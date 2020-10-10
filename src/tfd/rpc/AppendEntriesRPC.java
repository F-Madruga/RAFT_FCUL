package tfd.rpc;

public class AppendEntriesRPC extends RPCRequest {
	private static final long serialVersionUID = 7459347805113854201L;

	private int term;
	private int leaderId;
	private int prevLogIndex;
	//private List<> entries;
	private int leaderCommit;
}
