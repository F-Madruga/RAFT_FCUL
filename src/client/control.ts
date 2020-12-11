import blessed from 'blessed';
import chalk from 'chalk';
import WebSocket from 'ws';

const scr = blessed.screen({ smartCSR: true });
const width = 50;
const box = blessed.box({ width, height: 4, border: { type: 'line' } });
scr.append(box);
scr.key(['escape', 'q', 'C-c'], () => process.exit(0));
box.focus();
scr.render();
const set = (servers: { [host: string]: string }) => {
  box.height = Object.keys(servers).length + 2;
  box.setContent(Object.entries(servers)
    .map(([host, state]) => ` ${host}: ${state.padStart(width - host.length + 4, ' ')}`)
    .join('\n'));
  scr.render();
};
const State = {
  DISCONNECTED: chalk.red('DISCONNECTED'),
  FOLLOWER: chalk.blue('FOLLOWER'),
  CANDIDATE: chalk.yellow('CANDIDATE'),
  LEADER: chalk.green('LEADER'),
  UNKNOWN: chalk.red('UNKNOWN'),
};
const state: { [host: string]: string } = {};
['localhost:8082'].map((server) => {
  let ws: WebSocket;
  const connect = () => {
    state[server] = State.DISCONNECTED;
    set(state);
    ws = new WebSocket(`ws://${server}`);
    ws.onmessage = (message) => {
      state[server] = (State as any)[message.data.toString()] || State.UNKNOWN;
      set(state);
    };
    ws.onclose = () => connect();
    ws.onerror = () => connect();
  };
  return connect();
});
// const stateValues = Object.values(State);
// setInterval(() => set({
//   raft_fcul_server_1: stateValues[Math.floor(Math.random() * stateValues.length)],
//   raft_fcul_server_2: stateValues[Math.floor(Math.random() * stateValues.length)],
//   raft_fcul_server_3: stateValues[Math.floor(Math.random() * stateValues.length)],
//   raft_fcul_server_4: stateValues[Math.floor(Math.random() * stateValues.length)],
// }), 2000);
