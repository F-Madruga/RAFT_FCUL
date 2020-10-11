package tfd.rpc;

public class VoteResponse extends RPCMessage {

	private static final long serialVersionUID = 1L;

	public VoteResponse() {
		super(RPCMethod.VOTE_RESPONSE, "");
	}

}
