import { LogEntry } from '../server/log';

export enum RPCMethod {
  COMMAND_REQUEST = 'COMMAND_REQUEST',
  APPEND_ENTRIES_REQUEST = 'APPEND_ENTRIES_REQUEST',
  REQUEST_VOTE_REQUEST = 'REQUEST_VOTE_REQUEST',
  INSTALL_SNAPSHOT_REQUEST = 'INSTALL_SNAPSHOT_REQUEST',
  LEADER_RESPONSE = 'LEADER_RESPONSE',
  COMMAND_RESPONSE = 'COMMAND_RESPONSE',
  APPEND_ENTRIES_RESPONSE = 'APPEND_ENTRIES_RESPONSE',
  REQUEST_VOTE_RESPONSE = 'REQUEST_VOTE_RESPONSE',
  INSTALL_SNAPSHOT_RESPONSE = 'INSTALL_SNAPSHOT_RESPONSE',
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
  clientId?: string,
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
  leaderCommit: number,
};

export type RPCRequestVoteRequest = {
  method: RPCMethod.REQUEST_VOTE_REQUEST,
  term: number,
  candidateId: string,
  lastLogIndex: number,
  lastLogTerm: number,
};

export type RPCInstallSnapshotRequest = {
  method: RPCMethod.INSTALL_SNAPSHOT_REQUEST,
  term: number, // leader’s term
  leaderId: string, // so follower can redirect clients
  lastIncludedIndex: number, // the snapshot replaces all entries up through and including this index
  lastIncludedTerm: number, // term of lastIncludedIndex
  offset: number, // byte offset where chunk is positioned in the snapshot file
  data: string | Buffer, // raw bytes of the snapshot chunk, starting at offset
  done: boolean, // true if this is the last chunk
};

export type RPCServerRequest = RPCAppendEntriesRequest
| RPCRequestVoteRequest | RPCInstallSnapshotRequest;

export type RPCAppendEntriesResponse = {
  method: RPCMethod.APPEND_ENTRIES_RESPONSE,
  term: number,
  success: boolean,
};

export type RPCRequestVoteResponse = {
  method: RPCMethod.REQUEST_VOTE_RESPONSE,
  term: number,
  voteGranted: boolean,
};

export type RPCInstallSnapshotResponse = {
  method: RPCMethod.INSTALL_SNAPSHOT_RESPONSE,
  term: number, // currentTerm, for leader to update itself
};

export type RPCServerResponse = RPCAppendEntriesResponse
| RPCRequestVoteResponse | RPCInstallSnapshotResponse | RPCErrorResponse;

export type RPCRequest = RPCClientRequest | RPCServerRequest;

export type RPCResponse = RPCClientResponse | RPCServerResponse;

export type RPCMessage = RPCRequest | RPCResponse;
