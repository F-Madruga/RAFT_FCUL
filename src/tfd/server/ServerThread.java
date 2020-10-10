package tfd.server;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.UnknownHostException;
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
			try {
				if (!InetAddress.getByName(serverIp).equals(InetAddress.getLocalHost())) {
					try {
						System.out.println("Trying to connect with server " + serverIp);
						Socket clientSocket = new Socket(serverIp, this.port);
						System.out.println("Connected wit server " + serverIp);
						this.clientPool.submit(new ClientThread(clientSocket, this.streamHandler));
						if (clientSocket.isConnected()) {
						}
					} catch (Exception e) {
						System.out.println("Server isn't running");
					}
				}
			} catch (UnknownHostException e) {
				e.printStackTrace();
			}
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
