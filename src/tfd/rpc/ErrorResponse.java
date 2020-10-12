package tfd.rpc;

public class ErrorResponse extends RPCMessage {

	private static final long serialVersionUID = 1L;

	public ErrorResponse(String message) {
		super(RPCMethod.ERROR_RESPONSE, message);
	}

}
