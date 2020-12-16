import { EventEmitter } from 'events';

import logger from '../utils/log.util';
import { Event } from '../utils/constants.util';
import { LogEntry } from './log';
import { ready, State as StateModel, Log as LogModel } from './database';
import { IRaftStore } from './store';

export enum RaftState {
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER',
  CANDIDATE = 'CANDIDATE',
}

export type StateOptions = {
  // host: Replica,
  // replicas: Replica[],
  state?: RaftState,
  leader?: string,
  store: IRaftStore,
};

export class State extends EventEmitter {
  private _state: RaftState;
  private _leader: string;
  // Persistent state on all servers
  private _currentTerm: number = 0;
  private _votedFor?: string;
  private _log: LogEntry[] = [];
  // Volatile state on all servers
  private _commitIndex: number;
  private _lastApplied: number;
  // Volatile state on leaders
  // private _replicas: Replica[];
  private _store: IRaftStore;
  private _ready: Promise<any>;

  constructor(options: StateOptions) {
    super();
    this._state = options.state || RaftState.FOLLOWER;
    this._leader = options.leader || '';
    // Persistent state on all servers
    this._ready = ready
      .then(() => StateModel.findOne({ raw: true }))
      .catch(() => undefined)
      .then((state: any) => state || StateModel.create({
        currentTerm: 0,
        votedFor: undefined,
      }, { raw: true }))
      .then((state) => {
        this._currentTerm = state.currentTerm;
        this._votedFor = state.votedFor;
      })
      .then(() => LogModel.findAll({ raw: true }))
      .then((logs) => { this._log = logs as any[]; })
      .tap(() => logger.debug(`Database synched: ${this.toString()}`))
      .tapCatch((e) => logger.error(`Error preparing State: ${e.message}`))
      .catch(() => process.exit(1));
    // Volatile state on all servers
    this._commitIndex = 0;
    this._lastApplied = 0;
    // Volatile state on leaders
    this._store = options.store;
  }

  public get state() {
    return this._state;
  }

  public set state(value: RaftState) {
    if (value !== this._state) {
      logger.debug(`Changing state: ${value}`);
    }
    this._state = value;
    this.emit(Event.STATE_CHANGED, this._state);
  }

  public get leader() {
    return this._leader;
  }

  public set leader(value: string) {
    if (this.leader !== value) {
      logger.debug(`Leader set to ${value}`);
    }
    this._leader = value;
  }

  public get currentTerm() {
    return this._currentTerm;
  }

  public get votedFor() {
    return this._votedFor;
  }

  public setCurrentTerm = (currentTerm: number) => {
    if (currentTerm > this._currentTerm) {
      this._currentTerm = currentTerm;
      this._votedFor = undefined;
      const state = {
        currentTerm: this._currentTerm,
        votedFor: null,
      };
      return ready.then(() => StateModel.update(state, { where: {} }));
    }
    return Promise.resolve();
  };

  public setVotedFor(votedFor: string | undefined) {
    if (this._votedFor !== votedFor) {
      logger.debug(`VotedFor set to ${votedFor}`);
    }
    this._votedFor = votedFor;
    return ready.then(() => StateModel.update({ votedFor }, { where: {} }));
  }

  public get log() {
    return this._log;
  }

  public getLastLogEntry = () => (this._log[this._log.length - 1] || {
    term: 0,
    index: 0,
  } as LogEntry);

  public getLogEntry = (index: number) => this._log.find((entry) => entry.index === index);

  /**
   * Slice with inclusive end
   * @param end Inclusive end
   */
  public logSlice = (start: number, end?: number) => {
    const startIndex = this._log.findIndex((e) => e.index === start);
    const endIndex = end !== undefined
      ? this._log.findIndex((e) => e.index === end) : undefined;
    if (startIndex >= 0 && (endIndex || 0) >= 0) {
      return this._log.slice(startIndex, endIndex ? endIndex + 1 : undefined);
    }
    return [];
  };

  public addLogEntry = (entry: LogEntry) => {
    if (this._log.length > 0
      && this._log[this._log.length - 1].index >= entry.index) {
      const i = this._log.findIndex((e) => e.index === entry.index);
      this._log[i] = entry;
      return ready.then(() => LogModel.update(entry, { where: { index: entry.index } }))
        .then(() => undefined);
    }
    this._log.push(entry);
    return ready.then(() => LogModel.create(entry))
      .then(() => undefined);
  };

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

  public get ready() {
    return this._ready;
  }

  public toString = () => `State = ${this._state}, CurrentTerm = ${this._currentTerm}, LastLogEntryIndex = ${this.getLastLogEntry().index}, CommitIndex = ${this._commitIndex}, LastApplied = ${this._lastApplied}`;

  public isRead = (message: string) => this._store.isRead(message);

  public apply = (message: string) => {
    const response = this._store.apply(message);
    this._lastApplied += 1;
    return response;
  };
}
