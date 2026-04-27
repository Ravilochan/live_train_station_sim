import type { LevelData, Train, Platform, Upgrades } from '../types';
import { globalEvents, EVENTS } from './EventEmitter';

export class GameState {
  levelData: LevelData | null = null;
  
  gameMinute: number = 0;
  speedMultiplier: number = 1; 
  realSecondsPerGameMinute: number = 5;
  private lastTickTime: number = 0;
  private accumulator: number = 0;
  private isRunning: boolean = false;

  trains: Map<string, Train> = new Map();
  platforms: Map<string, Platform> = new Map();
  
  score: number = 0;
  xp: number = 0;
  reputation: number = 80;
  missedDepartures: number = 0;
  trainsServed: number = 0;
  onTimeServed: number = 0;
  
  selectedTrainId: string | null = null;

  upgrades: Upgrades = {
    staffTraining: 0,
    techSystems: 0,
    dispatchOps: 0,
    maintenanceCrew: 0
  };

  private transitQueue: Array<{ trainId: string, platformId: string, arrivalMinute: number }> = [];

  constructor() {
    this.loadFromStorage();
  }

  private saveToStorage() {
    localStorage.setItem('tsm_xp', this.xp.toString());
    localStorage.setItem('tsm_upgrades', JSON.stringify(this.upgrades));
    localStorage.setItem('tsm_score', this.score.toString());
  }

  private loadFromStorage() {
    const savedXp = localStorage.getItem('tsm_xp');
    const savedUpgrades = localStorage.getItem('tsm_upgrades');
    const savedScore = localStorage.getItem('tsm_score');
    if (savedXp) this.xp = parseInt(savedXp);
    if (savedScore) this.score = parseInt(savedScore);
    if (savedUpgrades) {
        try { this.upgrades = JSON.parse(savedUpgrades); } catch(e) {}
    }
  }

  loadLevel(level: LevelData) {
    this.levelData = level;
    this.gameMinute = 0;
    this.trains.clear();
    this.platforms.clear();
    this.transitQueue = [];
    
    for (const t of level.trains) {
      this.trains.set(t.id, { ...t, status: 'approaching' });
    }
    
    for (const p of level.platforms) {
      const platform = { ...p };
      if (platform.blockedUntil > 0) {
        platform.blockedUntil = Math.max(0, platform.blockedUntil - (this.upgrades.maintenanceCrew * 2));
      }
      this.platforms.set(p.id, platform);
    }
    
    this.reputation = 80;
    this.missedDepartures = 0;
    this.trainsServed = 0;
    this.onTimeServed = 0;
    
    this.emitScore();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickTime = performance.now();
    this.tick(this.lastTickTime);
  }

  pause() {
    this.speedMultiplier = 0;
    globalEvents.emit(EVENTS.SPEED_CHANGED, 0);
  }

  setSpeed(speed: number) {
    this.speedMultiplier = speed;
    if (!this.isRunning && speed > 0) this.start();
    globalEvents.emit(EVENTS.SPEED_CHANGED, speed);
  }

  private tick = (currentTime: number) => {
    if (!this.isRunning) return;
    const deltaTime = (currentTime - this.lastTickTime) / 1000;
    this.lastTickTime = currentTime;
    if (this.speedMultiplier > 0) {
      this.accumulator += deltaTime * this.speedMultiplier;
      if (this.accumulator >= this.realSecondsPerGameMinute) {
        this.accumulator -= this.realSecondsPerGameMinute;
        this.advanceGameMinute();
      }
    }
    requestAnimationFrame(this.tick);
  };

  private advanceGameMinute() {
    this.gameMinute++;
    globalEvents.emit(EVENTS.TIME_TICK, this.gameMinute);
    
    this.transitQueue = this.transitQueue.filter(item => {
      if (this.gameMinute >= item.arrivalMinute) {
        this.trainArrivesAtPlatform(item.trainId, item.platformId);
        return false;
      }
      return true;
    });

    this.processEvents();
    this.processTrains();
    this.processPlatforms();
    this.checkWinLossConditions();
  }

  private processEvents() {
    if (!this.levelData) return;
    for (const evt of this.levelData.events) {
      if (this.gameMinute === evt.startMinute) globalEvents.emit(EVENTS.DISRUPTION_ACTIVE, evt.description);
      if (this.gameMinute === evt.endMinute) globalEvents.emit(EVENTS.DISRUPTION_ACTIVE, null);
    }
  }

  private processTrains() {
    for (const [, train] of this.trains.entries()) {
      if (train.status === 'approaching' && this.gameMinute >= train.arrivalTime) {
        train.status = 'waiting';
        train.actualArrivalTime = this.gameMinute;
        globalEvents.emit(EVENTS.TRAIN_SPAWNED, train);
      }
      
      if (['boarding', 'deboarding', 'ready'].includes(train.status) && train.currentDwellTimer !== undefined) {
        train.currentDwellTimer--;
        
        if (train.currentDwellTimer <= 0) {
          if (train.status === 'deboarding') {
            const platform = this.platforms.get(train.assignedPlatformId!);
            if (train.requiresCleaning && platform) {
                train.status = 'boarding'; 
                platform.status = 'cleaning';
                globalEvents.emit(EVENTS.PLATFORM_STATUS_CHANGED, platform);
            } else {
                train.status = 'boarding';
            }
            
    const reduction = this.upgrades.staffTraining + this.upgrades.techSystems;
    let boardingTime = train.boardingTimeBase;
    if (train.requiresWater) boardingTime += 1;
    if (train.requiresMaintenanceCheck) boardingTime += 2;
    
    // Baggage penalty: +1 minute if heavy load
    if (train.baggageLoad > 50) boardingTime += 1;
    
    train.currentDwellTimer = Math.max(1, boardingTime - reduction);
            globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
          } else if (train.status === 'boarding') {
            const platform = this.platforms.get(train.assignedPlatformId!);
            if (platform && platform.status === 'cleaning') {
                platform.status = 'occupied';
                globalEvents.emit(EVENTS.PLATFORM_STATUS_CHANGED, platform);
            }
            train.status = 'ready';
            globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
          }
        }
      }
      
      if (train.status === 'waiting') {
        const waited = this.gameMinute - train.arrivalTime;
        if (waited > 3 && this.gameMinute % 2 === 0) this.updateScore(0, 0, -1); 
      }
    }
  }

  private processPlatforms() {
    for (const [, platform] of this.platforms.entries()) {
      if (platform.blockedUntil > 0 && this.gameMinute >= platform.blockedUntil) {
        platform.blockedUntil = 0;
        if (platform.status === 'maintenance') {
            platform.status = 'free';
            globalEvents.emit(EVENTS.PLATFORM_STATUS_CHANGED, platform);
        }
      } else if (platform.blockedUntil > this.gameMinute) {
        if (platform.status !== 'maintenance') {
            platform.status = 'maintenance';
            globalEvents.emit(EVENTS.PLATFORM_STATUS_CHANGED, platform);
        }
      }
    }
  }

  selectTrain(id: string | null) {
    this.selectedTrainId = id;
    globalEvents.emit(EVENTS.TRAIN_SELECTED, id ? this.trains.get(id) : null);
  }

  assignPlatform(trainId: string, platformId: string) {
    const train = this.trains.get(trainId);
    const platform = this.platforms.get(platformId);
    if (!train || !platform || train.status !== 'waiting' || platform.status !== 'free' || !train.platformCompatibility.includes(platform.length)) {
        globalEvents.emit('ILLEGAL_ASSIGNMENT');
        return false;
    }
    train.status = 'assigned';
    train.assignedPlatformId = platformId;
    platform.status = 'reserved';
    platform.currentTrainId = trainId;
    globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
    globalEvents.emit(EVENTS.PLATFORM_STATUS_CHANGED, platform);
    this.transitQueue.push({ trainId, platformId, arrivalMinute: this.gameMinute + 1 });
    return true;
  }

  private trainArrivesAtPlatform(trainId: string, platformId: string) {
    const train = this.trains.get(trainId);
    const platform = this.platforms.get(platformId);
    if (!train || !platform) return;
    train.status = 'deboarding';
    let weatherPenalty = 0;
    if (this.levelData) {
        const isRain = this.levelData.events.some(e => e.type === 'weather' && this.gameMinute >= e.startMinute && this.gameMinute < e.endMinute);
        if (isRain) weatherPenalty = 1;
    }
    const reduction = this.upgrades.staffTraining + this.upgrades.techSystems;
    train.currentDwellTimer = Math.max(1, train.deboardingTimeBase + weatherPenalty - reduction);
    platform.status = 'occupied';
    globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
    globalEvents.emit(EVENTS.PLATFORM_STATUS_CHANGED, platform);
  }

  clearDeparture(trainId: string) {
    const train = this.trains.get(trainId);
    if (!train || train.status !== 'ready') return false;
    const platform = this.platforms.get(train.assignedPlatformId!);
    if (platform) {
      platform.status = 'free';
      platform.currentTrainId = null;
      globalEvents.emit(EVENTS.PLATFORM_STATUS_CHANGED, platform);
    }
    train.status = 'cleared';
    globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
    const delay = this.gameMinute - train.scheduledDepartureTime;
    let scoreMod = 10;
    let xpMod = 10;
    let repMod = 0;
    if (delay <= 0) {
      this.onTimeServed++;
      scoreMod += 5; xpMod += 5;
    } else {
      this.missedDepartures++;
      scoreMod -= delay * 2;
      const repPenalty = Math.max(0, delay - this.upgrades.dispatchOps);
      repMod -= repPenalty; 
      if (train.priority >= 3) repMod -= repPenalty; 
    }
    this.trainsServed++;
    this.updateScore(scoreMod, xpMod, repMod);
    setTimeout(() => { if (train) { train.status = 'departed'; globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train); } }, 2000);
    return true;
  }

  updateScore(scoreChange: number, xpChange: number, repChange: number) {
    this.score += scoreChange;
    this.xp += xpChange;
    this.reputation = Math.max(0, Math.min(100, this.reputation + repChange));
    this.saveToStorage();
    this.emitScore();
  }

  purchaseUpgrade(id: string, cost: number): boolean {
    if (this.xp >= cost) {
      this.xp -= cost;
      (this.upgrades as any)[id]++;
      this.saveToStorage();
      this.emitScore();
      return true;
    }
    return false;
  }

  private emitScore() { globalEvents.emit(EVENTS.SCORE_UPDATED, { score: this.score, xp: this.xp, reputation: this.reputation }); }

  private checkWinLossConditions() {
    if (!this.levelData) return;
    if (this.reputation <= this.levelData.loseConditions.minReputation) {
      this.pause(); globalEvents.emit(EVENTS.GAME_OVER, { win: false, reason: 'Reputation dropped too low.' }); return;
    }
    if (this.missedDepartures >= this.levelData.loseConditions.maxMissedDepartures) {
      this.pause(); globalEvents.emit(EVENTS.GAME_OVER, { win: false, reason: `Too many missed departures (${this.missedDepartures}/3).` }); return;
    }
    if (this.gameMinute >= this.levelData.durationMinutes) {
      this.pause();
      if (this.onTimeServed >= 5 && this.reputation >= this.levelData.winConditions.minReputation) globalEvents.emit(EVENTS.GAME_OVER, { win: true, reason: 'Shift completed successfully!' });
      else globalEvents.emit(EVENTS.GAME_OVER, { win: false, reason: `Targets not met. On-time: ${this.onTimeServed}/5.` });
    }
  }
}
export const gameState = new GameState();