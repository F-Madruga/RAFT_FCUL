import Promise from 'bluebird';
import axios from 'axios';
import {
  RPCAppendEntriesRequest, RPCMethod, RPCRequestVoteRequest,
} from '../utils/rpc.util';
import { LogEntry } from './log';

export type ReplicaOptions = {
  host: string,
  port: number,
};

export class Replica {
  private _host: string;

  private _port: number;

  private _nextIndex: number;

  private _matchIndex: number;

  constructor(options: ReplicaOptions) {
    this._host = options.host;
    this._port = options.port;
    this._nextIndex = 0;
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

  public heartbeat = (term: number, leaderId: string,
    prevLogIndex: number, prevLogTerm: number,
    leaderCommit: number) => {
    const request: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      term,
      leaderId,
      prevLogIndex,
      prevLogTerm,
      entries: [],
      leaderCommit,
    };
    return Promise.resolve(axios.post('/', request, { baseURL: `http://${this._host}:${this._port}` }));
  };

  public requestVote = (term: number, candidateId: string,
    lastLogIndex: number, lastLogTerm: number) => {
    const request: RPCRequestVoteRequest = {
      method: RPCMethod.REQUEST_VOTE_REQUEST,
      term,
      candidateId,
      lastLogIndex,
      lastLogTerm,
    };
    return Promise.resolve(axios.post('/', request, { baseURL: `http://${this._host}:${this._port}` }));
  };

  public requestLeader = (term: number, leaderId: string,
    prevLogIndex: number, prevLogTerm: number,
    leaderCommit: number) => {
    const request: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      term,
      leaderId,
      prevLogIndex,
      prevLogTerm,
      entries: [],
      leaderCommit,
    };
    return Promise.resolve(axios.post('/', request, { baseURL: `http://${this._host}:${this._port}` }));
  };

  public appendEntry = (term: number, leaderId: string,
    prevLogIndex: number, prevLogTerm: number, entries: LogEntry[],
    leaderCommit: number) => {
    const request: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      term,
      leaderId,
      prevLogIndex,
      prevLogTerm,
      entries,
      leaderCommit,
    };
    return Promise.resolve(axios.post('/', request, { baseURL: `http://${this._host}:${this._port}` }))
      .then(() => { this._matchIndex += entries.length; });
  };

  public commitEntry = (term: number, leaderId: string,
    prevLogIndex: number, prevLogTerm: number,
    leaderCommit: number) => {
    const request: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      term,
      leaderId,
      prevLogIndex,
      prevLogTerm,
      entries: [],
      leaderCommit,
    };
    return Promise.resolve(axios.post('/', request, { baseURL: `http://${this._host}:${this._port}` }));
  };
}
