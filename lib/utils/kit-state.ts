import { Kit } from '@/types/database.types';
import { KitDerivedState, PrimaryAction } from '@/types/kit.types';
import { calculateTimerState, hoursUntil, hasTimePassed } from './timer';

/**
 * Derive computed state from a kit's database record
 * All business logic for what the user can do is centralized here
 */
export function deriveKitState(kit: Kit): KitDerivedState {
  const timer = kit.status === 'EXPOSING' ? calculateTimerState(kit) : null;

  // Calculate incubation times
  let hoursUntil48hrCheck: number | null = null;
  let hoursUntil72hrCheck: number | null = null;
  let canUpload48hrPhoto = false;
  let canUpload72hrPhoto = false;

  if (kit.lid_sealed_at) {
    const sealedAt = new Date(kit.lid_sealed_at);
    const hr48Target = new Date(sealedAt.getTime() + 48 * 60 * 60 * 1000);
    const hr72Target = new Date(sealedAt.getTime() + 72 * 60 * 60 * 1000);

    hoursUntil48hrCheck = hoursUntil(hr48Target.toISOString());
    hoursUntil72hrCheck = hoursUntil(hr72Target.toISOString());

    canUpload48hrPhoto = hasTimePassed(hr48Target.toISOString());
    canUpload72hrPhoto = hasTimePassed(hr72Target.toISOString());
  }

  // Business rules
  const canStartExposure = kit.status === 'REGISTERED';
  const canSealLid = kit.status === 'EXPOSURE_COMPLETE';

  // Determine primary action and display message
  let primaryAction: PrimaryAction = null;
  let displayMessage = '';
  let statusLabel = '';

  switch (kit.status) {
    case 'REGISTERED':
      primaryAction = 'START_TEST';
      displayMessage = 'Ready to start your mold test';
      statusLabel = 'Not Started';
      break;

    case 'EXPOSING':
      primaryAction = 'WAIT';
      displayMessage = 'Keep the petri dish lid open and in position';
      statusLabel = 'Exposing';
      break;

    case 'EXPOSURE_COMPLETE':
      primaryAction = 'SEAL_LID';
      displayMessage = 'Timer complete! Close the petri dish lid now.';
      statusLabel = 'Ready to Seal';
      break;

    case 'INCUBATING':
      primaryAction = 'WAIT';
      displayMessage = `First check-in in ${hoursUntil48hrCheck}h`;
      statusLabel = 'Incubating';
      break;

    case 'AWAITING_48HR_PHOTO':
      primaryAction = 'UPLOAD_48HR_PHOTO';
      displayMessage = '📸 Time to upload your 48-hour photo';
      statusLabel = '48hr Photo Required';
      break;

    case 'AWAITING_72HR_PHOTO':
      primaryAction = 'UPLOAD_72HR_PHOTO';
      displayMessage = canUpload72hrPhoto
        ? '📸 Time to upload your 72-hour photo'
        : `Next photo in ${hoursUntil72hrCheck}h`;
      statusLabel = '72hr Photo Pending';
      break;

    case 'COMPLETED':
      primaryAction = null;
      displayMessage = 'Test complete! Results will be analyzed by the lab.';
      statusLabel = 'Completed';
      break;
  }

  return {
    timer,
    hoursUntil48hrCheck,
    hoursUntil72hrCheck,
    canUpload48hrPhoto,
    canUpload72hrPhoto,
    canStartExposure,
    canSealLid,
    primaryAction,
    displayMessage,
    statusLabel,
  };
}

/**
 * Get status badge color based on kit status
 */
export function getStatusBadgeClass(status: Kit['status']): string {
  const classes = {
    REGISTERED: 'badge-gray',
    EXPOSING: 'badge-info',
    EXPOSURE_COMPLETE: 'badge-warning',
    INCUBATING: 'badge-info',
    AWAITING_48HR_PHOTO: 'badge-warning',
    AWAITING_72HR_PHOTO: 'badge-warning',
    COMPLETED: 'badge-success',
  };

  return classes[status] || 'badge-gray';
}
