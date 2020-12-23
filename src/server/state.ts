import { EventEmitter } from 'events';
import { Mutex } from 'async-mutex';
import logger from '../utils/log.util';
import { Event } from '../utils/constants.util';
import { Log, LogEntry } from './log';
import { ready, State as StateModel, Snapshot as SnapshotModel } from './database';
import { IRaftStore } from './store';

export enum RaftState {
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER',
  CANDIDATE = 'CANDIDATE',
}

export type Snapshot = {
  lastIncludedIndex: number,
  lastIncludedTerm: number,
  data: { [key: string]: string },
};

export type StateOptions = {
  // host: Replica,
  // replicas: Replica[],
  state?: RaftState,
  leader?: string,
  store: IRaftStore,
  snapshotSize?: number,
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
  private _lastIncludedIndex: number;
  private _lastIncludedTerm: number;
  private _snapshot: { [key: string]: string };
  private _snapshotSize: number;
  private _mutex: Mutex;
  private _snapshotting: Promise<any>;

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
        lastIncludedIndex: 0,
        lastIncludedTerm: 0,
      }, { raw: true }))
      .then((state) => {
        this._currentTerm = state.currentTerm;
        this._votedFor = state.votedFor;
        this._lastIncludedIndex = state.lastIncludedIndex;
        this._lastIncludedTerm = state.lastIncludedTerm;
        this._lastApplied = state.lastIncludedIndex;
      })
      .then(() => this._log.ready)
      .then(() => SnapshotModel.findAll({ raw: true }))
      .then((rows) => {
        const data = rows.reduce((acc, { key, value }: any) => ({ ...acc, [key]: value }), {});
        this._snapshot = data;
        this._store.install(data);
      })
      .tap(() => logger.debug(`Database synched: ${this.toString()}`))
      .tapCatch((e) => logger.error(`Error preparing State: ${e.message}`))
      .catch(() => process.exit(1));
    // Volatile state on all servers
    this._commitIndex = 0;
    this._lastApplied = 0;
    // Volatile state on leaders
    this._store = options.store;
    this._lastIncludedIndex = 0;
    this._lastIncludedTerm = 0;
    this._snapshot = {};
    this._snapshotSize = options.snapshotSize || 100;
    this._mutex = new Mutex();
    this._snapshotting = Promise.resolve();
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

  public get lastIncludedIndex() {
    return this._lastIncludedIndex;
  }

  public get lastIncludedTerm() {
    return this._lastIncludedTerm;
  }

  public get ready() {
    return this._ready;
  }

  public toString = () => `State = ${this._state}, CurrentTerm = ${this._currentTerm}, LastLogEntryIndex = ${this._log.getLastEntry().index}, CommitIndex = ${this._commitIndex}, LastApplied = ${this._lastApplied}`;

  public isRead = (message: string) => this._store.isRead(message);

  public apply = (message: string, increment?: boolean) => this._snapshotting.then(() => {
    const response = this._store.apply(message);
    if (increment !== false) {
      this._lastApplied += 1;
      if (this._lastApplied % this._snapshotSize === 0) {
        this.snapshot();
      }
    }
    logger.debug(`LastApplied updated: ${this.toString()}`);
    return response;
  });

  public installSnapshot = (request: Snapshot) => {
    this._lastIncludedIndex = request.lastIncludedIndex;
    this._lastIncludedTerm = request.lastIncludedTerm;
    this._snapshot = request.data;
    this._lastApplied = request.lastIncludedIndex;
    const state = {
      lastIncludedIndex: request.lastIncludedIndex,
      lastIncludedTerm: request.lastIncludedTerm,
    };
    const snapshot = Object.entries(request.data)
      .map(([key, value]) => ({ key, value }));
    this._store.install(request.data);
    return ready
      .then(() => this._log.truncate(request.lastIncludedIndex))
      .then(() => StateModel.update(state, { where: {} }))
      .then(() => SnapshotModel.destroy({ where: {} }))
      .then(() => SnapshotModel.bulkCreate(snapshot))
      .then(() => logger.debug(`Snapshot done: ${this.toString()}`));
  };

  public snapshot = () => this._mutex.runExclusive(() => {
    this._snapshotting = new Promise<Snapshot>((resolve) => {
      const data = this._store.snapshot();
      const lastEntry = this._log.getEntryByIndex(this._lastApplied) || ({
        term: 0,
        index: 0,
      } as LogEntry);
      const snapshot: Snapshot = {
        lastIncludedIndex: lastEntry.index,
        lastIncludedTerm: lastEntry.term,
        data,
      };
      return this.installSnapshot(snapshot)
        .then(() => snapshot)
        .tap(() => resolve(snapshot))
        .tapCatch(() => resolve(snapshot));
    });
    return this._snapshotting;
  });

  public getSnapshot = (): Snapshot => ({
    lastIncludedIndex: this._lastIncludedIndex,
    lastIncludedTerm: this._lastIncludedTerm,
    data: this._snapshot,
  });
}
