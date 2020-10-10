package tfd.server;

import tfd.configuration.Configuration;
import java.io.*;

public class ClientConnectionHandler implements IStreamHandler {

	@Override
	public void setStreams(InputStream inputStream, OutputStream outputStream) {
		// TODO Auto-generated method stub
		BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(inputStream));
		PrintWriter writer = new PrintWriter(outputStream, true);
		try {
			String request;
			do {
				request = bufferedReader.readLine();
				System.out.println(request);
				String response = "Received: " + request;
				writer.println(response);
			} while (!request.equals("Exit"));
		} catch (IOException e) {
			Configuration.printError("Error receiving client request", e);
		}
	}
}
