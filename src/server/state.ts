import Promise from 'bluebird';
import axios from 'axios';
import { nanoid } from 'nanoid';
import { EventEmitter } from 'events';
import logger from '../utils/log.util';

import {
  RPCMethod,
  RPCAppendEntriesRequest,
  RPCCommitEntriesRequest,
  RPCRequestVoteRequest,
  RPCLeaderRequest,
  RPCVoteResponse,
  RPCHeartbeatRequest,
} from '../utils/rpc.util';
import { LogEntry, Log } from './log';

export enum RaftState {
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER',
  CANDIDATE = 'CANDIDATE',
}

export type StateMachineOptions = {
  host: string,
  servers: string[],
  port?: number,
  initialState?: RaftState,
  minimumElectionTimeout?: number,
  maximumElectionTimeout?: number,
  heartbeatTimeout?: number,
};

export class StateMachine extends EventEmitter {
  private raftState: RaftState;

  // eslint-disable-next-line no-undef
  private electionTimer?: NodeJS.Timeout;

  // eslint-disable-next-line no-undef
  private heartbeatTimer?: NodeJS.Timeout;

  private minimumElectionTimeout: number;

  private maximumElectionTimeout: number;

  private heartbeatTimeout: number;

  private numberVotes: number = 0;

  private servers: string[];

  private host: string;

  private raftLeader?: string;

  private raftTerm: number = 0;

  private raftIndex: number = 0;

  private log: Log = new Log();

  private lastCommitedIndex: number = 0;

  constructor(options: StateMachineOptions) {
    super();
    this.raftState = options.initialState || RaftState.FOLLOWER;
    this.minimumElectionTimeout = options.minimumElectionTimeout || 150;
    this.maximumElectionTimeout = options.maximumElectionTimeout || 300;
    this.heartbeatTimeout = options.heartbeatTimeout || 50;
    const [host, port] = options.host.split(':');
    this.host = [host, port || options.port || 8081].join(':');
    this.servers = [...new Set(options.servers
      .map((s) => s.split(':'))
      .map(([h, p]) => [h, p || options.port || 8081].join(':')))];
    this.startElectionTimer();
  }

  private set setState(state: RaftState) {
    this.raftState = state;
    this.emit('state', this.raftState);
  }

  public get state() { return this.raftState; }

  public get leader() { return this.raftLeader; }

  public get term() { return this.raftTerm; }

  public get index() { return this.raftIndex; }

  private startElectionTimer = () => {
    if (this.electionTimer) clearTimeout(this.electionTimer);
    const task = this.startElection;
    this.electionTimer = setTimeout(() => task(), Math.floor(Math.random()
      * (this.maximumElectionTimeout - this.minimumElectionTimeout + 1))
      + this.minimumElectionTimeout);
  };

  private startElection = () => {
    this.raftState = RaftState.CANDIDATE;
    this.raftTerm += 1;
    this.numberVotes = 0;
    this.startElectionTimer();
    // this.vote();
    const request: RPCRequestVoteRequest = {
      method: RPCMethod.REQUEST_VOTE_REQUEST,
      term: this.raftTerm,
      index: this.raftIndex,
    };
    return Promise.all(this.servers
      .filter((s) => !s.startsWith(this.host.split(':')[0]))
      .map((server) => Promise
        .resolve(axios.post(`http://${server}`, request))
        .then((response) => response.data)
        .tap((response: RPCVoteResponse) => response.vote === true && this.vote())
        .catch(() => undefined)));
  };

  public vote = () => {
    if (this.raftState === RaftState.CANDIDATE) {
      this.numberVotes += 1;
      if (this.numberVotes > this.servers.length / 2) {
        this.numberVotes = 0;
        if (this.electionTimer) clearTimeout(this.electionTimer);
        this.setState = RaftState.LEADER;
        const request: RPCLeaderRequest = {
          method: RPCMethod.LEADER_REQUEST,
          message: this.host,
          term: this.raftTerm,
        };
        return Promise.all(this.servers
          .filter((s) => !s.startsWith(this.host.split(':')[0]))
          .map((server) => Promise
            .resolve(axios.post(`http://${server}`, request))
            .catch(() => undefined)))
          .then(() => this.startHeartbeatTimer());
      }
    }
    return undefined;
  };

  public setLeader = (leader: string, term: number) => {
    this.raftState = RaftState.FOLLOWER;
    this.raftLeader = leader;
    this.raftTerm = term;
    logger.debug(`Changing leader: ${leader}`);
    this.startElectionTimer();
  };

  public replicate = (message: string, clientId: string) => {
    // TODO: fix this mess
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      term: this.raftTerm,
      index: this.raftIndex + 1,
      data: message,
      clientId,
      operationId: nanoid(),
      committed: false,
    };

    const appendRequest: RPCAppendEntriesRequest = {
      method: RPCMethod.APPEND_ENTRIES_REQUEST,
      entry: logEntry,
    };

    const commitRequest: RPCCommitEntriesRequest = {
      method: RPCMethod.COMMIT_ENTRIES_REQUEST,
      entry: logEntry,
    };

    Promise.all(this.servers.filter((s) => !s.startsWith(this.host.split(':')[0])))
      .tap(() => logger.debug('Appending entry'))
      .tap(() => this.append(logEntry))
      .tap(() => logger.debug('Sending append entry request to the other servers'))
      .map((server) => Promise
        .resolve(axios.post('/', appendRequest, { baseURL: `http://${server}` }))
        .tap(() => logger.debug(`Append request sent to ${server}`)))
      // .tap(() => this.commitEntry())
      .tap(() => logger.debug('Sending commit entry request to the other servers'))
      .map((server) => Promise
        .resolve(axios.post('/', commitRequest, { baseURL: `http://${server}` }))
        .tap(() => logger.debug(`Commit request sent to ${server}`)));
    // const received: string[] = [];
    // sends to entry to all servers and appends
    // return Promise.all(this.servers
    //   .map((server) => new Promise((resolve, reject) => {
    //     const ws = new WebSocket(`ws://${server}`);
    //     const request: RPCAppendEntriesRequest | RPCCommitEntriesRequest = {
    //       method: entry.committed
    //         ? RPCMethod.COMMIT_ENTRIES_REQUEST : RPCMethod.APPEND_ENTRIES_REQUEST,
    //       entry,
    //     };
    //     return Promise
    //       .try(() => ws.send(JSON.stringify(request)))
    //       .then(() => {
    //         ws.onmessage = (event) => resolve(event.data);
    //         setTimeout(() => reject(), 5000);
    //       });
    //   })
    //     .then(() => {
    //       received.push(server);
    //       if ((received.length + 1) > (this.servers.length + 1) / 2) {
    //         entry.committed = true;
    //         this.log.push(entry);
    //         this.raftIndex += 1;
    //         return Promise.all(this.servers
    //           .filter((s) => received.includes(s))
    //           .map((s) => new Promise((resolve, reject) => {
    //             const ws = new WebSocket(`ws://${s}`);
    //             const request: RPCCommitEntriesRequest = {
    //               method: RPCMethod.COMMIT_ENTRIES_REQUEST,
    //               entry,
    //             };
    //             return Promise.try(() => ws.send(JSON.stringify(request)))
    //               .then(() => {
    //                 ws.onmessage = (event) => resolve(event.data);
    //                 setTimeout(() => reject(), 5000);
    //               });
    //           })));
    //       }
    //       return undefined;
    //     })));
  };

  private startHeartbeatTimer = () => {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    const task = this.sendHeartBeat;
    this.heartbeatTimer = setTimeout(() => task(), this.heartbeatTimeout);
  };

  private sendHeartBeat = () => {
    const request: RPCHeartbeatRequest = {
      method: RPCMethod.HEARTBEAT_REQUEST,
    };
    this.startHeartbeatTimer();
    return Promise.all(this.servers
      .filter((s) => !s.startsWith(this.host.split(':')[0]))
      .map((server) => Promise
        .resolve(axios.post(`http://${server}`, request))
        .then((response) => response.data)
        .catch(() => undefined)));
  };

  public append = (entry: LogEntry) => {
    this.log.addEntry(entry);
    this.raftTerm = entry.term;
    this.raftIndex = entry.index;
    logger.debug('Entry appended');
    // AppendEntries counts as a heartbeat
    // Add to log
    this.heartbeat();
  };

  // public commitEntry = () => {
  //   // TO DO
  //   logger.debug('Entry commited');
  // }

  public heartbeat = () => this.startElectionTimer();
}
