import { LogEntry } from '../server/log';

export enum RPCMethod {
  COMMAND_REQUEST = 'COMMAND_REQUEST',
  APPEND_ENTRIES_REQUEST = 'APPEND_ENTRIES_REQUEST',
  REQUEST_VOTE_REQUEST = 'REQUEST_VOTE_REQUEST',
  LEADER_RESPONSE = 'LEADER_RESPONSE',
  COMMAND_RESPONSE = 'COMMAND_RESPONSE',
  APPEND_ENTRIES_RESPONSE = 'APPEND_ENTRIES_RESPONSE',
  REQUEST_VOTE_RESPONSE = 'VOTE_RESPONSE',
  ERROR_RESPONSE = 'ERROR_RESPONSE',
}

export type RPCCommandRequest = {
  method: RPCMethod.COMMAND_REQUEST,
  message: string,
};

export type RPCClientRequest = RPCCommandRequest;

export type RPCLeaderResponse = {
  method: RPCMethod.LEADER_RESPONSE,
  message: string,
};

export type RPCCommandResponse = {
  method: RPCMethod.COMMAND_RESPONSE,
  message: string,
};

export type RPCErrorResponse = {
  method: RPCMethod.ERROR_RESPONSE,
  message: string,
};
export type RPCClientResponse = RPCLeaderResponse | RPCCommandResponse | RPCErrorResponse;

export type RPCAppendEntriesRequest = {
  method: RPCMethod.APPEND_ENTRIES_REQUEST,
  term: number,
  leaderId: string,
  prevLogIndex: number,
  prevLogTerm: number,
  entries: LogEntry[],
  leaderCommit: number
};

export type RPCRequestVoteRequest = {
  method: RPCMethod.REQUEST_VOTE_REQUEST,
  term: number,
  candidateId: string,
  lastLogIndex: number,
  lastLogTerm: number,
};

export type RPCServerRequest = RPCAppendEntriesRequest | RPCRequestVoteRequest;

export type RPCAppendEntriesResponse = {
  method: RPCMethod.APPEND_ENTRIES_RESPONSE,
  term: number,
  success: boolean
};

export type RPCRequestVoteResponse = {
  method: RPCMethod.REQUEST_VOTE_RESPONSE,
  term: number,
  voteGranted: boolean,
};

export type RPCServerResponse = RPCAppendEntriesResponse | RPCRequestVoteResponse | RPCErrorResponse;

export type RPCRequest = RPCClientRequest | RPCServerRequest;

export type RPCResponse = RPCClientResponse | RPCServerResponse;

export type RPCMessage = RPCRequest | RPCResponse;
