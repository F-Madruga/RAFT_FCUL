import Promise from 'bluebird';
import axios from 'axios';
import logger from '../utils/log.util';
import { RPCMethod, RPCRequest, RPCResponse } from '../utils/rpc.util';
import { RPCError, UnrecognizedMethodError } from '../utils/error.util';

export type RaftClientOptions = {
  servers: string[],
  port?: number,
};

export class RaftClient {
  private servers: string[];

  private leader: string;

  private token: string;

  constructor(options: RaftClientOptions) {
    this.servers = [...new Set(options.servers
      .map((s) => s.split(':'))
      .map(([h, p]) => [h, p || options.port || 8080].join(':')))];
    this.leader = this.servers[Math.floor(Math.random() * this.servers.length)];
    this.token = '';
    console.log(this.leader);
  }

  public request = (message: string): Promise<string> => this
    .send({ method: RPCMethod.COMMAND_REQUEST, message })
    .then((response) => {
      switch (response.method) {
        case RPCMethod.LEADER_RESPONSE: {
          this.leader = response.message;
          logger.debug(`Changing leader: ${response.message}`);
          return this.request(message);
        }
        case RPCMethod.COMMAND_RESPONSE: {
          return response.message;
        }
        case RPCMethod.EMPTY_RESPONSE: {
          return '';
        }
        case RPCMethod.ERROR_RESPONSE: {
          throw new RPCError(response.message);
        }
        default:
          break;
      }
      throw new UnrecognizedMethodError((response as any).method);
    });

  private send = (request: RPCRequest) => Promise
    .resolve(axios.post('/', request, { headers: { Authorization: `Bearer ${this.token}` }, baseURL: `http://${this.leader}` }))
    .tap(() => logger.debug(`Sent request: ${request.method}`))
    .then<RPCResponse>((response) => response.data)
    .tap((response) => logger.debug(`Received response: ${response.method}`));
}
