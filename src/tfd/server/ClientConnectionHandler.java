package tfd.server;

import java.util.UUID;

import tfd.rpc.ClientRequest;
import tfd.rpc.CommandResponse;
import tfd.rpc.LeaderResponse;
import tfd.rpc.RPCMessage;

public class ClientConnectionHandler implements IMessageHandler {

	private StateMachine stateMachine;
	private IClientHandler clientHandler;
	private String clientId;

	public ClientConnectionHandler(StateMachine stateMachine, IClientHandler clientHandler) {
		this.stateMachine = stateMachine;
		this.clientHandler = clientHandler;
		this.clientId = UUID.randomUUID().toString();
	}

	@Override
	public RPCMessage handle(RPCMessage message) {
		if (this.stateMachine.getState() == RaftState.LEADER) {
			ClientRequest request = (ClientRequest) message;
			String response = this.clientHandler.execute(request.getMessage());
			stateMachine.replicateEntry(request.getMessage(), this.clientId);
			return new CommandResponse(response);
		}
		return new LeaderResponse(this.stateMachine.getLeader());
	}

}
