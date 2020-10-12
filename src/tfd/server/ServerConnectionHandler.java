package tfd.server;

import tfd.rpc.*;
import tfd.utils.Printer;

import java.io.ObjectInputStream;

public class ServerConnectionHandler implements IMessageHandler {

	private StateMachine stateMachine;

	public ServerConnectionHandler(StateMachine stateMachine) {
		this.stateMachine = stateMachine;
	}

	@Override
	public RPCMessage handle(RPCMessage message) {
		switch (message.getMethod()) {
		case APPEND_ENTRIES: {
			AppendEntryRequest request = (AppendEntryRequest) message;
			Printer.printDebug(request.toString());
			stateMachine.appendEntry(request.getEntry());
			AppendEntryResponse response = new AppendEntryResponse("Received message " + message.getMessage());
			return response;
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
