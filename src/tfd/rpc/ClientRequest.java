package tfd.rpc;

public class ClientRequest extends RPCMessage {

	private static final long serialVersionUID = 1L;

	public ClientRequest(String message) {
		super(RPCMethod.CLIENT_REQUEST, message);
	}

}
