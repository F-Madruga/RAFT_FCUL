package tfd.server;

import tfd.configuration.Configuration;

import java.io.*;

public class ClientConnectionHandler implements IStreamHandler {

	@Override
	public void setStreams(InputStream inputStream, OutputStream outputStream) {
		// TODO Auto-generated method stub
		BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(inputStream));
		try {
			System.out.println(bufferedReader.readLine());
		} catch (IOException e) {
			Configuration.printError("Error receiving client request", e);
		}
	}

}
