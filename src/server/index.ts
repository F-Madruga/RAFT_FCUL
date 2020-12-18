import Promise from 'bluebird';
import yargs from 'yargs';
import { Server as WebSocketServer } from 'ws';

import load from '../utils/env.util';
import logger from '../utils/log.util';
import { Event } from '../utils/constants.util';
import { RaftServer } from './server';
import { Store } from './store';

Promise.config({ cancellation: true });
const { argv } = yargs(process.argv.slice(2)).options({
  config: { type: 'string', alias: 'c' },
  host: { type: 'string', alias: 'H' },
  port: { type: 'number', alias: 'p' },
  servers: { type: 'string', alias: 's' },
  clientPort: { type: 'number', alias: 'C' },
  serverPort: { type: 'number', alias: 'S' },
  controlPort: { type: 'number', alias: 'O' },
  minimumElectionTimeout: { type: 'number', alias: 'e' },
  maximumElectionTimeout: { type: 'number', alias: 'E' },
  heartbeatTimeout: { type: 'number', alias: 't' },
  snapshotSize: { type: 'number', alias: 'n' },
});
load(argv.config || process.env.ENV_FILE || './config/.env-server');

const server = new RaftServer({
  host: argv.host || process.env.HOST || 'localhost',
  port: parseInt(`${argv.port || ''}` || process.env.PORT || '8081', 10),
  servers: (argv.servers || process.env.SERVERS || '').split(',').filter((s) => !!s),
  clientPort: parseInt(`${argv.clientPort || ''}` || process.env.CLIENT_PORT || '8080', 10),
  serverPort: parseInt(`${argv.serverPort || ''}` || process.env.SERVER_PORT || '8081', 10),
  minimumElectionTimeout: parseInt(`${argv.minimumElectionTimeout || ''}`
    || process.env.MINIMUM_ELECTION_TIMEOUT || '150', 10),
  maximumElectionTimeout: parseInt(`${argv.maximumElectionTimeout || ''}`
    || process.env.MAXIMUM_ELECTION_TIMEOUT || '300', 10),
  heartbeatTimeout: parseInt(`${argv.heartbeatTimeout || ''}`
    || process.env.HEARTBEAT_TIMEOUT || '50', 10),
  store: new Store(),
  snapshotSize: parseInt(`${argv.snapshotSize || ''}` || process.env.SNAPSHOT_SIZE || '10', 10),
});

const controlPort = parseInt(`${argv.controlPort || ''}` || process.env.CONTROL_PORT || '8082', 10);
const controlServer = new WebSocketServer({ port: controlPort },
  () => logger.info(`Listening for control connections on port ${controlPort}`));
controlServer.on('connection', (ws) => {
  const socket = ws;
  const listener = (state: string) => ws.send(state);
  server.addListener(Event.STATE_CHANGED, listener);
  socket.onclose = () => server.removeListener(Event.STATE_CHANGED, listener);
  socket.onerror = () => server.removeListener(Event.STATE_CHANGED, listener);
});

process.addListener('SIGTERM', () => server.close());
