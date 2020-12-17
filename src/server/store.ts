// import logger from '../utils/log.util';

export interface IRaftStore {
  snapshot: () => { [key: string]: string },
  install: (snapshot: { [key: string]: string }) => any,
  apply: (message: string) => any,
  isRead: (message: string) => boolean,
}

export class Store implements IRaftStore {
  private _store: { [key: string]: string };

  constructor() {
    this._store = {};
  }

  public snapshot = () => ({ ...this._store });

  public install = (snapshot: { [key: string]: string }) => {
    this._store = snapshot;
  };

  public put = (key: string, value: string) => { this._store[key] = value; };

  public get = (key: string) => this._store[key];

  public del = (key: string) => {
    const value = this._store[key];
    delete this._store[key];
    return value;
  };

  public list = () => JSON.parse(JSON.stringify(this._store));

  public cas = (key: string, vOld: string, vNew: string) => {
    const value = this._store[key];
    if (value === vOld) this._store[key] = vNew;
    return value;
  };

  public apply = (message: string) => {
    // logger.debug(`Applying message: ${message}`);
    let response;
    try {
      const request = JSON.parse(message);
      switch (request.command) {
        case 'ping': {
          response = { command: 'pong' };
          break;
        }
        case 'put': {
          this.put(request.key, request.value);
          response = { command: 'put_response', key: request.key, value: request.value };
          break;
        }
        case 'get': {
          response = { command: 'get_response', key: request.key, value: this.get(request.key) };
          break;
        }
        case 'del': {
          response = { command: 'del_response', key: request.key, value: this.del(request.key) };
          break;
        }
        case 'list': {
          response = { command: 'list_response', list: this.list() };
          break;
        }
        case 'cas': {
          response = {
            command: 'cas_response',
            key: request.key,
            value: this.cas(request.key, request.vOld, request.vNew),
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
    // logger.debug(`Sending response: ${JSON.stringify(response)}`);
    return JSON.stringify(response);
  };

  public isRead = (message: string) => {
    const request = JSON.parse(message);
    return ['ping', 'get', 'list'].includes(request.command);
  };

  public isWrite = (message: string) => !this.isRead(message);
}
