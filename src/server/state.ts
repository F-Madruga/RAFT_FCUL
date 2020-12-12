import { EventEmitter } from 'events';

import { Replica } from './replica';
import { LogEntry } from './log';
import { ready, State as StateModel, Log as LogModel } from './database';

export enum RaftState {
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER',
  CANDIDATE = 'CANDIDATE',
}

export type StateOptions = {
  host: Replica,
  replicas: Replica[],
};

export class State extends EventEmitter {
  private _state: RaftState;
  private _host: Replica;
  // Persistent state on all servers
  private _currentTerm: number = 0;
  private _votedFor?: string;
  private _log: LogEntry[] = [];
  // Volatile state on all servers
  private _commitIndex: number;
  private _lastApplied: number;
  // Volatile state on leaders
  private _replicas: Replica[];

  constructor(options: StateOptions) {
    super();
    this._state = RaftState.FOLLOWER;
    this._host = options.host;
    // Persistent state on all servers
    ready.then(() => StateModel.findOne({ raw: true }))
      .catch(() => undefined)
      .then((state: any) => state || {
        currentTerm: 0,
        votedFor: undefined,
      })
      .then((state) => {
        this._currentTerm = state.currentTerm;
        this._votedFor = state.votedFor;
      })
      .then(() => LogModel.findAll({ raw: true }))
      .catch(() => undefined)
      .then((logs) => { this._log = logs as any[]; });
    // Volatile state on all servers
    this._commitIndex = 0;
    this._lastApplied = 0;
    // Volatile state on leaders
    this._replicas = options.replicas;
  }

  public get state() {
    return this._state;
  }

  public set state(value: RaftState) {
    this._state = value;
    this.emit('stateChanged', this._state);
  }

  public get host() {
    return this._host;
  }

  public get currentTerm() {
    return this._currentTerm;
  }

  public get votedFor() {
    return this._votedFor;
  }

  public setLeader(currentTerm: number, votedFor: string) {
    this._currentTerm = currentTerm;
    this._votedFor = votedFor;
    const state = {
      currentTerm,
      votedFor,
    };
    if (this._votedFor === undefined) {
      return ready.then(() => StateModel.create(state));
    }
    return ready.then(() => StateModel.update(state, { where: {} }));
  }

  public get log() {
    return this._log;
  }

  public addLogEntry(entry: LogEntry) {
    if (this._log.length > 0
      && this._log[this._log.length - 1].index >= entry.index) {
      const i = this._log.findIndex((e) => e.index === entry.index);
      this._log[i] = entry;
      return ready.then(() => LogModel.update(entry, { where: { index: entry.index } }));
    }
    this._log.push(entry);
    return ready.then(() => LogModel.create(entry));
  }

  public get commitIndex() {
    return this._commitIndex;
  }

  public set commitIndex(value: number) {
    this._commitIndex = value;
  }

  public get lastApplied() {
    return this._lastApplied;
  }

  public set lastApplied(value: number) {
    this._lastApplied = value;
  }

  public get replicas() {
    return this._replicas;
  }
}

// private _toCommit: { resolve: null | ((result?: any) => void) }[] = [];
