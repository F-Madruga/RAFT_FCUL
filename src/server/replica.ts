import Promise from 'bluebird';
import axios from 'axios';
import { RPCAppendEntriesRequest, RPCCommitEntriesRequest, RPCMethod } from '../utils/rpc.util';
import { LogEntry } from './log';

export type ReplicaOptions = {
  host: string,
  port: number,
  leaderLastIndex: number,
};

export class Replica {
  private _host: string;

  private _port: number;

  private _nextIndex: number;

  private _matchIndex: number;

  constructor(options: ReplicaOptions) {
    this._host = options.host;
    this._port = options.port;
    this._nextIndex = options.leaderLastIndex + 1;
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

  public appendEntry = (entry: LogEntry) => {
    const request: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      entry,
    };
    return Promise.resolve(axios.post('/', request, { baseURL: `http://${this._host}:${this._port}` }))
      .then(() => this._matchIndex++);
  };

  public commitEntry = (entry: LogEntry) => {
    const request: RPCCommitEntriesRequest = {
      method: RPCMethod.COMMIT_ENTRIES_REQUEST,
      entry,
    };
    return Promise.resolve(axios.post('/', request, { baseURL: `http://${this._host}:${this._port}` }));
  };
}
