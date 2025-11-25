import { Kit, KitStatus } from './database.types';

export interface TimerState {
  isActive: boolean;
  secondsRemaining: number;
  completesAt: string | null;
  progress: number; // 0-100
}

export type PrimaryAction =
  | 'START_TEST'
  | 'SEAL_LID'
  | 'UPLOAD_48HR_PHOTO'
  | 'UPLOAD_72HR_PHOTO'
  | 'WAIT'
  | null;

export interface KitDerivedState {
  // Timer calculations
  timer: TimerState | null;

  // Incubation calculations
  hoursUntil48hrCheck: number | null;
  hoursUntil72hrCheck: number | null;
  canUpload48hrPhoto: boolean;
  canUpload72hrPhoto: boolean;

  // Boolean flags
  canStartExposure: boolean;
  canSealLid: boolean;

  // Display state
  primaryAction: PrimaryAction;
  displayMessage: string;
  statusLabel: string;
}

export interface KitWithDerived extends Kit {
  derived: KitDerivedState;
}
