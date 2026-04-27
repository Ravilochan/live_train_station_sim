import { globalEvents, EVENTS } from './EventEmitter';
import { gameState } from './GameState';
import type { Train } from '../types';

export class TutorialManager {
  private currentStep = 0;
  private overlay = document.getElementById('tutorial-overlay')!;
  private titleEl = document.getElementById('tutorial-title')!;
  private textEl = document.getElementById('tutorial-text')!;
  private btnOk = document.getElementById('btn-tutorial-ok')!;

  constructor() {
    this.btnOk.addEventListener('click', () => this.nextStep());
    
    // Listen to game events to trigger specific steps
    globalEvents.on(EVENTS.TRAIN_SPAWNED, (train: Train) => {
      if (this.currentStep === 0 && train.id === 'TR-1') {
        this.showStep('Welcome, Station Master', 'A train has arrived! Click on Local 101 in the left panel or the top left of the screen, then assign it to a platform in the Right Panel.');
      }
    });

    globalEvents.on(EVENTS.TRAIN_STATUS_CHANGED, (train: Train) => {
      if (this.currentStep === 1 && train.status === 'assigned') {
        this.showStep('Platform Assigned', 'Great! The train is moving to the platform. It will deboard, board new passengers, and wait for clearance. Keep an eye on the Details panel.');
      }
      
      if (this.currentStep === 2 && train.status === 'ready') {
        this.showStep('Departure Clearance', 'The train is fully loaded and "Ready". Select it and click "Clear Departure" in the right panel to send it off on time!');
      }
    });

    globalEvents.on(EVENTS.DISRUPTION_ACTIVE, (msg: string | null) => {
      if (this.currentStep === 3 && msg && msg.includes('maintenance')) {
        this.showStep('Disruption!', 'Platform 7 is blocked for maintenance! Some platforms might become unavailable due to random events. Plan your routing carefully.');
      }
    });
  }

  private showStep(title: string, text: string) {
    this.titleEl.innerText = title;
    this.textEl.innerText = text;
    this.overlay.classList.remove('hidden');
    gameState.pause(); // Pause game while reading tutorial
  }

  private nextStep() {
    this.overlay.classList.add('hidden');
    this.currentStep++;
    gameState.setSpeed(1); // Resume normal speed
  }
}

export const tutorialManager = new TutorialManager();