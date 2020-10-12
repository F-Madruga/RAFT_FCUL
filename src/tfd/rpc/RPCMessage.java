package tfd.rpc;

import java.io.Serializable;

public abstract class RPCMessage implements Serializable {

	private static final long serialVersionUID = 1L;
	protected RPCMethod method;
	protected String message;

	public RPCMessage(RPCMethod method, String message) {
		this.method = method;
		this.message = message;
	}

	public RPCMethod getMethod() {
		return this.method;
	}

	public String getMessage() {
		return this.message;
	}

}
