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
  private entries: LogEntry[] = [];

  public addEntry = (entry: LogEntry) => {
    this.entries.push(entry);
  };

  public getLogEntry = (index: number) => this.entries[index];

  public get isEmpty() { return this.entries.length <= 0; }
}
