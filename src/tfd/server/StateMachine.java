package tfd.server;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;
import java.util.Arrays;
import java.util.Observable;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ThreadLocalRandom;

import tfd.rpc.AppendEntryRequest;
import tfd.rpc.AppendEntryResponse;
import tfd.utils.Configuration;
import tfd.utils.Printer;

public class StateMachine extends Observable {

	private RaftState state;
	private String[] servers;
	private int port;
	private Timer timer;
	private int term = 0;
	private String leader = null;
	private Log log;
	private int index = 0;
	private int numberServers;
	private int numberVotes;

	public StateMachine(RaftState state, String[] servers, int port) {
		this.setState(state);
		this.servers = servers;
		this.port = port;
		this.log = new Log();
		this.numberServers = servers.length;
		this.numberVotes = 0;
		this.leader = Configuration.getString("LEADER_NAME", "raft_fcul_server_1");
		//this.startElectionTimer();
	}

	public RaftState getState() {
		return this.state;
	}

	private void setState(RaftState state) {
		this.state = state;
		this.notifyObservers(this.state);
	}

	public String[] getServers() {
		return this.servers;
	}

	public int getTerm() {
		return this.term;
	}

	public int getIndex() {
		return this.index;
	}

	public String getLeader() {
		return this.leader;
	}

	public Log getLog() {
		return this.log;
	}

	public int getNumberServers() {
		return this.numberServers;
	}

	private void startElectionTimer() {
		if (this.timer != null)
			this.timer.cancel();
		TimerTask task = new TimerTask() {
			public void run() {
				startElection();
			}
		};
		int min = 100; // minimum delay in milliseconds
		int max = Configuration.getInt("ELECTION_TIMEOUT", 200); // maximum delay in milliseconds
		int delay = ThreadLocalRandom.current().nextInt(min, max + 1);
		// the thread associated with the timer will run as daemon (will not prevent the application from exiting)
		this.timer = new Timer(true);
		this.timer.schedule(task, delay);
	}

	private void startElection() {
		this.setState(RaftState.CANDIDATE);
		this.term += 1;
		this.startElectionTimer();
		this.getVote();
		// TODO: request votes from everyone
	}

	public void getVote() {
		if (this.state == RaftState.CANDIDATE) {
			this.numberVotes += 1;
			if (this.numberVotes > this.numberServers / 2) {
				this.numberVotes = 0;
				this.timer.cancel();
				this.setState(RaftState.LEADER);
				// TODO: tell everyone else
			}
		}
	}

	public void stepDown(String leader, int term) {
		if (this.state == RaftState.LEADER) {
			this.setState(RaftState.FOLLOWER);
			this.startElectionTimer();
			// TODO: set new leader and term
		}
	}

	public void replicateEntry(String data, String clientId) {
		LogEntry entry = new LogEntry(this.term, this.index + 1, data, clientId);
		for (String server : servers) {
			if (!server.equals(leader)) {
				try {
					Socket socket = new Socket(server, port);
					ObjectOutputStream oos = new ObjectOutputStream(socket.getOutputStream());
					AppendEntryRequest request = new AppendEntryRequest(entry);
					oos.writeObject(request);
					Printer.printDebug("Entry sent to " + server);
					ObjectInputStream ois = new ObjectInputStream(socket.getInputStream());
					try {
						AppendEntryResponse response = (AppendEntryResponse) ois.readObject();
					} catch (ClassNotFoundException e) {
						Printer.printError("Error receiving response from " + server, e);
					}
					Printer.printDebug("Replicate entry on " + server);
					socket.close();
				} catch (IOException e) {
					Printer.printError("Error connecting to " + server, e);
				}
			}
		}
		this.log.addEntry(entry);
		this.index += 1;
	}
	
	public void appendEntry(LogEntry entry) {
		this.log.addEntry(entry);
		this.term = entry.getTerm();
		this.index = entry.getIndex();
		Printer.printDebug(entry.toString());
		// AppendEntries counts as a heartbeat
		this.heartbeat();
	}
	
	public void heartbeat() {
		this.startElectionTimer();
	}

}
