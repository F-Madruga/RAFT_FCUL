package tfd.client;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.net.Socket;
import java.util.Random;

import tfd.configuration.Configuration;

public class MainClient {

	public static void main(String[] args) {
		Configuration.load();
		//String[] servers = Configuration.getString("SERVERS", "").split(",");
		//String[] serverDetails = servers[new Random().nextInt(servers.length)].split(":");
		//String serverIp = serverDetails[0];
		String serverIp = args[1];
		int serverPort = Integer.parseInt(args[0]);//Integer.parseInt(serverDetails[1]);
		Socket socket = null;
		try {
			socket = new Socket(serverIp, serverPort);
		} catch (Exception e) {
			Configuration.printError("Error connecting to server", e);
		}
		InputStream inputStream = null;
		OutputStream outputStream = null;
		try {
			inputStream = socket.getInputStream();
			outputStream = socket.getOutputStream();
			PrintWriter output = new PrintWriter(outputStream, true);
			output.println("teste");
		} catch (IOException e) {
			Configuration.printError("Error getting socket streams", e);
		}
	}

}
