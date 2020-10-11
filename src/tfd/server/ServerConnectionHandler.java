package tfd.server;

import tfd.rpc.RPCMessage;

public class ServerConnectionHandler implements IMessageHandler {

	private StateMachine stateMachine;

	public ServerConnectionHandler(StateMachine stateMachine) {
		this.stateMachine = stateMachine;
	}

	@Override
	public RPCMessage handle(RPCMessage message) {
		// TODO Auto-generated method stub
		return null;
	}

}
