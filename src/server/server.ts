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
  RPCVoteResponse,
  RPCAppendEntriesResponse,
  RPCCommandResponse,
} from '../utils/rpc.util';
import { RaftState, StateMachine } from './state';

export type RaftServerOptions = {
  host: string,
  servers: string[],
  clientPort: number,
  serverPort: number,
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
    this.servers = [...new Set(options.servers
      .map((s) => s.split(':'))
      .map(([h, p]) => [h, p || this.serverPort].join(':')))];
    this.stateMachine = new StateMachine({
      servers: this.servers,
      host: options.host,
    });
    // this.commandServer = new WebSocket.Server({ port: this.clientPort },
    //   () => logger.info(`Listening for client connections on port ${this.clientPort}`))
    //   .on('connection', (ws) => {
    //     // if not leader, send leader info
    //     if (this.stateMachine.state !== RaftState.LEADER) {
    //       const response: RPCLeaderResponse = {
    //         method: RPCMethod.LEADER_RESPONSE,
    //         message: this.stateMachine.leader || '',
    //       };
    //       return ws.send(JSON.stringify(response));
    //     }
    //     const clientId = nanoid();
    //     return ws.on('message', (message) => {
    //       const request: RPCClientRequest = JSON.parse(message.toString());
    //       switch (request.method) {
    //         case RPCMethod.COMMAND_REQUEST: {
    //           return Promise.try(() => this.stateMachine.replicate(request.message, clientId))
    //             .tap(() => logger.debug(`Processing client request: ${request.message}`))
    //             .then(() => options.handler(request.message))
    //             .then((response) => ({
    //               method: RPCMethod.COMMAND_RESPONSE,
    //               message: response,
    //             } as RPCCommandResponse))
    //             .then((response) => ws.send(JSON.stringify(response)));
    //         }
    //         default:
    //           break;
    //       }
    //       const response: RPCErrorResponse = {
    //         method: RPCMethod.ERROR_RESPONSE,
    //         message: `Unrecognized method: ${request.method}`,
    //       };
    //       return ws.send(JSON.stringify(response));
    //     });
    //   });
    this.commandServer = express().use(bodyParser.json()).use(Router().post('/', (req, res) => {
      // if not leader, send leader info
      if (this.stateMachine.state !== RaftState.LEADER) {
        const response: RPCLeaderResponse = {
          method: RPCMethod.LEADER_RESPONSE,
          message: this.stateMachine.leader || '',
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
          const response: RPCAppendEntriesResponse = { method: RPCMethod.APPEND_ENTRIES_RESPONSE };
          return Promise.try(() => this.stateMachine.append(request.entry))
            .tap(() => options.handler(request.entry.data))
            .tap(() => logger.debug('Entry appended'))
            .tap(() => res.json(response));
        }
        // case RPCMethod.COMMIT_ENTRIES_REQUEST: {
        //   // TODO: commit entries
        //   break;
        // }
        case RPCMethod.REQUEST_VOTE_REQUEST: {
          // vote NO if: local term is greater OR (term is equal AND local index is greater)
          if (this.stateMachine.term > request.term
            || (this.stateMachine.term === request.term
              && this.stateMachine.index > request.index)) {
            const response: RPCVoteResponse = { method: RPCMethod.VOTE_RESPONSE, vote: false };
            return res.json(response);
          }
          // vote YES otherwise
          const response: RPCVoteResponse = { method: RPCMethod.VOTE_RESPONSE, vote: true };
          return res.json(response);
        }
        // case RPCMethod.LEADER_REQUEST: {
        //   this.stateMachine.setLeader(request.message, request.term);
        //   const response: RPCLeaderResponse = {
        //     method: RPCMethod.LEADER_RESPONSE,
        //     message: request.message,
        //   };
        //   return res.json(response);
        // }
        // case RPCMethod.HEARTBEAT_REQUEST: {
        //   this.stateMachine.heartbeat();
        //   const response: RPCHeartbeatResponse = { method: RPCMethod.HEARTBEAT_RESPONSE };
        //   return res.json(response);
        // }
        default:
          break;
      }
      const response: RPCErrorResponse = {
        method: RPCMethod.ERROR_RESPONSE,
        message: `Unrecognized method: ${request.method}`,
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
