package tfd.server;

import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public class ServerSocket {
	public ServerSocket(int port, IStreamHandler streamHandler, String[] servers) {
	    this(port, 100, streamHandler, servers);
	}
	
	public ServerSocket(int port, int threadPoolSize, IStreamHandler streamHandler, String[] servers) {
	    ExecutorService clientPool = Executors.newFixedThreadPool(threadPoolSize);
	    Thread serverThread = new Thread(new ServerThread(clientPool, port, streamHandler, servers));
	    serverThread.start();
	}
}
