export enum RPCMethod {
  COMMAND_REQUEST = 'COMMAND_REQUEST',
  APPEND_ENTRIES_REQUEST = 'APPEND_ENTRIES_REQUEST',
  COMMIT_ENTRIES_REQUEST = 'COMMIT_ENTRIES_REQUEST',
  REQUEST_VOTE_REQUEST = 'REQUEST_VOTE_REQUEST',
  LEADER_REQUEST = 'LEADER_REQUEST',
  HEARTBEAT_REQUEST = 'HEARTBEAT_REQUEST',
  LEADER_RESPONSE = 'LEADER_RESPONSE',
  COMMAND_RESPONSE = 'COMMAND_RESPONSE',
  APPEND_ENTRIES_RESPONSE = 'APPEND_ENTRIES_RESPONSE',
  COMMIT_ENTRIES_RESPONSE = 'COMMIT_ENTRIES_RESPONSE',
  VOTE_RESPONSE = 'VOTE_RESPONSE',
  HEARTBEAT_RESPONSE = 'HEARTBEAT_RESPONSE',
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
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
export type RPCEmptyResponse = {
  method: RPCMethod.EMPTY_RESPONSE,
};
export type RPCErrorResponse = {
  method: RPCMethod.ERROR_RESPONSE,
  message: string,
};
export type RPCClientResponse = RPCLeaderResponse | RPCCommandResponse
| RPCEmptyResponse | RPCErrorResponse;

export type RPCAppendEntriesRequest = {
  method: RPCMethod.APPEND_ENTRIES_REQUEST,
  entry: LogEntry,
};
export type RPCCommitEntriesRequest = {
  method: RPCMethod.COMMIT_ENTRIES_REQUEST,
  entry: LogEntry,
};
export type RPCRequestVoteRequest = {
  method: RPCMethod.REQUEST_VOTE_REQUEST,
  term: number,
  index: number,
};
export type RPCLeaderRequest = {
  method: RPCMethod.LEADER_REQUEST,
  message: string,
  term: number,
};
export type RPCHeartbeatRequest = {
  method: RPCMethod.HEARTBEAT_REQUEST,
};
export type RPCServerRequest = RPCAppendEntriesRequest | RPCCommitEntriesRequest
| RPCRequestVoteRequest | RPCLeaderRequest | RPCHeartbeatRequest;

export type RPCAppendEntriesResponse = {
  method: RPCMethod.APPEND_ENTRIES_RESPONSE,
};
export type RPCCommitEntriesResponse = {
  method: RPCMethod.COMMIT_ENTRIES_RESPONSE,
};
export type RPCVoteResponse = {
  method: RPCMethod.VOTE_RESPONSE,
  vote: boolean,
};
export type RPCHeartbeatResponse = {
  method: RPCMethod.HEARTBEAT_RESPONSE,
};
export type RPCServerResponse = RPCAppendEntriesResponse | RPCCommitEntriesResponse
| RPCVoteResponse | RPCHeartbeatResponse | RPCEmptyResponse | RPCErrorResponse;

export type RPCRequest = RPCClientRequest | RPCServerRequest;
export type RPCResponse = RPCClientResponse | RPCServerResponse;

export type RPCMessage = RPCRequest | RPCResponse;
