import { Sequelize, DataTypes } from 'sequelize';

const Client = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_FILE || 'Raft_DB.db',
});

const Log = Client.define('Log', {
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
}, {});

export { Client, Log };
