package tfd.server;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class Log implements Serializable {

    private List<LogEntry> entries;

    public Log() {
        this.entries = new ArrayList<>();
    }

    void addEntry(LogEntry entry) {
        this.entries.add(entry);
    }

    LogEntry getLogEntryOfIndex(int index) {
        return this.entries.get(index);
    }

    boolean isEmpty() {
        return this.entries.isEmpty();
    }

    @Override
    public String toString() {
        return "Log {" +
                "entries=" + this.entries.toString() +
                '}';
    }
}
