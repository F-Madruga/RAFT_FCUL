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
  database1:
    image: postgres:13.1-alpine
    container_name: raft_fcul_database_1
    stdin_open: true
    tty: true
    networks:
      - raft_fcul_network
    environment:
      POSTGRES_DB: raft_fcul
      POSTGRES_USER: user_with_big_pp
      POSTGRES_PASSWORD: send_bobs

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
    depends_on:
      - database1
    environment:
      - SERVERS=raft_fcul_server_2
      - HOST=raft_fcul_server_1
      - LOG_LEVEL=debug
      - CLIENT_PORT=8080
      - SERVER_PORT=8081
      - MINIMUM_ELECTION_TIMEOUT=150
      - MAXIMUM_ELECTION_TIMEOUT=300
      - HEARTBEAT_TIMEOUT=50
      - DATABASE_URL=postgres://user_with_big_pp:send_bobs@raft_fcul_database_1:5432/raft_fcul

  database2:
    image: postgres:13.1-alpine
    container_name: raft_fcul_database_2
    stdin_open: true
    tty: true
    networks:
      - raft_fcul_network
    environment:
      POSTGRES_DB: raft_fcul
      POSTGRES_USER: user_with_big_pp
      POSTGRES_PASSWORD: send_bobs

  server2:
    build:
      context: .
      dockerfile: ./docker/Dockerfile.server
    image: raft_fcul_server
    container_name: raft_fcul_server_2
    stdin_open: true
    tty: true
    networks:
      - raft_fcul_network
    depends_on:
      - database2
    environment:
      - SERVERS=raft_fcul_server_1
      - HOST=raft_fcul_server_2
      - LOG_LEVEL=debug
      - CLIENT_PORT=8080
      - SERVER_PORT=8081
      - MINIMUM_ELECTION_TIMEOUT=150
      - MAXIMUM_ELECTION_TIMEOUT=300
      - HEARTBEAT_TIMEOUT=50
      - DATABASE_URL=postgres://user_with_big_pp:send_bobs@raft_fcul_database_2:5432/raft_fcul

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
      - INTERACTIVE=false
      - PARALLEL_REQUESTS=1
      - REQUEST_INTERVAL=5000
    depends_on:
      - server1
      - server2

networks:
  raft_fcul_network:
```

## Useful commands

| Command                               | Behavior                                                              | Observations                                                                                 |
| :------------------------------------ | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `npm run docker:compose:down`         | Delete all raft project containers and images                         | Doesn't include builder images                                                               |
| `npm run docker:prune`                | Delete **ALL** dangling images **(use with caution)**                 | Include all dangling images on the machine even if it's not from raft **(use with caution)** |
| `npm run docker:clean`                | Runs docker:compose:down and then docker:prune **(use with caution)** | Same observation as npm run docker:prune                                                     |
| `npm run docker:rebuild`              | Runs docker:clean and then docker:compose:up **(use with caution)**   | Same observation as npm run docker:prune                                                     |
| `npm run docker:list`                 | List all raft services                                                |                                                                                              |
| `npm run docker:stop -- {service}`    | Stop a service                                                        | Where "{service}" is the name of the service.                                                |
| `npm run docker:restart -- {service}` | Start a stopped service                                               | Where "{service}" is the name of the service.                                                |
