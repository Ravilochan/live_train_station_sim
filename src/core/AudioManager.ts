import { globalEvents, EVENTS } from './EventEmitter';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private ambientOscillator: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  constructor() {
    // AudioContext needs user gesture to start in many browsers, 
    // so we initialize it lazily or on first click.
    globalEvents.on(EVENTS.TRAIN_SPAWNED, () => this.playTrainArrival());
    globalEvents.on(EVENTS.TRAIN_STATUS_CHANGED, (train: any) => {
      if (train.status === 'cleared') this.playTrainDeparture();
      if (train.status === 'ready') this.playPAChime();
    });
    globalEvents.on('ILLEGAL_ASSIGNMENT', () => this.playErrorBuzzer());
    globalEvents.on(EVENTS.TRAIN_SELECTED, () => this.playUIClick());
    globalEvents.on(EVENTS.PLATFORM_STATUS_CHANGED, () => this.playSignalBeep());
    globalEvents.on(EVENTS.GAME_OVER, (data: any) => {
      if (data.win) this.playSuccess();
      else this.playWarning();
    });
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.startAmbient();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.05, this.ctx.currentTime, 0.5);
    }
    return this.isMuted;
  }

  private startAmbient() {
    if (!this.ctx || this.ambientOscillator) return;
    this.ambientOscillator = this.ctx.createOscillator();
    this.ambientGain = this.ctx.createGain();
    
    this.ambientOscillator.type = 'sine';
    this.ambientOscillator.frequency.value = 55; // Low hum
    
    this.ambientGain.gain.value = this.isMuted ? 0 : 0.05;
    
    this.ambientOscillator.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);
    
    this.ambientOscillator.start();
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    if (!this.ctx || this.isMuted) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playTrainArrival() {
    // Descending horn sound
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }

  playTrainDeparture() {
    this.playTone(150, 'square', 1.0, 0.1);
    setTimeout(() => this.playTone(200, 'square', 1.5, 0.1), 200);
  }

  playUIClick() {
    this.playTone(800, 'sine', 0.1, 0.05);
  }

  playSignalBeep() {
    this.playTone(600, 'square', 0.15, 0.05);
  }

  playWarning() {
    this.playTone(150, 'sawtooth', 0.5, 0.2);
    setTimeout(() => this.playTone(150, 'sawtooth', 0.5, 0.2), 600);
    setTimeout(() => this.playTone(150, 'sawtooth', 1.0, 0.2), 1200);
  }

  playSuccess() {
    this.playTone(400, 'sine', 0.2, 0.1);
    setTimeout(() => this.playTone(500, 'sine', 0.2, 0.1), 200);
    setTimeout(() => this.playTone(600, 'sine', 0.6, 0.1), 400);
  }
}

export const audioManager = new AudioManager();
  playPAChime() {
    // Classic 4-note chime
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.4, 0.03), i * 300);
    });
  }

  playErrorBuzzer() {
    this.playTone(100, 'sawtooth', 0.3, 0.1);
  }
