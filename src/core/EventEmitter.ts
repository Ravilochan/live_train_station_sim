type EventHandler = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler) {
    if (!this.events.has(event)) return;
    const handlers = this.events.get(event)!;
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  emit(event: string, ...args: any[]) {
    if (!this.events.has(event)) return;
    for (const handler of this.events.get(event)!) {
      handler(...args);
    }
  }
}

export const globalEvents = new EventEmitter();

// Global Event Names
export const EVENTS = {
  TIME_TICK: 'TIME_TICK', // arg: current game minute
  TRAIN_SPAWNED: 'TRAIN_SPAWNED', // arg: Train
  TRAIN_STATUS_CHANGED: 'TRAIN_STATUS_CHANGED', // arg: Train
  TRAIN_SELECTED: 'TRAIN_SELECTED', // arg: Train | null
  PLATFORM_STATUS_CHANGED: 'PLATFORM_STATUS_CHANGED', // arg: Platform
  SCORE_UPDATED: 'SCORE_UPDATED', // arg: { score, xp, reputation }
  GAME_OVER: 'GAME_OVER', // arg: { win: boolean, reason: string }
  SPEED_CHANGED: 'SPEED_CHANGED', // arg: speed multiplier (0, 1, 2)
  DISRUPTION_ACTIVE: 'DISRUPTION_ACTIVE' // arg: string (message) or null to clear
};