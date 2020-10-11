package tfd.server;

import tfd.utils.Printer;

public class ClientHandler implements IClientHandler {

	@Override
	public String execute(String message) {
		Printer.printMessage("[+] New message: " + message);
		return "OK";
	}

}
