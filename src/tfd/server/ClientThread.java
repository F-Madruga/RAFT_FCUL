package tfd.server;

import java.io.EOFException;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;
import java.util.UUID;

import tfd.rpc.EmptyResponse;
import tfd.rpc.RPCMessage;
import tfd.rpc.RPCMethod;
import tfd.utils.Printer;

class ClientThread implements Runnable {

	private final Socket clientSocket;
	private final IMessageHandler handler;
	private ObjectInputStream ois;
	private ObjectOutputStream oos;
	private String clientId;

	public ClientThread(Socket clientSocket, IMessageHandler handler) throws IOException {
		this.clientSocket = clientSocket;
		this.clientId = UUID.randomUUID().toString();
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
				try {
					request = (RPCMessage) this.ois.readObject();
				} catch (EOFException e) {
					System.out.println("caught!");
					break;
				}
				Printer.printDebug("Received request: " + request.getMessage());
				if (request.getMethod() == RPCMethod.EXIT_REQUEST) {
					oos.writeObject(new EmptyResponse());
					break;
				}
				RPCMessage response = this.handler.handle(request, clientId);
				this.oos.writeObject(response);
				this.oos.flush();
				Printer.printDebug("Sent response: " + response.getMessage());
			}
			clientSocket.close();
		} catch (IOException | ClassNotFoundException e) {
			Printer.printError("Error connecting to new client", e);
		}
	}
}
