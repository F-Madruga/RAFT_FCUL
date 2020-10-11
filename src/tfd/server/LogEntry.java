package tfd.server;

import java.io.Serializable;
import java.sql.Timestamp;

public class LogEntry implements Serializable {

	private static final long serialVersionUID = 1L;
	private Timestamp timestamp;
	private String message;
	private String clientId;
	private String operationId;

	public LogEntry(String message, String clientId, String operationId) {
		this.timestamp = new Timestamp(System.currentTimeMillis());
		this.message = message;
		this.clientId = clientId;
		this.operationId = operationId;
	}

	public Timestamp getTimestamp() {
		return this.timestamp;
	}

	public String getMessage() {
		return this.message;
	}

	public String getClientId() {
		return clientId;
	}

	public String getOperationId() {
		return operationId;
	}

	@Override
	public String toString() {
		return "LogEntry{timestamp=" + this.timestamp.toString() + ",message=" + this.message + "}";
	}

}
