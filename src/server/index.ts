import dotenv from 'dotenv';
import logger from '../utils/log.util';
import { RaftServer } from './server';
import * as store from './store';

dotenv.config({ path: './config/.env-server' });
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
  handler: execute,
});
// const controlPort = parseInt(process.env.CONTROL_PORT || '8082', 10);
// new WebSocket.Server({ port: controlPort },
//   () => logger.info(`Listening for control connections on port ${controlPort}`))
//   .on('connection', (ws) => {
//     const handlers = {
//       state: (state: RaftState) => ws.send(JSON.stringify({ state })),
//     };
//     Object.entries(handlers).map(([event, handler]) => server.on(event, handler));
//     const cleanUp = () => Object.entries(handlers)
//       .map(([event, handler]) => server.removeListener(event, handler));
//     ws.on('close', cleanUp).on('error', cleanUp);
//   });
process.addListener('SIGTERM', () => server.close());
