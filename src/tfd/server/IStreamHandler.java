package tfd.server;

import java.io.InputStream;
import java.io.OutputStream;

public interface IStreamHandler {
	public void setStreams(InputStream inputStream, OutputStream outputStream);
}
