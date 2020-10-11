package tfd.server;

import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;

import tfd.rpc.RPCMessage;
import tfd.utils.Printer;

class ClientThread implements Runnable {

	private final Socket clientSocket;
	private final IMessageHandler handler;

	public ClientThread(Socket clientSocket, IMessageHandler handler) {
		this.clientSocket = clientSocket;
		this.handler = handler;
	}

	@Override
	public void run() {
		RPCMessage request = null;
		try {
			System.out.println("New client connection.");
			ObjectInputStream ois = new ObjectInputStream(clientSocket.getInputStream());
			request = (RPCMessage) ois.readObject();
			Printer.printDebug("Received request: " + request.getMessage());
			ObjectOutputStream oos = new ObjectOutputStream(clientSocket.getOutputStream());
			RPCMessage response = this.handler.handle(request);
			oos.writeObject(response);
			Printer.printDebug("Sent response: " + response.getMessage());
			clientSocket.close();
		} catch (Exception e) {
			Printer.printError("Error connecting to new client", e);
		}
	}
}
