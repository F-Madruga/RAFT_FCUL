package tfd.server;

import tfd.rpc.RPCMessage;

public interface IMessageHandler {

	public RPCMessage handle(RPCMessage message, String clientId);

}
