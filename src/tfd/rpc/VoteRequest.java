package tfd.rpc;

public class VoteRequest extends RPCMessage {

	private static final long serialVersionUID = 1L;
	private int term;
	private int index;

	public VoteRequest(int term, int index) {
		super(RPCMethod.REQUEST_VOTE, "");
		this.term = term;
		this.index = index;
	}

	public int getTerm() {
		return this.term;
	}

	public int getIndex() {
		return this.index;
	}

}
