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
import { RaftState, StateMachine } from './state';

export type RaftServerOptions = {
  host: string,
  servers: string[],
  clientPort: number,
  serverPort: number,
  minimumElectionTimeout?: number,
  maximumElectionTimeout?: number,
  heartbeatTimeout?: number,
  handler: (message: string) => string | Promise<string>,
};

export class RaftServer extends EventEmitter {
  private _clientPort: number;
  private _serverPort: number;
  private _stateMachine: StateMachine;
  private _commandServer: http.Server;
  private _raftServer: http.Server;

  constructor(options: RaftServerOptions) {
    super();
    this._clientPort = options.clientPort;
    this._serverPort = options.serverPort;
    this._stateMachine = new StateMachine({
      servers: options.servers,
      host: options.host,
      port: options.serverPort,
      minimumElectionTimeout: options.minimumElectionTimeout,
      maximumElectionTimeout: options.maximumElectionTimeout,
      heartbeatTimeout: options.heartbeatTimeout,
    });
    this._commandServer = express().use(bodyParser.json()).use(Router().post('/', (req, res) => {
      // if not leader, send leader info
      if (this._stateMachine.state !== RaftState.LEADER) {
        const response: RPCLeaderResponse = {
          method: RPCMethod.LEADER_RESPONSE,
          message: this._stateMachine.leader || this._stateMachine.host,
        };
        return res.json(response);
      }
      const token = ((req.headers.authorization || '').match(/Bearer\s*(.*)/) || [])[1];
      const clientId = token || nanoid(32);
      const request: RPCClientRequest = req.body;
      switch (request.method) {
        case RPCMethod.COMMAND_REQUEST: {
          return Promise.try(() => this._stateMachine.replicate(request.message, clientId))
            .tap(() => logger.debug(`Processing client request: ${request.message}`))
            .then(() => options.handler(request.message))
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
            logger.debug(`${this._stateMachine.currentTerm}, ${request.term}, ${(this._stateMachine.log[this._stateMachine.log.length - 1] || {}).index || 0}, ${request.prevLogIndex}`);
            logger.debug(`${request.term < this._stateMachine.currentTerm}, ${((this._stateMachine.log[this._stateMachine.log.length - 1] || {}).index || 0) < request.prevLogIndex}`);
          }
          if (request.term >= this._stateMachine.currentTerm) {
            if (request.term > this._stateMachine.currentTerm) {
              logger.debug(`Changing leader: ${request.leaderId}`);
            }
            this._stateMachine.setLeader(request.leaderId, request.term);
          }
          if (request.term < this._stateMachine.currentTerm
            || ((this._stateMachine.log[this._stateMachine.log.length - 1] || {}).index || 0)
            < request.prevLogIndex) {
            return res.json({
              method: RPCMethod.APPEND_ENTRIES_RESPONSE,
              term: this._stateMachine.currentTerm,
              success: false,
            } as RPCAppendEntriesResponse);
          }
          return Promise.all(request.entries)
            .mapSeries((entry) => {
              this._stateMachine.append(entry);
              // if (entry.index <= request.leaderCommit) {
              //   // commit
              // }
              // check if entries already exist in log
              return options.handler(entry.data);
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
              term: this._stateMachine.currentTerm,
              success: true,
            } as RPCAppendEntriesResponse));
        }
        case RPCMethod.REQUEST_VOTE_REQUEST: {
          logger.debug(`Receive vote request from: ${request.candidateId}`);
          return Promise.props<RPCRequestVoteResponse>({
            method: RPCMethod.REQUEST_VOTE_RESPONSE,
            term: this._stateMachine.currentTerm,
            voteGranted: Promise.resolve(this._stateMachine.vote(request.candidateId,
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
