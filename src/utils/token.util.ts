import Promise from 'bluebird';
import paseto from 'paseto';
import crypto from 'crypto';

const key = crypto.createSecretKey(Buffer
  .from(process.env.TOKEN_KEY || '01234567890123456789012345678901'));

export const encrypt = (clientId: string) => Promise
  .resolve(paseto.V2.encrypt({ sub: clientId }, key, { iat: false }));

export const decrypt = (token: string) => Promise.resolve(paseto.V2.decrypt(token, key, {}));
