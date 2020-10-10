package tfd.server;

import tfd.rpc.ClientRPC;

import java.io.Serializable;
import java.sql.Timestamp;

public class LogEntry implements Serializable {

    private Timestamp timestamp;
    private ClientRPC clientRPC;
    //private int term;


    /*public LogEntry(ClientRPC clientRPC, int term) {
        this.timestamp = new Timestamp(System.currentTimeMillis());
        this.clientRPC = clientRPC;
        this.term = term;
    }*/

    public LogEntry(ClientRPC clientRPC) {
        this.timestamp = new Timestamp(System.currentTimeMillis());
        this.clientRPC = clientRPC;
    }

    /*public int getTerm() {
        return this.term;
    }*/

    public Timestamp getTimestamp() {
        return this.timestamp;
    }

    public ClientRPC getClientRPC() {
        return this.clientRPC;
    }

    @Override
    public String toString() {
        return "LogEntry{" +
                "timestamp=" + this.timestamp.toString() +
                "clientRPC=" + this.clientRPC.toString() +
                //"term=" + this.term +
                '}';
    }
}
