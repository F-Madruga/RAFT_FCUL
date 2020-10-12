package tfd.rpc;

import tfd.server.LogEntry;

public class AppendEntryRequest extends RPCMessage {

    private String clientId;
    private LogEntry entry;

    public AppendEntryRequest(String clientId, LogEntry entry) {
        super(RPCMethod.APPEND_ENTRIES, "");
        this.clientId = clientId;
        this.entry = entry;
    }

    public LogEntry getEntry() {
        return this.entry;
    }
}
