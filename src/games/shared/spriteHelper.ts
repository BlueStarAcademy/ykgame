import Phaser from "phaser";
import type { GameId } from "@/lib/games";
import {
  getSpriteSheetPath,
  SPRITE_FRAME_COUNT,
  SPRITE_FRAME_HEIGHT,
  SPRITE_FRAME_WIDTH,
} from "./equipmentArt";

export function animKey(gameId: GameId, work: boolean) {
  return `${gameId}-${work ? "work" : "idle"}`;
}

export function textureKey(gameId: GameId) {
  return `eq-${gameId}`;
}

export function loadEquipmentSpriteSheet(scene: Phaser.Scene, gameId: GameId) {
  const key = textureKey(gameId);
  if (scene.textures.exists(key)) return;
  scene.load.spritesheet(key, getSpriteSheetPath(gameId), {
    frameWidth: SPRITE_FRAME_WIDTH,
    frameHeight: SPRITE_FRAME_HEIGHT,
  });
}

export function ensureEquipmentAnims(scene: Phaser.Scene, gameId: GameId) {
  const texKey = textureKey(gameId);
  const idleKey = animKey(gameId, false);
  const workKey = animKey(gameId, true);

  if (!scene.anims.exists(idleKey)) {
    scene.anims.create({
      key: idleKey,
      frames: scene.anims.generateFrameNumbers(texKey, {
        start: 0,
        end: SPRITE_FRAME_COUNT - 1,
      }),
      frameRate: 6,
      repeat: -1,
    });
  }

  if (!scene.anims.exists(workKey)) {
    scene.anims.create({
      key: workKey,
      frames: scene.anims.generateFrameNumbers(texKey, {
        start: 0,
        end: SPRITE_FRAME_COUNT - 1,
      }),
      frameRate: 12,
      repeat: -1,
    });
  }
}

export function playEquipmentAnim(
  sprite: Phaser.GameObjects.Sprite,
  gameId: GameId,
  work: boolean,
) {
  const key = animKey(gameId, work);
  if (sprite.anims.currentAnim?.key !== key) {
    sprite.play(key);
  }
}

export function createEquipmentSprite(
  scene: Phaser.Scene,
  gameId: GameId,
  x: number,
  y: number,
  scale = 1.5,
) {
  ensureEquipmentAnims(scene, gameId);
  const sprite = scene.add.sprite(x, y, textureKey(gameId), 0);
  sprite.setScale(scale);
  sprite.play(animKey(gameId, false));
  return sprite;
}
