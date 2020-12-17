import { EventEmitter } from 'events';

// import logger from '../utils/log.util';
import { RPCInstallSnapshotRequest } from '../utils/rpc.util';
import { State } from './state';
import { Replica } from './replica';
import logger from '../utils/log.util';

export type SnapshotManagerOptions = {
  state: State,
  host: Replica,
  replicas: Replica[],
};

export class SnapshotManager extends EventEmitter {
  private _state: State;
  private _host: Replica;
  private _replicas: Replica[];

  constructor(options: SnapshotManagerOptions) {
    super();
    this._state = options.state;
    this._host = options.host;
    this._replicas = options.replicas;
  }

  public install = (request: RPCInstallSnapshotRequest) => this._state.installSnapshot({
    lastIncludedIndex: request.lastIncludedIndex,
    lastIncludedTerm: request.lastIncludedTerm,
    data: JSON.parse(request.data.toString()),
  });

  public snapshot = () => {
    const snapshot = this._state.snapshot();
    logger.debug(`New snapshot: ${this._state.toString()}`);
    return this._replicas.map((replica) => replica.installSnapshot(snapshot));
  };
}
