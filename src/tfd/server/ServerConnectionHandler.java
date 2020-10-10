package tfd.server;

import java.io.*;

public class ServerConnectionHandler implements IStreamHandler {


	@Override
	public void setStreams(InputStream inputStream, OutputStream outputStream) {
		// TODO Auto-generated method stub
		BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(inputStream));
		while (true) {
			try {
				String request = bufferedReader.readLine();
				System.out.println(request);
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}
}
