import Promise from 'bluebird';
import { EventEmitter } from 'events';
import {
  RPCAppendEntriesRequest, RPCCommandRequest, RPCMethod, RPCAppendEntriesResponse,
} from '../utils/rpc.util';
import { LogEntry } from './log';

// import logger from '../utils/log.util';
import { State, RaftState } from './state';

export type ReplicationManagerOptions = {
  state: State,
  heartbeatTimeout?: number;
};

export class ReplicationManager extends EventEmitter {
  private _timer?: NodeJS.Timeout;
  private _state: State;
  private _timeout: number;

  constructor(options: ReplicationManagerOptions) {
    super();
    this._state = options.state;
    this._timeout = options.heartbeatTimeout || 50;
  }

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
    const lastEntry = this._state.getLastLogEntry();
    this.start();
    return Promise.all(this._state.replicas)
      .map((replica) => replica.appendEntries(this._state.currentTerm, this._state.host.toString(),
        lastEntry.index, lastEntry.term, this._state.log, this._state.commitIndex));
  };

  public replicate = (request: RPCCommandRequest) => {
    // Enviar os AppendEntriesRequest e mandar fazer commit localmente
    const lastEntry = this._state.getLastLogEntry();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      term: this._state.currentTerm,
      index: lastEntry.index + 1,
      data: request.message,
      clientId: // !,
      operationId: // !,
      leaderId: this._state.host.toString()
    };
    return Promise.some(
      this._state.replicas.map((replica) => replica
        .appendEntries(this._state.currentTerm, this._state.host.toString(),
          lastEntry.index, lastEntry.term, this._state.log, this._state.commitIndex)),
      this._state.replicas.length / 2,
    );
  };

  public append = (request: RPCAppendEntriesRequest) => {
    if (request.term < this._state.currentTerm) {
      return {
        method: RPCMethod.APPEND_ENTRIES_RESPONSE,
        term: this._state.currentTerm,
        success: false,
      } as RPCAppendEntriesResponse;
    }
    this._state.state = RaftState.FOLLOWER;
    this._state.setCurrentTerm(request.term);
    this._state.leader = request.leaderId;
    request.entries.map((entry) => this._state.addLogEntry(entry));
    return {
      method: RPCMethod.APPEND_ENTRIES_RESPONSE,
      term: this._state.currentTerm,
      success: true,
    } as RPCAppendEntriesResponse;
  };

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
