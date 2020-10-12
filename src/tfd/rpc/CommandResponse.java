package tfd.rpc;

public class CommandResponse extends RPCMessage {

	private static final long serialVersionUID = 1L;

	public CommandResponse(String message) {
		super(RPCMethod.COMMAND_RESPONSE, message);
	}

}
