package tfd.server;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.net.Socket;

import tfd.configuration.Configuration;

class ClientThread implements Runnable {
	private final Socket clientSocket;
	private final IStreamHandler streamHandler;

	public ClientThread(Socket clientSocket, IStreamHandler streamHandler) {
		this.clientSocket = clientSocket;
		this.streamHandler = streamHandler;
	}

	@Override
	public void run() {
		try {
			System.out.println("New client connection.");
			InputStream inputStream = clientSocket.getInputStream();
			OutputStream outputStream = clientSocket.getOutputStream();
			this.streamHandler.setStreams(inputStream, outputStream);
			clientSocket.close();
		} catch (IOException e) {
			Configuration.printError("Error connecting to new client", e);
		}
	}
}
