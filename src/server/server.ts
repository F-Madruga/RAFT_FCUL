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
  private servers: string[];

  private clientPort: number;

  private serverPort: number;

  private stateMachine: StateMachine;

  private commandServer: http.Server;

  private raftServer: http.Server;

  constructor(options: RaftServerOptions) {
    super();
    this.clientPort = options.clientPort;
    this.serverPort = options.serverPort;
    // this.servers = [...new Set(options.servers
    //   .map((s) => s.split(':'))
    //   .map(([h, p]) => [h, p || this.serverPort].join(':')))];
    this.servers = options.servers;
    this.stateMachine = new StateMachine({
      servers: this.servers,
      host: options.host,
      port: options.serverPort,
      minimumElectionTimeout: options.minimumElectionTimeout,
      maximumElectionTimeout: options.maximumElectionTimeout,
      heartbeatTimeout: options.heartbeatTimeout,
    });
    this.commandServer = express().use(bodyParser.json()).use(Router().post('/', (req, res) => {
      // if not leader, send leader info
      if (this.stateMachine.state !== RaftState.LEADER) {
        const response: RPCLeaderResponse = {
          method: RPCMethod.LEADER_RESPONSE,
          message: this.stateMachine.votedFor?.split(':')[0] || '',
        };
        return res.json(response);
      }
      // const token = ((req.headers.authorization || '').match(/Bearer\s*(.*)/) || [])[1];
      const clientId = nanoid(32);
      const request: RPCClientRequest = req.body;
      switch (request.method) {
        case RPCMethod.COMMAND_REQUEST: {
          return Promise.try(() => this.stateMachine.replicate(request.message, clientId))
            .tap(() => logger.debug(`Processing client request: ${request.message}`))
            .then(() => options.handler(request.message))
            .then((response) => ({
              method: RPCMethod.COMMAND_RESPONSE,
              message: response,
              clientId,
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
      .listen(this.clientPort,
        () => logger.info(`Listening for client connections on port ${this.clientPort}`));
    this.raftServer = express().use(bodyParser.json()).use(Router().post('/', (req, res) => {
      const request: RPCServerRequest = req.body;
      switch (request.method) {
        case RPCMethod.APPEND_ENTRIES_REQUEST: {
          if (request.entries.length > 0) {
            logger.debug(`${this.stateMachine.currentTerm}, ${request.term}, ${(this.stateMachine.log[this.stateMachine.log.length - 1] || {}).index || 0}, ${request.prevLogIndex}`);
            logger.debug(`${request.term < this.stateMachine.currentTerm}, ${((this.stateMachine.log[this.stateMachine.log.length - 1] || {}).index || 0) < request.prevLogIndex}`);
          }
          if (request.term < this.stateMachine.currentTerm
            || ((this.stateMachine.log[this.stateMachine.log.length - 1] || {}).index || 0) < request.prevLogIndex) {
            return res.json({
              method: RPCMethod.APPEND_ENTRIES_RESPONSE,
              term: this.stateMachine.currentTerm,
              success: false,
            } as RPCAppendEntriesResponse);
          }
          this.stateMachine.setLeader(request.leaderId, request.term);
          return Promise.all(request.entries)
            .mapSeries((entry) => {
              this.stateMachine.append(entry);
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
              term: this.stateMachine.currentTerm,
              success: true,
            } as RPCAppendEntriesResponse));
        }
        case RPCMethod.REQUEST_VOTE_REQUEST: {
          logger.debug(`Receive vote request from: ${request.candidateId}`);
          return Promise.props<RPCRequestVoteResponse>({
            method: RPCMethod.REQUEST_VOTE_RESPONSE,
            term: this.stateMachine.currentTerm,
            voteGranted: Promise.resolve(this.stateMachine.vote(request.candidateId,
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
      .listen(this.serverPort,
        () => logger.info(`Listening for server connections on port ${this.serverPort}`));
  }

  public close = () => {
    this.commandServer.close();
    this.raftServer.close();
  };
}
