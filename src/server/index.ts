import yargs from 'yargs';
import { Server as WebSocketServer } from 'ws';

import load from '../utils/env.util';
import { RaftServer } from './server';
import { Store } from './store';

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
});
load(argv.config || process.env.ENV_FILE || './config/.env-server');

const server = new RaftServer({
  host: argv.host || process.env.HOST || 'locahost',
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
});

const control = new WebSocketServer({
  port: parseInt(`${argv.controlPort || ''}` || process.env.CONTROL_PORT || '8082', 10),
});
control.on('connection', (ws) => ws.on('open', () => {
  const listener = (state: string) => ws.send(state);
  server.addListener('stateChanged', listener);
  ws.on('close', () => server.removeListener('stateChanged', listener));
  ws.on('error', () => server.removeListener('stateChanged', listener));
}));

process.addListener('SIGTERM', () => server.close());
