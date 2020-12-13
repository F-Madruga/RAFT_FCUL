import Promise from 'bluebird';
import axios from 'axios';
import { EventEmitter } from 'events';

import { Event } from '../utils/constants.util';
import logger from '../utils/log.util';
import {
  RPCAppendEntriesRequest,
  RPCAppendEntriesResponse,
  RPCMethod,
  RPCRequestVoteRequest,
  RPCRequestVoteResponse,
} from '../utils/rpc.util';
import { State } from './state';

export type ReplicaOptions = {
  host: string,
  port: number,
  state: State,
  heartbeatTimeout?: number;
};

export class Replica extends EventEmitter {
  private _host: string;
  private _port: number;
  private _nextIndex: number;
  private _matchIndex: number;
  private _timer?: NodeJS.Timeout;
  private _state: State;
  private _timeout: number;
  private _sending: boolean;

  constructor(options: ReplicaOptions) {
    super();
    this._host = options.host;
    this._port = options.port;
    this._nextIndex = 1;
    this._matchIndex = 0;
    this._state = options.state;
    this._timeout = options.heartbeatTimeout || 50;
    this._sending = false;
  }

  private RPCRequest = <T>(url: string, data: any) => Promise.resolve(axios.post(url, data))
    .then<T>((response) => response.data);

  public init = () => {
    this._nextIndex = this._state.getLastLogEntry().index + 1;
    // this._nextIndex = lastLogIndex + 1;
  };

  public get host() : string {
    return this._host;
  }

  public get port() : number {
    return this._port;
  }

  public get matchIndex() {
    return this._matchIndex || 0;
  }

  public set matchIndex(value: number) {
    this._matchIndex = value;
    this.emit(Event.MATCH_INDEX_CHANGED, value);
  }

  public toString = () => `${this._host}:${this._port}`;

  public start = () => {
    this.stop();
    this._timer = setTimeout(() => this.heartbeat(), this._timeout);
  };

  public stop = () => {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  };

  public heartbeat = () => {
    this.start();
    // logger.debug(`Leader = ${this._state.leader}, VOTED_FOR = ${this._state.votedFor}, TERM = ${this._state.currentTerm}`);
    return this.appendEntries();
  };

  public requestVote = (candidateId: string) => {
    const lastEntry = this._state.getLastLogEntry();
    logger.debug(`Requesting vote to ${this._host}`);
    const request: RPCRequestVoteRequest = {
      method: RPCMethod.REQUEST_VOTE_REQUEST,
      term: this._state.currentTerm,
      candidateId,
      lastLogIndex: lastEntry.index,
      lastLogTerm: lastEntry.term,
    };
    return this.RPCRequest<RPCRequestVoteResponse>(`http://${this.toString()}`, request);
  };

  public appendEntries = (): any => {
    if (this._sending) {
      return Promise.resolve();
    }
    this._sending = true;
    const lastEntry = this._state.getLastLogEntry();
    const start = this._state.log.findIndex((e) => e.index === this._nextIndex);
    const stop = this._state.log.findIndex((e) => e.index === lastEntry.index);
    const entries = this._state.log.slice(start, stop + 1);
    const request: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      term: this._state.currentTerm,
      leaderId: this._state.leader,
      prevLogIndex: lastEntry.index,
      prevLogTerm: lastEntry.term,
      entries,
      leaderCommit: this._state.commitIndex,
    };
    // if (entries.length > 0) {
    //   logger.debug(request);
    // }
    return this.RPCRequest<RPCAppendEntriesResponse>(`http://${this.toString()}`, request)
      .tap((response) => {
        // logger.debug(`Replica ${this.toString()} response: ${JSON.stringify(response, null, 2)}`);
        if (response.term <= this._state.currentTerm) {
          if (response.success) {
            this.matchIndex = lastEntry.index;
            this._nextIndex = lastEntry.index + 1;
            return Promise.resolve();
          }
          if (this._nextIndex > 1) {
            logger.debug(`NEXT_INDEX = ${this._nextIndex}`);
            this._nextIndex -= 1;
            return this.appendEntries();
          }
          return Promise.reject(new Error());
        }
        return response;
      })
      .then((response) => {
        this._sending = false;
        const currentLastEntry = this._state.getLastLogEntry();
        if (request.prevLogIndex !== currentLastEntry.index) {
          logger.debug(`REQUEST_PREV_LOG_INDEX = ${request.prevLogIndex}, LAST_ENTRY_INDEX = ${currentLastEntry.index}`);
          return this.appendEntries();
        }
        return response;
      })
      .catch(() => logger.debug(`Failed to send entries between index ${entries[0].index} and ${entries[entries.length - 1].index} to ${this.toString()}`));
  };

  // public appendEntries = (term: number, leaderId: string, prevLogTerm: number,
  //   leaderCommit: number, log: LogEntry[],
  //   lastLogIndex: number = this.nextIndex - 1): Promise<RPCAppendEntriesResponse> => {
  //   this.nextIndex = lastLogIndex + 1;
  //   // logger.debug(`Sending entries to ${this._host}: ${this._nextIndex}, ${this._matchIndex}`);
  //   const request: RPCAppendEntriesRequest = {
  //     method: RPCMethod.APPEND_ENTRIES_REQUEST,
  //     term,
  //     leaderId,
  //     entries: log.slice((log[this.nextIndex - 1] || {}).index || 0, log.length),
  //     prevLogIndex: (log[this.nextIndex - 1] || {}).index || 0,
  //     prevLogTerm,
  //     leaderCommit,
  //   };
  //   return this.RPCRequest<RPCAppendEntriesResponse>(`http://${this._host}:${this._port}`, request)
  //     .then((response) => {
  //       if (this.nextIndex <= 0) {
  //         this.nextIndex = this.matchIndex + 1;
  //         return response;
  //       }
  //       if (response.success === false) {
  //         this.nextIndex -= 1;
  //         logger.debug('Resending request');
  //         return this.appendEntries(term, leaderId, prevLogTerm, leaderCommit, log);
  //       }
  //       this.matchIndex += request.entries.length;
  //       this.nextIndex = this.matchIndex + 1;
  //       return response;
  //     });
  // };
}
