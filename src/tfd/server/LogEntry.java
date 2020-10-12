package tfd.server;

import java.io.Serializable;
import java.sql.Timestamp;
import java.util.UUID;

public class LogEntry implements Serializable {

	private static final long serialVersionUID = 1L;
	private Timestamp timestamp;
	private int term;
	private int index;
	private String data;
	private String clientId;
	private String operationId;

	public LogEntry(int term, int index, String message, String clientId) {
		this.timestamp = new Timestamp(System.currentTimeMillis());
		this.term = term;
		this.index = index;
		this.data = message;
		this.clientId = clientId;
		this.operationId = UUID.randomUUID().toString();
	}

	public Timestamp getTimestamp() {
		return this.timestamp;
	}

	public int getTerm() {
		return this.term;
	}

	public int getIndex() {
		return this.index;
	}

	public String getData() {
		return this.data;
	}

	public String getClientId() {
		return clientId;
	}

	public String getOperationId() {
		return operationId;
	}

	@Override
	public String toString() {
		return "LogEntry {\n"
				+ "  timestamp: " + this.timestamp.toString() + ",\n"
				+ "  term: " + this.term + ",\n"
				+ "  index: " + this.index + ",\n"
				+ "  data: " + this.data + ",\n"
				+ "  clientId: " + this.clientId + ",\n"
				+ "  operationId: " + this.operationId + ",\n"
				+ "}";
	}

}
