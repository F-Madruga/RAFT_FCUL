package tfd.server;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;

import tfd.utils.Printer;

public class ServerThread implements Runnable {
	private final ExecutorService clientPool;
	private final int port;
	private final IMessageHandler handler;

	public ServerThread(ExecutorService clientPool, int port, IMessageHandler handler) {
		this.clientPool = clientPool;
		this.port = port;
		this.handler = handler;
	}

	@Override
	public void run() {
		try (ServerSocket serverSocket = new ServerSocket(port)) {
			System.out.println("Waiting for clients to connect...");
			while (true) {
				Socket clientSocket = serverSocket.accept();
				this.clientPool.submit(new ClientThread(clientSocket, this.handler));
			}
			// serverSocket.close();
		} catch (IOException e) {
			Printer.printError("Error starting server", e);
		}
	}
}
