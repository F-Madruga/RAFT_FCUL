import { render } from 'preact';
import { useState } from 'preact/hooks';
// import { Button } from '@material-ui/core';
// import * as materialButton from 'preact-material-components/Button';
// import 'preact-material-components/Button/style.css';
// import 'preact-material-components/Theme/style.css';

const Command = {
  NONE: 'none',
  PING: 'ping',
  GET: 'get',
  PUT: 'put',
  DELETE: 'delete',
  LIST: 'list',
  CAS: 'cas',
};

const RPCMethod = {
  COMMAND_REQUEST: 'COMMAND_REQUEST',
  LEADER_RESPONSE: 'LEADER_RESPONSE',
  COMMAND_RESPONSE: 'COMMAND_RESPONSE',
  ERROR_RESPONSE: 'ERROR_RESPONSE',
};

const App = () => {
  const [command, setCommand] = useState(Command.NONE);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [vOld, setVOld] = useState('');
  const [vNew, setVNew] = useState('');
  const [response, setResponse] = useState('');
  // TODO: add url input (cookie)
  const [leader, setLeader] = useState('localhost:8011');
  const [token, setToken] = useState();
  // eslint-disable-next-line no-undef
  const request = () => fetch(`http://${leader}`, {
    method: 'post',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      command,
      key,
      value,
      vOld,
      vNew,
    }),
  })
    .then((r) => r.data)
    .then((data) => {
      switch (data.method) {
        case RPCMethod.LEADER_RESPONSE: {
          setLeader(data.message);
          return request();
        }
        case RPCMethod.COMMAND_RESPONSE: {
          if (data.clientId) setToken(data.clientId);
          setResponse(data);
          return data.message;
        }
        case RPCMethod.ERROR_RESPONSE: {
          throw new Error(data.message);
        }
        default:
          throw new Error('Unknown error');
      }
    })
    .catch((error) => <span>{`An error has ocurred: ${error.message}`}</span>)
    .then((r) => setResponse(r));
  const renderSwitch = () => {
    switch (command) {
      case Command.PING:
        return <button onClick={() => request()}>Send</button>;
      case Command.GET:
        return (
          <>
            <input type='text' placeholder='Key' onchange={(e) => setKey(e.target.value)} />
            <br/>
            <button onClick={() => request()}>Send</button>
          </>
        );
      case Command.PUT:
        return (
          <>
            <input type='text' placeholder='Key' onchange={(e) => setKey(e.target.value)} />
            <br/>
            <input type='text' placeholder='Value' onchange={(e) => setValue(e.target.value)} />
            <br/>
            <button onClick={() => request()}>Send</button>
          </>
        );
      case Command.DELETE:
        return (
          <>
            <input type='text' placeholder='Key' onchange={(e) => setKey(e.target.value)} />
            <br/>
            <button onClick={() => request()}>Send</button>
          </>
        );
      case Command.LIST:
        return <button onClick={() => request()}>Send</button>;
      case Command.CAS:
        return (
          <>
            <input type='text' placeholder='Key' onchange={(e) => setKey(e.target.value)} />
            <br/>
            <input type='text' placeholder='Old Value' onchange={(e) => setVOld(e.target.value)} />
            <br/>
            <input type='text' placeholder='New Value' onchange={(e) => setVNew(e.target.value)} />
            <br/>
            <button onClick={() => request()}>Send</button>
          </>
        );
      default:
        return '';
    }
  };
  const renderResponse = () => {
    switch (response.command) {
      case 'put_response':
        return (
          <>
            <span>{`Key: ${response.key}`}</span>
            <br/>
            <span>{`Value: ${response.value}`}</span>
          </>
        );
      case 'get_response':
        return (
          <>
            <span>{`Key: ${response.key}`}</span>
            <br/>
            <span>{`Value: ${response.value}`}</span>
          </>
        );
      case 'del_response':
        return (
          <>
            <span>{`Key: ${response.key}`}</span>
            <br/>
            <span>{`Value: ${response.value}`}</span>
          </>
        );
      case 'list_response':
        return (
          <>
            {Object.entries(response.list)
              .map(([k, v]) => (
                <>
                  <span>{`Key: ${k}`}</span>
                  <br/>
                  <span>{`Value: ${v}`}</span>
                </>
              )).join(<br/>)}
          </>
        );
      case 'cas_response':
        return (
          <>
            <span>{`Key: ${response.key}`}</span>
            <br/>
            <span>{`Value: ${response.value}`}</span>
          </>
        );
      default:
        return '';
    }
  };
  return (
    <>
      <h1>Raft Web Client</h1>
      {/* <materialButton.Button onClick={() => setCount(count + 1)}>Hello World</materialButton.Button> */}
      {/* <br/> */}
      <button onClick={() => setCommand(Command.PING)}>Ping</button>
      <button onClick={() => setCommand(Command.GET)}>Get</button>
      <button onClick={() => setCommand(Command.PUT)}>Put</button>
      <button onClick={() => setCommand(Command.DELETE)}>Delete</button>
      <button onClick={() => setCommand(Command.LIST)}>List</button>
      <button onClick={() => setCommand(Command.CAS)}>CAS</button>
      <br/>
      <br/>
      {renderSwitch()}
      <br/>
      <br/>
      {renderResponse()}
      <br/>
      <br/>
      {/* TODO: add control panel */}
      Francisco Madruga, João Loureiro, Pedro Rosa | TFD 2020/2021 | FCUL
    </>
  );
};

render(<App />, window.document.body);
