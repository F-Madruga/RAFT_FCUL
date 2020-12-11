import Promise from 'bluebird';
import yargs from 'yargs';
import inquirer from 'inquirer';
import chalk from 'chalk';

import load from '../utils/env.util';
import logger from '../utils/log.util';
import { RaftClient } from './client';

const { argv } = yargs(process.argv.slice(2)).options({
  config: { type: 'string', alias: 'c' },
  servers: { type: 'string', alias: 's' },
  port: { type: 'number', alias: 'p' },
  websocket: { type: 'boolean', alias: 'w' },
  interactive: { type: 'boolean', alias: 'i' },
  parallel: { type: 'number', alias: 'P' },
  interval: { type: 'number', alias: 'I' },
});
load(argv.config || process.env.ENV_FILE || './config/.env-client');

const servers = (argv.servers || process.env.SERVERS || 'localhost').split(',');
const port = parseInt(`${argv.port || ''}` || process.env.PORT || '8080', 10);
const websocket = argv.websocket || process.env.WEBSOCKET === 'true' || false;
const interactive = argv.interactive || process.env.INTERACTIVE === 'true' || false;
const parallelRequests = parseInt(`${argv.parallel || ''}` || process.env.PARALLEL_REQUESTS || '1', 10);
const requestInterval = parseInt(`${argv.interval || ''}` || process.env.REQUEST_INTERVAL || '0', 10);

const handler = (response: string) => {
  logger.debug(`Received response: ${response}`);
  const {
    command,
    key,
    value,
    list,
    message,
  } = JSON.parse(response || '{}');
  console.log(chalk.blue(({
    pong: 'Received Pong response',
    get_response: 'Received value:',
    put_response: 'Added value to store:',
    del_response: 'Deleted value from store:',
    list_response: 'List of key/value pairs:',
    cas_response: 'Value updated:',
  } as any)[command] || 'Error processing response:'));
  switch (command) {
    case 'pong':
      break;
    case 'put_response':
      console.log(`    Key: ${key}\n    Value: ${value}`);
      break;
    case 'get_response':
      console.log(`    Key: ${key}\n    Value: ${value}`);
      break;
    case 'del_response':
      console.log(`    Key: ${key}\n    Value: ${value}`);
      break;
    case 'list_response':
      console.log(Object.entries(JSON.parse(list))
        .map(([k, v]) => `    Key: ${k}\n    Value: ${v}`)
        .join('\n'));
      break;
    case 'cas_response':
      console.log(`    Key: ${key}\n    Value: ${value}`);
      break;
    case 'error':
      console.error(chalk.red(`    Error: ${message}`));
      break;
    default:
      console.error(chalk.red('    Error: Unrecognized command'));
  }
};
const client = new RaftClient({
  servers,
  port,
  websocket,
  ...(websocket ? { handler } : {}),
});
logger.info('Started client.');

async function* interactiveGenerator() {
  while (true) {
    yield inquirer
      .prompt([
        {
          type: 'list',
          name: 'command',
          message: 'Command',
          choices: [
            { name: 'Ping', value: 'ping' },
            { name: 'Get', value: 'get' },
            { name: 'Put', value: 'put' },
            { name: 'Delete', value: 'del' },
            { name: 'List', value: 'list' },
            { name: 'CAS', value: 'cas' },
          ],
        },
        {
          type: 'input',
          name: 'key',
          message: 'Please specify a key',
          when: (answers) => ['get', 'put', 'del', 'cas'].includes(answers.command),
        },
        {
          type: 'input',
          name: 'value',
          message: 'Please specify a value',
          when: (answers) => ['put'].includes(answers.command),
        },
        {
          type: 'input',
          name: 'vOld',
          message: 'Please specify the current value',
          when: (answers) => ['cas'].includes(answers.command),
        },
        {
          type: 'input',
          name: 'vNew',
          message: 'Please specify the new value',
          when: (answers) => ['cas'].includes(answers.command),
        },
      ])
      .then((answers) => {
        const request = JSON.stringify({
          command: answers.command,
        });
        logger.debug(`Sending request: ${request}`);
        console.log(chalk.green(({
          get: `Requesting value with key ${answers.key}`,
          put: `Adding value ${answers.value} to key ${answers.key}`,
          del: `Deleting value from key ${answers.key}`,
          list: 'Listing all key/value pairs',
          cas: `Updating key ${answers.key}: changing value ${answers.vOld} to value ${answers.vNew}`,
        } as any)[answers.command] || 'Sending Ping request'));
        return client.request(request)
          .tap((response) => (websocket ? undefined : handler(response)));
      })
      .catch((error) => {
        if (error.isTtyError) {
          console.error(chalk.red('Error sending request: Prompt couldn\'t be rendered in the current environment'));
        } else {
          console.error(chalk.red(`Error sending request: ${error.message}`));
        }
      });
  }
}
async function* generator() {
  while (true) {
    const request = JSON.stringify({ command: 'ping' });
    logger.info(`Sending request: ${request}`);
    yield client.request(request)
      .tap(() => Promise.delay(requestInterval))
      .catch((error) => logger.error(`Error sending request: ${error.message}`));
  }
}
const autoRequest = async () => {
  // eslint-disable-next-line no-restricted-syntax
  for await (const response of generator()) {
    logger.debug(`Received response: ${response}`);
  }
};
if (interactive) {
  (async () => {
    // eslint-disable-next-line no-restricted-syntax
    for await (const response of interactiveGenerator()) {
      logger.silent(response || '');
    }
  })();
} else {
  Array(parallelRequests).fill(0).map(() => autoRequest());
}
