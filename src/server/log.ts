export type LogEntry = {
  timestamp: string,
  term: number,
  index: number,
  data: string,
  clientId: string,
  operationId: string,
  committed: boolean,
};

export class Log {
  private _entries: LogEntry[] = [];

  public addEntry = (entry: LogEntry) => {
    this._entries.push(entry);
  };

  public get length() { return this._entries.length; }

  public getLogEntry = (index: number) => this._entries[index];

  public get isEmpty() { return this._entries.length <= 0; }
}
