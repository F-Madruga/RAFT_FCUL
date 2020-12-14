import Promise from 'bluebird';
import yargs from 'yargs';
import { Sequelize, DataTypes } from 'sequelize';

import logger from '../utils/log.util';

const { argv } = yargs(process.argv.slice(2)).options({
  host: { type: 'string', alias: 'H' },
  databaseUrl: { type: 'string', alias: 'd' },
  databaseFile: { type: 'string', alias: 'D' },
});
const url = argv.databaseUrl || process.env.DATABASE_URL
  || `sqlite://${argv.database || process.env.DATABASE_FILE
    || `raft_${argv.host || process.env.HOST || 'database'}.db`}`;
export const Client = new Sequelize(url, {
  // dialect: 'sqlite',
  // storage: argv.database || process.env.DATABASE_FILE
  //   || `raft_${argv.host || process.env.HOST || 'database'}.db`,
  logging: false,
});

export const Log = Client.define('Log', {
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  term: {
    type: DataTypes.NUMBER,
    allowNull: false,
  },
  index: {
    type: DataTypes.NUMBER,
    allowNull: false,
    primaryKey: true,
  },
  data: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  leaderId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clientId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  operationId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'logs',
  timestamps: false,
});

export const State = Client.define('State', {
  currentTerm: {
    type: DataTypes.NUMBER,
    allowNull: false,
    primaryKey: true,
  },
  votedFor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'state',
  timestamps: false,
});

export const Snapshot = Client.define('Snapshot', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'snapshot',
  timestamps: false,
});

export const ready = Promise.race([
  Client.sync(),
  new Promise((resolve, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
])
  .then(() => ({ Log, State, Snapshot }))
  .tapCatch((e) => logger.error(`Error synchronizing database: ${e.message}`))
  .catch(() => process.exit(1));

export default {
  Client,
  Log,
  State,
  Snapshot,
  ready,
};
