import { EventEmitter } from 'events';

import logger from '../utils/log.util';
import { Event } from '../utils/constants.util';
import { Log } from './log';
import { ready, State as StateModel } from './database';
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
  private _log: Log;
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
    this._log = new Log();
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
      .then(() => this._log.ready)
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

  public toString = () => `State = ${this._state}, CurrentTerm = ${this._currentTerm}, LastLogEntryIndex = ${this._log.getLastEntry().index}, CommitIndex = ${this._commitIndex}, LastApplied = ${this._lastApplied}`;

  public isRead = (message: string) => this._store.isRead(message);

  public apply = (message: string) => {
    const response = this._store.apply(message);
    this._lastApplied += 1;
    logger.debug(`LastApplied updated: ${this.toString()}`);
    return response;
  };
}
