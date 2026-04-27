export type TrainType = 'local' | 'express' | 'priority' | 'special';
export type TrainStatus = 
  | 'approaching' 
  | 'waiting' 
  | 'assigned' 
  | 'arrived' 
  | 'deboarding' 
  | 'boarding' 
  | 'ready' 
  | 'cleared' 
  | 'departed' 
  | 'delayed' 
  | 'cancelled';

export type PlatformLength = 'short' | 'medium' | 'long';
export type PlatformStatus = 'free' | 'reserved' | 'occupied' | 'cleaning' | 'maintenance' | 'emergency';

export interface Train {
  id: string;
  name: string;
  type: TrainType;
  direction: string;
  priority: number;
  platformCompatibility: PlatformLength[];
  arrivalTime: number; // in game minutes
  scheduledDepartureTime: number; // in game minutes
  dwellTime: number; // base dwell time in game minutes
  passengerLoad: number;
  baggageLoad: number;
  boardingTimeBase: number;
  deboardingTimeBase: number;
  requiresCleaning: boolean;
  requiresWater: boolean;
  requiresMaintenanceCheck: boolean;
  status: TrainStatus;
  
  // Runtime calculated properties
  actualArrivalTime?: number;
  assignedPlatformId?: string | null;
  currentDwellTimer?: number;
}

export interface Platform {
  id: string;
  length: PlatformLength;
  status: PlatformStatus;
  currentTrainId: string | null;
  blockedUntil: number; // in game minutes (0 if not blocked)
  cleaningTime: number;
}

export interface LevelEvent {
  type: 'maintenance' | 'weather';
  targetId?: string; // e.g., platform ID
  startMinute: number;
  endMinute: number;
  description: string;
}

export interface LevelData {
  id: string;
  name: string;
  description: string;
  durationMinutes: number; // e.g., 180 game minutes (3 hours)
  platforms: Platform[];
  trains: Train[];
  events: LevelEvent[];
  winConditions: {
    minServed: number;
    minReputation: number;
    maxDelays: number;
  };
  loseConditions: {
    minReputation: number;
    maxMissedDepartures: number;
  };
}