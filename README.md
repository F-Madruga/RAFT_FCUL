# RAFT_FCUL

Implementation of [Raft consensus algorithm](https://raft.github.io/)

## Table of Contents

1. [Requirements](##requirements)
2. [Usage](##usage)
3. [Configuration](##configuration)
4. [Useful commands](##useful-commands)

## Requirements

- Node js (npm)
- Docker
- Docker-compose

## Usage

### Start servers and clients

```
npm run docker:compose:up
```

### Stop servers and clients

```
npm run docker:compose:down
```

## Configuration

Setup on the docker-compose.yml the number of server you want to initialize as the example below:

```yaml
version: "3.3"

services:
  server1:
    build:
      context: .
      dockerfile: ./docker/Dockerfile.server
    image: raft_fcul_server
    container_name: raft_fcul_server_1
    stdin_open: true
    tty: true
    networks:
      - raft_fcul_network
    environment:
      - SERVERS=raft_fcul_server_2 # Servers are separated by ","
      - HOST=raft_fcul_server_1
      - LOG_LEVEL=debug
      - CLIENT_PORT=8080
      - SERVER_PORT=8081
      - MINIMUM_ELECTION_TIMEOUT=150
      - MAXIMUM_ELECTION_TIMEOUT=300
      - HEARTBEAT_TIMEOUT=50
      - DATABASE_FILE=Raft_DB.db

  server2:
    build:
      context: .
      dockerfile: ./docker/Dockerfile.server
    image: raft_fcul_server
    container_name: raft_fcul_server_2 # Servers are separated by ","
    stdin_open: true
    tty: true
    networks:
      - raft_fcul_network
    environment:
      - SERVERS=raft_fcul_server_1
      - HOST=raft_fcul_server_2
      - LOG_LEVEL=debug
      - CLIENT_PORT=8080
      - SERVER_PORT=8081
      - MINIMUM_ELECTION_TIMEOUT=150
      - MAXIMUM_ELECTION_TIMEOUT=300
      - HEARTBEAT_TIMEOUT=50
      - DATABASE_FILE=Raft_DB.db

  client:
    build:
      context: .
      dockerfile: ./docker/Dockerfile.client
    image: raft_fcul_client
    stdin_open: true
    tty: true
    networks:
      - raft_fcul_network
    environment:
      - SERVERS=raft_fcul_server_1,raft_fcul_server_2
      - LOG_LEVEL=debug
      - PORT=8080
      - WEBSOCKET=false
      - INTERACTIVE=false # True if you want to control the client, false if you want an automatic client
      - PARALLEL_REQUESTS=1 # If interactive is false, choose how many automatic client exists (number of threads)
      - REQUEST_INTERVAL=5000
    depends_on:
      - server1 # List of all the server service in this file
      - server2

networks:
  raft_fcul_network:
```

## Useful commands

| Command                              | Behavior                                                              | Observations                                                                                 |
| :----------------------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `npm run docker:compose:down`        | Delete all raft project containers and images                         | Doesn't include builder images                                                               |
| `npm run docker:prune`               | Delete **ALL** dangling images **(use with caution)**                 | Include all dangling images on the machine even if it's not from raft **(use with caution)** |
| `npm run docker:clean`               | Runs docker:compose:down and then docker:prune **(use with caution)** | Same observation as npm run docker:prune                                                     |
| `npm run docker:rebuild`             | Runs docker:clean and then docker:compose:up **(use with caution)**   | Same observation as npm run docker:prune                                                     |
| `npm run docker:list`                | List all raft services                                                |                                                                                              |
| `npm run docker:stop --{service}`    | Stop a service                                                        | Where "{service}" is the name of the service.                                                |
| `npm run docker:restart --{service}` | Start a stopped service                                               | Where "{service}" is the name of the service.                                                |
