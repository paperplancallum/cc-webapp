import { Kit } from '@/types/database.types';
import { TimerState } from '@/types/kit.types';

/**
 * Calculate timer state from server timestamps
 * This ensures timer is accurate even after page refreshes
 */
export function calculateTimerState(kit: Kit): TimerState {
  if (kit.status !== 'EXPOSING' || !kit.exposure_started_at) {
    return {
      isActive: false,
      secondsRemaining: 0,
      completesAt: null,
      progress: 0,
    };
  }

  const startedAt = new Date(kit.exposure_started_at);
  const durationMs = kit.exposure_duration_minutes * 60 * 1000;
  const completesAt = new Date(startedAt.getTime() + durationMs);
  const now = new Date();

  const msRemaining = completesAt.getTime() - now.getTime();
  const secondsRemaining = Math.max(0, Math.floor(msRemaining / 1000));

  const msElapsed = now.getTime() - startedAt.getTime();
  const progress = Math.min(100, Math.floor((msElapsed / durationMs) * 100));

  return {
    isActive: secondsRemaining > 0,
    secondsRemaining,
    completesAt: completesAt.toISOString(),
    progress,
  };
}

/**
 * Format seconds into MM:SS format
 */
export function formatTimerDisplay(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate hours until a future timestamp
 */
export function hoursUntil(targetDate: string | null): number | null {
  if (!targetDate) return null;

  const target = new Date(targetDate);
  const now = new Date();
  const msRemaining = target.getTime() - now.getTime();
  const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));

  return Math.max(0, hoursRemaining);
}

/**
 * Check if a timestamp has passed
 */
export function hasTimePassed(targetDate: string | null): boolean {
  if (!targetDate) return false;
  return new Date(targetDate) <= new Date();
}
