import Promise from 'bluebird';
import { EventEmitter } from 'events';

import logger from '../utils/log.util';
import { RPCRequestVoteRequest } from '../utils/rpc.util';
import { State, RaftState } from './state';
import { Replica } from './replica';

export type ElectionManagerOptions = {
  state: State,
  host: Replica,
  replicas: Replica[],
  minimumElectionTimeout?: number,
  maximumElectionTimeout?: number,
};

export class ElectionManager extends EventEmitter {
  private _timer?: NodeJS.Timeout;
  private _state: State;
  private _host: Replica;
  private _replicas: Replica[];
  private _minimumTimeout: number;
  private _maximumTimeout: number;

  constructor(options: ElectionManagerOptions) {
    super();
    this._state = options.state;
    this._host = options.host;
    this._replicas = options.replicas;
    this._minimumTimeout = options.minimumElectionTimeout || 150;
    this._maximumTimeout = options.maximumElectionTimeout || 300;
  }

  public start = () => {
    this.stop();
    const timeout = Math.floor(Math.random() * (this._maximumTimeout - this._minimumTimeout + 1))
      + this._minimumTimeout;
    this._timer = setTimeout(() => this.startElection(), timeout);
  };

  public stop = () => {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  };

  private startElection = () => {
    logger.debug('Election started');
    this._state.state = RaftState.CANDIDATE;
    this._state.setCurrentTerm(this._state.currentTerm + 1);
    this._state.setVotedFor(this._host.toString());
    const term = this._state.currentTerm;
    const result = Promise.some(
      this._replicas.map((replica) => replica
        .requestVote(this._host.toString())
        .tap((response) => {
          if (response.term > term) {
            this._state.state = RaftState.FOLLOWER;
            this._state.setCurrentTerm(response.term);
            result.cancel();
          }
          if (!response.voteGranted || response.term !== term) {
            return Promise.reject(new Error());
          }
          return Promise.resolve();
        })
        .tapCatch(() => logger.debug(`Replica ${replica.toString()} responded with no vote`))),
      this._replicas.length / 2,
    )
      .then(() => {
        logger.info(`Elected leader on term ${this._state.currentTerm}`);
        this._state.state = RaftState.LEADER;
        this._state.leader = this._host.host;
        this._replicas.map((replica) => replica.init());
      })
      .catch(() => logger.debug('Not enough votes'));
    return result;
  };

  public processVote = (request: RPCRequestVoteRequest) => {
    logger.debug('Received vote request');
    if (request.term < this._state.currentTerm) {
      return false;
    }
    if (request.term > this._state.currentTerm) {
      this._state.state = RaftState.FOLLOWER;
      this._state.setCurrentTerm(request.term);
    }
    const lastEntry = this._state.getLastLogEntry();
    if ((!this._state.votedFor || this._state.votedFor === request.candidateId)
      && request.lastLogIndex >= lastEntry.index) {
      this._state.setVotedFor(request.candidateId);
      return true;
    }
    return false;
  };
}
