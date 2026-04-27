import { gameState } from '../core/GameState';
import { globalEvents, EVENTS } from '../core/EventEmitter';
import type { Train } from '../types';

export class UIManager {
  private queueContainer = document.getElementById('train-queue')!;
  private detailsContainer = document.getElementById('train-details')!;
  private actionsContainer = document.getElementById('train-actions')!;
  
  private scoreEl = document.getElementById('ui-score')!;
  private xpEl = document.getElementById('ui-xp')!;
  private repEl = document.getElementById('ui-reputation')!;
  private timeEl = document.getElementById('ui-time')!;
  
  private btnPause = document.getElementById('btn-pause')!;
  private btn1x = document.getElementById('btn-1x')!;
  private btn2x = document.getElementById('btn-2x')!;
  private btnAudio = document.getElementById('btn-audio')!;

  private alertBanner = document.getElementById('alert-banner')!;
  
  private modalOverlay = document.getElementById('modal-overlay')!;
  private modalTitle = document.getElementById('modal-title')!;
  private modalReason = document.getElementById('modal-reason')!;
  private modalScore = document.getElementById('modal-score')!;
  private modalXp = document.getElementById('modal-xp')!;
  private modalRep = document.getElementById('modal-rep')!;

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    globalEvents.on(EVENTS.TIME_TICK, this.updateTime);
    globalEvents.on(EVENTS.TRAIN_SPAWNED, this.renderQueue);
    globalEvents.on(EVENTS.TRAIN_STATUS_CHANGED, this.handleTrainStatusChanged);
    globalEvents.on(EVENTS.TRAIN_SELECTED, this.renderDetails);
    globalEvents.on(EVENTS.SCORE_UPDATED, this.updateScore);
    globalEvents.on(EVENTS.DISRUPTION_ACTIVE, this.handleDisruption);
    globalEvents.on(EVENTS.GAME_OVER, this.handleGameOver);
    globalEvents.on(EVENTS.SPEED_CHANGED, this.updateSpeedButtons);

    this.btnPause.addEventListener('click', () => gameState.setSpeed(0));
    this.btn1x.addEventListener('click', () => gameState.setSpeed(1));
    this.btn2x.addEventListener('click', () => gameState.setSpeed(2));
    this.btnAudio.addEventListener('click', () => {
      import('../core/AudioManager').then(({ audioManager }) => {
        audioManager.init();
        const isMuted = audioManager.toggleMute();
        this.btnAudio.innerText = isMuted ? '🔇 Unmute' : '🔊 Mute';
      });
    });
  }

  private updateSpeedButtons = (speed: number) => {
    this.btnPause.classList.toggle('active', speed === 0);
    this.btn1x.classList.toggle('active', speed === 1);
    this.btn2x.classList.toggle('active', speed === 2);
  }

  private updateTime = (minute: number) => {
    const totalMinutes = 8 * 60 + minute;
    const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const m = (totalMinutes % 60).toString().padStart(2, '0');
    this.timeEl.innerText = `${h}:${m}`;
  }

  private updateScore = (data: { score: number, xp: number, reputation: number }) => {
    this.scoreEl.innerText = data.score.toString();
    this.xpEl.innerText = data.xp.toString();
    this.repEl.innerText = data.reputation.toString();
  }

  private handleDisruption = (msg: string | null) => {
    if (msg) {
      this.alertBanner.innerText = msg;
      this.alertBanner.classList.remove('hidden');
    } else {
      this.alertBanner.classList.add('hidden');
    }
  }

  private renderQueue = () => {
    this.queueContainer.innerHTML = '';
    const trains = Array.from(gameState.trains.values())
      .filter(t => t.status !== 'approaching' && t.status !== 'departed')
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.arrivalTime - b.arrivalTime;
      });

    trains.forEach(t => {
      const card = document.createElement('div');
      card.className = `train-card ${gameState.selectedTrainId === t.id ? 'selected' : ''}`;
      
      const badgeClass = `badge badge-${this.getBadgeType(t.status)}`;

      card.innerHTML = `
        <div class="card-header">
          <span class="train-id">${t.id}</span>
          <span class="${badgeClass}">${t.status}</span>
        </div>
        <div class="train-name">${t.name}</div>
        <div style="font-size:0.7rem; color:var(--text-dim); margin-top:0.4rem; font-family:'JetBrains Mono'">
          PRIORITY: ${t.priority} | ARR: ${t.arrivalTime}
        </div>
      `;
      card.onclick = () => gameState.selectTrain(t.id);
      this.queueContainer.appendChild(card);
    });
  }

  private getBadgeType(status: string): string {
    if (status === 'waiting' || status === 'delayed') return 'waiting';
    if (status === 'assigned' || status === 'arrived' || status === 'deboarding' || status === 'boarding') return 'assigned';
    if (status === 'ready') return 'ready';
    return 'waiting';
  }

  private handleTrainStatusChanged = (train: Train) => {
    this.renderQueue();
    if (gameState.selectedTrainId === train.id) {
      this.renderDetails(train);
    }
  }

  private renderDetails = (train: Train | null) => {
    this.renderQueue();
    this.actionsContainer.innerHTML = '';

    if (!train) {
      this.detailsContainer.innerHTML = '<p style="color:var(--text-dim); font-size:0.9rem;">Select a train from the queue to view data and dispatch controls.</p>';
      return;
    }

    this.detailsContainer.innerHTML = `
      <div class="details-grid">
        <div class="details-label">TYPE</div><div class="details-value" style="color:var(--neon-purple)">${train.type.toUpperCase()}</div>
        <div class="details-label">PRIORITY</div><div class="details-value">${train.priority}</div>
        <div class="details-label">LENGTH</div><div class="details-value">${train.platformCompatibility[0]}</div>
        <div class="details-label">PASSENGERS</div><div class="details-value">${train.passengerLoad}</div>
        <div class="details-label">SERVICE</div><div class="details-value">${train.currentDwellTimer || '0'}m</div>
        <div class="details-label">SCHEDULED</div><div class="details-value">${train.scheduledDepartureTime}m</div>
      </div>
    `;

    if (train.status === 'waiting') {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.style.marginTop = '1.5rem';
      btn.innerText = 'AUTO-ASSIGN PLATFORM';
      btn.onclick = () => {
        const p = Array.from(gameState.platforms.values()).find(
          p => p.status === 'free' && train.platformCompatibility.includes(p.length)
        );
        if (p) gameState.assignPlatform(train.id, p.id);
      };
      this.actionsContainer.appendChild(btn);
    }

    if (train.status === 'ready') {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.style.marginTop = '1.5rem';
      btn.style.backgroundColor = 'var(--neon-green)';
      btn.innerText = 'CLEAR DEPARTURE';
      btn.onclick = () => gameState.clearDeparture(train.id);
      this.actionsContainer.appendChild(btn);
    }
  }

  private handleGameOver = (data: { win: boolean, reason: string }) => {
    this.modalTitle.innerText = data.win ? 'SHIFT COMPLETED' : 'DISMISSED';
    this.modalTitle.style.color = data.win ? 'var(--neon-green)' : 'var(--neon-red)';
    this.modalReason.innerText = data.reason;
    
    this.modalScore.innerText = gameState.score.toString();
    this.modalXp.innerText = gameState.xp.toString();
    this.modalRep.innerText = gameState.reputation.toString();
    
    this.modalOverlay.classList.remove('hidden');
  }
}