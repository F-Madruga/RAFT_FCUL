import Promise from 'bluebird';
import axios from 'axios';
import { nanoid } from 'nanoid';
import { EventEmitter } from 'events';
import logger from '../utils/log.util';
import { Replica } from './replica';

import {
  RPCMethod,
  RPCAppendEntriesRequest,
  RPCRequestVoteResponse,
} from '../utils/rpc.util';
import { LogEntry, Log } from './log';

export enum RaftState {
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER',
  CANDIDATE = 'CANDIDATE',
}

export type StateMachineOptions = {
  host: string,
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

  private _currentTerm: number = 0;

  private _lastApplied: number = 0;

  private _log: Log = new Log();

  private _commitIndex: number = 0;

  constructor(options: StateMachineOptions) {
    super();
    this._state = options.initialState || RaftState.FOLLOWER;
    this._minimumElectionTimeout = options.minimumElectionTimeout || 150;
    this._maximumElectionTimeout = options.maximumElectionTimeout || 300;
    this._heartbeatTimeout = options.heartbeatTimeout || 50;
    this._host = options.host;
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
    this._numberVotes = 0;
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
    const lastEntry: LogEntry = this._log.getLogEntry(this._log.length - 1);
    const result = Promise
      .some(
        this._replicas.map((replica) => replica
          .requestVote(this._currentTerm, this._host, lastEntry.index, lastEntry.term)
          .then<RPCRequestVoteResponse>((response) => response.data)
          .tap((response) => {
            if (response.term > this._currentTerm) {
              // Update term
              result.cancel();
            }
            if (!response.voteGranted) {
              return Promise.reject(new Error());
            }
            return undefined;
          })),
        this._replicas.length / 2,
      )
      .then(() => this._replicas.map((replica) => replica
        .requestLeader(this._currentTerm, this._host,
          lastEntry.index, lastEntry.term, this._commitIndex)));
      // Update next index
      // Update raft state
    return result;
  };

  public vote = () => {
    if (this._state === RaftState.CANDIDATE) {
      this._numberVotes += 1;
      if (this._numberVotes > this._replicas.length / 2) {
        this._numberVotes = 0;
        if (this._electionTimer) clearTimeout(this._electionTimer);
        this.setState = RaftState.LEADER;
        const request: RPCLeaderRequest = {
          method: RPCMethod.LEADER_REQUEST,
          message: this._host,
          term: this._currentTerm,
        };
        return Promise.all(this._replicas
          .filter((s) => !s.startsWith(this._host.split(':')[0]))
          .map((server) => Promise
            .resolve(axios.post(`http://${server}`, request))
            .catch(() => undefined)))
          .then(() => this.startHeartbeatTimer());
      }
    }
    return undefined;
  };

  public setLeader = (leader: string, term: number) => {
    this._state = RaftState.FOLLOWER;
    this._votedFor = leader;
    this._currentTerm = term;
    logger.debug(`Changing leader: ${leader}`);
    this.startElectionTimer();
  };

  public replicate = (message: string, clientId: string) => {
    // TODO: fix this mess
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      term: this._currentTerm,
      index: this._lastApplied + 1,
      data: message,
      clientId,
      operationId: nanoid(),
      committed: false,
    };

    const appendRequest: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      entry: logEntry,
    };

    const commitRequest: RPCCommitEntriesRequest = {
      method: RPCMethod.COMMIT_ENTRIES_REQUEST,
      entry: logEntry,
    };

    Promise.all(this._replicas.filter((s) => !s.startsWith(this._host.split(':')[0])))
      .tap(() => logger.debug('Appending entry'))
      .tap(() => this.append(logEntry))
      .tap(() => logger.debug('Sending append entry request to the other servers'))
      .map((server) => Promise
        .resolve(axios.post('/', appendRequest, { baseURL: `http://${server}` }))
        .tap(() => logger.debug(`Append request sent to ${server}`)))
      // .tap(() => this.commitEntry())
      .tap(() => logger.debug('Sending commit entry request to the other servers'))
      .map((server) => Promise
        .resolve(axios.post('/', commitRequest, { baseURL: `http://${server}` }))
        .tap(() => logger.debug(`Commit request sent to ${server}`)));
    // const received: string[] = [];
    // sends to entry to all servers and appends
    // return Promise.all(this.servers
    //   .map((server) => new Promise((resolve, reject) => {
    //     const ws = new WebSocket(`ws://${server}`);
    //     const request: RPCAppendEntriesRequest | RPCCommitEntriesRequest = {
    //       method: entry.committed
    //         ? RPCMethod.COMMIT_ENTRIES_REQUEST : RPCMethod.APPEND_ENTRIES_REQUEST,
    //       entry,
    //     };
    //     return Promise
    //       .try(() => ws.send(JSON.stringify(request)))
    //       .then(() => {
    //         ws.onmessage = (event) => resolve(event.data);
    //         setTimeout(() => reject(), 5000);
    //       });
    //   })
    //     .then(() => {
    //       received.push(server);
    //       if ((received.length + 1) > (this.servers.length + 1) / 2) {
    //         entry.committed = true;
    //         this.log.push(entry);
    //         this.lastApplied += 1;
    //         return Promise.all(this.servers
    //           .filter((s) => received.includes(s))
    //           .map((s) => new Promise((resolve, reject) => {
    //             const ws = new WebSocket(`ws://${s}`);
    //             const request: RPCCommitEntriesRequest = {
    //               method: RPCMethod.COMMIT_ENTRIES_REQUEST,
    //               entry,
    //             };
    //             return Promise.try(() => ws.send(JSON.stringify(request)))
    //               .then(() => {
    //                 ws.onmessage = (event) => resolve(event.data);
    //                 setTimeout(() => reject(), 5000);
    //               });
    //           })));
    //       }
    //       return undefined;
    //     })));
  };

  private startHeartbeatTimer = () => {
    if (this._heartbeatTimer) clearTimeout(this._heartbeatTimer);
    const task = this.sendHeartBeat;
    this._heartbeatTimer = setTimeout(() => task(), this._heartbeatTimeout);
  };

  private sendHeartBeat = () => {
    const request: RPCHeartbeatRequest = {
      method: RPCMethod.HEARTBEAT_REQUEST,
    };
    this.startHeartbeatTimer();
    return Promise.all(this._replicas
      .filter((s) => !s.startsWith(this._host.split(':')[0]))
      .map((server) => Promise
        .resolve(axios.post(`http://${server}`, request))
        .then((response) => response.data)
        .catch(() => undefined)));
  };

  public append = (entry: LogEntry) => {
    this._log.addEntry(entry);
    this._currentTerm = entry.term;
    this._lastApplied = entry.index;
    logger.debug('Entry appended');
    // AppendEntries counts as a heartbeat
    // Add to log
    this.heartbeat();
  };

  // public commitEntry = () => {
  //   // TO DO
  //   logger.debug('Entry commited');
  // }

  public heartbeat = () => this.startElectionTimer();
}
