import Promise from 'bluebird';
import yargs from 'yargs';
import { Sequelize, DataTypes } from 'sequelize';

import logger from '../utils/log.util';

const { argv } = yargs(process.argv.slice(2)).options({
  host: { type: 'string', alias: 'H' },
  database: { type: 'string', alias: 'd' },
});
export const Client = new Sequelize({
  dialect: 'sqlite',
  storage: argv.database || process.env.DATABASE_FILE
    || `raft_${argv.host || process.env.HOST || 'database'}.db`,
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
  },
  votedFor: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'state',
  timestamps: false,
});

export const Snapshot = Client.define('Snapshot', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
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
  .tapCatch((e) => logger.error(`Error synchronizing database: ${e.message}`))
  .catch(() => process.exit(1));

export default {
  Client,
  Log,
  State,
  Snapshot,
  ready,
};
