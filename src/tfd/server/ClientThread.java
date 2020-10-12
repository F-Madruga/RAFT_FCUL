package tfd.server;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;

import tfd.rpc.EmptyResponse;
import tfd.rpc.RPCMessage;
import tfd.rpc.RPCMethod;
import tfd.utils.Printer;

class ClientThread implements Runnable {

	private final Socket clientSocket;
	private final IMessageHandler handler;
	private ObjectInputStream ois;
	private ObjectOutputStream oos;

	public ClientThread(Socket clientSocket, IMessageHandler handler) throws IOException {
		this.clientSocket = clientSocket;
		this.handler = handler;
		this.ois = new ObjectInputStream(clientSocket.getInputStream());
		this.oos = new ObjectOutputStream(clientSocket.getOutputStream());
	}

	@Override
	public void run() {
		RPCMessage request = null;
		try {
			System.out.println("New client connection.");
			while (true) {
				request = (RPCMessage) this.ois.readObject();
				Printer.printDebug("Received request: " + request.getMessage());
				if (request.getMethod() == RPCMethod.EXIT_REQUEST) {
					oos.writeObject(new EmptyResponse());
					break;
				}
				RPCMessage response = this.handler.handle(request);
				this.oos.writeObject(response);
				Printer.printDebug("Sent response: " + response.getMessage());
			}
		} catch (Exception e) {
			Printer.printError("Error connecting to new client", e);
			try {
				clientSocket.close();
			} catch (IOException ioException) {
				Printer.printError("Error closing socket", e);
			}
		}
	}
}
