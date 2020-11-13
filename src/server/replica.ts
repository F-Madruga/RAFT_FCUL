import Promise from 'bluebird';
import axios from 'axios';
import {
  RPCMethod,
  RPCAppendEntriesRequest,
  RPCAppendEntriesResponse,
  RPCRequestVoteRequest,
  RPCRequestVoteResponse,
} from '../utils/rpc.util';
import { LogEntry } from './log';

export type ReplicaOptions = {
  host: string,
  port: number,
  lastLogIndex: number,
};

export class Replica {
  private _host: string;

  private _port: number;

  private _nextIndex: number;

  private _matchIndex: number;

  constructor(options: ReplicaOptions) {
    this._host = options.host;
    this._port = options.port;
    this._nextIndex = options.lastLogIndex + 1;
    this._matchIndex = 0;
  }

  public get host() : string {
    return this._host;
  }

  public get port() : number {
    return this._port;
  }

  public get nextIndex() : number {
    return this._nextIndex;
  }

  public get matchIndex() : number {
    return this._matchIndex;
  }

  public set nextIndex(leaderLastIndex : number) {
    this._nextIndex = leaderLastIndex + 1;
  }

  private RPCRequest = <T>(url: string, data: any) => Promise.resolve(axios.post(url, data))
    .then<T>((response) => response.data);

  public requestVote = (term: number, candidateId: string,
    lastLogIndex: number, lastLogTerm: number) => {
    const request: RPCRequestVoteRequest = {
      method: RPCMethod.REQUEST_VOTE_REQUEST,
      term,
      candidateId,
      lastLogIndex,
      lastLogTerm,
    };
    return this.RPCRequest<RPCRequestVoteResponse>(`http://${this._host}:${this._port}`, request);
  };

  public appendEntries = (term: number, leaderId: string, prevLogTerm: number, leaderCommit: number,
    log: LogEntry[], nextIndex: number = this.nextIndex): Promise<RPCAppendEntriesResponse> => {
    this._nextIndex = nextIndex;
    const request: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      term,
      leaderId,
      entries: log.slice(this._nextIndex, log.length),
      prevLogIndex: this._nextIndex,
      prevLogTerm,
      leaderCommit,
    };
    console.log('Replica:', this._host);
    console.log('Leader log:', log);
    console.log('New entries:', request.entries);
    console.log('Next index:', this._nextIndex);
    console.log('Match index:', this._matchIndex);
    return this.RPCRequest<RPCAppendEntriesResponse>(`http://${this._host}:${this._port}`, request)
      .then((response) => {
        if (response.success === false && this._nextIndex > 0) {
          this._nextIndex -= 1;
          return this.appendEntries(term, leaderId, prevLogTerm, leaderCommit, log);
        }
        this._matchIndex += request.entries.length;
        this._nextIndex = this._matchIndex + 1;
        return response;
      });
  };
}
