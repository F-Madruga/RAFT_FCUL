import Promise from 'bluebird';
import { EventEmitter } from 'events';

import logger from '../utils/log.util';
import { RPCRequestVoteRequest } from '../utils/rpc.util';
import { State, RaftState } from './state';
import { LogEntry } from './log';

export type ElectionManagerOptions = {
  state: State,
  minimumElectionTimeout?: number,
  maximumElectionTimeout?: number,
};

export class ElectionManager extends EventEmitter {
  private _timer?: NodeJS.Timeout;
  private _state: State;
  private _minimumTimeout: number;
  private _maximumTimeout: number;

  constructor(options: ElectionManagerOptions) {
    super();
    this._state = options.state;
    this._minimumTimeout = options.minimumElectionTimeout || 150;
    this._maximumTimeout = options.maximumElectionTimeout || 300;
  }

  public start = () => {
    this.stop();
    const timeout = Math.floor(
      Math.random() * (this._maximumTimeout - this._minimumTimeout + 1),
    ) + this._minimumTimeout;
    this._timer = setTimeout(() => this.startElection, timeout);
  };

  public stop = () => {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  };

  private startElection = () => {
    // Acaba quando:
    // - Ganha a eleição
    // - Outro server diz que é o líder
    // - Tempo de eleição termina (ninguem ganha)
    logger.debug('Election started');
    this._state.state = RaftState.CANDIDATE;
    this._state.setLeader(this._state.currentTerm + 1, this._state.host.toString());
    const lastEntry: LogEntry = (this._state.log[this._state.log.length - 1] || {
      term: 0,
      index: 0,
    } as LogEntry);
    const term = this._state.currentTerm;
    const result = Promise
      .some(
        this._state.replicas.map((replica) => replica
          .requestVote(term, this._state.host.toString(), lastEntry.index, lastEntry.term)
          .tap((response) => {
            if (response.term > term) {
              this._state.state = RaftState.FOLLOWER;
              result.cancel();
            }
            if (!response.voteGranted || response.term !== term) {
              return Promise.reject(new Error());
            }
            return Promise.resolve();
          })
          .tapCatch(() => logger.debug(`Replica ${replica.toString()} didn't respond to vote`))),
        this._state.replicas.length / 2,
      )
      .then(() => {
        this._state.state = RaftState.LEADER;
      })
      .catch(() => {
        this._state.state = RaftState.FOLLOWER;
      });
    return result;
  };

  public processVote = (request: RPCRequestVoteRequest) => {
    if (true) {
      this._state.state = RaftState.FOLLOWER;
      this._state.setLeader(request.term, request.candidateId);
      return true;
    }
    return false;
  };

  // public vote = (candidateId: string, term: number, lastLogIndex: number) => {
  //   if (term >= this._currentTerm
  //     && (!this._votedFor || this._votedFor === candidateId)
  //     && lastLogIndex >= ((this._log[this._log.length - 1] || {}).index || 0)) {
  //     this._votedFor = candidateId;
  //     return true;
  //   }
  //   return false;
  // };
}
