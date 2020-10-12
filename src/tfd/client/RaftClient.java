package tfd.client;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;
import java.util.Random;

import tfd.rpc.ClientRequest;
import tfd.rpc.RPCMessage;
import tfd.utils.Configuration;
import tfd.utils.Printer;
import tfd.utils.ResponseErrorException;

public class RaftClient {

	private String[] servers;
	private int port;
	private String leader;
	private Socket connection;
	private ObjectInputStream ois;
	private ObjectOutputStream oos;

	public RaftClient(String[] servers, int port) {
		this.servers = servers;
		this.port = port;
		//this.leader = servers[new Random().nextInt(servers.length)];
		this.leader = Configuration.getString("LEADER", "raft_fcul_server_1");
		this.connect();
	}

	public String request(String message) throws ResponseErrorException {
		ClientRequest request = new ClientRequest(message);
		RPCMessage response = send(request);
		switch (response.getMethod()) {
		case LEADER_RESPONSE: {
			this.leader = response.getMessage();
			Printer.printDebug("Changing leader");
			this.connect();
			return this.request(message);
		}
		case COMMAND_RESPONSE: {
			return response.getMessage();
		}
		case EMPTY_RESPONSE: {
			return "";
		}
		case ERROR_RESPONSE: {
			throw new ResponseErrorException(response.getMessage());
		}
		default:
			break;
		}
		throw new ResponseErrorException("Unrecognized response method.");
	}

	private void connect() {
		try {
			if (this.connection != null)
				this.connection.close();
			Printer.printDebug("Connecting to server: " + this.leader);
			this.connection = new Socket(this.leader, this.port);
			this.oos = new ObjectOutputStream(this.connection.getOutputStream());
			this.ois = new ObjectInputStream(this.connection.getInputStream());
			Printer.printDebug("Connected to server.");
		} catch (IOException e) {
			Printer.printError("Error on connecting", e);
			try {
				Thread.sleep(100);
			} catch (InterruptedException ex) {}
		}
	}

	private RPCMessage send(RPCMessage request) {
		try {
			oos.writeObject(request);
			oos.flush();
			Printer.printDebug("Sent request: " + request.getMessage());
			RPCMessage response = (RPCMessage) ois.readObject();
			Printer.printDebug("Received response: " + response.getMessage());
			return response;
		} catch (Exception e) {
			Printer.printError("Error sending request", e);
			this.leader = servers[new Random().nextInt(servers.length)];
			this.connect();
			return this.send(request);
		}
	}

}
