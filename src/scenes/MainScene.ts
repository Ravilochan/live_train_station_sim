import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import { globalEvents, EVENTS } from '../core/EventEmitter';
import type { Train, Platform } from '../types';

export class MainScene extends Phaser.Scene {
  private trainsMap: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private platformGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private platformText: Map<string, Phaser.GameObjects.Text> = new Map();

  // Theme Colors
  private readonly COLOR_BG = 0x0B0F19;
  private readonly COLOR_BORDER = 0x374151;
  private readonly COLOR_TRACK = 0x4B5563; // Brightened tracks
  private readonly COLOR_PLATFORM_FREE = 0x1F2937; // Distinct free platform fill
  private readonly COLOR_NEON_CYAN = 0x06B6D4;
  private readonly COLOR_NEON_GREEN = 0x10B981;
  private readonly COLOR_NEON_RED = 0xEF4444;
  private readonly COLOR_NEON_AMBER = 0xF59E0B;
  private readonly COLOR_NEON_PURPLE = 0xA855F7;

  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(this.COLOR_BG);

    this.drawStaticTracks();
    this.drawPlatforms();

    globalEvents.on(EVENTS.TRAIN_SPAWNED, this.handleTrainSpawned);
    globalEvents.on(EVENTS.TRAIN_STATUS_CHANGED, this.handleTrainStatusChanged);
    globalEvents.on(EVENTS.PLATFORM_STATUS_CHANGED, this.handlePlatformStatusChanged);
    globalEvents.on(EVENTS.TRAIN_SELECTED, this.handleTrainSelected);
  }

  private drawStaticTracks() {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, this.COLOR_TRACK, 0.4);

    // Main arrival track (top)
    graphics.lineBetween(0, 100, 800, 100);
    // Main departure track (bottom)
    graphics.lineBetween(0, 700, 800, 700);

    // Connecting tracks to platforms
    if (gameState.levelData) {
      let currentY = 150;
      for (const p of gameState.levelData.platforms) {
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
    }
  }

  private drawPlatforms() {
    if (!gameState.levelData) return;
    let currentY = 150;
    for (const p of gameState.levelData.platforms) {
      this.createPlatform(p, currentY);
      currentY += 50;
    }
  }

  private createPlatform(p: Platform, y: number) {
    let width = p.length === 'long' ? 400 : (p.length === 'medium' ? 300 : 200);
    const x = 400;

    const g = this.add.graphics();
    this.updatePlatformGraphics(g, p, x, y, width);
    
    // Make hit area
    const hitArea = new Phaser.Geom.Rectangle(x - width/2, y - 15, width, 30);
    g.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', () => {
      if (gameState.selectedTrainId) {
        gameState.assignPlatform(gameState.selectedTrainId, p.id);
      }
    });

    this.platformGraphics.set(p.id, g);

    const txt = this.add.text(x - width/2 - 40, y - 7, p.id, { 
      fontFamily: 'JetBrains Mono', 
      fontSize: '12px',
      color: '#9CA3AF'
    });
    this.platformText.set(p.id, txt);
  }

  private updatePlatformGraphics(g: Phaser.GameObjects.Graphics, p: Platform, x: number, y: number, width: number) {
    g.clear();
    const color = this.getPlatformColor(p.status);
    
    // Outer Glow / Border
    g.lineStyle(2, color, 0.4);
    g.strokeRoundedRect(x - width/2 - 2, y - 17, width + 4, 34, 4);

    // Main Fill (Not BG, but slightly lighter slate)
    g.fillStyle(this.COLOR_PLATFORM_FREE);
    g.fillRoundedRect(x - width/2, y - 15, width, 30, 4);
    
    // Inner Border
    g.lineStyle(1, color, 0.8);
    g.strokeRoundedRect(x - width/2, y - 15, width, 30, 4);
  }

  private getPlatformColor(status: string): number {
    switch (status) {
      case 'free': return this.COLOR_TRACK;
      case 'reserved': return this.COLOR_NEON_AMBER;
      case 'occupied': return this.COLOR_NEON_CYAN;
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
    const color = this.getTrainColor(train.type);
    
    this.drawTrain(g, 40, 15, color);
    
    const count = this.trainsMap.size;
    g.x = 50 + (count * 50);
    g.y = 50;

    const hitArea = new Phaser.Geom.Rectangle(0, 0, 40, 15);
    g.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', () => gameState.selectTrain(train.id));

    this.trainsMap.set(train.id, g);
  }

  private drawTrain(g: Phaser.GameObjects.Graphics, w: number, h: number, color: number) {
    g.clear();
    // More solid fill for higher contrast
    g.fillStyle(color, 0.6);
    g.fillRoundedRect(0, 0, w, h, 4);
    g.lineStyle(2, color, 1);
    g.strokeRoundedRect(0, 0, w, h, 4);
    
    // Interior detail
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
        this.tweens.add({
          targets: g,
          x: 400 - width/2 + 10,
          y: this.getPlatformY(p.id) - 7,
          duration: 2000,
          ease: 'Cubic.easeInOut',
          onStart: () => {
             this.drawTrain(g, width - 20, 15, this.getTrainColor(train.type));
          }
        });
      }
    } else if (train.status === 'cleared') {
      this.tweens.add({
        targets: g,
        x: 800,
        y: 700,
        duration: 2000,
        ease: 'Cubic.easeIn',
        onComplete: () => g.setVisible(false)
      });
    } else if (train.status === 'ready') {
      this.tweens.add({
        targets: g,
        alpha: 0.5,
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    }
  }

  private getPlatformY(id: string): number {
    const index = parseInt(id.replace('P', '')) - 1;
    return 150 + (index * 50);
  }

  private handlePlatformStatusChanged = (platform: Platform) => {
    const g = this.platformGraphics.get(platform.id);
    if (g) {
        let width = platform.length === 'long' ? 400 : (platform.length === 'medium' ? 300 : 200);
        this.updatePlatformGraphics(g, platform, 400, this.getPlatformY(platform.id), width);
    }
  }

  private handleTrainSelected = (train: Train | null) => {
    // Reset all platforms pulse
    this.platformGraphics.forEach((g) => {
        this.tweens.killTweensOf(g);
        g.alpha = 1;
    });

    if (train && train.status === 'waiting') {
        // Pulse compatible platforms
        this.platformGraphics.forEach((g, id) => {
            const p = gameState.platforms.get(id);
            if (p && p.status === 'free' && train.platformCompatibility.includes(p.length)) {
                this.tweens.add({
                    targets: g,
                    alpha: 0.4,
                    duration: 600,
                    yoyo: true,
                    repeat: -1
                });
            }
        });
    }
  }
}