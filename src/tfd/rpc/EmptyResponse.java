package tfd.rpc;

public class EmptyResponse extends RPCMessage {

	private static final long serialVersionUID = 1L;

	public EmptyResponse() {
		super(RPCMethod.EMPTY_RESPONSE, "");
	}

}
