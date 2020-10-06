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

	public ServerThread(ExecutorService clientPool, int port, IStreamHandler streamHandler) {
		this.clientPool = clientPool;
		this.port = port;
		this.streamHandler = streamHandler;
	}

	@Override
	public void run() {
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
