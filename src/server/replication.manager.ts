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
        logger.debug(`incremented commitIndex to ${this._state.commitIndex}`);
      }
      const { lastApplied } = this._state;
      if (this._state.commitIndex > lastApplied && this._toCommit[lastApplied + 1]) {
        logger.debug(`committing ${lastApplied + 1}`);
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
    const lastEntry = this._state.getLastLogEntry();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      term: this._state.currentTerm,
      index: lastEntry.index + 1,
      data: request.message,
      clientId,
      operationId: nanoid(),
      leaderId: this._host.toString(),
    };
    this._state.addLogEntry(entry);
    logger.debug(this._state.log);
    this._replicas.map((replica) => replica.appendEntries());
    return new Promise((resolve) => {
      this._toCommit[entry.index] = resolve;
    });
  };

  public append = (request: RPCAppendEntriesRequest) => Promise.resolve(this._mutex.acquire())
    .then(() => {
      if (request.term < this._state.currentTerm) {
        return false;
      }
      this._state.state = RaftState.FOLLOWER;
      this._state.leader = request.leaderId;
      this._state.setCurrentTerm(request.term);
      const previousEntry = this._state.getLogEntry(request.prevLogIndex);
      if (request.prevLogIndex !== 0
        && ((previousEntry || {}).term || this._state.currentTerm) !== request.prevLogTerm) {
        return false;
      }
      const lastNewEntry = request.entries[request.entries.length - 1];
      if (request.leaderCommit > this._state.commitIndex) {
        this._state.commitIndex = Math
          .min(request.leaderCommit, (lastNewEntry || {}).index || request.leaderCommit);
        logger.debug(`Update commit index = ${this._state.commitIndex}`);
      }
      // logger.debug(`Leader = ${this._state.leader}, VOTED_FOR = ${this._state.votedFor}, TERM = ${this._state.currentTerm}`);
      return Promise.all(request.entries)
        .map((entry) => this._state.addLogEntry(entry))
        .then(() => {
          if (request.entries.length > 0) {
            logger.debug(this._state.log);
          }
        })
        .then(() => Promise.all(request.entries)
          .map((entry) => this._state.commitIndex >= entry.index && this._state.apply(entry.data)))
        .then(() => true);
    })
    .tap(() => this._mutex.release());

  // if (request.entries.length > 0) {
  //   logger.debug(`${this._state.currentTerm}, ${request.term}, ${(this._state.log[this._state.log.length - 1] || {}).index || 0}, ${request.prevLogIndex}`);
  //   logger.debug(`${request.term < this._state.currentTerm}, ${((this._state.log[this._state.log.length - 1] || {}).index || 0) < request.prevLogIndex}`);
  // }
  // if (request.term >= this._state.currentTerm) {
  //   if (request.term > this._state.currentTerm) {
  //     logger.debug(`Changing leader: ${request.leaderId}`);
  //   }
  //   this._state.setLeader(request.term, request.leaderId);
  // }
  // if (request.term < this._state.currentTerm
  //   || ((this._state.log[this._state.log.length - 1] || {}).index || 0)
  //   < request.prevLogIndex) {
  //   return res.json({
  //     method: RPCMethod.APPEND_ENTRIES_RESPONSE,
  //     term: this._state.currentTerm,
  //     success: false,
  //   } as RPCAppendEntriesResponse);
  // }
  // return Promise.all(request.entries)
  //   .mapSeries((entry) => {
  //     this._state.append(entry);
  //     // if (entry.index <= request.leaderCommit) {
  //     //   // commit
  //     // }
  //     // check if entries already exist in log
  //     return options.store.apply(entry.data);
  //   })
  //   // .tap(() => {
  //   //   if (request.leaderCommit > this.stateMachine.commitIndex
  //   //     && request.entries.length > 0) {
  //   //     this.stateMachine.commitIndex = Math
  //   //       .min(request.leaderCommit, request.entries[request.entries.length - 1].index);
  //   //   }
  //   // })
  //   // .tap(() => logger.debug('Entry appended'))

  // public replicate = (message: string, clientId: string) => Promise.resolve();

  // private heartbeat = () => {
  //   const lastEntry: LogEntry = this._log[this._log.length - 1];
  //   // logger.debug('Sending heartbeat');
  //   this.startHeartbeatTimer();
  //   return Promise.all(this._replicas)
  //     .map((replica) => replica
  //       .appendEntries(this._currentTerm, this._host, (lastEntry || {}).term || this._currentTerm,
  //         this._commitIndex, this._log));
  // };

  // public replicate = (message: string, clientId: string) => {
  //   this.startHeartbeatTimer();
  //   const entry: LogEntry = {
  //     timestamp: new Date().toISOString(),
  //     term: this._currentTerm,
  //     index: this._log.length + 1,
  //     data: message,
  //     clientId,
  //     operationId: nanoid(),
  //     leaderId: this._host,
  //   };
  //   // this._log.push(entry);
  //   this.add(entry);
  //   logger.debug(this._log);
  //   const commitPromise: { resolve: null | ((result?: any) => void) } = { resolve: null };
  //   this._toCommit.push(commitPromise);
  //   return new Promise((execute) => Promise
  //     .some(
  //       this._replicas.map((replica) => replica
  //         .appendEntries(this._currentTerm, this._host, entry.term,
  //           this._commitIndex, this._log)),
  //       Math.ceil(this._replicas.length / 2),
  //     )
  //     .then(() => new Promise((resolve) => {
  //       commitPromise.resolve = resolve;
  //       return this.commit();
  //     }))
  //     .then(() => this._commitIndex++)
  //     .then(() => execute())
  //     .then(() => this._lastApplied++)
  //     .then(() => this._replicas.map((replica) => replica
  //       .appendEntries(this._currentTerm, this._host, entry.term,
  //         this._commitIndex, this._log))));
  // };

  // private startHeartbeatTimer = () => {
  //   // logger.debug('Start heartbeat timer');
  //   if (this._heartbeatTimer) clearTimeout(this._heartbeatTimer);
  //   const task = this.heartbeat;
  //   this._heartbeatTimer = setTimeout(() => task(), this._heartbeatTimeout);
  //   // stop heartbeat timer if new leader is elected (replica is now follower)
  // };

  // private heartbeat = () => {
  //   const lastEntry: LogEntry = this._log[this._log.length - 1];
  //   // logger.debug('Sending heartbeat');
  //   this.startHeartbeatTimer();
  //   return Promise.all(this._replicas)
  //     .map((replica) => replica
  //       .appendEntries(this._currentTerm, this._host, (lastEntry || {}).term || this._currentTerm,
  //         this._commitIndex, this._log));
  // };

  // public append = (entry: LogEntry) => {
  //   if (this._log[entry.index - 1] && this._log[entry.index - 1].term !== entry.term) {
  //     this._log = this._log.slice(0, entry.index);
  //     // TODO: delete database entries
  //   }
  //   // this._log.push(entry);
  //   this.add(entry);
  //   this._currentTerm = entry.term;
  //   this._lastApplied = entry.index;
  //   logger.debug(this._log);
  // };

  // public add = (entry: LogEntry) => {
  //   this._log.push(entry);
  //   return Log.create(entry);
  // };
}
