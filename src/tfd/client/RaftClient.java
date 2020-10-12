package tfd.client;

import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;
import java.util.Random;
import tfd.rpc.ClientRequest;
import tfd.rpc.RPCMessage;
import tfd.utils.Printer;
import tfd.utils.ResponseErrorException;

public class RaftClient {

	private String[] servers;
	private int port;
	private String leader;

	public RaftClient(String[] servers, int port) {
		this.servers = servers;
		this.port = port;
		this.leader = servers[new Random().nextInt(servers.length)];
	}

	public String request(String message) throws ResponseErrorException {
		RPCMessage response = null;
		try {
			Printer.printDebug("Connecting to server: " + this.leader);
			Socket socket = new Socket(this.leader, this.port);
			Printer.printDebug("Connected to server.");
			ObjectOutputStream oos = new ObjectOutputStream(socket.getOutputStream());
			ClientRequest request = new ClientRequest(message);
			oos.writeObject(request);
			Printer.printDebug("Sent request: " + message);
			ObjectInputStream ois = new ObjectInputStream(socket.getInputStream());
			response = (RPCMessage) ois.readObject();
			Printer.printDebug("Received response: " + response.getMessage());
			socket.close();
			Printer.printDebug("Closed connection.");
		} catch (Exception e) {
			this.leader = servers[new Random().nextInt(servers.length)];
			return this.request(message);
		}
		switch (response.getMethod()) {
		case LEADER_RESPONSE: {
			this.leader = response.getMessage();
			return this.request(message);
		}
		case ERROR_RESPONSE: {
			throw new ResponseErrorException(response.getMessage());
		}
		case COMMAND_RESPONSE: {
			return response.getMessage();
		}
		default:
			break;
		}
		throw new ResponseErrorException("Unrecognized response method.");
	}

}
