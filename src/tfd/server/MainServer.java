package tfd.server;

import java.io.IOException;

import tfd.configuration.Configuration;

public class MainServer {

	public static void main(String[] args) throws IOException {
		Configuration.load();
		new Server(Configuration.getInt("CLIENT_PORT", 8080), new ClientConnectionHandler());
		new Server(Configuration.getInt("SERVER_PORT", 8080), new ServerConnectionHandler());
	}

}
