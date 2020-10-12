package tfd.rpc;

public class LeaderResponse extends RPCMessage {

	private static final long serialVersionUID = 1L;

	public LeaderResponse(String message) {
		super(RPCMethod.LEADER_RESPONSE, message);
	}

}
