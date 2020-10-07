package tfd.server;

import java.io.IOException;

import tfd.configuration.Configuration;

public class MainServer {

	public static void main(String[] args) throws IOException {
		Configuration.load();
		new ServerSocket(Configuration.getInt("CLIENT_PORT", 8080), new ClientConnectionHandler());
		new ServerSocket(Configuration.getInt("SERVER_PORT", 8081), new ServerConnectionHandler());
	}
}
