package tfd.rpc;

public class RequestVoteRPC extends RPCRequest {
	private static final long serialVersionUID = -8827006834413538386L;

	private int term;
	private int candidateId;
	private int lasLogIndex;
	private int lastLogTerm;

}
