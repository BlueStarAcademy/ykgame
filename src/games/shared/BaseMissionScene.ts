import Phaser from "phaser";
import type { GameEndCallback, MissionConfig } from "./types";
import {
  createEquipmentSprite,
  ensureEquipmentAnims,
  loadEquipmentSpriteSheet,
  playEquipmentAnim,
} from "./spriteHelper";

export abstract class BaseMissionScene extends Phaser.Scene {
  protected progress = 0;
  protected target = 10;
  protected timeLeft = 90;
  protected elapsed = 0;
  protected ended = false;
  protected onEnd?: GameEndCallback;
  protected missionConfig!: MissionConfig;

  protected progressText!: Phaser.GameObjects.Text;
  protected timerText!: Phaser.GameObjects.Text;
  protected instructionText!: Phaser.GameObjects.Text;

  init(data: { config: MissionConfig; onEnd: GameEndCallback }) {
    this.missionConfig = data.config;
    this.onEnd = data.onEnd;
    this.target = data.config.target;
    this.timeLeft = data.config.duration;
  }

  preload() {
    loadEquipmentSpriteSheet(this, this.missionConfig.gameId);
  }

  create() {
    ensureEquipmentAnims(this, this.missionConfig.gameId);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#87CEEB");

    this.add.rectangle(width / 2, height * 0.55, width, height * 0.35, 0x8B7355);
    this.add.rectangle(width / 2, height * 0.75, width, height * 0.5, 0x4a7c59);

    this.progressText = this.add.text(16, 16, "진행: 0%", {
      fontSize: "18px",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 8, y: 4 },
    });

    this.timerText = this.add.text(width - 16, 16, this.formatTime(this.timeLeft), {
      fontSize: "18px",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0);

    this.instructionText = this.add.text(width / 2, height - 24, "", {
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#000000aa",
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 1);

    this.createMission();
    this.createControls();
  }

  update(_time: number, delta: number) {
    if (this.ended) return;

    this.elapsed += delta / 1000;
    this.timeLeft = Math.max(0, this.missionConfig.duration - this.elapsed);
    this.timerText.setText(this.formatTime(Math.ceil(this.timeLeft)));

    this.updateMission(delta);

    const pct = Math.min(100, Math.round((this.progress / this.target) * 100));
    this.progressText.setText(`진행: ${pct}%`);

    if (this.progress >= this.target) {
      this.finish(true);
    } else if (this.timeLeft <= 0) {
      this.finish(false);
    }
  }

  protected finish(completed: boolean) {
    if (this.ended) return;
    this.ended = true;

    const pct = Math.min(100, Math.round((this.progress / this.target) * 100));
    this.onEnd?.({
      gameId: this.missionConfig.gameId,
      progress: completed ? 100 : pct,
      playTime: Math.round(this.elapsed),
      timeLeft: Math.ceil(this.timeLeft),
      completed,
    });
  }

  protected addProgress(amount = 1) {
    this.progress = Math.min(this.target, this.progress + amount);
  }

  protected formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  protected spawnEquipmentSprite(x: number, y: number, scale = 1.5) {
    return createEquipmentSprite(this, this.missionConfig.gameId, x, y, scale);
  }

  protected setEquipmentWorking(sprite: Phaser.GameObjects.Sprite, working: boolean) {
    playEquipmentAnim(sprite, this.missionConfig.gameId, working);
  }

  protected abstract createMission(): void;
  protected abstract updateMission(delta: number): void;
  protected abstract createControls(): void;
}
