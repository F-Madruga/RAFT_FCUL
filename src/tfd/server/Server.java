package tfd.server;

import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public class Server {
	public Server(int port, IStreamHandler streamHandler) {
	    this(port, 100, streamHandler);
	}
	
	public Server(int port, int threadPoolSize, IStreamHandler streamHandler) {
	    ExecutorService clientPool = Executors.newFixedThreadPool(threadPoolSize);
	    Thread serverThread = new Thread(new ServerThread(clientPool, port, streamHandler));
	    serverThread.start();
	}
}