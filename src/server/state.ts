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
  servers: string[],
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

  private _log: LogEntry[];

  private _toCommit: { resolve: null | ((result?: any) => void) }[] = [];

  private _commitIndex: number = 0;

  constructor(options: StateMachineOptions) {
    super();
    this._state = options.initialState || RaftState.FOLLOWER;
    this._minimumElectionTimeout = options.minimumElectionTimeout || 150;
    this._maximumElectionTimeout = options.maximumElectionTimeout || 300;
    this._heartbeatTimeout = options.heartbeatTimeout || 50;
    this._host = options.host;
    this._port = options.port;
    this._log = []; // check disk for log
    this._replicas = options.servers.map((server) => new Replica({
      host: server,
      port: this._port,
      lastLogIndex: (this._log[this._log.length - 1] || {}).index || 0,
    }));
    this.startElectionTimer();
  }

  private set setState(state: RaftState) {
    this._state = state;
    this.emit('state', this._state);
  }

  public get state() { return this._state; }

  public get log() { return this._log; }

  public get votedFor() { return this._votedFor; }

  public get currentTerm() { return this._currentTerm; }

  public get lastApplied() { return this._lastApplied; }

  public get commitIndex() { return this._commitIndex; }

  public set commitIndex(index: number) { this._commitIndex = index; }

  private startElectionTimer = () => {
    // logger.debug('Start election timer');
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
    const lastEntry: LogEntry = this._log[this._log.length - 1];
    const result = Promise
      .some(
        this._replicas.map((replica) => replica
          .requestVote(this._currentTerm, this._host,
            (lastEntry || {}).index || 0, (lastEntry || {}).term || this._currentTerm)
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
        Math.ceil(this._replicas.length / 2),
      )
      .then(() => {
        this.setState = RaftState.LEADER;
        this._votedFor = undefined;
        if (this._electionTimer) clearTimeout(this._electionTimer);
      })
      .then(() => this._replicas
        .map((replica) => replica
          .appendEntries(this._currentTerm, this._host, (lastEntry || {}).term || this._currentTerm,
            this._commitIndex, this._log, (this._log[this._log.length - 1] || {}).index + 1 || 1)))
      .then(() => this.startHeartbeatTimer())
      .catch(() => logger.debug('Not enough votes'));
    return result;
  };

  public vote = (candidateId: string, term: number, lastLogIndex: number) => {
    if (term >= this.currentTerm
      && (!this._votedFor || this._votedFor === candidateId)
      && lastLogIndex >= ((this._log[this._log.length - 1] || {}).index || 0)) {
      this._votedFor = candidateId;
      return true;
    }
    return false;
    // // vote NO if: local term is greater OR (term is equal AND local index is greater)
    // if (((this._votedFor || this._votedFor !== candidateId) && this._currentTerm <= term)
    //   || this._currentTerm > term
    //   || (this._currentTerm === term && this._lastApplied > lastLogIndex)) {
    //   return false;
    // }
    // // vote YES otherwise
    // this._votedFor = candidateId;
    // return true;
  };

  public setLeader = (leader: string, term: number) => {
    this._state = RaftState.FOLLOWER;
    if (this._currentTerm !== term) this._votedFor = undefined;
    this._currentTerm = term;
    // logger.debug(`Changing leader: ${leader}`);
    if (this._heartbeatTimer) clearTimeout(this._heartbeatTimer);
    this.startElectionTimer();
  };

  private commit = () => {
    for (let i = 0; i < this._toCommit.length; i++) {
      if ((this._toCommit[i] || {}).resolve !== null) {
        this._toCommit[i].resolve!();
      } else {
        this._toCommit = this._toCommit.slice(i, this._toCommit.length);
        break;
      }
    }
  };

  public replicate = (message: string, clientId: string) => {
    this.startHeartbeatTimer();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      term: this._currentTerm,
      index: this._log.length + 1,
      data: message,
      clientId,
      operationId: nanoid(),
      leaderId: this._host,
    };
    this._log.push(entry);
    logger.debug(this._log);
    const commitPromise: { resolve: null | ((result?: any) => void) } = { resolve: null };
    this._toCommit.push(commitPromise);
    return new Promise((execute) => Promise
      .some(
        this._replicas.map((replica) => replica
          .appendEntries(this._currentTerm, this._host, entry.term,
            this._commitIndex, this._log)),
        Math.ceil(this._replicas.length / 2),
      )
      .then(() => new Promise((resolve) => {
        commitPromise.resolve = resolve;
        return this.commit();
      }))
      .then(() => this._commitIndex++)
      .then(() => execute())
      .then(() => this._lastApplied++)
      .then(() => this._replicas.map((replica) => replica
        .appendEntries(this._currentTerm, this._host, entry.term,
          this._commitIndex, this._log))));
  };

  private startHeartbeatTimer = () => {
    // logger.debug('Start heartbeat timer');
    if (this._heartbeatTimer) clearTimeout(this._heartbeatTimer);
    const task = this.heartbeat;
    this._heartbeatTimer = setTimeout(() => task(), this._heartbeatTimeout);
    // stop heartbeat timer if new leader is elected (replica is now follower)
  };

  private heartbeat = () => {
    const lastEntry: LogEntry = this._log[this._log.length - 1];
    // logger.debug('Sending heartbeat');
    this.startHeartbeatTimer();
    return Promise.all(this._replicas)
      .map((replica) => replica
        .appendEntries(this._currentTerm, this._host, (lastEntry || {}).term || this._currentTerm,
          this._commitIndex, this._log));
  };

  public append = (entry: LogEntry) => {
    if (this._log[entry.index - 1] && this._log[entry.index - 1].term !== entry.term) {
      this._log = this._log.slice(0, entry.index);
    }
    this._log.push(entry);
    this._currentTerm = entry.term;
    this._lastApplied = entry.index;
    logger.debug(this._log);
  };
}
