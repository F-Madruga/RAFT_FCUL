import Promise from 'bluebird';
import { nanoid } from 'nanoid';
import { Mutex } from 'async-mutex';
import { EventEmitter } from 'events';

// import logger from '../utils/log.util';
import {
  RPCAppendEntriesRequest,
  RPCCommandRequest,
} from '../utils/rpc.util';
import { LogEntry } from './log';
import { State, RaftState } from './state';
import { Replica } from './replica';
import { Event } from '../utils/constants.util';
import logger from '../utils/log.util';

export type ReplicationManagerOptions = {
  state: State,
  host: Replica,
  replicas: Replica[],
};

export class ReplicationManager extends EventEmitter {
  private _state: State;
  private _host: Replica;
  private _replicas: Replica[];
  private _toCommit: { [index: number]: ((result?: any) => void) };
  private _mutex: Mutex;

  constructor(options: ReplicationManagerOptions) {
    super();
    this._state = options.state;
    this._host = options.host;
    this._replicas = options.replicas;
    this._toCommit = {};
    this._replicas.map((replica) => replica.on(Event.MATCH_INDEX_CHANGED, () => {
      while (this._replicas.filter((r) => r.matchIndex > this._state.commitIndex).length
        >= this._replicas.length / 2) {
        this._state.commitIndex += 1;
        logger.debug(`CommitIndex updated: ${this._state.toString()}`);
      }
      const { lastApplied } = this._state;
      if (this._state.commitIndex > lastApplied && this._toCommit[lastApplied + 1]) {
        logger.debug(`Quorum committed: ${this._state.toString()}`);
        this._toCommit[lastApplied + 1]();
        delete this._toCommit[lastApplied + 1];
      }
    }));
    this._mutex = new Mutex();
  }

  public start = () => {
    this.stop();
    this._replicas.map((replica) => replica.heartbeat());
  };

  public stop = () => {
    this._replicas.map((replica) => replica.stop());
  };

  public replicate = (request: RPCCommandRequest, clientId: string) => {
    const lastEntry = this._state.log.getLastEntry();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      term: this._state.currentTerm,
      index: lastEntry.index + 1,
      data: request.message,
      clientId,
      operationId: nanoid(),
      leaderId: this._host.toString(),
    };
    this._state.log.addEntry(entry);
    logger.debug(`New entry to replicate: ${this._state.toString()}`);
    this._replicas.map((replica) => replica.appendEntries());
    return new Promise((resolve) => {
      this._toCommit[entry.index] = resolve;
    });
  };

  public append = (request: RPCAppendEntriesRequest) => Promise.resolve(this._mutex.acquire())
    .then(() => {
      // if (this._state.log.length === 0) {
      //   logger.debug('APPEND_LOG_LENGTH IS EMPTY!!!!!!!!');
      // }
      if (request.term < this._state.currentTerm) {
        logger.debug(`REQUEST_TERM = ${request.term}, CURRENT_TERM = ${this._state.currentTerm}`);
        return false;
      }
      this._state.state = RaftState.FOLLOWER;
      this._state.leader = request.leaderId;
      this._state.setCurrentTerm(request.term);
      const previousEntry = this._state.log.getEntryByIndex(request.prevLogIndex);
      if (request.prevLogIndex !== 0
        && ((previousEntry || {}).term || this._state.currentTerm) !== request.prevLogTerm) {
        logger.debug(`REQUEST_PREV_LOG_INDEX = ${request.prevLogIndex}, PREV_ENTRY_TERM = ${(previousEntry || {}).term || this._state.currentTerm}, CURRENT_TERM = ${this._state.currentTerm}`);
        return false;
      }
      const lastNewEntry = request.entries[request.entries.length - 1];
      if (request.leaderCommit > this._state.commitIndex) {
        this._state.commitIndex = Math
          .min(request.leaderCommit, (lastNewEntry || {}).index || request.leaderCommit);
        logger.debug(`CommitIndex updated: ${this._state.toString()}`);
      }
      // logger.debug(`Leader = ${this._state.leader}, VOTED_FOR = ${this._state.votedFor}, TERM = ${this._state.currentTerm}`);
      return Promise.all(request.entries)
        .map((entry) => this._state.log.addEntry(entry))
        .then(() => {
          // if (request.entries.length > 0) {
          //   logger.debug(this._state.log);
          // }
          const entriesToApply = this._state
            .log.slice(this._state.lastApplied + 1, this._state.commitIndex);
          // logger.debug(`Applying entries: ${this._state.toString()}`);
          // logger.debug(`Entries to apply = ${entriesToApply.length}, LastApplied = ${this._state.lastApplied + 1}, CommitIndex = ${this._state.commitIndex}`);
          return Promise.all(entriesToApply)
            .map((entry) => this._state.apply(entry.data));
        })
        .then(() => {
          if (request.entries.length > 0) {
            logger.debug(`Log updated: ${this._state.toString()}`);
          }
        })
        .then(() => true);
    })
    .tap(() => this._mutex.release());
}
