package tfd.rpc;

public class AppendEntryResponse extends RPCMessage {
    public AppendEntryResponse(String message) {
        super(RPCMethod.APPEND_ENTRIES_RESPONSE, message);
    }
}
