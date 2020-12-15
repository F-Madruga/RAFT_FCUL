import Promise from 'bluebird';
import yargs from 'yargs';
import { Sequelize, DataTypes } from 'sequelize';

import logger from '../utils/log.util';

const { argv } = yargs(process.argv.slice(2)).options({
  host: { type: 'string', alias: 'H' },
  database: { type: 'string', alias: 'd' },
  databaseHost: { type: 'string' },
  databasePort: { type: 'number' },
  databaseUsername: { type: 'string' },
  databasePassword: { type: 'string' },
  databaseDialect: { type: 'string' },
});
// const url = argv.databaseUrl || process.env.DATABASE_URL
//   || `sqlite://${argv.database || process.env.DATABASE_FILE
//     || `raft_${argv.host || process.env.HOST || 'database'}.db`}`;
const database = argv.database || process.env.DATABASE_NAME || 'raft_fcul';
const host = argv.databaseHost || process.env.DATABASE_HOST || 'localhost';
const port = argv.databasePort || parseInt(`${process.env.DATABASE_PORT || 3306}`, 10);
const username = argv.databaseUsername || process.env.DATABASE_USERNAME;
const password = argv.databasePassword || process.env.DATABASE_PASSWORD;
const dialect = argv.databaseDialect || process.env.DATABASE_DIALECT || 'mysql';
export const Client = new Sequelize({
  database,
  host,
  port,
  dialect: dialect as any,
  username,
  password,
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
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  index: {
    type: DataTypes.INTEGER,
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
    type: DataTypes.INTEGER,
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
