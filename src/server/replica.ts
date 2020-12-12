import Promise from 'bluebird';
import axios from 'axios';

import logger from '../utils/log.util';
import {
  RPCAppendEntriesRequest,
  RPCMethod,
  RPCRequestVoteRequest,
  RPCRequestVoteResponse,
} from '../utils/rpc.util';
import { LogEntry } from './log';

export type ReplicaOptions = {
  host: string,
  port: number,
};

export class Replica {
  private _host: string;
  private _port: number;
  private _nextIndex?: number;
  private _matchIndex?: number;

  constructor(options: ReplicaOptions) {
    this._host = options.host;
    this._port = options.port;
  }
  private RPCRequest = <T>(url: string, data: any) => Promise.resolve(axios.post(url, data))
    .then<T>((response) => response.data);

  public init = (lastLogIndex: number) => {
    this._nextIndex = lastLogIndex + 1;
    this._matchIndex = 0;
  };

  public get host() : string {
    return this._host;
  }

  public get port() : number {
    return this._port;
  }

  public toString = () => `${this._host}:${this._port}`;

  public requestVote = (term: number, candidateId: string,
    lastLogIndex: number, lastLogTerm: number) => {
    logger.debug(`Requesting vote to ${this._host}`);
    const request: RPCRequestVoteRequest = {
      method: RPCMethod.REQUEST_VOTE_REQUEST,
      term,
      candidateId,
      lastLogIndex,
      lastLogTerm,
    };
    return this.RPCRequest<RPCRequestVoteResponse>(`http://${this.toString()}`, request);
  };

  public appendEntries = (term: number, leaderId: string,
    prevLogIndex: number, prevLogTerm: number, log: LogEntry[], leaderCommit: number) => {
    // const start = log.findIndex((e) => e.index === this._nextIndex);
    // const entries = log.slice(start, log.length);
    const request: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      term,
      leaderId,
      prevLogIndex,
      prevLogTerm,
      entries: [],
      leaderCommit,
    };
    return this.RPCRequest<RPCAppendEntriesRequest>(`http://${this.toString()}`, request);
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
