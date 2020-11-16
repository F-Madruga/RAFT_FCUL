import load from '../utils/env.util';
import logger from '../utils/log.util';
import { RaftServer } from './server';
import * as store from './store';

load(process.env.ENV_FILE || './config/.env-server');
const execute = (message: string) => {
  logger.debug(`New message: ${message}`);
  let response;
  try {
    const request = JSON.parse(message);
    switch (request.command) {
      case 'ping': {
        response = { command: 'pong' };
        break;
      }
      case 'put': {
        store.put(request.key, request.value);
        response = { command: 'put_response', key: request.key, value: request.value };
        break;
      }
      case 'get': {
        response = { command: 'get_response', key: request.key, value: store.get(request.key) };
        break;
      }
      case 'del': {
        response = { command: 'del_response', key: request.key, value: store.del(request.key) };
        break;
      }
      case 'list': {
        response = { command: 'list_response', list: store.list() };
        break;
      }
      case 'cas': {
        response = {
          command: 'cas_response',
          key: request.key,
          value: store.cas(request.key, request.vOld, request.vNew),
        };
        break;
      }
      default: {
        response = { command: 'error', message: 'Unrecognized command.' };
        break;
      }
    }
  } catch (e) {
    response = { command: 'error', message: 'Unprocessable request.' };
  }
  logger.debug(`Sending response: ${JSON.stringify(response)}`);
  return JSON.stringify(response);
};
const server = new RaftServer({
  host: process.env.HOST!,
  servers: (process.env.SERVERS || '').split(',').filter((s) => !!s),
  clientPort: parseInt(process.env.CLIENT_PORT || '8080', 10),
  serverPort: parseInt(process.env.SERVER_PORT || '8081', 10),
  minimumElectionTimeout: parseInt(process.env.MINIMUM_ELECTION_TIMEOUT || '150', 10),
  maximumElectionTimeout: parseInt(process.env.MAXIMUM_ELECTION_TIMEOUT || '300', 10),
  heartbeatTimeout: parseInt(process.env.HEARTBEAT_TIMEOUT || '50', 10),
  handler: execute,
});
process.addListener('SIGTERM', () => server.close());
