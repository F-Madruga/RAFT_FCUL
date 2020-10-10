package tfd.client;

import java.io.*;
import java.net.InetAddress;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Random;
import java.util.Scanner;

import tfd.configuration.Configuration;

public class MainClient {

	public static void main(String[] args) {
		Configuration.load();
		String[] servers = Configuration.getString("SERVERS", "").split(":");
		String serverIp = servers[new Random().nextInt(servers.length)];
		int serverPort = Configuration.getInt("CLIENT_PORT", 8080);
		Socket socket = null;
		try {
			System.out.println("Trying to connect with server " + serverIp);
			socket = new Socket(serverIp, serverPort);
			System.out.println("Connected with server " + serverIp);
		} catch (Exception e) {
			Configuration.printError("Error connecting to server", e);
		}
		InputStream inputStream = null;
		OutputStream outputStream = null;
		try {
			inputStream = socket.getInputStream();
			outputStream = socket.getOutputStream();
		} catch (IOException e) {
			Configuration.printError("Error getting socket streams", e);
		}
		PrintWriter writer = new PrintWriter(outputStream, true);
		BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
		Scanner scanner = new Scanner(System.in);
		int action = 0;
		do {
			showMenu();
			try {
				action = 1;//Integer.parseInt(scanner.nextLine());
				switch (action) {
					case 0:
						try {
							writer.println("Exit");
							socket.close();
						} catch (IOException e) {
							Configuration.printError("Error closing socket", e);
						}
						break;
					case 1:
						// TODO send requests
						try {
							writer.println("teste" + InetAddress.getLocalHost().getHostName());
						} catch (UnknownHostException e) {
							e.printStackTrace();
						}
						try {
							System.out.println(reader.readLine());
						} catch (IOException e) {
							Configuration.printError("Error receiving response", e);
						}
						break;
					default:
						System.out.println("Invalid action");
				}
			} catch (NumberFormatException e) {
				System.out.println("Invalid action");
				System.out.println("Action must be a number");
			}
		} while (action != 0);
	}

	private static void showMenu() {
		System.out.println("Select one action:");
		System.out.println("1 - Send command");
		System.out.println("0 - Exit");
	}

}
