package tfd.utils;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.Map;
import java.util.Properties;

public class Configuration {
	private static Properties properties = new Properties();
	private static Map<String, String> env = System.getenv();

	public static void load(String fileName) {
		try (FileInputStream is = new FileInputStream(fileName)) {
			properties.load(is);
		} catch (IOException ex) {}
	}

	public static void load() {
		load("env.yaml");
	}

	public static String getString(String propertyName, String defaultValue) {
		String property = env.containsKey(propertyName) ? env.get(propertyName) : properties.getProperty(propertyName);
		return property == null ? defaultValue : property;
	}

	public static int getInt(String propertyName, int defaultValue) {
		String property = env.containsKey(propertyName) ? env.get(propertyName) : properties.getProperty(propertyName);
		try {
			return Integer.parseInt(property);
		} catch (NumberFormatException ex) {
			return defaultValue;
		}
	}

	public static float getFloat(String propertyName, float defaultValue) {
		String property = env.containsKey(propertyName) ? env.get(propertyName) : properties.getProperty(propertyName);
		try {
			return Float.parseFloat(property);
		} catch (NumberFormatException ex) {
			return defaultValue;
		}
	}

	public static boolean getBoolean(String propertyName, boolean defaultValue) {
		String property = env.containsKey(propertyName) ? env.get(propertyName) : properties.getProperty(propertyName);
		return Boolean.parseBoolean(property);
	}

}
