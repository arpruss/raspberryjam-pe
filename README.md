Raspberryjam PE (Pocket Edition)
================================

This software provides the [Python API](http://www.stuffaboutcode.com/p/minecraft-api-reference.html) from [Minecraft: Pi Edition](http://pi.minecraft.net/) for [Minecraft: Pocket Edition](https://play.google.com/store/apps/details?id=com.mojang.minecraftpe) on Android. You can [download this software (Raspberry Jam Mod)](https://play.google.com/store/apps/details?id=mobi.omegacentauri.rjm) for free from the Google Play Store.

To learn more, check out the [instructable](http://www.instructables.com/id/Python-Coding-for-Android-Minecraft-PE/) by the author.

Status
------

### Done ###

* **camera:** camera.setFollow, camera.setNormal, camera.getEntityId,
* **chat:** chat.post, 
* **entity:** entity.setPos, entity.setTile, entity.getPos, entity.getTile, entity.getPitch, entity.getRotation,
* **events:** events.block.hits, events.clear, events.setting, events.chat.posts, 
* **player:** player.setTile, player.setPos, player.setRotation, player.setPitch, player.getPitch, player.getRotation, player.setDirection, player.getDirection,
* **world:** world.setBlock, world.setBlocks, world.getBlock, world.getBlockWithData, world.getPlayerIds, world.spawnEntity, world.removeEntity, world.getHeight, world.setting

### Divergences and to dos ###

* The origin point for coordinates is defined by the player position the first time the user loads
  the world while using the script. This may not be the spawn point as it should be if the world was
  created earlier.
* Chat posts from server return -1 as the callback function doesn't specify the speaker.
* world.spawnEntity() does not support NBT tag.

### Functions available for now that may be removed: ###

* world.setTime
* entity.rideAnimal
