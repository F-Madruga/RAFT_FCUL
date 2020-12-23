import Promise from 'bluebird';
import { Op } from 'sequelize';

import logger from '../utils/log.util';
import { ready, Log as LogModel } from './database';

export type LogEntry = {
  timestamp: string,
  term: number,
  index: number,
  data: string,
  leaderId: string,
  clientId: string,
  operationId: string,
};

export type LogOptions = {
  entries?: LogEntry[];
};

export class Log {
  private _entries: LogEntry[];

  private _ready: Promise<any>;

  constructor(options?: LogOptions) {
    this._entries = (options || {}).entries || [];
    this._ready = ready
      .then(() => LogModel.findAll({ raw: true }))
      .then((entries) => { this._entries = entries as any[]; });
  }

  public get entries() {
    return this._entries;
  }

  public get length() { return this._entries.length; }

  public get isEmpty() { return this._entries.length <= 0; }

  public addEntry = (entry: LogEntry) => {
    if (this._entries.length > 0
      && this._entries[this._entries.length - 1].index >= entry.index) {
      const i = this._entries.findIndex((e) => e.index === entry.index);
      this._entries[i] = entry;
      return ready.then(() => LogModel.update(entry, { where: { index: entry.index } }))
        .then(() => undefined);
    }
    logger.debug(`ADDING_ENTRY_INDEX = ${entry.index}`);
    this._entries.push(entry);
    return ready.then(() => LogModel.create(entry))
      .then(() => undefined);
  };

  public getEntryByIndex = (index: number) => this._entries.find((e) => e.index === index);

  public getLastEntry = () => this._entries[this._entries.length - 1] || ({
    term: 0,
    index: 0,
  } as LogEntry);

  /**
   * Slice with inclusive end
   * @param end Inclusive end
   */
  public slice = (start: number, end?: number) => {
    const startIndex = this._entries.findIndex((e) => e.index === start);
    const endIndex = end !== undefined
      ? this._entries.findIndex((e) => e.index === end) : undefined;
    if (startIndex >= 0 && (endIndex || 0) >= 0) {
      return this._entries.slice(startIndex, endIndex ? endIndex + 1 : undefined);
    }
    return [];
  };

  public truncate = (lastIndex: number) => {
    const endIndex = this._entries.findIndex((e) => e.index === lastIndex);
    this._entries = this._entries.slice(endIndex === -1 ? 0 : endIndex + 1);
    return LogModel.destroy({ where: { index: { [Op.lte]: lastIndex } } });
  };

  public get ready() {
    return this._ready;
  }
}
