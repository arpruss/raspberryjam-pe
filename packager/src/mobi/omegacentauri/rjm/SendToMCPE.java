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
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Bundle;
import android.preference.PreferenceManager;
import android.provider.MediaStore;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class SendToMCPE extends Activity {
	private static boolean DEBUG = true;
	public ContentResolver cr;
	static final int INVALID_ROTATION = -360000;
	int fuzz = 0;
	private SharedPreferences options;
	private int orientation;
	private int inHeight;
	private int inWidth;
	private Bitmap inBmp;
	private double aspect;
	private TextView resX;
	private EditText resY;
	private CheckBox dither;
	private boolean switchXY;
	private TextView info;
	private CheckBox external;
	private EditText host;
	private static final String PHOTO_RES_Y = "photoResY";
	private static final String PHOTO_DITHER = "photoDither";
	private static final String PHOTO_IP = "photoHost";
	private static final String PHOTO_EXTERNAL = "photoExternal";
	static final short COLORS[][] = {
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
	
	public void safeToast(final String msg) {
		runOnUiThread(new Runnable() {

			@Override
			public void run() {
				Toast.makeText(SendToMCPE.this, msg, Toast.LENGTH_LONG).show();
			}});
	}

    public void onSend(View v) {
    	int h = 1;
    	
		try {
			h = Integer.parseInt(resY.getText().toString());
		}
		catch (Exception e) {}
		
		int w = (int) (aspect * h + 0.5);
		if (w <= 0)
			w = 1;
		
		final String ip = external.isChecked() ? host.getText().toString() : "127.0.0.1";
		final boolean d = dither.isChecked();
		SharedPreferences.Editor ed = options.edit();
		ed.putInt(PHOTO_RES_Y, h);
		ed.putBoolean(PHOTO_DITHER, d);
		if (external.isChecked()) {
			ed.putBoolean(PHOTO_EXTERNAL, true);
			ed.putString(PHOTO_IP, ip);
		}
		else {
			ed.putBoolean(PHOTO_EXTERNAL, false);
		}
		ed.commit();

		Matrix m = new Matrix();

		if (INVALID_ROTATION != orientation && orientation != 0) {
			m.postRotate(orientation);
		}

		m.postScale(w/(float)inWidth, h/(float)inHeight);

		final Bitmap bmp = Bitmap.createBitmap(inBmp, 0, 0, inBmp.getWidth(), inBmp.getHeight(), m, true);
		final int width = Math.min(bmp.getWidth(), w);
		final int height = Math.min(bmp.getHeight(), h);
		new Thread(new Runnable(){
			@Override
			public void run() {
				try {
					sendToMinecraft(ip, 4711, bmp, d, width, height);
				} catch (Exception e) {
					Log.e("rjm", ""+e);
					safeToast("Error: RaspberryJamMod not running?");
				} finally {
					bmp.recycle();
					inBmp.recycle();
				}
			}}).start();
		finish();
    }
    
    /** Called when the activity is first created. */
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
        options = PreferenceManager.getDefaultSharedPreferences(this);
        setContentView(R.layout.photo);

		cr = getContentResolver();
		Intent i = getIntent();
		
		if (! i.getAction().equals(Intent.ACTION_SEND)) 
			finish();
		
		load(i.getExtras());
	}
	
	@Override
	public void onNewIntent(Intent i) {
		if (! i.getAction().equals(Intent.ACTION_SEND)) 
			finish();
		
		load(i.getExtras());
	}
	
	void load(Bundle extras) {
		if (extras == null ||
				! extras.containsKey(Intent.EXTRA_STREAM)) {
			Toast.makeText(this, "Cannot load image", Toast.LENGTH_LONG);
			finish();
			return;
		}

		Uri uri = (Uri)extras.getParcelable(Intent.EXTRA_STREAM);
		byte[] data;
		
		try {
			data = getStreamBytes(cr.openInputStream(uri));
		} catch (FileNotFoundException e) {
			SendToMCPE.log("error reading: "+e);
			return;
		}

		if (data == null) 
			return;

		SendToMCPE.log("need to decode "+data.length+" bytes");

		orientation = getOrientation(cr, uri);
		SendToMCPE.log("orientation = "+orientation);

		inBmp = BitmapFactory.decodeByteArray(data, 0, data.length);

		if (inBmp == null) {
			Toast.makeText(this, "Cannot load image", Toast.LENGTH_LONG);
			finish();
			return;
		}

		switchXY = orientation != INVALID_ROTATION && ((orientation % 180) != 0);
		inHeight = switchXY ? inBmp.getWidth() : inBmp.getHeight();
		inWidth = switchXY ? inBmp.getHeight() : inBmp.getWidth();
		Log.v("rjm", "switchXY "+switchXY+" dim "+inWidth+" x "+inHeight);
		
		if (inHeight == 0 || inWidth == 0) {
			Toast.makeText(this, "Invalid image size", Toast.LENGTH_LONG);
			finish();
			return;
		}
		
		aspect = (double)inWidth / inHeight;
		TextView inRes = (TextView) findViewById(R.id.inRes);
		inRes.setText("Input: "+inWidth+" x "+inHeight);
		resX = (TextView) findViewById(R.id.resX);
		resY = (EditText) findViewById(R.id.resY);
		int h = options.getInt(PHOTO_RES_Y, 100);
		int w = (int) (aspect * h + 0.5);
		if (w <= 0)
			w = 1;
		resX.setText(""+w);
		resY.setText(""+h);
		resY.selectAll();
		TextWatcher watcher = new TextWatcher() {
			
			@Override
			public void onTextChanged(CharSequence s, int start, int before, int count) {
			}
			
			@Override
			public void beforeTextChanged(CharSequence s, int start, int count,
					int after) {
			}
			
			@Override
			public void afterTextChanged(Editable s) {
				try {
					int h = Integer.parseInt(s.toString());
					int w = (int) (aspect * h + 0.5);
					if (w <= 0)
						w = 1;
					resX.setText(""+w);
				}
				catch (Exception e) {
					resX.setText("1");
				}
			}
		};
		resY.addTextChangedListener(watcher);
		boolean d = options.getBoolean(PHOTO_DITHER, false);
		dither = (CheckBox)findViewById(R.id.dither);
		dither.setChecked(d);		
		info = (TextView)findViewById(R.id.info);
		external = (CheckBox)findViewById(R.id.external);
		host = (EditText)findViewById(R.id.host);
		boolean ext = options.getBoolean(PHOTO_EXTERNAL, false);
		external.setChecked(ext);
		updateExternal(ext);
		if (ext) {
			host.setText(options.getString(PHOTO_IP, "127.0.0.1"));
			host.setSelection(host.getText().length());
		}
		external.setOnCheckedChangeListener(new CheckBox.OnCheckedChangeListener() {
			
			@Override
			public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
				updateExternal(isChecked);
			}
		});
	}

	private void updateExternal(boolean ext) {
		if (ext) {
			info.setText("Enter IP address of a device running Minecraft with Raspberry Jam Mod, or of your server with Raspberry Juice, or of a Raspberry PI running Minecraft."); 
			host.setVisibility(View.VISIBLE);
		}
		else {
			info.setText("Make sure that Raspberry Jam Mod is installed and a Minecraft world has been started via BlockLauncher.");
			host.setVisibility(View.GONE);
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

	// Floyd-Steinberg
	void sendToMinecraft(String address, int port, Bitmap bmp, Boolean dither, int w, int h) throws Exception {
		Log.v("rjm", "sendToMinecraft");
		short[][][] outPixel = new short[w][h][2]; 
		
		if (dither) {
			short[][][] in = new short[w][h][3];
			
			for (int x = 0; x < w ; x++)
				for (int y = 0 ; y < h ; y++) {
					int c = bmp.getPixel(x,h-1-y);
					in[x][y][0] = (short) Color.red(c);
					in[x][y][1] = (short) Color.green(c);
					in[x][y][2] = (short) Color.blue(c);
				}
			
			dither(outPixel, in, w, h);
		}
		else {
			for (int x = 0; x < w ; x++)
				for (int y = 0 ; y < h ; y++) {
					int c = bmp.getPixel(x,h-1-y);
					short[] b = closestMinecraft((short)Color.red(c),(short)Color.green(c),(short)Color.blue(c));
					outPixel[x][y][0] = b[0];
					outPixel[x][y][1] = b[1];
				}
		}

		safeToast("Sending to Minecraft");
		Socket s = new Socket(address, port);
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
						sendPixelToMinecraft(out, pos[0]+x*dx,pos[1]+y,pos[2]+x*dz, outPixel[x][y]);
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
						sendPixelToMinecraft(out, pos[0]+x*xx+y*xy,pos[1],pos[2]+x*zx+y*zy, outPixel[x][y]);
			}
			safeToast("Sent!");
		}
		finally {
			try {
				s.close();
			}
			catch (Exception e) {}
		}
	}

	private short[] closestMinecraft(short r,short g,short b) {
		int bestDist = Integer.MAX_VALUE;
		short[] bestBlock = COLORS[0];
		for (short[] block : COLORS) {
			int d = (r-(int)block[2])*(r-(int)block[2])+(g-(int)block[3])*(g-(int)block[3])+(b-(int)block[4])*(b-(int)block[4]);
			if (d < bestDist) {
				bestBlock = block;
				bestDist = d;
			}
		}
		return bestBlock;
	}

	/* modifies in */
	private void dither(short[][][] out, short[][][] in, int w, int h) {
		for (int y = 0 ; y < h ; y++) 
			for (int x = 0; x < w ; x++) {
				short[] inPixel = in[x][y];
				short[] b = closestMinecraft(inPixel[0],inPixel[1],inPixel[2]);
				out[x][y][0] = (short) b[0];
				out[x][y][1] = (short) b[1];
				for (int i = 0 ; i < 3 ; i++) {
					short err = (short) (inPixel[i] - b[2+i]);
					if (x + 1 < w)
						in[x+1][y][i] += err * 7 / 16;
					if (y + 1 < h) {
						if (0 < x)
							in[x-1][y+1][i] += err * 3 / 16;
						in[x][y+1][i]   += err * 5/16;
						if (x + 1 < w)
							in[x+1][y+1][i] += err / 16;
					}
				}
			}
	}

	private void sendPixelToMinecraft(PrintWriter out, int x, int y, int z,
			short[] bestBlock) {
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
}
