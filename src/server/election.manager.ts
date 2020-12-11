import { EventEmitter } from 'events';

import logger from '../utils/log.util';
import { State } from './state';

export type ElectionManagerOptions = {
  state: State,
  minimumElectionTimeout?: number,
  maximumElectionTimeout?: number,
};

export class ElectionManager extends EventEmitter {
  private _electionTimer?: NodeJS.Timeout;
  private _state: State;
  private _minimumElectionTimeout: number;
  private _maximumElectionTimeout: number;

  constructor(options: ElectionManagerOptions) {
    super();
    this._state = options.state;
    this._minimumElectionTimeout = options.minimumElectionTimeout || 150;
    this._maximumElectionTimeout = options.maximumElectionTimeout || 300;
    this.start();
  }

  private start = () => {
    // logger.debug('Start election timer');
    if (this._electionTimer) clearTimeout(this._electionTimer);
    const task = this.startElection;
    this._electionTimer = setTimeout(() => task(), Math.floor(Math.random()
      * (this._maximumElectionTimeout - this._minimumElectionTimeout + 1))
      + this._minimumElectionTimeout);
  };

  private startElection = () => {
    logger.debug('Started election');
    this._state = RaftState.CANDIDATE;
    this._currentTerm += 1;
    this._votedFor = this._host;
    this.start();
    const lastEntry: LogEntry = this._log[this._log.length - 1];
    const result = Promise
      .some(
        this._replicas.map((replica) => replica
          .requestVote(this._currentTerm, this._host,
            (lastEntry || {}).index || 0, (lastEntry || {}).term || this._currentTerm)
          .tap((response) => {
            logger.debug(`${replica.host} vote: ${response.voteGranted}`);
            if (response.term > this._currentTerm) {
              // this._votedFor = undefined;
              logger.debug(`Changing leader: ${replica.host}`);
              this.setLeader(replica.host, response.term);
              result.cancel();
            }
            if (!response.voteGranted) {
              return Promise.reject(new Error());
            }
            return undefined;
          })),
        Math.ceil(this._replicas.length / 2),
      )
      .then(() => {
        logger.debug('Elected leader');
        this.setState = RaftState.LEADER;
        this._leader = this._host;
        // this._votedFor = undefined;
        if (this._electionTimer) clearTimeout(this._electionTimer);
      })
      .then(() => this._replicas
        .map((replica) => replica
          .appendEntries(this._currentTerm, this._host, (lastEntry || {}).term || this._currentTerm,
            this._commitIndex, this._log, (this._log[this._log.length - 1] || {}).index || 0)
          .catch(() => undefined)))
      .then(() => this.startHeartbeatTimer())
      // .tapCatch((e) => e.map(console.log)) // ! delete after fix
      .catch(() => {
        logger.debug('Not enough votes');
        this.setState = RaftState.FOLLOWER;
        // this._votedFor = undefined;
      });
    return result;
  };

  public vote = (candidateId: string, term: number, lastLogIndex: number) => {
    logger.debug(`${term}, ${this._currentTerm}, ${candidateId}, ${this._votedFor}, ${lastLogIndex}, ${(this._log[this._log.length - 1] || {}).index || 0}, ${term >= this._currentTerm
      && (!this._votedFor || this._votedFor === candidateId)
      && lastLogIndex >= ((this._log[this._log.length - 1] || {}).index || 0)}`);
    if (term >= this._currentTerm
      && (!this._votedFor || this._votedFor === candidateId)
      && lastLogIndex >= ((this._log[this._log.length - 1] || {}).index || 0)) {
      this._votedFor = candidateId;
      return true;
    }
    return false;
  };
}
