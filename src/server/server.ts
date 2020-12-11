import Promise from 'bluebird';
import express, { Router } from 'express';
import bodyParser from 'body-parser';
import { nanoid } from 'nanoid';
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
} from '../utils/rpc.util';
import { RaftState, State } from './state';
import { IRaftStore } from './store';
import { Replica } from './replica';
import { ElectionManager } from './election.manager';
import { ReplicationManager } from './replication.manager';

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
};

export class RaftServer extends EventEmitter {
  private _clientPort: number;
  private _serverPort: number;
  private _state: State;
  private _electionManager: ElectionManager;
  private _replicationManager: ReplicationManager;
  private _commandServer: http.Server;
  private _raftServer: http.Server;

  constructor(options: RaftServerOptions) {
    super();
    this._clientPort = options.clientPort;
    this._serverPort = options.serverPort;
    this._state = new State({
      host: new Replica({ host: options.host, port: options.port || options.serverPort || 8080 }),
      replicas: [...new Set(options.servers
        .map((s) => s.split(':'))
        .map(([host, port]) => ({
          host,
          port: (port ? parseInt(port, 10) : undefined) || options.serverPort || 8080,
        })))]
        .map((replica) => new Replica(replica)),
    });
    this._electionManager = new ElectionManager({
      state: this._state,
      minimumElectionTimeout: options.minimumElectionTimeout,
      maximumElectionTimeout: options.maximumElectionTimeout,
    });
    this._replicationManager = new ReplicationManager({
      state: this._state,
      heartbeatTimeout: options.heartbeatTimeout,
    });
    // TODO: add event handlers
    this._electionManager.on('elected', () => {
      this._replicationManager.start();
    });
    // TODO: add message queues
    // TODO: add log to state + database
    this._commandServer = express().use(bodyParser.json()).use(Router().post('/', (req, res) => {
      // if not leader, send leader info
      if (this._state.state !== RaftState.LEADER) {
        const response: RPCLeaderResponse = {
          method: RPCMethod.LEADER_RESPONSE,
          message: this._state.leader || this._state.host.toString(),
        };
        return res.json(response);
      }
      const token = ((req.headers.authorization || '').match(/Bearer\s*(.*)/) || [])[1];
      const clientId = token || nanoid(32);
      const request: RPCClientRequest = req.body;
      switch (request.method) {
        case RPCMethod.COMMAND_REQUEST: {
          // Only replicate if it is a write command
          return Promise.try(() => (options.store.isRead(request.message)
            ? undefined
            : this._replicationManager.replicate(request.message, clientId)))
            .tap(() => logger.debug(`Processing client request: ${request.message}`))
            .then(() => options.store.apply(request.message))
            .then((response) => ({
              method: RPCMethod.COMMAND_RESPONSE,
              message: response,
              ...(token ? {} : { clientId }),
            } as RPCCommandResponse))
            .then((response) => res.json(response));
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
    this._raftServer = express().use(bodyParser.json()).use(Router().post('/', (req, res) => {
      const request: RPCServerRequest = req.body;
      switch (request.method) {
        case RPCMethod.APPEND_ENTRIES_REQUEST: {
          if (request.entries.length > 0) {
            logger.debug(`${this._state.currentTerm}, ${request.term}, ${(this._state.log[this._state.log.length - 1] || {}).index || 0}, ${request.prevLogIndex}`);
            logger.debug(`${request.term < this._state.currentTerm}, ${((this._state.log[this._state.log.length - 1] || {}).index || 0) < request.prevLogIndex}`);
          }
          if (request.term >= this._state.currentTerm) {
            if (request.term > this._state.currentTerm) {
              logger.debug(`Changing leader: ${request.leaderId}`);
            }
            this._state.setLeader(request.leaderId, request.term);
          }
          if (request.term < this._state.currentTerm
            || ((this._state.log[this._state.log.length - 1] || {}).index || 0)
            < request.prevLogIndex) {
            return res.json({
              method: RPCMethod.APPEND_ENTRIES_RESPONSE,
              term: this._state.currentTerm,
              success: false,
            } as RPCAppendEntriesResponse);
          }
          return Promise.all(request.entries)
            .mapSeries((entry) => {
              this._state.append(entry);
              // if (entry.index <= request.leaderCommit) {
              //   // commit
              // }
              // check if entries already exist in log
              return options.store.apply(entry.data);
            })
            // .tap(() => {
            //   if (request.leaderCommit > this.stateMachine.commitIndex
            //     && request.entries.length > 0) {
            //     this.stateMachine.commitIndex = Math
            //       .min(request.leaderCommit, request.entries[request.entries.length - 1].index);
            //   }
            // })
            // .tap(() => logger.debug('Entry appended'))
            .tap(() => res.json({
              method: RPCMethod.APPEND_ENTRIES_RESPONSE,
              term: this._state.currentTerm,
              success: true,
            } as RPCAppendEntriesResponse));
        }
        case RPCMethod.REQUEST_VOTE_REQUEST: {
          logger.debug(`Receive vote request from: ${request.candidateId}`);
          return Promise.props<RPCRequestVoteResponse>({
            method: RPCMethod.REQUEST_VOTE_RESPONSE,
            term: this._state.currentTerm,
            voteGranted: Promise.resolve(this._electionManager.vote(request.candidateId,
              request.term, request.lastLogIndex))
              .catch(() => false),
          })
            .then((response) => res.json(response));
        }
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
