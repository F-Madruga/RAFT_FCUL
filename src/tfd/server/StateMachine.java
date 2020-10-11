package tfd.server;

import java.util.Observable;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ThreadLocalRandom;

import tfd.utils.Configuration;

public class StateMachine extends Observable {

	private RaftState state;
	private Timer timer;
	private int term = 0;
	private String leader = null;
	private Log log;
	private int lastIndex = 0;
	private int numberServers;
	private int numberVotes;

	public StateMachine(RaftState state, int numberServers) {
		this.setState(state);
		// the thread associated with the timer will run as daemon (will not prevent the application from exiting)
		this.timer = new Timer(true);
		this.log = new Log();
		this.numberServers = numberServers;
		this.numberVotes = 0;
		this.startElectionTimer();
	}

	public RaftState getState() {
		return this.state;
	}

	private void setState(RaftState state) {
		this.state = state;
		this.notifyObservers(this.state);
	}

	public int getTerm() {
		return this.term;
	}

	public String getLeader() {
		return this.leader;
	}

	public int getNumberServers() {
		return this.numberServers;
	}

	private void startElectionTimer() {
		TimerTask task = new TimerTask() {
			public void run() {
				startElection();
			}
		};
		int max = Configuration.getInt("ELECTION_TIMEOUT", 300); // maximum delay in milliseconds
		int delay = ThreadLocalRandom.current().nextInt(0, max + 1);
		this.timer.schedule(task, delay);
	}

	private void startElection() {
		this.setState(RaftState.CANDIDATE);
		this.startElectionTimer();
	}

	public void getVote() {
		if (this.state == RaftState.CANDIDATE) {
			this.numberVotes += 1;
			if (this.numberVotes > this.numberServers / 2) {
				this.numberVotes = 0;
				this.timer.cancel();
				this.setState(RaftState.LEADER);
			}
		}
	}

	public void stepDown() {
		if (this.state == RaftState.LEADER) {
			this.setState(RaftState.FOLLOWER);
			this.timer.cancel();
			this.startElectionTimer();
		}
	}

}
