package tfd.server;

import tfd.utils.Configuration;

public class MainServer {

	public static void main(String[] args) {
		Configuration.load(".env-server");
		int clientPort = Configuration.getInt("CLIENT_PORT", 8080);
		int serverPort = Configuration.getInt("SERVER_PORT", 8081);
		String[] servers = Configuration.getString("SERVERS", "").split(":");
		servers = !servers[0].equals("") ? servers : new String[0];
		ClientHandler clientHandler = new ClientHandler();
		new RaftServer(clientPort, serverPort, servers, clientHandler);
	}

}
