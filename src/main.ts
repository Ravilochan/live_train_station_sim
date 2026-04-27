import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { UIManager } from './ui/UIManager';
import { gameState } from './core/GameState';
import './core/TutorialManager'; // Initialize it to start listening to events

// Load level data directly (Vite handles JSON imports)
import level01 from './data/level_01_morning_rush.json';
import type { LevelData } from './types';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 800,
  parent: 'game-container',
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

window.onload = () => {
  // 1. Boot Game Engine
  new Phaser.Game(config);

  // 2. Boot UI
  new UIManager();

  // 3. Load Level & Start Simulation
  gameState.loadLevel(level01 as LevelData);
  gameState.start();
};