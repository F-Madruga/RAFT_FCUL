package tfd.server;

import tfd.configuration.Configuration;

public class MainServer {

	public static void main(String[] args) {
		Configuration.load();

		int clientPort = Configuration.getInt("CLIENT_PORT", 8080);

		int serverPort = Configuration.getInt("SERVER_PORT", 8081);
		String[] servers = Configuration.getString("SERVERS", "").split(":");
		servers = !servers[0].equals("") ? servers : new String[0];

		new ServerSocket(clientPort, new ClientConnectionHandler(), new String[0]);
		new ServerSocket(serverPort, new ServerConnectionHandler(), servers);
	}
}
