import type { LevelData, Train, Platform } from '../types';
import { globalEvents, EVENTS } from './EventEmitter';

export class GameState {
  levelData: LevelData | null = null;
  
  gameMinute: number = 0;
  speedMultiplier: number = 1; // 0 = paused, 1 = normal, 2 = fast
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
  
  selectedTrainId: string | null = null;

  loadLevel(level: LevelData) {
    this.levelData = level;
    this.gameMinute = 0;
    this.trains.clear();
    this.platforms.clear();
    
    // Copy trains to our map, ensuring status starts as 'approaching'
    for (const t of level.trains) {
      this.trains.set(t.id, { ...t, status: 'approaching' });
    }
    
    for (const p of level.platforms) {
      this.platforms.set(p.id, { ...p });
    }
    
    this.score = 0;
    this.xp = 0;
    this.reputation = 80;
    this.missedDepartures = 0;
    this.trainsServed = 0;
    
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
    if (!this.isRunning && speed > 0) {
      this.start();
    }
    globalEvents.emit(EVENTS.SPEED_CHANGED, speed);
  }

  private tick = (currentTime: number) => {
    if (!this.isRunning) return;

    const deltaTime = (currentTime - this.lastTickTime) / 1000; // in seconds
    this.lastTickTime = currentTime;

    if (this.speedMultiplier > 0) {
      this.accumulator += deltaTime * this.speedMultiplier;

      // Have we reached a new game minute?
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
    this.processEvents();
    this.processTrains();
    this.processPlatforms();
    this.checkWinLossConditions();
  }

  private processEvents() {
    if (!this.levelData) return;
    for (const evt of this.levelData.events) {
      if (this.gameMinute === evt.startMinute) {
        globalEvents.emit(EVENTS.DISRUPTION_ACTIVE, evt.description);
      }
      if (this.gameMinute === evt.endMinute) {
        globalEvents.emit(EVENTS.DISRUPTION_ACTIVE, null);
      }
    }
  }

  private processTrains() {
    // Basic logic for train state transitions per minute
    for (const [, train] of this.trains.entries()) {
      // Spawn train
      if (train.status === 'approaching' && this.gameMinute >= train.arrivalTime) {
        train.status = 'waiting';
        train.actualArrivalTime = this.gameMinute;
        globalEvents.emit(EVENTS.TRAIN_SPAWNED, train);
      }
      
      // Update dwell timers
      if (['boarding', 'deboarding', 'ready'].includes(train.status) && train.currentDwellTimer !== undefined) {
        train.currentDwellTimer--;
        
        if (train.currentDwellTimer <= 0) {
          if (train.status === 'deboarding') {
            train.status = 'boarding';
            train.currentDwellTimer = train.boardingTimeBase;
            globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
          } else if (train.status === 'boarding') {
            train.status = 'ready';
            globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
          }
        }
      }
      
      // Penalty for waiting outside too long (simplified)
      if (train.status === 'waiting') {
        const waited = this.gameMinute - train.arrivalTime;
        if (waited > 3 && this.gameMinute % 2 === 0) {
          this.updateScore(0, 0, -1); // lose reputation for waiting
        }
      }
    }
  }

  private processPlatforms() {
    // Process blocked states
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

  // --- ACTIONS ---

  selectTrain(id: string | null) {
    this.selectedTrainId = id;
    globalEvents.emit(EVENTS.TRAIN_SELECTED, id ? this.trains.get(id) : null);
  }

  assignPlatform(trainId: string, platformId: string) {
    const train = this.trains.get(trainId);
    const platform = this.platforms.get(platformId);

    if (!train || !platform) return false;
    
    // Check if train is even in a state to be assigned
    if (train.status !== 'waiting') return false;
    
    // Check if platform is free and compatible
    if (platform.status !== 'free') return false;
    if (!train.platformCompatibility.includes(platform.length)) return false;

    // Apply assignment
    train.status = 'assigned';
    train.assignedPlatformId = platformId;
    platform.status = 'reserved';
    platform.currentTrainId = trainId;

    globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
    globalEvents.emit(EVENTS.PLATFORM_STATUS_CHANGED, platform);
    
    // Simulate transit time to platform
    setTimeout(() => this.trainArrivesAtPlatform(trainId, platformId), 2000); 
    
    return true;
  }

  private trainArrivesAtPlatform(trainId: string, platformId: string) {
    const train = this.trains.get(trainId);
    const platform = this.platforms.get(platformId);
    if (!train || !platform) return;

    train.status = 'deboarding';
    // Let's add slight penalty if weather event is active (startMinute=0, endMinute=180)
    let weatherPenalty = 0;
    if (this.levelData) {
        const isRain = this.levelData.events.some(e => e.type === 'weather' && this.gameMinute >= e.startMinute && this.gameMinute < e.endMinute);
        if (isRain) weatherPenalty = 1;
    }
    
    train.currentDwellTimer = train.deboardingTimeBase + weatherPenalty;
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

    // Calc score
    const delay = this.gameMinute - train.scheduledDepartureTime;
    let scoreMod = 10;
    let xpMod = 10;
    let repMod = 0;

    if (delay <= 0) {
      scoreMod += 5; // on time bonus
      xpMod += 5;
    } else {
      scoreMod -= delay * 2;
      repMod -= delay; // late departure hurts rep
      if (train.priority >= 3) repMod -= delay; // high priority hurts more
    }

    this.trainsServed++;
    this.updateScore(scoreMod, xpMod, repMod);

    setTimeout(() => {
      if (train) {
        train.status = 'departed';
        globalEvents.emit(EVENTS.TRAIN_STATUS_CHANGED, train);
      }
    }, 2000);

    return true;
  }

  updateScore(scoreChange: number, xpChange: number, repChange: number) {
    this.score += scoreChange;
    this.xp += xpChange;
    this.reputation = Math.max(0, Math.min(100, this.reputation + repChange));
    this.emitScore();
  }

  private emitScore() {
    globalEvents.emit(EVENTS.SCORE_UPDATED, {
      score: this.score,
      xp: this.xp,
      reputation: this.reputation
    });
  }

  private checkWinLossConditions() {
    if (!this.levelData) return;
    
    // Check Fail
    if (this.reputation <= this.levelData.loseConditions.minReputation) {
      this.pause();
      globalEvents.emit(EVENTS.GAME_OVER, { win: false, reason: 'Reputation dropped too low.' });
      return;
    }

    // Check Win (Level duration reached)
    if (this.gameMinute >= this.levelData.durationMinutes) {
      this.pause();
      if (this.trainsServed >= this.levelData.winConditions.minServed && this.reputation >= this.levelData.winConditions.minReputation) {
        globalEvents.emit(EVENTS.GAME_OVER, { win: true, reason: 'Shift completed successfully!' });
      } else {
        globalEvents.emit(EVENTS.GAME_OVER, { win: false, reason: 'Shift completed, but targets were not met.' });
      }
    }
  }
}

export const gameState = new GameState();