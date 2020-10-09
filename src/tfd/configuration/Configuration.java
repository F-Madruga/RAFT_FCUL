package tfd.configuration;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.Map;
import java.util.Properties;

public class Configuration {
	private static Properties properties = new Properties();
	private static Map<String, String> env = System.getenv();
	private static boolean loaded = false;

	public static void load() {
		if (!loaded) {
			try (FileInputStream is = new FileInputStream(".env")) {
				properties.load(is);
				loaded = true;
			} catch (IOException ex) {}
		}
	}

	public static String getString(String propertyName, String defaultValue) {
		load();
		String property = env.containsKey(propertyName) ? env.get(propertyName) : properties.getProperty(propertyName);
		return property == null ? defaultValue : property;
	}

	public static int getInt(String propertyName, int defaultValue) {
		load();
		String property = env.containsKey(propertyName) ? env.get(propertyName) : properties.getProperty(propertyName);
		try {
			return Integer.parseInt(property);
		} catch (NumberFormatException ex) {
			return defaultValue;
		}
	}

	public static float getFloat(String propertyName, float defaultValue) {
		load();
		String property = env.containsKey(propertyName) ? env.get(propertyName) : properties.getProperty(propertyName);
		try {
			return Float.parseFloat(property);
		} catch (NumberFormatException ex) {
			return defaultValue;
		}
	}

	public static boolean getBoolean(String propertyName, boolean defaultValue) {
		load();
		String property = env.containsKey(propertyName) ? env.get(propertyName) : properties.getProperty(propertyName);
		return Boolean.parseBoolean(property);
	}

	public static void printError(String message, Exception exception, boolean exit) {
		load();
		if (getBoolean("DEBUG", false))
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
