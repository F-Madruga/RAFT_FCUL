package tfd.rpc;

public class EmptyResponse extends RPCMessage {

	private static final long serialVersionUID = 1L;

	public EmptyResponse() {
		super(RPCMethod.NO_VOTE_RESPONSE, "");
	}

}
