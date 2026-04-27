import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { UIManager } from './ui/UIManager';
import './core/TutorialManager';

// Load level data
import level01 from './data/level_01_morning_rush.json';
import level02 from './data/level_02_night_shift.json';
import level03 from './data/level_03_storm.json';

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
  const ui = new UIManager();
  ui.setLevels([level01, level02, level03]);

  // Game waits for user to click "Begin Shift" in the Menu overlay
};