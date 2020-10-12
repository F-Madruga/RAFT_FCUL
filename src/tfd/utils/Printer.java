package tfd.utils;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

public class Printer {

	public static void printDebug(String message) {
		if (Configuration.getBoolean("DEBUG", false)) {
			TimeZone tz = TimeZone.getTimeZone("UTC");
			SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
			df.setTimeZone(tz);
			String isoDate = df.format(new Date());
			System.out.println("[" + isoDate + "] DEBUG: " + message);
		}
	}

	public static void printMessage(String message) {
		System.out.println(message);
	}

	public static void printError(String message, Exception exception, boolean exit) {
		if (Configuration.getBoolean("DEBUG", false))
			exception.printStackTrace();
		else
			System.err.println(message + ": " + exception.toString());
		if (exit)
			System.exit(1);
	}

	public static void printError(String message, Exception exception) {
		printError(message, exception, true);
	}

}
