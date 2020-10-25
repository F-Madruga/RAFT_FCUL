import '../utils/env.util';
import logger from '../utils/log.util';
import { RaftClient } from './client';

const servers = (process.env.SERVERS || 'localhost').split(',');
const port = parseInt(process.env.PORT || '8080', 10);
const requestInterval = parseInt(process.env.REQUEST_INTERVAL || '1000', 10);
const client = new RaftClient({ servers, port });
logger.info('Started client.');
setInterval(() => {
  const request = new Date().toISOString();
  logger.info(`Sending request: ${request}`);
  return client.request(request)
    .then((response) => logger.info(`Received response: ${response}`))
    .catch((error) => logger.error(`Error sending request: ${error.message}`));
}, requestInterval);
// TODO: change to promise interval
