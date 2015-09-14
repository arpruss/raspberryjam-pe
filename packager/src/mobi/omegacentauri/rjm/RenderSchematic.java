package mobi.omegacentauri.rjm;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.util.zip.GZIPInputStream;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.preference.PreferenceManager;
import android.util.Log;
import android.widget.Toast;

public class RenderSchematic extends Activity {
	private static boolean DEBUG = true;
	private SharedPreferences options;

	static public void log(String s) {
		Log.v("rjm", s);
	}
	
	public void safeToast(final String msg) {
		runOnUiThread(new Runnable() {

			@Override
			public void run() {
				Toast.makeText(RenderSchematic.this, msg, Toast.LENGTH_LONG).show();
			}});
	}

	public void safeFinish() {
		runOnUiThread(new Runnable() {

			@Override
			public void run() {
				try {
					finish();
				}
				catch(Exception e) {}
			}});
	}

    
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
        options = PreferenceManager.getDefaultSharedPreferences(this);

		Intent i = getIntent();
		
		if (! i.getAction().equals(Intent.ACTION_VIEW)) 
			finish();

		transmit(i.getData());
	}
	
	private void transmit(final Uri uri) {
		new Thread(new Runnable(){
			@Override
			public void run() {
				sendToMinecraft("127.0.0.1", 4711, uri);
				safeFinish();
			}}).start();
	}

	@Override
	public void onNewIntent(Intent i) {
		if (! i.getAction().equals(Intent.ACTION_VIEW)) 
			finish();
		
		transmit(i.getData());
	}
	
	int[] getTilePos(PrintWriter out, BufferedReader reader) throws Exception {
		Log.v("rjm", "getTilePos");
		out.println("player.getTile()");
		String pos = reader.readLine();
		if (pos == null) {
			throw new IOException("Cannot get tile position");
		}
		Log.v("rjm", pos);
		String[] data = pos.split(",");
		if (data.length < 3)
			throw new IOException("Cannot get tile position");
		int[] x = new int[3];
		for (int i = 0; i < 3 ; i++)
			x[i] = Integer.parseInt(data[i]);
		return x;
	}

	double getDouble(PrintWriter out, BufferedReader reader, String command) throws Exception {
		out.println(command);
		String value = reader.readLine();
		if (value == null) {
			throw new IOException("Cannot get datum");
		}
		return Double.parseDouble(value);
	}

	// schematic is uncompressed here
	void sendToMinecraft(PrintWriter mcOut, BufferedReader mcIn, InputStream schematic) throws Exception {
		NBTTag tag = NBTTag.readNBTTag(schematic);
		if (tag == null || !tag.label.equals("Schematic")) {
			throw new IOException("Cannot read schematic file");
		}
		int sizeX = -1;
		int sizeY = -1;
		int sizeZ = -1;
		byte[] blocks = null;
		byte[] data = null;
		while ((tag = NBTTag.readNBTTag(schematic)) != null && tag.id != NBTTag.TAG_END) {
			if (tag.id == NBTTag.TAG_SHORT && tag.label.equals("Width")) {
				sizeX = NBTTag.readShort(schematic);
				log("Width "+sizeX);
			}
			else if (tag.id == NBTTag.TAG_SHORT && tag.label.equals("Height")) {
				sizeY = NBTTag.readShort(schematic);
				log("Height "+sizeY);
			}
			else if (tag.id == NBTTag.TAG_SHORT && tag.label.equals("Length")) {
				sizeZ = NBTTag.readShort(schematic);
				log("Length "+sizeZ);
			}
			else if (tag.id == NBTTag.TAG_BYTE_ARRAY && tag.label.equals("Blocks")) {
				int len = NBTTag.readInt(schematic);
				log("length "+len);
				blocks = new byte[len];
				int r = NBTTag.readFully(schematic,blocks);
				log("read "+r);
				if (r != len) {
					throw new IOException("Undersized file");
				}
			}
			else if (tag.id == NBTTag.TAG_BYTE_ARRAY && tag.label.equals("Data")) {
				int len = NBTTag.readInt(schematic);
				log("length "+len);
				data = new byte[len];
				int r = NBTTag.readFully(schematic,data);
				if (r != len) {
					throw new IOException("Undersized file");
				}
			}
			else 
				tag.skip(schematic);
		}
		if (sizeX < 0 || sizeY < 0 || sizeZ < 0 || blocks == null || data == null) {
			throw new IOException("Missing data in schematic file");
		}

		int[] pos = getTilePos(mcOut, mcIn);
		
		int x0 = pos[0] - sizeX / 2;
		int y0 = pos[1];
		int z0 = pos[2] - sizeZ / 2;
		safeToast("Sending data to RaspberryJamMod...");
		for (int y = 0 ; y < sizeY ; y++) {
			mcOut.println("player.setTile("+pos[0]+","+(y+pos[1])+","+(pos[2])+")");
			for (int x = 0 ; x < sizeX ; x++)
				for (int z = 0 ; z < sizeZ ; z++) {
					int offset = (y * sizeZ + z) * sizeX + x;
					if (blocks[offset] != 0) {
						mcOut.println("world.setBlock("+(x0+x)+","+(y0+y)+","+(z0+z)+","+(blocks[offset]&0xFF)+","+(data[offset]&0xFF)+")");
					}
				}
		}
	}
	
	void sendToMinecraft(String address, int port, Uri uri) {
		InputStream schematic = null;
		PrintWriter mcOut = null;
		BufferedReader mcIn = null;

		Socket s = null;

		try {
			schematic = new GZIPInputStream(new FileInputStream(uri.getPath()));
			s = new Socket(address, port);
			mcOut = new PrintWriter(s.getOutputStream(), true);
			mcIn = new BufferedReader(new InputStreamReader(s.getInputStream()));
			sendToMinecraft(mcOut, mcIn, schematic);
			safeToast("Schematic sent!");
		}
		catch(Exception e) {
			Log.v("rjm", ""+e);
			safeToast("Error sending data. Maybe Blocklauncher and RasberryJamMod aren't running? Error message "+e);
		}		
		
		if (schematic != null) {
			try { schematic.close(); } catch(Exception e) {}
		}
		if (mcOut != null) {
			try { mcOut.close(); } catch(Exception e) {}
		}
		if (mcIn != null) {
			try { mcIn.close(); } catch(Exception e) {}
		}
		if (s != null) {
			try { s.close(); } catch(Exception e) {}
		}
	}

	static class NBTTag {
		static final int TAG_END = 0;
		static final int TAG_BYTE = 1;
		static final int TAG_SHORT = 2;
		static final int TAG_INT = 3;
		static final int TAG_LONG = 4;
		static final int TAG_FLOAT = 5;
		static final int TAG_DOUBLE = 6;
		static final int TAG_BYTE_ARRAY = 7;
		static final int TAG_STRING = 8;
		static final int TAG_LIST = 9;
		static final int TAG_COMPOUND = 10;
		static final int TAG_INT_ARRAY = 11;
		
		int id;
		String label;
		
		public NBTTag(int id, String label) {
			this.id = id;
			this.label = label;
		}
		

		public static void skipBytes(InputStream data, int size) throws IOException {
			while (size-- > 0) 
				if (data.read()<0)
					throw new IOException("Undersized file");
		}
		
		public static int readFully(InputStream in, byte[] array) throws IOException{
			int offset = 0;
			int r;
			try {
				while (offset < array.length && 0 <= (r = in.read(array, offset, array.length-offset))) {
					offset += r;
				}
			} catch (IOException e) {
			}
			return offset;
		}
		
		public void skip(InputStream data) throws IOException {
			switch (id) {
			case TAG_END:
				break;
			case TAG_BYTE:
				skipBytes(data, 1);
				break;
			case TAG_SHORT:
				skipBytes(data, 2);
				break;
			case TAG_INT:
			case TAG_FLOAT:
				skipBytes(data, 4);
				break;
			case TAG_LONG:
			case TAG_DOUBLE:
				skipBytes(data, 8);
				break;
			case TAG_BYTE_ARRAY:
				skipBytes(data, readInt(data));
				break;
			case TAG_STRING: {
				short len = readShort(data);
				skipBytes(data, len);
				break;
			}
			case TAG_LIST: {
				int id = data.read();
				if (id < 0) 
					throw new IOException("Undersized file");
				NBTTag listPayloadTag = new NBTTag(id, "");
				int len = readInt(data);
				for (int i = 0 ; i < len ; i++)
					listPayloadTag.skip(data);
				break;
			}
			case TAG_COMPOUND: {
				NBTTag tag;
				while ((tag = NBTTag.readNBTTag(data)) != null && tag.id != NBTTag.TAG_END) {
					tag.skip(data);
				}
				break;
			}
			case TAG_INT_ARRAY: {
				int len = readInt(data);
				skipBytes(data, len * 4);
				break;
			}
			}
		}

		static public NBTTag readNBTTag(InputStream data) {
			int id = -1;
			try {
				id = data.read();
			}
			catch (Exception e) {}
			
			if (id < 0)
				return null;
			else if (id == TAG_END) 
				return new NBTTag(TAG_END,"");
			
			try {
				int len = readShort(data);
				byte[] labelBytes = new byte[len];
				if (readFully(data,labelBytes) < len)
					return null;
				String label = new String(labelBytes, "UTF-8");
				log("tag "+id+" "+label);
				return new NBTTag(id, label);
			}
			catch (IOException e) {
				return null;
			}
		}
		
		static short readShort(InputStream data) throws IOException {
			byte[] v = new byte[2];
			if (readFully(data,v) < 2)
				throw new IOException("End of file");
			return (short) (((v[0] & 0xFF) << 8) | (v[1] & 0xFF));
		}

		static int readInt(InputStream data) throws IOException {
			byte[] v = new byte[4];
			if (readFully(data,v) < 4)
				throw new IOException("End of file");
			return (int) (((v[0] & 0xFF) << 24) | ((v[1] & 0xFF) << 16) | ((v[2] & 0xFF) << 8)  | (v[3] & 0xFF));
		}
	}
}
