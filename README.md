Done:
// chat.post, world.setBlock, world.setBlocks, world.getBlock, world.getBlockWithData,
// player.setTile, player.setPos, player.setRotation, player.setPitch, player.getPitch,
// player.getRotation, world.getPlayerIds, entity.setPos, entity.setTile, entity.getPos,
// entity.getTile, world.spawnEntity, world.removeEntity, world.getHeight, events.block.hits,
// events.clear, events.setting, events.chat.posts, entity.getPitch, entity.getRotation,
// player.setDirection, player.getDirection, camera.setFollow, camera.setNormal, camera.getEntityId,
// world.setting

Divergences and to dos:
// The origin point for coordinates is defined by the player position the first time the user loads
//  the world while using the script. This may not be the spawn point as it should be if the world was
//  created earlier.
// Chat posts from server return -1 as the callback function doesn't specify the speaker.
// world.spawnEntity() does not support NBT tag.

Functions available for now that may be removed:
// world.setTime,entity.rideAnimal
