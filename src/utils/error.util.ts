export class RPCError extends Error {}

export class UnrecognizedMethodError extends Error {
  constructor(method: string) {
    super(`Unrecognized response method: ${method}`);
  }
}
