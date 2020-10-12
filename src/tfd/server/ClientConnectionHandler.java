package tfd.server;

import java.util.UUID;

import tfd.rpc.ClientRequest;
import tfd.rpc.CommandResponse;
import tfd.rpc.LeaderResponse;
import tfd.rpc.RPCMessage;

public class ClientConnectionHandler implements IMessageHandler {

	private StateMachine stateMachine;
	private IClientHandler clientHandler;


	public ClientConnectionHandler(StateMachine stateMachine, IClientHandler clientHandler) {
		this.stateMachine = stateMachine;
		this.clientHandler = clientHandler;
	}

	@Override
	public RPCMessage handle(RPCMessage message, String clientId) {
		if (this.stateMachine.getState() == RaftState.LEADER) {
			ClientRequest request = (ClientRequest) message;
			String response = this.clientHandler.execute(request.getMessage());
			stateMachine.replicateEntry(request.getMessage(), clientId);
			return new CommandResponse(response);
		}
		return new LeaderResponse(this.stateMachine.getLeader());
	}

}
