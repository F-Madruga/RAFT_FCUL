import Promise from 'bluebird';
import { nanoid } from 'nanoid';
import { EventEmitter } from 'events';
import logger from '../utils/log.util';
import { Replica } from './replica';

import { LogEntry } from './log';

export enum RaftState {
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER',
  CANDIDATE = 'CANDIDATE',
}

export type StateMachineOptions = {
  host: string,
  port: number,
  replicas: Replica[],
  initialState?: RaftState,
  minimumElectionTimeout?: number,
  maximumElectionTimeout?: number,
  heartbeatTimeout?: number,
};

export class StateMachine extends EventEmitter {
  private _state: RaftState;

  private _electionTimer?: NodeJS.Timeout;

  private _heartbeatTimer?: NodeJS.Timeout;

  private _minimumElectionTimeout: number;

  private _maximumElectionTimeout: number;

  private _heartbeatTimeout: number;

  private _numberVotes: number = 0;

  private _replicas: Replica[];

  private _host: string;

  private _votedFor?: string;

  private _port: number;

  private _currentTerm: number = 0;

  private _lastApplied: number = 0;

  private _log: LogEntry[] = [];

  private _commitIndex: number = 0;

  constructor(options: StateMachineOptions) {
    super();
    this._state = options.initialState || RaftState.FOLLOWER;
    this._minimumElectionTimeout = options.minimumElectionTimeout || 150;
    this._maximumElectionTimeout = options.maximumElectionTimeout || 300;
    this._heartbeatTimeout = options.heartbeatTimeout || 50;
    this._host = options.host;
    this._port = options.port;
    this._replicas = options.replicas;
    this.startElectionTimer();
  }

  private set setState(state: RaftState) {
    this._state = state;
    this.emit('state', this._state);
  }

  public get state() { return this._state; }

  public get votedFor() { return this._votedFor; }

  public get currentTerm() { return this._currentTerm; }

  public get lastApplied() { return this._lastApplied; }

  private startElectionTimer = () => {
    if (this._electionTimer) clearTimeout(this._electionTimer);
    const task = this.startElection;
    this._electionTimer = setTimeout(() => task(), Math.floor(Math.random()
      * (this._maximumElectionTimeout - this._minimumElectionTimeout + 1))
      + this._minimumElectionTimeout);
  };

  private startElection = () => {
    this._state = RaftState.CANDIDATE;
    this._currentTerm += 1;
    this._votedFor = this._host;
    this.startElectionTimer();
    // this.vote();
    // const request: RPCRequestVoteRequest = {
    //   method: RPCMethod.REQUEST_VOTE_REQUEST,
    //   term: this._currentTerm,
    //   index: this._lastApplied,
    // };
    // return Promise.all(this._replicas
    //   .filter((s) => !s.startsWith(this._host.split(':')[0]))
    //   .map((server) => Promise
    //     .resolve(axios.post(`http://${server}`, request))
    //     .then((response) => response.data)
    //     .tap((response: RPCVoteResponse) => response.vote === true && this.vote())
    //     .catch(() => undefined)));
    const lastEntry: LogEntry = this._log[this._log.length - 1];
    const result = Promise
      .some(
        this._replicas.map((replica) => replica
          .requestVote(this._currentTerm, this._host, lastEntry.index, lastEntry.term)
          .tap((response) => {
            // if (response.term > this._currentTerm) {
            //   // Update term
            //   result.cancel();
            // }
            if (!response.voteGranted) {
              return Promise.reject(new Error());
            }
            return undefined;
          })),
        this._replicas.length / 2,
      )
      .then(() => {
        this.setState = RaftState.LEADER;
        this._votedFor = undefined;
      })
      .then(() => this._replicas
        .map((replica) => replica
          .appendEntries(this._currentTerm, this._host, lastEntry.term,
            this._commitIndex, this._log, this._lastApplied)))
      .then(() => this.startHeartbeatTimer());
    return result;
  };

  // public vote = () => {
  //   if (this._state === RaftState.CANDIDATE) {
  //     this._numberVotes += 1;
  //     if (this._numberVotes > this._replicas.length / 2) {
  //       this._numberVotes = 0;
  //       if (this._electionTimer) clearTimeout(this._electionTimer);
  //       this.setState = RaftState.LEADER;
  //       const request: RPCLeaderRequest = {
  //         method: RPCMethod.LEADER_REQUEST,
  //         message: this._host,
  //         term: this._currentTerm,
  //       };
  //       return Promise.all(this._replicas
  //         .filter((s) => !s.startsWith(this._host.split(':')[0]))
  //         .map((server) => Promise
  //           .resolve(axios.post(`http://${server}`, request))
  //           .catch(() => undefined)))
  //         .then(() => this.startHeartbeatTimer());
  //     }
  //   }
  //   return undefined;
  // };

  public setLeader = (leader: string, term: number) => {
    this._state = RaftState.FOLLOWER;
    this._votedFor = leader;
    this._currentTerm = term;
    logger.debug(`Changing leader: ${leader}`);
    this.startElectionTimer();
  };

  public replicate = (message: string, clientId: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      term: this._currentTerm,
      index: this._lastApplied + 1,
      data: message,
      clientId,
      operationId: nanoid(),
      leaderId: this._host,
    };
    this._log.push(entry);
    return new Promise((execute) => Promise
      .some(
        this._replicas.map((replica) => replica
          .appendEntries(this._currentTerm, this._host, entry.term,
            this._commitIndex, this._log)),
        this._replicas.length / 2,
      )
      .then(() => execute())
      // .then(() => this._commitIndex++)
      .then(() => this._replicas.map((replica) => replica
        .appendEntries(this._currentTerm, this._host, entry.term,
          this._commitIndex, this._log))));
  };

  private startHeartbeatTimer = () => {
    if (this._heartbeatTimer) clearTimeout(this._heartbeatTimer);
    const task = this.heartbeat;
    this._heartbeatTimer = setTimeout(() => task(), this._heartbeatTimeout);
    // stop heartbeat timer if new leader is elected (replica is now follower)
  };

  private heartbeat = () => {
    const lastEntry: LogEntry = this._log[this._log.length - 1];
    this.startHeartbeatTimer();
    return Promise.all(this._replicas)
      .map((replica) => replica
        .appendEntries(this._currentTerm, this._host, lastEntry.term,
          this._commitIndex, this._log));
  };

  public append = (entry: LogEntry) => {
    this._log.push(entry);
    this._currentTerm = entry.term;
    this._lastApplied = entry.index;
    logger.debug('Entry appended');
    // AppendEntries counts as a heartbeat
    // Add to log
    this.heartbeat();
  };
}
