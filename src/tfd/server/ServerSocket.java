package tfd.server;

import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public class ServerSocket {
	public ServerSocket(int port, IMessageHandler handler) {
	    this(port, 1000, handler);
	}
	
	public ServerSocket(int port, int threadPoolSize, IMessageHandler streamHandler) {
	    ExecutorService clientPool = Executors.newFixedThreadPool(threadPoolSize);
	    Thread serverThread = new Thread(new ServerThread(clientPool, port, streamHandler));
	    serverThread.start();
	}
}
