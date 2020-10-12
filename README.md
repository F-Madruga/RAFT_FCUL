# RAFT_FCUL

## Requirements
* Java
* Docker
* Docker-compose

## Usage
Start servers and clients
```
docker-compose up -d --scale client=<number-of-clients-to-start>
```
List servers and client

```
docker ps
```

Select client from list

```
docker logs <client> && docker attach <client>
```