import Phaser from "phaser";
import { BaseMissionScene } from "../shared/BaseMissionScene";

export class CollectMissionScene extends BaseMissionScene {
  private player!: Phaser.GameObjects.Rectangle;
  private items: Phaser.GameObjects.Rectangle[] = [];
  private cursors!: {
    up: Phaser.GameObjects.Arc;
    down: Phaser.GameObjects.Arc;
    left: Phaser.GameObjects.Arc;
    right: Phaser.GameObjects.Arc;
    action: Phaser.GameObjects.Arc;
  };
  private velocity = { x: 0, y: 0 };
  private actionLabel!: Phaser.GameObjects.Text;

  protected createMission() {
    const { width, height } = this.scale;
    this.player = this.add.rectangle(width / 2, height * 0.5, 40, 30, this.missionConfig.brandColor);
    this.instructionText.setText("D-pad로 이동 · ACTION으로 작업");

    for (let i = 0; i < this.target + 5; i++) {
      const item = this.add.rectangle(
        Phaser.Math.Between(40, width - 40),
        Phaser.Math.Between(height * 0.35, height * 0.65),
        20,
        20,
        0x654321,
      );
      this.items.push(item);
    }
  }

  protected createControls() {
    const { width, height } = this.scale;
    const baseY = height - 100;
    const cx = width / 2;

    const mkBtn = (x: number, y: number, label: string) => {
      const btn = this.add.circle(x, y, 28, 0xffffff, 0.35).setInteractive();
      this.add.text(x, y, label, { fontSize: "16px", color: "#333" }).setOrigin(0.5);
      btn.on("pointerdown", () => btn.setFillStyle(0xffffff, 0.6));
      btn.on("pointerup", () => btn.setFillStyle(0xffffff, 0.35));
      btn.on("pointerout", () => btn.setFillStyle(0xffffff, 0.35));
      return btn;
    };

    this.cursors = {
      up: mkBtn(cx - 80, baseY - 40, "▲"),
      down: mkBtn(cx - 80, baseY + 40, "▼"),
      left: mkBtn(cx - 120, baseY, "◀"),
      right: mkBtn(cx - 40, baseY, "▶"),
      action: mkBtn(width - 70, baseY, "A"),
    };

    this.actionLabel = this.add.text(width - 70, baseY + 36, "작업", {
      fontSize: "11px",
      color: "#fff",
    }).setOrigin(0.5);

    const bindHold = (btn: Phaser.GameObjects.Arc, key: keyof typeof this.velocity | "action", val: number) => {
      btn.on("pointerdown", () => {
        if (key === "action") this.tryAction();
        else this.velocity[key] = val;
      });
      btn.on("pointerup", () => {
        if (key !== "action") this.velocity[key] = 0;
      });
      btn.on("pointerout", () => {
        if (key !== "action") this.velocity[key] = 0;
      });
    };

    bindHold(this.cursors.up, "y", -3);
    bindHold(this.cursors.down, "y", 3);
    bindHold(this.cursors.left, "x", -3);
    bindHold(this.cursors.right, "x", 3);
    this.cursors.action.on("pointerdown", () => this.tryAction());
  }

  private tryAction() {
    const nearby = this.items.find(
      (item) =>
        item.active &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) < 50,
    );
    if (nearby) {
      nearby.setActive(false).setVisible(false);
      this.addProgress(1);
    }
  }

  protected updateMission(_delta: number) {
    this.player.x = Phaser.Math.Clamp(
      this.player.x + this.velocity.x,
      20,
      this.scale.width - 20,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + this.velocity.y,
      this.scale.height * 0.3,
      this.scale.height * 0.7,
    );
  }
}

export class DriveMissionScene extends BaseMissionScene {
  private vehicle!: Phaser.GameObjects.Rectangle;
  private fillBar!: Phaser.GameObjects.Graphics;
  private speed = 0;
  private forwardBtn!: Phaser.GameObjects.Arc;
  private leftBtn!: Phaser.GameObjects.Arc;
  private rightBtn!: Phaser.GameObjects.Arc;

  protected createMission() {
    const { width, height } = this.scale;
    this.vehicle = this.add.rectangle(80, height * 0.55, 50, 30, this.missionConfig.brandColor);
    this.fillBar = this.add.graphics();
    this.instructionText.setText("전진 버튼으로 작업 진행");
    this.drawBar();
  }

  private drawBar() {
    const { width } = this.scale;
    const pct = this.progress / this.target;
    this.fillBar.clear();
    this.fillBar.fillStyle(0x333333, 1);
    this.fillBar.fillRect(20, 60, width - 40, 16);
    this.fillBar.fillStyle(this.missionConfig.brandColor, 1);
    this.fillBar.fillRect(20, 60, (width - 40) * pct, 16);
  }

  protected createControls() {
    const { width, height } = this.scale;
    const baseY = height - 90;

    const mkBtn = (x: number, y: number, label: string) => {
      const btn = this.add.circle(x, y, 32, 0xffffff, 0.35).setInteractive();
      this.add.text(x, y, label, { fontSize: "16px", color: "#333" }).setOrigin(0.5);
      return btn;
    };

    this.forwardBtn = mkBtn(width - 70, baseY, "▶");
    this.leftBtn = mkBtn(width - 140, baseY, "◀");
    this.rightBtn = mkBtn(width - 70, baseY - 60, "▲");

    this.add.text(width - 70, baseY + 38, "전진", { fontSize: "11px", color: "#fff" }).setOrigin(0.5);

    this.forwardBtn.on("pointerdown", () => { this.speed = 2.5; });
    this.forwardBtn.on("pointerup", () => { this.speed = 0; });
    this.forwardBtn.on("pointerout", () => { this.speed = 0; });

    let turn = 0;
    this.leftBtn.on("pointerdown", () => { turn = -2; });
    this.leftBtn.on("pointerup", () => { turn = 0; });
    this.rightBtn.on("pointerdown", () => { turn = 2; });
    this.rightBtn.on("pointerup", () => { turn = 0; });

    this.events.on("update", () => {
      this.vehicle.y += turn * 0.5;
      this.vehicle.y = Phaser.Math.Clamp(this.vehicle.y, this.scale.height * 0.35, this.scale.height * 0.7);
    });
  }

  protected updateMission(_delta: number) {
    if (this.speed > 0) {
      this.vehicle.x += this.speed;
      if (this.vehicle.x > this.scale.width + 20) {
        this.vehicle.x = -20;
        this.addProgress(1);
        this.drawBar();
      }
    }
  }
}

export class DeliverMissionScene extends BaseMissionScene {
  private player!: Phaser.GameObjects.Rectangle;
  private cargo: Phaser.GameObjects.Rectangle | null = null;
  private carrying = false;
  private dropZone!: Phaser.GameObjects.Rectangle;
  private velocity = { x: 0, y: 0 };

  protected createMission() {
    const { width, height } = this.scale;
    this.player = this.add.rectangle(width / 2, height * 0.5, 45, 35, this.missionConfig.brandColor);
    this.dropZone = this.add.rectangle(width - 60, height * 0.55, 50, 50, 0xffffff, 0.3);
    this.add.text(width - 60, height * 0.55, "목표", { fontSize: "12px", color: "#fff" }).setOrigin(0.5);
    this.spawnCargo();
    this.instructionText.setText("화물을 집어 목표 지점에 배달");
  }

  private spawnCargo() {
    const { width, height } = this.scale;
    if (this.cargo) this.cargo.destroy();
    this.cargo = this.add.rectangle(
      Phaser.Math.Between(60, width - 120),
      Phaser.Math.Between(height * 0.4, height * 0.65),
      24,
      24,
      0xdddddd,
    );
    this.carrying = false;
  }

  protected createControls() {
    const { width, height } = this.scale;
    const cx = 70;
    const baseY = height - 90;

    const mkBtn = (x: number, y: number, label: string) =>
      this.add.circle(x, y, 28, 0xffffff, 0.35).setInteractive();

    const up = mkBtn(cx, baseY - 40, "▲");
    const down = mkBtn(cx, baseY + 40, "▼");
    const left = mkBtn(cx - 40, baseY, "◀");
    const right = mkBtn(cx + 40, baseY, "▶");
    const lift = mkBtn(width - 70, baseY, "L");

    this.add.text(width - 70, baseY + 36, "리프트", { fontSize: "11px", color: "#fff" }).setOrigin(0.5);

    const bind = (btn: Phaser.GameObjects.Arc, key: "x" | "y", val: number) => {
      btn.on("pointerdown", () => { this.velocity[key] = val; });
      btn.on("pointerup", () => { this.velocity[key] = 0; });
      btn.on("pointerout", () => { this.velocity[key] = 0; });
    };
    bind(up, "y", -3);
    bind(down, "y", 3);
    bind(left, "x", -3);
    bind(right, "x", 3);

    lift.on("pointerdown", () => {
      if (!this.carrying && this.cargo?.active) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.cargo.x, this.cargo.y);
        if (dist < 50) {
          this.carrying = true;
          this.cargo.setVisible(false);
        }
      } else if (this.carrying) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.dropZone.x, this.dropZone.y);
        if (dist < 60) {
          this.carrying = false;
          this.addProgress(1);
          this.spawnCargo();
        }
      }
    });
  }

  protected updateMission(_delta: number) {
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x, 25, this.scale.width - 25);
    this.player.y = Phaser.Math.Clamp(
      this.player.y + this.velocity.y,
      this.scale.height * 0.35,
      this.scale.height * 0.7,
    );
  }
}

export class CompactMissionScene extends BaseMissionScene {
  private vehicle!: Phaser.GameObjects.Rectangle;
  private vibrating = false;
  private bar!: Phaser.GameObjects.Graphics;

  protected createMission() {
    const { width, height } = this.scale;
    this.vehicle = this.add.rectangle(width / 2, height * 0.55, 55, 35, this.missionConfig.brandColor);
    this.bar = this.add.graphics();
    this.instructionText.setText("전진 + 진동으로 도로 다지기");
    this.drawBar();
  }

  private drawBar() {
    const { width } = this.scale;
    const pct = this.progress / this.target;
    this.bar.clear();
    this.bar.fillStyle(0x333333, 1);
    this.bar.fillRect(20, 60, width - 40, 16);
    this.bar.fillStyle(0xef6c00, 1);
    this.bar.fillRect(20, 60, (width - 40) * pct, 16);
  }

  protected createControls() {
    const { width, height } = this.scale;
    const baseY = height - 90;
    const fwd = this.add.circle(width - 140, baseY, 32, 0xffffff, 0.35).setInteractive();
    const vib = this.add.circle(width - 60, baseY, 32, 0xffffff, 0.35).setInteractive();
    this.add.text(width - 140, baseY + 38, "전진", { fontSize: "11px", color: "#fff" }).setOrigin(0.5);
    this.add.text(width - 60, baseY + 38, "진동", { fontSize: "11px", color: "#fff" }).setOrigin(0.5);

    fwd.on("pointerdown", () => { this.vehicle.x += 3; });
    vib.on("pointerdown", () => { this.vibrating = true; });
    vib.on("pointerup", () => { this.vibrating = false; });
    vib.on("pointerout", () => { this.vibrating = false; });
  }

  protected updateMission(delta: number) {
    if (this.vibrating) {
      this.progress += (delta / 1000) * 2;
      this.progress = Math.min(this.target, this.progress);
      this.drawBar();
      this.vehicle.setScale(1 + Math.sin(this.elapsed * 20) * 0.05);
    }
  }
}

export class SortMissionScene extends BaseMissionScene {
  private counts = { coarse: 0, medium: 0, fine: 0 };
  private targets = { coarse: 4, medium: 4, fine: 4 };
  private labels: Phaser.GameObjects.Text[] = [];

  protected createMission() {
    this.target = 12;
    this.instructionText.setText("크기별 버튼으로 암석 분류");
    const { width } = this.scale;
    [" coarse:0/4", "medium:0/4", "fine:0/4"].forEach((_, i) => {
      const t = this.add.text(20, 55 + i * 22, "", { fontSize: "14px", color: "#fff", backgroundColor: "#00000088", padding: { x: 6, y: 2 } });
      this.labels.push(t);
    });
    this.updateLabels();
    void width;
  }

  private updateLabels() {
    const names = ["대", "중", "소"];
    const keys = ["coarse", "medium", "fine"] as const;
    keys.forEach((k, i) => {
      this.labels[i]?.setText(`${names[i]}: ${this.counts[k]}/${this.targets[k]}`);
    });
  }

  protected createControls() {
    const { width, height } = this.scale;
    const baseY = height - 90;
    const colors = [0x795548, 0x9e9e9e, 0xcfd8dc];
    const keys = ["coarse", "medium", "fine"] as const;
    const labels = ["대", "중", "소"];

    keys.forEach((key, i) => {
      const x = width / 2 + (i - 1) * 80;
      const btn = this.add.circle(x, baseY, 32, colors[i], 0.8).setInteractive();
      this.add.text(x, baseY, labels[i], { fontSize: "16px", color: "#fff" }).setOrigin(0.5);
      btn.on("pointerdown", () => {
        if (this.counts[key] < this.targets[key]) {
          this.counts[key]++;
          this.addProgress(1);
          this.updateLabels();
        }
      });
    });
  }

  protected updateMission(_delta: number) {}
}

export class PaveMissionScene extends BaseMissionScene {
  private vehicle!: Phaser.GameObjects.Rectangle;
  private paving = false;
  private width_ = 1;
  private bar!: Phaser.GameObjects.Graphics;

  protected createMission() {
    const { width, height } = this.scale;
    this.vehicle = this.add.rectangle(60, height * 0.55, 50, 28, this.missionConfig.brandColor);
    this.bar = this.add.graphics();
    this.instructionText.setText("전진 + 폭 조절로 포장");
    this.drawBar();
  }

  private drawBar() {
    const { width } = this.scale;
    const pct = this.progress / this.target;
    this.bar.clear();
    this.bar.fillStyle(0x333333, 1);
    this.bar.fillRect(20, 60, width - 40, 16);
    this.bar.fillStyle(0x00838f, 1);
    this.bar.fillRect(20, 60, (width - 40) * pct, 16);
  }

  protected createControls() {
    const { width, height } = this.scale;
    const baseY = height - 90;
    const fwd = this.add.circle(width - 140, baseY, 30, 0xffffff, 0.35).setInteractive();
    const wide = this.add.circle(width - 80, baseY, 30, 0xffffff, 0.35).setInteractive();
    const narrow = this.add.circle(width - 80, baseY - 55, 30, 0xffffff, 0.35).setInteractive();

    fwd.on("pointerdown", () => { this.paving = true; });
    fwd.on("pointerup", () => { this.paving = false; });
    wide.on("pointerdown", () => { this.width_ = Math.min(2, this.width_ + 0.2); });
    narrow.on("pointerdown", () => { this.width_ = Math.max(0.5, this.width_ - 0.2); });
  }

  protected updateMission(delta: number) {
    if (this.paving) {
      this.vehicle.x += 2;
      this.progress += (delta / 1000) * this.width_;
      this.progress = Math.min(this.target, this.progress);
      this.drawBar();
      if (this.vehicle.x > this.scale.width + 30) this.vehicle.x = 40;
    }
  }
}
