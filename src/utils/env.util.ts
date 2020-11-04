import dotenv from 'dotenv';

export default (filename: string) => dotenv.config({ path: filename });
