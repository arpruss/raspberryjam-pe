package mobi.omegacentauri.rjm;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentResolver;
import android.content.DialogInterface;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Log;
import android.widget.Toast;

public class SendToMCPE extends Activity {
	private static boolean DEBUG = true;
	public ContentResolver cr;
	private int maxHeight = 110;
	static final int INVALID_ROTATION = -360000;
	int fuzz = 0;
	static final int COLORS[][] = {
		{35,0, 222,222,222},
		{35,1, 219,125,63},
		{35,2, 180,81,189},
		{35,3, 107,138,201},
		{35,4, 177,166,39},
		{35,5, 66,174,57},
		{35,6, 208,132,153},
		{35,7, 64,64,64},
		{35,8, 155,161,161},
		{35,9, 47,111,137},
		{35,10, 127,62,182},
		{35,11, 46,57,142},
		{35,12, 79,50,31},
		{35,13, 53,71,27},
		{35,14, 151,52,49},
		{35,15, 26,22,22},
		{159,0,210,178,161},
		{159,1,162,84,38},
		{159,2,150,88,109},
		{159,3,113,109,138},
		{159,4,186,133,35},
		{159,5,104,118,53},
		{159,6,162,78,79},
		{159,7,58,42,36},
		{159,8,135,107,98},
		{159,9,87,91,91},
		{159,10,118,70,86},
		{159,11,74,60,91},
		{159,12,77,51,36},
		{159,13,76,83,42},
		{159,14,143,61,47},
		{159,15,37,23,16},
		{155,0,232,228,220},
		{152,0,164,26,9},
		{41,0,250,239,80},
		{173,0,19,19,19},
	};

	public static void log(String s) {
		if (DEBUG )
			Log.v("SendReduced", s);
	}

	/** Called when the activity is first created. */
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		cr = getContentResolver();
		Intent i = getIntent();
		Bundle e = i.getExtras();
		if (i.getAction().equals(Intent.ACTION_SEND)) {
			if (e != null &&
					e.containsKey(Intent.EXTRA_STREAM))  {
				ReducedImage ri = new ReducedImage(
						(Uri)e.getParcelable(Intent.EXTRA_STREAM));
				if (ri.bmp != null) {
					final Bitmap bmp = ri.bmp;

					new Thread(new Runnable(){
						@Override
						public void run() {
							try {
								sendToMinecraft(bmp);
								bmp.recycle();
							} catch (Exception e) {
								Log.e("rjm", ""+e);
								runOnUiThread(new Runnable() {

									@Override
									public void run() {
										Toast.makeText(SendToMCPE.this, "Error: RaspberryJamMod not running?", Toast.LENGTH_LONG).show();
									}});
							}
						}}).start();
				}
			}
			finish();
		}
	}

	int[] getTilePos(PrintWriter out, BufferedReader reader) throws Exception {
		Log.v("rjm", "getTilePos");
		out.println("player.getTile()");
		String pos = reader.readLine();
		Log.v("rjm", "got");
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
			throw new IOException("Cannot get tile position");
		}
		return Double.parseDouble(value);
	}

	void sendToMinecraft(Bitmap bmp) throws Exception {
		Log.v("rjm", "sendToMinecraft");
		int w = bmp.getWidth();
		int h = bmp.getHeight();
		Socket s = new Socket("127.0.0.1", 4711);
		try {
			PrintWriter out = new PrintWriter(s.getOutputStream(), true);
			BufferedReader reader = new BufferedReader(new InputStreamReader(s.getInputStream()));
			int[] pos = getTilePos(out, reader);
			double yawDouble = getDouble(out, reader, "player.getRotation()");
			yawDouble %= 360;
			if (yawDouble < 0)
				yawDouble += 360;
			int yaw = (int)(Math.round(yawDouble / 90.) * 90.);
			if (yaw == 360)
				yaw = 0;
			double pitchDouble = getDouble(out, reader, "player.getPitch()");
			int pitch = (int)(Math.round(pitchDouble / 90.) * 90.);
			Log.v("rjm", "yaw "+yaw+" pitch "+pitch);
			if (pitch == 0) {
				int dx;
				int dz;
				int backX;
				int backZ;

				if (yaw == 180) {
					dx = 1;
					dz = 0;
					backX = 0;
					backZ = -1;
				}
				else if (yaw == 0) {
					dx = -1;
					dz = 0;
					backX = 0;
					backZ = 1;
				}
				else if (yaw == 90) {
					dx = 0;
					dz = -1;
					backX = 1;
					backZ = 0;
				}
				else { //if (yaw == 270) {
					dx = 0;
					dz = 1;
					backX = -1;
					backZ = 0;
				}
				out.println("player.setTile("+(pos[0]+backX)+","+pos[1]+","+(pos[2]+backZ)+")");
				for (int x = 0 ; x < w; x++)
					for (int y = 0; y <h ; y++) 
						sendPixelToMinecraft(out, pos[0]+x*dx,pos[1]+y,pos[2]+x*dz, bmp.getPixel(x, h-1-y));
			}
			else {
				int xx;
				int xy;
				int zx;
				int zy;
				if (yaw == 180) {
					// OK
					zx = 0;
					zy = -1;
					xx = 1;
					xy = 0;
				}
				else if (yaw == 0) {
					// OK
					zx = 0;
					zy = 1;
					xx = -1;
					xy = 0;
				}
				else if (yaw == 90) {
					// OK
					zx = -1;
					zy = 0;
					xx = 0;
					xy = -1;
				}
				else { // 270
					zx = 1; //ok
					zy = 0;
					xx = 0;
					xy = 1;
				}
				if (pitch < 0) {
					zy = -zy; 
					xy = -xy;
					pos[1] += 2;
				}
				for (int x = 0 ; x < w; x++)
					for (int y = 0; y <h ; y++) 
						sendPixelToMinecraft(out, pos[0]+x*xx+y*xy,pos[1],pos[2]+x*zx+y*zy, bmp.getPixel(x, h-1-y));
			}
		}
		finally {
			try {
				s.close();
			}
			catch (Exception e) {}
		}
	}

	private void sendPixelToMinecraft(PrintWriter out, int x, int y, int z,
			int c) {
		int r = (int) (Color.red(c) + (Math.random()-0.5)*fuzz);
		int g = (int) (Color.green(c) + (Math.random()-0.5)*fuzz);
		int b = (int) (Color.blue(c) + (Math.random()-0.5)*fuzz);
		int bestDist = Integer.MAX_VALUE;
		int[] bestBlock = COLORS[0];
		for (int[] block : COLORS) {
			int d = (r-block[2])*(r-block[2])+(g-block[3])*(g-block[3])+(b-block[4])*(b-block[4]);
			if (d < bestDist) {
				bestBlock = block;
				bestDist = d;
			}
		}
		out.println("world.setBlock("+x+","+y+","+z+","+bestBlock[0]+","+bestBlock[1]+")");
	}

	static private int getOrientation(ContentResolver cr, Uri uri) {
		Cursor c = 
				android.provider.MediaStore.Images.Media.query(cr, uri, 
						new String[]{MediaStore.Images.Media.ORIENTATION});
		if (c == null)
			return INVALID_ROTATION;
		c.moveToFirst();
		int o = c.getInt(c.getColumnIndex(MediaStore.Images.Media.ORIENTATION));
		c.close();
		return o;
	}

	static private byte[] getStreamBytes(InputStream stream) {
		List<byte[]> chunks = new ArrayList<byte[]>();
		byte[] buffer = new byte[16384];

		int total = 0;
		int read;
		try {
			while (0 <= (read = stream.read(buffer))) {
				byte[] chunk = new byte[read];
				System.arraycopy(buffer, 0, chunk, 0, read);
				chunks.add(chunk);
				total += read;
			}
		} catch (IOException e) {
			Log.e("rjm","error reading: "+e);
			return null;
		}

		byte[] data = new byte[total];
		int pos = 0;

		for (byte[] chunk: chunks) {
			System.arraycopy(chunk, 0, data, pos, chunk.length);
			pos += chunk.length;
		}

		return data;
	}

	class ReducedImage {
		long date;
		Bitmap bmp;

		public ReducedImage(Uri uri) {
			bmp = null;

			SendToMCPE.log("Reducing "+uri);
			byte[] data;
			try {
				data = getStreamBytes(cr.openInputStream(uri));
			} catch (FileNotFoundException e) {
				SendToMCPE.log("error reading: "+e);
				return;
			}

			if (data == null) 
				return;

			date = -1;
			if (uri.getScheme().equalsIgnoreCase("file")) {
				File f = new File(uri.getPath());
				date = f.lastModified();
			}

			SendToMCPE.log("need to decode "+data.length+" bytes");

			int o = getOrientation(cr, uri);
			SendToMCPE.log("orientation = "+o);

			Bitmap inBmp = BitmapFactory.decodeByteArray(data, 0, data.length);

			if (inBmp == null) {
				SendToMCPE.log("error decoding");
				return;
			}

			int h = inBmp.getHeight();
			int w = inBmp.getWidth();

			boolean transform = false;

			Matrix m = new Matrix();

			if (h > maxHeight) {
				m.postScale(maxHeight / (float)h, maxHeight / (float)h);
			}

			if (INVALID_ROTATION != o) {
				m.postRotate(o);
				transform = true;
			}

			SendToMCPE.log("image: "+w+"x"+h+" ["+o+"]");

			if (transform)
				bmp = Bitmap.createBitmap(inBmp, 0, 0, w, h, m, true);
			else
				bmp = inBmp;
		}
	}
}
