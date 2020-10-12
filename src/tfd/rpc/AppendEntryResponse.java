package tfd.rpc;

public class AppendEntryResponse extends RPCMessage {

    private static final long serialVersionUID = 1L;

    public AppendEntryResponse(String message) {
        super(RPCMethod.APPEND_ENTRIES_RESPONSE, message);
    }
}
