package tfd.server;

import tfd.rpc.ErrorResponse;
import tfd.rpc.EmptyResponse;
import tfd.rpc.RPCMessage;
import tfd.rpc.VoteRequest;
import tfd.rpc.VoteResponse;

public class ServerConnectionHandler implements IMessageHandler {

	private StateMachine stateMachine;

	public ServerConnectionHandler(StateMachine stateMachine) {
		this.stateMachine = stateMachine;
	}

	@Override
	public RPCMessage handle(RPCMessage message) {
		switch (message.getMethod()) {
		case APPEND_ENTRIES: {
			// TODO: process entries
			break;
		}
		case REQUEST_VOTE: {
			VoteRequest request = (VoteRequest) message;
			// do not vote if: term is greater or (term is equal and index is greater)
			if (this.stateMachine.getTerm() > request.getTerm()
					|| (this.stateMachine.getTerm() == request.getTerm() && this.stateMachine.getIndex() > request.getIndex()))
				return new EmptyResponse();
			// vote otherwise
			return new VoteResponse();
		}
		default:
			break;
		}
		return new ErrorResponse("Unrecognized request method.");
	}

}
