import { Replica } from './replica';

export enum RaftState {
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER',
  CANDIDATE = 'CANDIDATE',
}

export type StateOptions = {
  host: Replica,
  replicas: Replica[],
};

export class State {
  public state: RaftState;
  public currentTerm: number;
  public lastApplied: number;
  private _host: Replica;
  private _replicas: Replica[];
  public leader?: string;

  constructor(options: StateOptions) {
    this.state = RaftState.FOLLOWER;
    this.currentTerm = 0;
    this.lastApplied = 0;
    this._host = options.host;
    this._replicas = options.replicas;
  }

  public get host() {
    return this._host;
  }

  public get replicas() {
    return this._replicas;
  }
}

// private _votedFor?: string;
// private _log: LogEntry[];
// private _toCommit: { resolve: null | ((result?: any) => void) }[] = [];
// private _commitIndex: number = 0;
// this._log = [];
// Client.sync()
//   .then(() => Log.findAll({ raw: true }))
//   .then((logs) => { this._log = logs as any[]; });
// this.emit('state', this._state);
