export type LogEntry = {
  timestamp: string,
  term: number,
  index: number,
  data: string,
  leaderId: string,
  clientId: string,
  operationId: string,
};

// export class Log {
//   private _entries: LogEntry[] = [];

//   public addEntry = (entry: LogEntry) => {
//     this._entries.push(entry);
//   };

//   public get length() { return this._entries.length; }

//   public getLogEntry = (index: number) => this._entries[index];

//   public get isEmpty() { return this._entries.length <= 0; }

//   public get currentLeader() { return this._entries[this._entries.length - 1].leaderId; }
// }
