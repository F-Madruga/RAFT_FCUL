import Promise from 'bluebird';
import express, { Router } from 'express';
import bodyParser from 'body-parser';
import { nanoid } from 'nanoid';
import cors from 'cors';
import http from 'http';
import { EventEmitter } from 'events';

import logger from '../utils/log.util';
import {
  RPCMethod,
  RPCClientRequest,
  RPCLeaderResponse,
  RPCServerRequest,
  RPCErrorResponse,
  RPCCommandResponse,
  RPCAppendEntriesResponse,
  RPCRequestVoteResponse,
  RPCInstallSnapshotResponse,
} from '../utils/rpc.util';
import { Event } from '../utils/constants.util';
import { RaftState, State } from './state';
import { IRaftStore } from './store';
import { Replica } from './replica';
import { ElectionManager } from './election.manager';
import { ReplicationManager } from './replication.manager';
import { SnapshotManager } from './snapshot.manager';

export type RaftServerOptions = {
  host: string,
  port?: number,
  servers: string[],
  clientPort: number,
  serverPort: number,
  minimumElectionTimeout?: number,
  maximumElectionTimeout?: number,
  heartbeatTimeout?: number,
  store: IRaftStore,
  snapshotSize?: number,
};

export class RaftServer extends EventEmitter {
  private _clientPort: number;
  private _serverPort: number;
  private _state: State;
  private _electionManager: ElectionManager;
  private _replicationManager: ReplicationManager;
  private _snapshotManager: SnapshotManager;
  private _commandServer: http.Server;
  private _raftServer: http.Server;
  private _host: Replica;
  private _replicas: Replica[];

  constructor(options: RaftServerOptions) {
    super();
    this._clientPort = options.clientPort;
    this._serverPort = options.serverPort;
    this._state = new State({
      store: options.store,
      snapshotSize: options.snapshotSize,
    });
    this._host = new Replica({
      state: this._state,
      host: options.host,
      port: options.port || options.serverPort || 8080,
    });
    this._state.leader = this._host.host;
    this._replicas = [...new Set(options.servers
      .map((s) => s.split(':'))
      .map(([host, port]) => ({
        host,
        port: (port ? parseInt(port, 10) : undefined) || options.serverPort || 8080,
        state: this._state,
        heartbeatTimeout: options.heartbeatTimeout,
      })))]
      .map((replica) => new Replica(replica));
    this._electionManager = new ElectionManager({
      state: this._state,
      host: this._host,
      replicas: this._replicas,
      minimumElectionTimeout: options.minimumElectionTimeout,
      maximumElectionTimeout: options.maximumElectionTimeout,
    });
    this._replicationManager = new ReplicationManager({
      state: this._state,
      host: this._host,
      replicas: this._replicas,
    });
    this._snapshotManager = new SnapshotManager({
      state: this._state,
      replicas: this._replicas,
    });
    this._state.ready.then(() => {
      this._state.on(Event.STATE_CHANGED, (state: RaftState) => {
        this.emit(Event.STATE_CHANGED, state);
        switch (state) {
          case RaftState.FOLLOWER:
            this._electionManager.start();
            this._replicationManager.stop();
            break;
          case RaftState.CANDIDATE:
            this._electionManager.start();
            this._replicationManager.stop();
            break;
          case RaftState.LEADER:
            this._electionManager.stop();
            this._replicationManager.start();
            break;
          default:
        }
      });
      this._state.state = RaftState.FOLLOWER;
    });
    this._commandServer = express()
      .use(bodyParser.json())
      .use(cors() as any)
      .use(Router().post('/', (req, res) => {
      // if not leader, send leader info
        if (this._state.state !== RaftState.LEADER) {
          logger.debug(`Sending leader info: ${this._state.leader || this._host.host}:${this._clientPort}`);
          const response: RPCLeaderResponse = {
            method: RPCMethod.LEADER_RESPONSE,
            message: `${this._state.leader || this._host.host}:${this._clientPort}`,
          };
          return res.json(response);
        }
        const token = ((req.headers.authorization || '').match(/Bearer\s*(.*)/) || [])[1];
        const clientId = token || nanoid(32);
        const request: RPCClientRequest = req.body;
        switch (request.method) {
          case RPCMethod.COMMAND_REQUEST: {
          // Only replicate if it is a write command
            return Promise.try(() => this._state.isRead(request.message))
              .tap((isRead) => isRead || this._replicationManager.replicate(request, clientId))
              .tap(() => logger.debug(`Processing client request: ${request.message}`))
              .then((isRead) => this._state.apply(request.message, !isRead))
              .then((message) => {
                const response: RPCCommandResponse = {
                  method: RPCMethod.COMMAND_RESPONSE,
                  message,
                  ...(token ? {} : { clientId }),
                };
                return res.json(response);
              });
          }
          default:
            break;
        }
        const response: RPCErrorResponse = {
          method: RPCMethod.ERROR_RESPONSE,
          message: `Unrecognized method: ${request.method}`,
        };
        return res.json(response);
      }))
      .listen(this._clientPort,
        () => logger.info(`Listening for client connections on port ${this._clientPort}`));
    this._raftServer = express()
      .use(bodyParser.json())
      .use(cors() as any)
      .use(Router().post('/', (req, res) => {
        const request: RPCServerRequest = req.body;
        switch (request.method) {
          case RPCMethod.APPEND_ENTRIES_REQUEST:
            return this._state.ready
              .then(() => this._replicationManager.append(request))
              .catch(() => false)
              .then((success) => {
                const response: RPCAppendEntriesResponse = {
                  method: RPCMethod.APPEND_ENTRIES_RESPONSE,
                  term: this._state.currentTerm,
                  success,
                };
                return res.json(response);
              });
          case RPCMethod.REQUEST_VOTE_REQUEST:
            return this._state.ready
              .then(() => this._electionManager.processVote(request))
              .catch(() => false)
              .then((voteGranted) => {
                const response: RPCRequestVoteResponse = {
                  method: RPCMethod.REQUEST_VOTE_RESPONSE,
                  term: this._state.currentTerm,
                  voteGranted,
                };
                return res.json(response);
              });
          case RPCMethod.INSTALL_SNAPSHOT_REQUEST:
            return this._state.ready
              .then(() => this._snapshotManager.install(request))
              .catch(() => undefined)
              .then(() => {
                const response: RPCInstallSnapshotResponse = {
                  method: RPCMethod.INSTALL_SNAPSHOT_RESPONSE,
                  term: this._state.currentTerm,
                };
                return res.json(response);
              });
          default:
            break;
        }
        const response: RPCErrorResponse = {
          method: RPCMethod.ERROR_RESPONSE,
          message: `Unrecognized method: ${(request as any).method}`,
        };
        return res.json(response);
      }))
      .listen(this._serverPort,
        () => logger.info(`Listening for server connections on port ${this._serverPort}`));
  }

  public close = () => {
    this._commandServer.close();
    this._raftServer.close();
  };
}
