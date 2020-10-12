package tfd.server;

import tfd.utils.Configuration;

public class RaftServer {

	private StateMachine stateMachine;

	public RaftServer(int clientPort, int serverPort, String[] servers, IClientHandler clientHandler) {
		stateMachine = new StateMachine(Configuration.getBoolean("LEADER", false) ? RaftState.LEADER : RaftState.FOLLOWER, servers, serverPort);
		ClientConnectionHandler clientConnectionHandler = new ClientConnectionHandler(stateMachine, clientHandler);
		new ServerSocket(clientPort, clientConnectionHandler);
		ServerConnectionHandler serverConnectionHandler = new ServerConnectionHandler(stateMachine);
		new ServerSocket(serverPort, serverConnectionHandler);
	}

	public StateMachine getStateMachine() {
		return this.stateMachine;
	}

}
