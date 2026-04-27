import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import { globalEvents, EVENTS } from '../core/EventEmitter';
import type { Train, Platform } from '../types';

export class MainScene extends Phaser.Scene {
  private trainsMap: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private platformGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private weatherParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private selectionBrackets?: Phaser.GameObjects.Graphics;

  // Theme Colors
  private COLOR_BG = 0x0B0F19;
  private readonly COLOR_BORDER = 0x374151;
  private readonly COLOR_TRACK = 0x4B5563; 
  private readonly COLOR_PLATFORM_FREE = 0x1F2937; 
  private readonly COLOR_NEON_CYAN = 0x06B6D4;
  private readonly COLOR_NEON_GREEN = 0x10B981;
  private readonly COLOR_NEON_RED = 0xEF4444;
  private readonly COLOR_NEON_AMBER = 0xF59E0B;
  private readonly COLOR_NEON_PURPLE = 0xA855F7;

  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    this.createMaintenanceTexture();
    this.updateTheme();
    this.drawStaticTracks();
    this.drawPlatforms();

    this.selectionBrackets = this.add.graphics();
    this.selectionBrackets.setDepth(100);

    globalEvents.on(EVENTS.TRAIN_SPAWNED, this.handleTrainSpawned);
    globalEvents.on(EVENTS.TRAIN_STATUS_CHANGED, this.handleTrainStatusChanged);
    globalEvents.on(EVENTS.PLATFORM_STATUS_CHANGED, this.handlePlatformStatusChanged);
    globalEvents.on(EVENTS.TRAIN_SELECTED, this.handleTrainSelected);
    globalEvents.on(EVENTS.DISRUPTION_ACTIVE, this.handleDisruption);
    globalEvents.on(EVENTS.SPEED_CHANGED, (speed: number) => {
        this.tweens.timeScale = speed;
    });

    globalEvents.on('ILLEGAL_ASSIGNMENT', () => {
        this.cameras.main.flash(200, 255, 0, 0, false);
    });

    globalEvents.on('SHIFT_STARTED', () => {
        this.updateTheme();
        this.drawStaticTracks();
        this.drawPlatforms();
    });
  }

  private updateTheme() {
    if (gameState.levelData?.theme === 'night') {
        this.COLOR_BG = 0x020617;
    } else {
        this.COLOR_BG = 0x0B0F19;
    }
    this.cameras.main.setBackgroundColor(this.COLOR_BG);
  }

  private handleDisruption = (msg: string | null) => {
      if (msg && (msg.toLowerCase().includes('rain') || msg.toLowerCase().includes('storm'))) {
          if (!this.weatherParticles) {
              const graphics = this.make.graphics({x: 0, y: 0});
              graphics.fillStyle(0xFFFFFF, 0.4);
              graphics.fillRect(0, 0, 2, 8);
              graphics.generateTexture('rain-drop', 2, 8);
              graphics.destroy();

              this.weatherParticles = this.add.particles(0, 0, 'rain-drop', {
                  x: { min: 0, max: 800 },
                  y: -10,
                  speedY: { min: 400, max: 600 },
                  speedX: { min: -50, max: 50 },
                  lifespan: 2000,
                  quantity: 5,
                  scaleX: 0.5,
                  scaleY: 1,
                  emitting: true
              });
          }
      } else {
          if (this.weatherParticles) {
              this.weatherParticles.stop();
              this.weatherParticles.destroy();
              this.weatherParticles = undefined;
          }
      }
  }

  private createMaintenanceTexture() {
    const size = 32;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xF59E0B, 1);
    g.fillRect(0, 0, size, size);
    g.fillStyle(0x000000, 1);
    g.beginPath();
    g.moveTo(0, size);
    g.lineTo(size, 0);
    g.lineTo(size, size/2);
    g.lineTo(size/2, size);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(0, size/2);
    g.lineTo(size/2, 0);
    g.lineTo(0, 0);
    g.closePath();
    g.fillPath();
    g.generateTexture('maintenance-stripes', size, size);
    g.destroy();
  }

  private drawStaticTracks() {
    this.children.getAll().forEach(c => {
        if (c.name === 'static_track') c.destroy();
    });

    const graphics = this.add.graphics();
    graphics.setName('static_track');
    graphics.lineStyle(2, this.COLOR_TRACK, 0.4);
    graphics.lineBetween(0, 100, 800, 100);
    graphics.lineBetween(0, 700, 800, 700);

    if (gameState.levelData) {
      let currentY = 150;
      for (const p of gameState.levelData.platforms) {
        if (p.id === 'SIDING' || p.id === 'HOLD') continue;
        let width = p.length === 'long' ? 400 : (p.length === 'medium' ? 300 : 200);
        graphics.beginPath();
        graphics.moveTo(50, 100);
        graphics.lineTo(400 - width/2, currentY);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(400 + width/2, currentY);
        graphics.lineTo(750, 700);
        graphics.strokePath();
        currentY += 50;
      }
      graphics.lineBetween(600, 100, 600, 150);
      graphics.lineBetween(200, 650, 200, 700);
    }
  }

  private drawPlatforms() {
    this.platformGraphics.forEach(g => {
        if ((g as any).signalLight) (g as any).signalLight.destroy();
        if ((g as any).maintenanceText) (g as any).maintenanceText.destroy();
        g.destroy();
    });
    this.platformGraphics.clear();

    if (!gameState.levelData) return;
    let currentY = 150;
    for (const p of gameState.levelData.platforms) {
      this.createPlatform(p, currentY);
      if (p.id !== 'SIDING' && p.id !== 'HOLD') currentY += 50;
    }
  }

  private createPlatform(p: Platform, y: number) {
    const isSiding = p.id === 'SIDING';
    const isHold = p.id === 'HOLD';
    let width = p.length === 'long' ? 400 : (p.length === 'medium' ? 300 : 200);
    const x = isSiding ? 600 : (isHold ? 200 : 400);
    const actualY = isSiding ? 150 : (isHold ? 650 : y);

    const g = this.add.graphics();
    const signal = this.add.circle(x + width/2 + 15, actualY, 6, 0xef4444);
    (g as any).signalLight = signal;

    const mText = this.add.text(x, actualY, 'MAINTENANCE IN PROGRESS', {
        fontFamily: 'JetBrains Mono',
        fontSize: '10px',
        color: '#000000',
        fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10).setVisible(false);
    (g as any).maintenanceText = mText;

    this.updatePlatformGraphics(g, p, x, actualY, width);
    
    const hitArea = new Phaser.Geom.Rectangle(x - width/2, actualY - 15, width, 30);
    g.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', () => {
      if (gameState.selectedTrainId) gameState.assignPlatform(gameState.selectedTrainId, p.id);
    });

    this.platformGraphics.set(p.id, g);

    this.add.text(x - width/2 - (isSiding || isHold ? 0 : 40), actualY - (isSiding || isHold ? 30 : 7), p.id, { 
      fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#9CA3AF'
    }).setName('static_label');
  }

  private updatePlatformGraphics(g: Phaser.GameObjects.Graphics, p: Platform, x: number, y: number, width: number) {
    g.clear();
    const color = this.getPlatformColor(p.status);
    g.lineStyle(2, color, 0.4);
    g.strokeRoundedRect(x - width/2 - 2, y - 17, width + 4, 34, 4);

    if (p.status === 'maintenance') {
        g.fillStyle(0xF59E0B, 1);
    } else {
        g.fillStyle(this.COLOR_PLATFORM_FREE);
    }
    
    g.fillRoundedRect(x - width/2, y - 15, width, 30, 4);
    g.lineStyle(1, color, 0.8);
    g.strokeRoundedRect(x - width/2, y - 15, width, 30, 4);

    if ((g as any).signalLight) {
        const signalColor = (p.status === 'free' || p.status === 'maintenance') ? 0xef4444 : (p.status === 'reserved' ? 0xf59e0b : 0x10b981);
        (g as any).signalLight.setFillStyle(signalColor);
    }

    if ((g as any).maintenanceText) {
        (g as any).maintenanceText.setVisible(p.status === 'maintenance');
    }
  }

  private getPlatformColor(status: string): number {
    switch (status) {
      case 'free': return this.COLOR_TRACK;
      case 'reserved': return this.COLOR_NEON_AMBER;
      case 'occupied': return this.COLOR_NEON_CYAN;
      case 'cleaning': return this.COLOR_NEON_PURPLE;
      case 'maintenance': return this.COLOR_NEON_RED;
      default: return this.COLOR_BORDER;
    }
  }

  private getTrainColor(type: string): number {
    switch (type) {
      case 'local': return this.COLOR_NEON_GREEN;
      case 'express': return this.COLOR_NEON_CYAN;
      case 'priority': return this.COLOR_NEON_AMBER;
      case 'special': return this.COLOR_NEON_PURPLE;
      default: return 0xFFFFFF;
    }
  }

  private handleTrainSpawned = (train: Train) => {
    const g = this.add.graphics();
    this.drawTrain(g, 40, 15, this.getTrainColor(train.type));
    const count = this.trainsMap.size;
    g.x = 50 + (count * 50); g.y = 50;
    const hitArea = new Phaser.Geom.Rectangle(0, 0, 40, 15);
    g.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', () => gameState.selectTrain(train.id));
    this.trainsMap.set(train.id, g);
  }

  private drawTrain(g: Phaser.GameObjects.Graphics, w: number, h: number, color: number) {
    g.clear();
    g.fillStyle(color, 0.6);
    g.fillRoundedRect(0, 0, w, h, 4);
    g.lineStyle(2, color, 1);
    g.strokeRoundedRect(0, 0, w, h, 4);
    g.lineStyle(1, 0xFFFFFF, 0.4);
    g.lineBetween(w*0.2, h*0.5, w*0.8, h*0.5);
  }

  private handleTrainStatusChanged = (train: Train) => {
    const g = this.trainsMap.get(train.id);
    if (!g) return;

    if (train.status === 'assigned' && train.assignedPlatformId) {
      const p = gameState.platforms.get(train.assignedPlatformId);
      if (p) {
        let width = p.length === 'long' ? 400 : (p.length === 'medium' ? 300 : 200);
        const isSiding = p.id === 'SIDING'; const isHold = p.id === 'HOLD';
        const targetX = isSiding ? 600 : (isHold ? 200 : 400);
        const targetY = isSiding ? 150 : (isHold ? 650 : this.getPlatformY(p.id));

        this.tweens.add({
          targets: g, x: targetX - width/2 + 10, y: targetY - 7,
          duration: 2000, ease: 'Cubic.easeInOut',
          onStart: () => this.drawTrain(g, width - 20, 15, this.getTrainColor(train.type))
        });
      }
    } else if (train.status === 'cleared') {
      if ((g as any).progressBar) (g as any).progressBar.destroy();
      this.tweens.add({ targets: g, x: 800, y: 700, duration: 2000, ease: 'Cubic.easeIn', onComplete: () => g.setVisible(false) });
    } else if (train.status === 'ready') {
      if ((g as any).progressBar) (g as any).progressBar.destroy();
      this.tweens.add({ targets: g, alpha: 0.5, duration: 500, yoyo: true, repeat: -1 });
    }
  }

  private getPlatformY(id: string): number {
    if (id === 'SIDING') return 150;
    if (id === 'HOLD') return 650;
    const index = parseInt(id.replace('P', '')) - 1;
    return 150 + (index * 50);
  }

  private handlePlatformStatusChanged = (platform: Platform) => {
    const g = this.platformGraphics.get(platform.id);
    if (g) {
        let width = platform.length === 'long' ? 400 : (platform.length === 'medium' ? 300 : 200);
        const x = platform.id === 'SIDING' ? 600 : (platform.id === 'HOLD' ? 200 : 400);
        this.updatePlatformGraphics(g, platform, x, this.getPlatformY(platform.id), width);
    }
  }

  private handleTrainSelected = (train: Train | null) => {
    this.platformGraphics.forEach((g) => { this.tweens.killTweensOf(g); g.alpha = 1; });

    if (this.selectionBrackets) {
        this.selectionBrackets.clear();
        this.tweens.killTweensOf(this.selectionBrackets);
        this.selectionBrackets.alpha = 1;
    }

    if (train) {
        const trainGraphics = this.trainsMap.get(train.id);
        if (trainGraphics && this.selectionBrackets) {
            const drawBrackets = () => {
                if (!this.selectionBrackets || !trainGraphics) return;
                this.selectionBrackets.clear();
                const padding = 4;
                const w = (trainGraphics as any).width ? (trainGraphics as any).width + (padding * 2) : 48;
                const h = (trainGraphics as any).height ? (trainGraphics as any).height + (padding * 2) : 23;
                const len = 6; 
                this.selectionBrackets.lineStyle(2, this.COLOR_NEON_CYAN, 1);
                this.selectionBrackets.beginPath();
                this.selectionBrackets.moveTo(0, len); this.selectionBrackets.lineTo(0, 0); this.selectionBrackets.lineTo(len, 0);
                this.selectionBrackets.strokePath();
                this.selectionBrackets.beginPath();
                this.selectionBrackets.moveTo(w - len, 0); this.selectionBrackets.lineTo(w, 0); this.selectionBrackets.lineTo(w, len);
                this.selectionBrackets.strokePath();
                this.selectionBrackets.beginPath();
                this.selectionBrackets.moveTo(0, h - len); this.selectionBrackets.lineTo(0, h); this.selectionBrackets.lineTo(len, h);
                this.selectionBrackets.strokePath();
                this.selectionBrackets.beginPath();
                this.selectionBrackets.moveTo(w - len, h); this.selectionBrackets.lineTo(w, h); this.selectionBrackets.lineTo(w, h - len);
                this.selectionBrackets.strokePath();
            };
            drawBrackets();
            this.selectionBrackets.x = trainGraphics.x - 4;
            this.selectionBrackets.y = trainGraphics.y - 4;
            this.tweens.add({ targets: this.selectionBrackets, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
        }

        if (train.status === 'waiting') {
            this.platformGraphics.forEach((g, id) => {
                const p = gameState.platforms.get(id);
                if (p && p.status === 'free' && train.platformCompatibility.includes(p.length)) {
                    this.tweens.add({ targets: g, alpha: 0.5, duration: 500, yoyo: true, repeat: -1 });
                }
            });
        }
    }
  }

  update() {
      if (gameState.selectedTrainId && this.selectionBrackets) {
          const g = this.trainsMap.get(gameState.selectedTrainId);
          if (g) {
              this.selectionBrackets.x = g.x - 4;
              this.selectionBrackets.y = g.y - 4;
          }
      }

      gameState.trains.forEach((train, id) => {
          const g = this.trainsMap.get(id);
          if (g && (train.status === 'deboarding' || train.status === 'boarding')) {
              if (!(g as any).progressBar) (g as any).progressBar = this.add.graphics();
              const bar = (g as any).progressBar;
              bar.clear();
              const total = train.status === 'deboarding' ? train.deboardingTimeBase : train.boardingTimeBase;
              const current = train.currentDwellTimer || 0;
              const pct = 1 - (current / total);
              const p = gameState.platforms.get(train.assignedPlatformId || '');
              let width = p ? (p.length === 'long' ? 400 : (p.length === 'medium' ? 300 : 200)) : 40;
              width -= 20;
              bar.fillStyle(0x000000, 0.5); bar.fillRect(g.x, g.y - 10, width, 4);
              bar.fillStyle(this.COLOR_NEON_CYAN, 1); bar.fillRect(g.x, g.y - 10, width * Math.min(1, pct), 4);
          }
      });
  }

  onDestroy() {
    globalEvents.off(EVENTS.TRAIN_SPAWNED, this.handleTrainSpawned);
    globalEvents.off(EVENTS.TRAIN_STATUS_CHANGED, this.handleTrainStatusChanged);
    globalEvents.off(EVENTS.PLATFORM_STATUS_CHANGED, this.handlePlatformStatusChanged);
    globalEvents.off(EVENTS.TRAIN_SELECTED, this.handleTrainSelected);
    globalEvents.off(EVENTS.DISRUPTION_ACTIVE, this.handleDisruption);
  }
}