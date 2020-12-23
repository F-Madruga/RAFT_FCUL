import Promise from 'bluebird';
import axios, { CancelTokenSource, CancelToken } from 'axios';
import { EventEmitter } from 'events';

import { Event } from '../utils/constants.util';
import logger from '../utils/log.util';
import {
  RPCAppendEntriesRequest,
  RPCAppendEntriesResponse,
  RPCInstallSnapshotRequest,
  RPCMethod,
  RPCRequestVoteRequest,
  RPCRequestVoteResponse,
} from '../utils/rpc.util';
import { RaftState, State } from './state';
import { LogEntry } from './log';

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
  private _requesting: CancelTokenSource;

  constructor(options: ReplicaOptions) {
    super();
    this._host = options.host;
    this._port = options.port;
    this._nextIndex = 1;
    this._matchIndex = 0;
    this._state = options.state;
    this._timeout = options.heartbeatTimeout || 50;
    this._sending = false;
    this._requesting = axios.CancelToken.source();
  }

  private RPCRequest = <T>(url: string, data: any, cancelToken?: CancelToken) => Promise
    .resolve(axios.post(url, data, { ...(cancelToken ? { cancelToken } : {}) }))
    .then<T>((response) => response.data);

  public init = () => {
    this._nextIndex = this._state.log.getLastEntry().index + 1;
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
    this._sending = false;
    return this.appendEntries();
  };

  public requestVote = (candidateId: string) => {
    const lastEntry = this._state.log.getLastEntry();
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
      return undefined;
    }
    this._sending = true;
    this.start();
    return Promise.resolve(this._nextIndex >= ((this._state.log.entries[0] || {}).index || 0)
      ? this._state.log.slice(this._nextIndex)
      : this.installSnapshot()
        .then(() => this._state.log.entries))
      .then((entries) => {
        const previousEntry = this._state.log.getEntryByIndex(this._nextIndex - 1) || {
          term: 0,
          index: 0,
        } as LogEntry;
        const request: RPCAppendEntriesRequest = {
          method: RPCMethod.APPEND_ENTRIES_REQUEST,
          term: this._state.currentTerm,
          leaderId: this._state.leader,
          prevLogIndex: previousEntry.index,
          prevLogTerm: previousEntry.term,
          entries,
          leaderCommit: this._state.commitIndex,
        };
        this._requesting.cancel();
        this._requesting = axios.CancelToken.source();
        return this.RPCRequest<RPCAppendEntriesResponse>(`http://${this.toString()}`,
          request, this._requesting.token)
          .tap((response) => Promise.try(() => {
            if (response.term <= this._state.currentTerm) {
              if (response.success) {
                if (entries.length > 0) {
                  this._nextIndex += entries.length;
                  this.matchIndex = this._nextIndex - 1;
                }
                return response;
              }
              if (this._nextIndex > this._matchIndex + 1) {
                logger.debug(`Trying to send entries again to replica ${this._host}`);
                this._nextIndex -= 1;
                this._sending = false;
                return this.appendEntries();
              }
              this._nextIndex = 0;
              this._sending = false;
              return this.appendEntries();
            }
            this._state.state = RaftState.FOLLOWER;
            this._state.setCurrentTerm(response.term);
            return response;
          })
            .then(() => {
              this._sending = false;
              const lastEntry = this._state.log.getLastEntry();
              if (this._matchIndex < lastEntry.index) {
                return this.appendEntries();
              }
              return response;
            }));
      })
      .catch(() => {
        this._sending = false;
      });
  };

  public installSnapshot = () => {
    const snapshot = this._state.getSnapshot();
    const request: RPCInstallSnapshotRequest = {
      method: RPCMethod.INSTALL_SNAPSHOT_REQUEST,
      term: this._state.currentTerm,
      leaderId: this._state.leader,
      lastIncludedIndex: snapshot.lastIncludedIndex,
      lastIncludedTerm: snapshot.lastIncludedTerm,
      offset: 0,
      data: JSON.stringify(snapshot.data),
      done: true,
    };
    this._requesting.cancel();
    this._requesting = axios.CancelToken.source();
    return this.RPCRequest<RPCAppendEntriesResponse>(`http://${this.toString()}`,
      request, this._requesting.token)
      .catch(() => undefined);
  };
}
