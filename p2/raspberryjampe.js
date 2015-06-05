// droidjam.js (c) 2015 by Alexander R. Pruss
//
// License: MIT / X11

// 20 is reliable
// 80 seems OK
var BLOCKS_PER_TICK = 100;
var PORT = 4711;
var EVENTS_MAX = 512;
var PLAYER_HEIGHT = 1.61999988;
var TOO_SMALL = 1e-9;

var serverSocket;
var socket;
var reader;
var writer;
var thread;
var running;

var immutable = 0;
var worldDir = "undefined";
var hitRestrictedToSword = 1;
var blockQueue = [];
var hitData = [];
var chatData = [];
var newWorld = 1;
var needSpawnY = 0;
var spawnX;
var spawnY;
var spawnZ;
var playerId;
//var noAIs = [];
var ENTITIES = {
    "PrimedTnt":65,
    "FallingSand":66,
    "Arrow":80,
    "Snowball":81,
    "MinecartRideable":84,
    "Fireball":85,
    "Zombie":32,
    "Creeper":33,
    "Skeleton":34,
    "Spider":35,
    "PigZombie":36,
    "Slime":37,
    "Enderman":38, //untested from here
    "Silverfish":39,
    "CaveSpider":40,
    "Ghast":41,
    "LavaSlime":42,
    "Chicken":10,
    "Cow":11,
    "Pig":12,
    "Sheep":13,
    "Wolf":14,
    "Mooshroom":16,
    "Squid":17,
    "Bat":19
};

function setCamera(id) {
   ModPE.setCamera(id);
   camera = id;
}

function updateSpawnPos() {
   if (! newWorld && "" != ModPE.readData(worldDir+".spawnX")) {
       spawnX = parseInt(ModPE.readData(worldDir+".spawnX"));
       spawnY = parseInt(ModPE.readData(worldDir+".spawnY"));
       spawnZ = parseInt(ModPE.readData(worldDir+".spawnZ"));
       android.util.Log.v("droidjam", "read spawn position as "+spawnX+" "+spawnY+" "+spawnZ);
       return;
   }

   newWorld = 0;

   android.util.Log.v("droidjam", "initial position is "+Player.getX()+" "+Player.getY()+" "+Player.getZ());

   spawnX = parseInt(Math.floor(Player.getX()));
   ModPE.saveData(worldDir+".spawnX", spawnX);
   y = Player.getY();
   if (y <= 127) {
       spawnY = parseInt(Math.round(y - PLAYER_HEIGHT));
       ModPE.saveData(worldDir+".spawnY", spawnY);
   }
   else {
       spawnY = 0;
       needSpawnY = 1;
   }
   spawnZ = parseInt(Math.floor(Player.getZ()));
   ModPE.saveData(worldDir+".spawnZ", spawnZ);
   android.util.Log.v("droidjam", "defining spawn position as "+spawnX+" "+spawnY+" "+spawnZ);
}

function selectLevelHook() {
   android.util.Log.v("droidjam", "selectLevel");
   worldDir = Level.getWorldDir();
   var f = new java.io.File(android.os.Environment.getExternalStorageDirectory().getAbsolutePath()+"/games/com.mojang/minecraftWorlds/"+worldDir);
   if (f.listFiles()) {
       newWorld = 0;
   }
   else {
       newWorld = 1;
       android.util.Log.v("droidjam", "new world");
   }
}

function newLevel(hasLevel) {
   android.util.Log.v("droidjam", "newLevel "+hasLevel);
   running = 1;
   thread = new java.lang.Thread(runServer);
   thread.start();
   playerId = Player.getEntity();
   setCamera(playerId);
   updateSpawnPos();
}

function sync(f) {
   return new Packages.org.mozilla.javascript.Synchronizer(f);
}

function _addHit(data) {
   hitData.push(data);
   while(hitData.length > EVENTS_MAX) {
       hitData.shift();
   }
}

function _addChat(data) {
   chatData.push(data);
   while(chatData.length > EVENTS_MAX) {
       chatData.shift();
   }
}

function _getAndClearHits() {
    var out = "";
    for (var i = 0; i < hitData.length ; i++) {
        if (i > 0) {
            out += "|";
        }
        out += hitData[i];
    }
    hitData = [];
    return out;
}

function _getAndClearChats() {
    var out = "";
    for (var i = 0; i < chatData.length ; i++) {
        if (i > 0) {
            out += "|";
        }
        out += chatData[i];
    }
    chatData = [];
    return out;
}

function _clearHits() {
    hitData = [];
}

function _clearChats() {
    chatData = [];
}

function _restrictToSword(x) {
    hitRestrictedToSword = x;
}

eventSync = {
          addHit: sync(_addHit),
          addChat: sync(_addChat),
          getAndClearHits: sync(_getAndClearHits),
          getAndClearChats: sync(_getAndClearChats),
          clearHits: sync(_clearHits),
          clearChats: sync(_clearChats),
          restrictToSword: _restrictToSword };

function useItem(x,y,z,itemId,blockId,side) {
   if (immutable) {
       preventDefault();
   }
   if (! hitRestrictedToSword || itemId == 267 || itemId == 268 || itemId == 272 || itemId == 276 || itemId == 283) {
       eventSync.addHit([x,y,z,side,playerId]);
   }
}

function destroyBlock(x,y,z,side) {
   if (immutable) {
       preventDefault();
   }
}

function startDestroyBlock(x,y,z,side) {
   if (immutable) {
       preventDefault();
   }
}

function chatHook(message) {
   data = [playerId, message.replace(/\|/g, '&#124;')];
   eventSync.addChat(data);
}

// we don't know the userId on server messages, so use -1
function serverMessageReceiveHook(message) {
   data = [-1, message.replace(/\|/g, '&#124;')];
   eventSync.addChat(data);
}

function posDesc(desc,x) {
    desc = desc.replace(/[A-Za-z]/, '~');
    if (desc.charAt(0) != "~") {
        return desc;
    }
    var adj = desc.substring(1);
    if (adj.charAt(0) == "+") {
        adj = adj.substring(1);
    }
    if (isNaN(parseFloat(adj))) {
        adj = "0";
    }
    return x + parseFloat(adj);
}

function quotedList(args) {
    var out = "";
    for (var i = 0; i < args.length ; i++) {
        if (i > 0) {
            out += ",";
        }
        out += "'"+args[i].replace("\\", "\\\\").replace("'", "\\'")+"'";
    }
    return out;
}

function entityX(id) {
   return Entity.getX(id) - spawnX;
}

function entityY(id) {
   if (id == playerId) 
       return Entity.getY(id) - PLAYER_HEIGHT - spawnY;
   else
       return Entity.getY(id) - spawnY;
}

function entityZ(id) {
   return Entity.getZ(id);
}

function entitySetPosition(id, x,y,z) {
     var y2;
     if (id == playerId) {
         y2 = PLAYER_HEIGHT+parseFloat(y);
     }
     else {
         y2 = args[2];
     }
     Entity.setVelX(id,0);
     Entity.setVelY(id,0);
     Entity.setVelZ(id,0);
     Entity.setPosition(id,spawnX+x,spawnY+y2,spawnZ+z);
}


function playerX() {
   return Player.getX() - spawnX;
}

function playerY() {
   return Player.getY() - PLAYER_HEIGHT - spawnY;
}

function playerZ() {
   return Player.getZ() - spawnZ;
}

function procCmd(cmdLine) {
    cmds = cmdLine.split(/ +/);
    if (cmds[0] == "time") {
        if (cmds.length >= 3 && cmds[1] == "set") {
            Level.setTime(cmds[2]);
        }
        else if (cmds.length >= 3 && cmds[1] == "add") {
            Level.setTime(Level.getTime() + cmds[3]);
        }
        else if (cmds.length >= 2 && cmds[1] == "query") {
            clientMessage("Day time "+Level.getTime());
        }
    }
    else if (cmds[0] == "tp" && cmds.length >= 4) {
        entitySetPosition(playerId,posDesc(cmds[1],playerX()),
            posDesc(cmds[2],playerY()),
            posDesc(cmds[3],playerZ()));
    }
    else if ((cmds[0] == "py" || cmds[0] == "python") && cmds.length >= 2) {
        var context = com.mojang.minecraftpe.MainActivity.currentMainActivity.get();
        var intent = new android.content.Intent();
        intent.setClassName("com.hipipal.qpyplus","com.hipipal.qpyplus.MPyApi");
        intent.setAction("com.hipipal.qpyplus.action.MPyApi");
        var bundle = new android.os.Bundle();
        bundle.putString("app", "myappid");
        bundle.putString("act", "onPyApi");
        bundle.putString("flag", "onQPyExec");
        bundle.putString("param", "");
        dir = android.os.Environment.getExternalStorageDirectory().getAbsolutePath() + "/com.hipipal.qpyplus/scripts";
        cmds.shift();
        var script = "import sys\n" +
             "sys.path.append('" + dir + "')\n"+
             "sys.argv = [" + quotedList(cmds) + "]\n"+
             "execfile('" + dir + "/" + cmds[0] + ".py')\n";
        bundle.putString("pycode",script);
        intent.putExtras(bundle);
        context.startActivity(intent);
    }
}

function _closeAllButServer() {
    android.util.Log.v("droidjam", "closing connection");
    try {
         reader.close();
    } catch(e) {}
    reader = undefined;
    try {
        writer.close();
    } catch(e) {}
    writer = undefined;
    try {
        socket.close();
    } catch(e) {}
    socket = undefined;
}

function _closeServer() {
   try {
      if (serverSocket) {
          serverSocket.close();
          android.util.Log.v("droidjam", "closed socket");
          serverSocket = undefined;
      }
   } catch(e) {}
}

serverSync = { closeAllButServer: sync(_closeAllButServer),
   closeServer: sync(_closeServer) };

function runServer() {
   try {
       serverSocket=new java.net.ServerSocket(PORT,1);
   }
   catch(e) {
       print("Error "+e);
       return;
   }

   while(running) {
      reader = undefined;
      writer = undefined;
      socket = undefined;

      try {
          if (!running)
              break;
          socket=serverSocket.accept();
          android.util.Log.v("droidjam", "opening connection");
          reader=new java.io.BufferedReader(new java.io.InputStreamReader(socket.getInputStream()));
          writer=new java.io.PrintWriter(socket.getOutputStream(),true);
//          Level.setTime(0); // only for debug

          while(running) {
             var str = reader.readLine();
             if (undefined == str)
                break;
             handleCommand(str);
          }
      }
      catch(e) {
         if (running)
             print("Error "+e);
      }
      serverSync.closeAllButServer();
   }

   serverSync.closeServer();
   print("Closing server");
}

function leaveGame() {
   android.util.Log.v("droidjam", "leaveGame()");
   running = 0;
   serverSync.closeAllButServer();
   serverSync.closeServer();
}

function entitySetDirection(id, x, y, z) {
   if (x * x + y * y + z * z >= TOO_SMALL * TOO_SMALL) {

       var xz = Math.sqrt(x * x + z * z);
       var yaw;
       if (xz >= TOO_SMALL) {
           yaw = Math.atan2(-x, z) * 180 / Math.PI;
       }
       else {
           yaw = getYaw(id);
       }

       var pitch = Math.atan2(-y, xz) * 180 / Math.PI;

       setRot(id, yaw, pitch);
   }
}

function entityGetDirection(id) {
   var pitch = getPitch(id) * Math.PI / 180.;
   var yaw = getYaw(id) * Math.PI / 180.;
   var x = Math.cos(-pitch) * Math.sin(-yaw);
   var z = Math.cos(-pitch) * Math.cos(-yaw);
   var y = Math.sin(-pitch);
   writer.println(""+x+","+y+","+z);
}

function handleCommand(cmd) {
   cmd = cmd.trim();
   var n = cmd.indexOf("(");
   if (n==-1 || cmd.slice(-1) != ")") {
       err("Cannot parse");
       return;
   }
   var m = cmd.substring(0,n);
   var argList = cmd.substring(n+1,cmd.length()-1);
   var args = argList.split(",");
   if (m == "world.setBlock") {
       setBlock(args);
   }
   else if (m == "world.setBlocks") {
       setBlocks(args);
   }
   else if (m == "player.getPos") {
       writer.println(""+playerX()+","+playerY()+","+playerZ());
   }
   else if (m == "player.getTile") {
       // maybe others should be rounded, too?
       writer.println(""+Math.floor(playerX())+","+Math.round(playerY())+","+Math.floor(playerZ()));
   }
   else if (m == "entity.getPos") {
       writer.println(entityX(args[0])+","+entityY(args[0])+","+entityZ(args[0]));
   }
   else if (m == "entity.getTile") {
       writer.println(Math.floor(entityX(args[0]))+","+Math.round(entityY(args[0]))+","+Math.floor(entityZ(args[0])));
   }
   else if (m == "world.getPlayerId" || m == "world.getPlayerIds") {
       writer.println(""+playerId);
   }
   else if (m == "entity.setPos" || m == "entity.setTile") {
       entitySetPosition(args[0],parseFloat(args[1]),parseFloat(args[2]),parseFloat(args[3]));
   }
   else if (m == "player.setPos" || m == "player.setTile") {
       entitySetPosition(playerId,parseFloat(args[0]),parseFloat(args[1]),parseFloat(args[2]));
   }
   else if (m == "player.getPitch") {
       writer.println(""+getPitch(playerId));
   }
   else if (m == "player.getRotation") {
       writer.println(""+getYaw(playerId));
   }
   else if (m == "entity.getPitch") {
       writer.println(""+getPitch(args[0]));
   }
   else if (m == "entity.getRotation") {
       writer.println(""+getYaw(args[0]));
   }
   else if (m == "player.setPitch") {
       setRot(playerId, getYaw(playerId), args[0]);
   }
   else if (m == "player.setRotation") {
       setRot(playerId, args[0], getPitch(playerId));
   }
   else if (m == "entity.setPitch") {
       setRot(args[0], getYaw(args[0]), args[1]);
   }
   else if (m == "entity.setRotation") {
       setRot(args[0], args[1], getPitch(args[0]));
   }
   else if (m == "entity.setDirection") {
       entitySetDirection(args[0], args[1], args[2], args[3]);
   }
   else if (m == "player.setDirection") {
       entitySetDirection(playerId, args[0], args[1], args[2]);
   }
   else if (m == "entity.getDirection") {
       entityGetDirection(args[0]);
   }
   else if (m == "player.getDirection") {
       entityGetDirection(playerId);
   }
   else if (m == "world.getBlock") {
       writer.println(""+Level.getTile(spawnX+parseInt(args[0]), spawnY+parseInt(args[1]), spawnZ+parseInt(args[2])));
   }
   else if (m == "world.getBlockWithData") {
       writer.println(""+
           Level.getTile(spawnX+parseInt(args[0]),spawnY+parseInt(args[1]), spawnZ+parseInt(args[2]))+","+
           Level.getData(spawnX+parseInt(args[0]), spawnY+parseInt(args[1]), spawnZ+parseInt(args[2])));
   }
   else if (m == "chat.post") {
       clientMessage(argList);
   }
   else if (m == "world.setTime") {
       Level.setTime(args[0]);
   }
   else if (m == "world.setting") {
       if (args.length >= 2 && args[0] == "world_immutable") {
           immutable = parseInt(args[1]);
       }
   }
   else if (m == "events.block.hits") {
       writer.println(eventSync.getAndClearHits());
   }
   else if (m == "events.chat.posts") {
       writer.println(eventSync.getAndClearChats());
   }
   else if (m == "events.clear") {
       eventSync.clearHits();
       eventSync.clearChats();
   }
   else if (m == "events.setting") {
       if(args[0] == "restrict_to_sword") {
            eventSync.restrictToSword(parseInt(args[1]));
       }
   }
   else if (m == "camera.setFollow") {
       setCamera(args[0]);
   }
   else if (m == "camera.setNormal") {
       setCamera(playerId);
   }
   else if (m == "camera.getEntityId") {
       writer.println(""+camera);
   }
   else if (m == "world.getHeight") {
       var x = spawnX+parseInt(args[0]);
       var z = spawnZ+parseInt(args[2]);
       var y;
       for (var y = 127 ; y > 0 ; y--) {
           if (Level.getTile(x,y,z)) {
               break;
           }
       }
       writer.println(""+(y-spawnY));
   }
   else if (m == "world.spawnEntity") {
       var id;
       var x = spawnX+parseFloat(args[1]);
       var y = spawnY+parseFloat(args[2]);
       var z = spawnZ+parseFloat(args[3]);
       if (args[0] == "Cow") {
           id = spawnCow(x,y,z);
       }
       else if (args[0] == "Chicken") {
           android.util.Log.v("droidjam", "chicken at "+x+" "+y+" "+z); 
           id = spawnChicken(x,y,z);
       }
       else if (! isNaN(args[0])) {
           id = Level.spawnMob(x,y,z, args[0]);
       }
       else if (args[0] in ENTITIES) {
           id = Level.spawnMob(x,y,z, ENTITIES[args[0]]);
       }
       writer.println(""+id);
//       if (args.length >= 5 && args[4]) {
//           var e = [id, args[1], args[2], args[3], 0, 0];
//           noAIs.push(e);
//           android.util.Log.v("droidjam", "closing connection");
//       }
   }
   else if (m == "entity.rideAnimal") { // unofficial
       Entity.rideAnimal(args[0], args[1]);
   }
   else if (m == "world.removeEntity") {
       Entity.remove(args[0]);
   }
   else {
       err("Unknown command");
    }
}

var busy = 0;

function _pushBlockQueue(x,y,z,id,meta) {
    var entry = [x,y,z,id,meta];
    blockQueue.push(entry);
}

pushBlockQueue = new Packages.org.mozilla.javascript.Synchronizer(_pushBlockQueue);

function setBlock(args) {
    pushBlockQueue(
       spawnX+parseInt(args[0]),
       spawnY+parseInt(args[1]),
       spawnZ+parseInt(args[2]),
       parseInt(args[3]), parseInt(args[4]));
}

function _grab() {
    var count = blockQueue.length;
    if (count == 0)
        return [];
    if (count > BLOCKS_PER_TICK) {
        count = BLOCKS_PER_TICK;
    }
    var grabbed = blockQueue.slice(0,count);
    blockQueue = blockQueue.slice(count);
    return grabbed;
}

grab = new Packages.org.mozilla.javascript.Synchronizer(_grab);

function modTick() {
    if (needSpawnY && Player.getY() < 128) {
        needSpawnY = 0;
        spawnY = parseInt(Math.round(Player.getY()-PLAYER_HEIGHT));
        android.util.Log.v("droidjam", "spawnY = "+spawnY);
        while (spawnY > 0 && Level.getTile(spawnX,spawnY-1,spawnZ) == 0) {
            spawnY--;
        }
        ModPE.saveData(worldDir+".spawnY", spawnY);
        android.util.Log.v("droidjam", "adjusted spawnY = "+spawnY);
    }
//    for (i = 0 ; i < noAIs.length ; i++) {
//        e = noAIs[i];
//        Entity.setPosition(e[0],e[1],e[2],e[3]);
//        setRot(e[0], e[4], e[5]);
//    }
    if (busy) {
        // try again next tick
        return;
    }
    busy++;
    var grabbed = grab();
    for (var i = 0 ; i < grabbed.length ; i++) {
        var e = grabbed[i];
        Level.setTile(e[0], e[1], e[2], e[3], e[4]);
    }
    busy--;
}

function setBlocks(args) {
   var x0 = parseInt(args[0]) + spawnX;
   var y0 = parseInt(args[1]) + spawnY;
   var z0 = parseInt(args[2]) + spawnZ;
   var x1 = parseInt(args[3]) + spawnX;
   var y1 = parseInt(args[4]) + spawnY;
   var z1 = parseInt(args[5]) + spawnZ;
   var id = parseInt(args[6]);
   var meta = parseInt(args[7]);
   var startx = x0 < x1 ? x0 : x1;
   var starty = y0 < y1 ? y0 : y1;
   var startz = z0 < z1 ? z0 : z1;
   var endx = x0 > x1 ? x0 : x1;
   var endy = y0 > y1 ? y0 : y1;
   var endz = z0 > z1 ? z0 : z1;
   for (var z = startz ; z <= endz ; z++) {
       for (var y = starty ; y <= endy ; y++) {
           for (var x = startx ; x <= endx ; x++) {
                pushBlockQueue(x,y,z,id,meta);
           }
       }
   }
}

function err(msg) {
   writer.println("ERR "+msg);
   android.util.Log.e("droidjam", "error "+msg);
}
