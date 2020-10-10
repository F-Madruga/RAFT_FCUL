package tfd.server;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;

import tfd.configuration.Configuration;

public class ServerThread implements Runnable {
	private final ExecutorService clientPool;
	private final int port;
	private final IStreamHandler streamHandler;
	private final String[] servers;

	public ServerThread(ExecutorService clientPool, int port, IStreamHandler streamHandler, String[] servers) {
		this.clientPool = clientPool;
		this.port = port;
		this.streamHandler = streamHandler;
		this.servers = servers;
	}

	@Override
	public void run() {
		for (String serverIp : servers) {
			System.out.println("Trying to connect with " + serverIp);
			try {
				Socket clientSocket = new Socket(serverIp, this.port);
				this.clientPool.submit(new ClientThread(clientSocket, this.streamHandler));
			} catch (Exception e) {
				System.out.println("Error");
			}
			System.out.println("Connected with " + serverIp);
		}

		try (ServerSocket serverSocket = new ServerSocket(port)) {
			System.out.println("Waiting for clients to connect...");
			while (true) {
				Socket clientSocket = serverSocket.accept();
				this.clientPool.submit(new ClientThread(clientSocket, this.streamHandler));
			}
			// serverSocket.close();
		} catch (IOException e) {
			Configuration.printError("Error starting server", e);
		}
	}
}
