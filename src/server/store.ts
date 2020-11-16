const store: { [key: string]: string } = {};

export const put = (key: string, value: string) => { store[key] = value; };

export const get = (key: string) => store[key];

export const del = (key: string) => { const value = store[key]; delete store[key]; return value; };

export const list = () => JSON.parse(JSON.stringify(store));

export const cas = (key: string, vOld: string, vNew: string) => {
  const value = store[key];
  if (value === vOld) store[key] = vNew;
  return value;
};
