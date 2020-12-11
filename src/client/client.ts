import Promise from 'bluebird';
import axios from 'axios';
import WebSocket from 'ws';

import logger from '../utils/log.util';
import { RPCMethod, RPCRequest, RPCResponse } from '../utils/rpc.util';
import { RPCError, UnrecognizedMethodError } from '../utils/error.util';

export type RaftClientOptions = {
  servers: string[],
  port?: number,
  secure?: boolean,
  websocket?: boolean,
  handler?: (response: string) => any,
};

export class RaftClient {
  private servers: string[];
  private leader: string;
  private token: string;
  private secure: boolean;
  private websocket?: Promise<WebSocket>;
  private handler: (response: string) => any;

  constructor(options: RaftClientOptions) {
    this.servers = [...new Set(options.servers
      .map((s) => s.split(':'))
      .map(([h, p]) => [h, p || options.port || 8080].join(':')))];
    this.secure = options.secure || false;
    [this.leader] = this.servers;
    this.chooseRandomLeader();
    if (options.websocket) {
      this.connect();
    }
    this.handler = options.handler || (() => undefined);
    this.token = '';
  }

  private chooseRandomLeader = () => {
    this.leader = this.servers[Math.floor(Math.random() * this.servers.length)];
  };

  public request = (message: string): Promise<string> => (this.websocket
    ? this.websocket.then((socket) => socket
      .send(JSON.stringify({ method: RPCMethod.COMMAND_REQUEST, message })))
      .then(() => '')
    : this.send({ method: RPCMethod.COMMAND_REQUEST, message })
      .then((response) => this.response(response, message)));

  private send = (request: RPCRequest) => Promise
    .resolve(axios.post(`http://${this.leader}`, request,
      { headers: { Authorization: `Bearer ${this.token}` } }))
    .tap(() => logger.debug(`Sent request to ${this.leader}: ${request.method}`))
    .then<RPCResponse>((response) => response.data)
    .tap((response) => logger.debug(`Received response: ${response.method}`));

  private connect = () => {
    if (this.websocket) this.websocket.then((socket) => socket.close());
    this.websocket = new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws${this.secure ? 's' : ''}//${this.leader}`, this.token);
      socket.onopen = (ev) => {
        logger.debug('ws.open', ev);
        resolve(socket);
      };
      socket.onclose = (ev) => {
        logger.debug('ws.close', ev);
        this.chooseRandomLeader();
        this.connect();
        reject(ev);
      };
      socket.onerror = (err) => {
        logger.debug('ws.error', err);
        this.chooseRandomLeader();
        this.connect();
        reject(err);
      };
    });
    this.websocket.then((socket) => {
      // eslint-disable-next-line no-param-reassign
      socket.onmessage = (data) => {
        logger.debug('ws.incoming', data);
        try {
          const parsedData = JSON.parse(data.data.toString());
          logger.debug('ws.incoming.unpacked', parsedData);
          this.response(parsedData, ''); // ! fix me
        } catch (e) {
          logger.debug('ws.incoming.unpacked', 'Error unpacking message');
        }
      };
    });
  };

  private response = (response: RPCResponse, request: string) => {
    switch (response.method) {
      case RPCMethod.LEADER_RESPONSE: {
        this.leader = response.message;
        logger.debug(`Changing leader: ${this.leader}`);
        this.connect();
        return this.request(request);
      }
      case RPCMethod.COMMAND_RESPONSE: {
        if (response.clientId) this.token = response.clientId;
        this.handler(response.message);
        return response.message;
      }
      case RPCMethod.ERROR_RESPONSE: {
        throw new RPCError(response.message);
      }
      default:
        break;
    }
    throw new UnrecognizedMethodError((response as any).method);
  };
}
