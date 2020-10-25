import yaml from 'js-yaml';
import fs from 'fs';

const loadFileSync = (fileName: string) => {
  try {
    return yaml.safeLoad(fs.readFileSync(fileName, 'utf8'));
  } catch (e) {
    return {};
  }
};

process.env = Object.assign(loadFileSync(process.env.ENV_FILE || ''), process.env);
