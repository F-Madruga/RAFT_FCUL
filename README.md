# RAFT_FCUL

Implementation of [Raft consensus algorithm](https://raft.github.io/)

## Requirements

- Node js (npm)
- Docker
- Docker-compose

## Usage

Start servers and clients

```
npm run docker:compose
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
    networks:
      - raft_fcul_network
    environment:
      - SERVERS=raft_fcul_server_2
      - HOST=raft_fcul_server_1
      - LOG_LEVEL=debug
      - CLIENT_PORT=8080
      - SERVER_PORT=8081
      - MINIMUM_ELECTION_TIMEOUT=150
      - MAXIMUM_ELECTION_TIMEOUT=300
      - HEARTBEAT_TIMEOUT=50

  server2:
    build:
    context: .
    dockerfile: ./docker/Dockerfile.server
    image: raft_fcul_server
    container_name: raft_fcul_server_2
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
      - REQUEST_INTERVAL=5000
    depends_on:
      - server1
      - server2
networks:
  raft_fcul_network:
```

In the `SERVERS` variable of the server you put a list of the remaining servers while in the client you put a list of all the servers.
