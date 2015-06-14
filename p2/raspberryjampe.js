// droidjam.js (c) 2015 by Alexander R. Pruss
//
// License: MIT / X11

// 20 is reliable
// 80 seems OK
// but surprisingly 10000 works well
var BLOCKS_PER_TICK = 10000;
var PORT = 4711;
var EVENTS_MAX = 512;
var PLAYER_HEIGHT = 1.61999988;
var TOO_SMALL = 1e-9;

var serverSocket;
var socket;
var reader;
var writer;
var thread;
var running = false;

var busy = 0;
var immutable = false;
var worldDir = "undefined";
var hitRestrictedToSword = 1;
var blockQueue = [];
var grabbed = [];
var hitData = [];
var chatData = [];
var newWorld = true;
var needSpawnY = false;
var spawnX;
var spawnY;
var spawnZ;
var playerId;
//var noAIs = [];
var ENTITIES = {
    "PrimedTnt":65,
    "FallingSand":66,
    "FishingRodHook":77, // not official name
    "Arrow":80,
    "Snowball":81,
    "Egg":82, // not official name
    "MinecartRideable":84,
    "Fireball":85,
    "Boat":90,
    "Zombie":32,
    "Creeper":33,
    "Skeleton":34,
    "Spider":35,
    "PigZombie":36,
    "Slime":37,
    "Enderman":38,
    "Silverfish":39,
    "CaveSpider":40,
    "Ghast":41,
    "LavaSlime":42,
    "Chicken":10,
    "Cow":11,
    "Pig":12,
    "Sheep":13,
    "Wolf":14,
    "Villager":15,
    "Mooshroom":16,
    "Squid":17,
    "Bat":19
};

function _clearBlockQueue(x,y,z,id,meta) {
    blockQueue = [];
}

clearBlockQueue = new Packages.org.mozilla.javascript.Synchronizer(_clearBlockQueue);

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

   newWorld = false;

   android.util.Log.v("droidjam", "initial position is "+Player.getX()+" "+Player.getY()+" "+Player.getZ());

   spawnX = Math.floor(Player.getX());
   ModPE.saveData(worldDir+".spawnX", spawnX);
   y = Player.getY();
   if (y <= 127) {
       spawnY = Math.round(y - PLAYER_HEIGHT);
       ModPE.saveData(worldDir+".spawnY", spawnY);
   }
   else {
       spawnY = 0;
       needSpawnY = true;
   }
   spawnZ = Math.floor(Player.getZ());
   ModPE.saveData(worldDir+".spawnZ", spawnZ);
   android.util.Log.v("droidjam", "defining spawn position as "+spawnX+" "+spawnY+" "+spawnZ);
}

function selectLevelHook() {
   android.util.Log.v("droidjam", "selectLevel");
   worldDir = Level.getWorldDir();
   var f = new java.io.File(android.os.Environment.getExternalStorageDirectory().getAbsolutePath()+"/games/com.mojang/minecraftWorlds/"+worldDir);
   if (f.listFiles()) {
       newWorld = false;
   }
   else {
       newWorld = true;
       android.util.Log.v("droidjam", "new world");
   }
}

function newLevel(hasLevel) {
   android.util.Log.v("droidjam", "newLevel "+hasLevel);
   running = true;
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
         y2 = PLAYER_HEIGHT+y;
     }
     else {
         y2 = y;
     }
     Entity.setVelX(id,0);
     Entity.setVelY(id,0);
     Entity.setVelZ(id,0);
     android.util.Log.v("droidjam", "pos "+x+" "+y+" "+z+"->"+[spawnX+x,spawnY+y2,spawnZ+z]);
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
          socket=serverSocket.accept();
          if (!running)
              break;

          android.util.Log.v("droidjam", "opened connection");
          reader=new java.io.BufferedReader(new java.io.InputStreamReader(socket.getInputStream()));
          writer=new java.io.PrintWriter(socket.getOutputStream(),true);

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
   clearBlockQueue();
   running = false;
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

function _pushBlockQueue(x,y,z,id,meta) {
    var entry = [x,y,z,id,meta];
    blockQueue.push(entry);
}

pushBlockQueue = new Packages.org.mozilla.javascript.Synchronizer(_pushBlockQueue);

function _getBlockFromQueue(x,y,z) {
    for (var i = blockQueue.length - 1 ; i >= 0 ; i++) {
        if (blockQueue[i][0] == x && blockQueue[i][1] == y && blockQueue[i][2] == z)
            return [blockQueue[i][3], blockQueue[i][4]];
    }
    for (var i = grabbed.length - 1 ; i >= 0 ; i++) {
        if (grabbed[i][0] == x && grabbed[i][1] == y && grabbed[i][2] == z)
            return [grabbed[i][3], grabbed[i][4]];
    }
    return undefined;
}

getBlockFromQueue = new Packages.org.mozilla.javascript.Synchronizer(_getBlockFromQueue);

function getBlock(x,y,z) {
   var b = getBlockFromQueue(x,y,z);
   if (b === undefined)
       return Level.getTile(x,y,z);
   else {
       clientMessage(b);
       return b[0];
   }
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
      pushBlockQueue(
         spawnX+Math.floor(args[0]),
         spawnY+Math.floor(args[1]),
         spawnZ+Math.floor(args[2]),
         parseInt(args[3]),
         parseInt(args[4]));
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
       var id = parseInt(args[0]);
       writer.println(entityX(id)+","+entityY(id)+","+entityZ(id));
   }
   else if (m == "entity.getTile") {
       var id = parseInt(args[0]);
       writer.println(Math.floor(entityX(id))+","+Math.round(entityY(id))+","+Math.floor(entityZ(id)));
   }
   else if (m == "world.getPlayerId" || m == "world.getPlayerIds") {
       writer.println(""+playerId);
   }
   else if (m == "entity.setPos" || m == "entity.setTile") {
       var id = parseInt(args[0]);
       if(id != -1)
           entitySetPosition(id,parseFloat(args[1]),parseFloat(args[2]),parseFloat(args[3]));
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
       var id = parseInt(args[0]);
       writer.println(""+getPitch(id));
   }
   else if (m == "entity.getRotation") {
       writer.println(""+getYaw(id));
   }
   else if (m == "player.setPitch") {
       setRot(playerId, getYaw(playerId), parseFloat(args[0]));
   }
   else if (m == "player.setRotation") {
       setRot(playerId, parseFloat(args[0]), getPitch(playerId));
   }
   else if (m == "entity.setPitch") {
       var id = parseInt(args[0]);
       if (id != -1)
           setRot(id, getYaw(id), parseFloat(args[1]));
   }
   else if (m == "entity.setRotation") {
       var id = parseInt(args[0]);
       if (id != -1)
           setRot(id, parseFloat(args[1]), getPitch(id));
   }
   else if (m == "entity.setDirection") {
       var id = parseInt(args[0]);
       if (id != -1)
           entitySetDirection(id, parseFloat(args[1]), parseFloat(args[2]), parseFloat(args[3]));
   }
   else if (m == "player.setDirection") {
       entitySetDirection(playerId, parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]));
   }
   else if (m == "entity.getDirection") {
       var id = parseInt(args[0]);
       if (id != -1)
          entityGetDirection(id);
   }
   else if (m == "player.getDirection") {
       entityGetDirection(playerId);
   }
   else if (m == "world.getBlock") {
       var x = spawnX+Math.floor(args[0]);
       var y = spawnY+Math.floor(args[1]);
       var z = spawnZ+Math.floor(args[2]);
       writer.println(""+getBlock(x,y,z));
   }
   else if (m == "world.getBlockWithData") {
       var x = spawnX + Math.floor(args[0]);
       var y = spawnY + Math.floor(args[1]);
       var z = spawnZ + Math.floor(args[2]);
       var b = getBlockFromQueue(x,y,z);
       if (b === undefined)
           writer.println(""+Level.getTile(x,y,z)+","+Level.getData(x,y,z));
       else
           writer.println(""+b[0]+","+b[1]);
   }
   else if (m == "chat.post") {
       if (argList.charAt(0) == '/')
           clientMessage(":"+argList); // protect against slash command injection
       else
           clientMessage(argList);
   }
   else if (m == "world.setTime") {
       Level.setTime(parseInt(args[0]));
   }
   else if (m == "world.setting") {
       if (args.length >= 2 && args[0] == "world_immutable") {
           immutable = Boolean(parseInt(args[1]));
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
       setCamera(parseInt(args[0]));
   }
   else if (m == "camera.setNormal") {
       setCamera(playerId);
   }
   else if (m == "camera.getEntityId") {
       writer.println(""+camera);
   }
   else if (m == "world.getHeight") {
       // could be optimized for cases where there is a lot of stuff in queue
       var x = spawnX+Math.floor(args[0]);
       var z = spawnZ+Math.floor(args[2]);
       var y;
       for (var y = 127 ; y > 0 ; y--) {
           if (getBlock(x,y,z)) {
               break;
           }
       }
       writer.println(""+(y-spawnY));
   }
   else if (m == "world.spawnEntity") {
       var id = -1;
       var x = spawnX+parseFloat(args[1]);
       var y = spawnY+parseFloat(args[2]);
       var z = spawnZ+parseFloat(args[3]);

       if (args[0] == "Cow") {
           id = spawnCow(x,y,z);
       }
       else if (args[0] == "Chicken") {
           id = spawnChicken(x,y,z);
       }
       else if (! isNaN(args[0])) {
           android.util.Log.v("droidjam", "mob at "+x+" "+y+" "+z);
           id = Level.spawnMob(x,y,z, args[0]);
       }
       else if (args[0] in ENTITIES) {
           android.util.Log.v("droidjam", "mob at "+x+" "+y+" "+z);
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
       Entity.rideAnimal(parseInt(args[0]), parseInt(args[1]));
   }
   else if (m == "world.removeEntity") {
       Entity.remove(parseInt(args[0]));
   }
   else {
       android.util.Log.e("droidjam", "Unknown command");
       err("Unknown command");
   }
}

function _grabFromQueue() {
    var count = blockQueue.length;
    if (count == 0)
        return [];
    if (count > BLOCKS_PER_TICK) {
        count = BLOCKS_PER_TICK;
    }
    grabbed = blockQueue.slice(0,count);
    blockQueue = blockQueue.slice(count);
}

grabFromQueue = new Packages.org.mozilla.javascript.Synchronizer(_grabFromQueue);

function modTick() {
    if (needSpawnY && Player.getY() < 128) {
        needSpawnY = false;
        spawnY = Math.round(Player.getY()-PLAYER_HEIGHT);
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
        android.util.Log.v("droidjam", "busy tick");
        // try again next tick
        return;
    }
    busy++;
    grabFromQueue();
    for (var i = 0 ; i < grabbed.length ; i++) {
        var e = grabbed[i];
        Level.setTile(e[0], e[1], e[2], e[3], e[4]);
    }
    grabbed = [];
    busy--;
}

function setBlocks(args) {
   var x0 = Math.floor(args[0]) + spawnX;
   var y0 = Math.floor(args[1]) + spawnY;
   var z0 = Math.floor(args[2]) + spawnZ;
   var x1 = Math.floor(args[3]) + spawnX;
   var y1 = Math.floor(args[4]) + spawnY;
   var z1 = Math.floor(args[5]) + spawnZ;
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
