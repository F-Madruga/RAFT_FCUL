package tfd.server;

import java.util.ArrayList;
import java.util.List;

public class Log {

	private List<LogEntry> entries;

	public Log() {
		this.entries = new ArrayList<>();
	}

	public void addEntry(LogEntry entry) {
		this.entries.add(entry);
	}

	public LogEntry getLogEntry(int index) {
		return this.entries.get(index);
	}

	public boolean isEmpty() {
		return this.entries.isEmpty();
	}

}
