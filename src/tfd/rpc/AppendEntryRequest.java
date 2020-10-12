package tfd.rpc;

import tfd.server.LogEntry;

public class AppendEntryRequest extends RPCMessage {

    private LogEntry entry;

    public AppendEntryRequest(LogEntry entry) {
        super(RPCMethod.APPEND_ENTRIES, "");
        this.entry = entry;
    }

    public LogEntry getEntry() {
        return this.entry;
    }
}
