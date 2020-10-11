package tfd.client;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;
import java.util.Timer;
import java.util.TimerTask;

import tfd.utils.Configuration;
import tfd.utils.Printer;
import tfd.utils.ResponseErrorException;

public class MainClient {

	public static void main(String[] args) {
		Configuration.load("env.client.yaml");
		String[] servers = Configuration.getString("SERVERS", "").split(",");
		int port = Configuration.getInt("PORT", 8080);
		final RaftClient client = new RaftClient(servers, port);
		TimerTask task = new TimerTask() {
			public void run() {
				try {
					TimeZone tz = TimeZone.getTimeZone("UTC");
					SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
					df.setTimeZone(tz);
					String isoDate = df.format(new Date());
					String response = client.request(isoDate);
					Printer.printMessage("[+] Response received from server: " + response);
				} catch (ResponseErrorException e) {
					Printer.printError("[-] Error received from server", e);
				}
			}
		};
		Timer timer = new Timer();
		timer.scheduleAtFixedRate(task, 0, 10000);
	}

}
