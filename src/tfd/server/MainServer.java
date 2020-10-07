package tfd.server;

import java.io.IOException;
import java.net.InetAddress;
import java.util.Arrays;

import tfd.configuration.Configuration;

public class MainServer {

	public static void getNetworkIPs() {
		final byte[] ip;
		try {
			ip = InetAddress.getLocalHost().getAddress();
		} catch (Exception e) {
			return;     // exit method, otherwise "ip might not have been initialized"
		}

		for(int i=1;i<=254;i++) {
			final int j = i;  // i as non-final variable cannot be referenced from inner class
			new Thread(new Runnable() {   // new thread for parallel execution
				public void run() {
					try {
						ip[3] = (byte)j;
						InetAddress address = InetAddress.getByAddress(ip);
						String output = address.toString().substring(1);
						if (address.isReachable(5000)) {
							System.out.println(output + " is on the network");
						} else {
							System.out.println("Not Reachable: "+output);
						}
					} catch (Exception e) {
						e.printStackTrace();
					}
				}
			}).start();     // dont forget to start the thread
		}
	}

	public static void main(String[] args) throws IOException {
		Configuration.load();
		// find all servers
		getNetworkIPs();
		new Server(Integer.parseInt(args[0]), new ClientConnectionHandler());
		//new Server(Configuration.getInt("PORT", 8080), new ClientConnectionHandler());
		//new Server(Configuration.getInt("SERVER_PORT", 8081), new ServerConnectionHandler());
	}

}
