'use client';

import { Kit } from '@/types/database.types';
import { deriveKitState, getStatusBadgeClass } from '@/lib/utils/kit-state';
import { formatTimerDisplay } from '@/lib/utils/timer';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface KitCardProps {
  kit: Kit;
}

export function KitCard({ kit }: KitCardProps) {
  const [derived, setDerived] = useState(() => deriveKitState(kit));

  // Recalculate derived state every second for timer updates
  useEffect(() => {
    const interval = setInterval(() => {
      setDerived(deriveKitState(kit));
    }, 1000);

    return () => clearInterval(interval);
  }, [kit]);

  const getActionButton = () => {
    switch (derived.primaryAction) {
      case 'START_TEST':
        return (
          <Link href={`/kit/${kit.id}/start`} className="btn-primary w-full">
            🚀 Start Test
          </Link>
        );
      case 'SEAL_LID':
        return (
          <Link href={`/kit/${kit.id}/seal`} className="btn-primary w-full">
            🔒 Seal Lid
          </Link>
        );
      case 'UPLOAD_48HR_PHOTO':
        return (
          <Link
            href={`/kit/${kit.id}/upload?type=48HR`}
            className="btn-primary w-full"
          >
            📸 Upload 48hr Photo
          </Link>
        );
      case 'UPLOAD_72HR_PHOTO':
        return (
          <Link
            href={`/kit/${kit.id}/upload?type=72HR`}
            className="btn-primary w-full"
          >
            📸 Upload 72hr Photo
          </Link>
        );
      case 'WAIT':
        return (
          <Link href={`/kit/${kit.id}`} className="btn-secondary w-full">
            View Details
          </Link>
        );
      default:
        return (
          <Link href={`/kit/${kit.id}`} className="btn-secondary w-full">
            View Details
          </Link>
        );
    }
  };

  return (
    <div className="card hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 truncate">
          {kit.location_name}
        </h3>
        <span className={cn('badge', getStatusBadgeClass(kit.status))}>
          {derived.statusLabel}
        </span>
      </div>

      {/* Content - Conditional based on status */}
      <div className="mb-6">
        {kit.status === 'EXPOSING' && derived.timer && (
          <div className="text-center space-y-2">
            <div className="text-5xl font-mono font-bold text-primary-600">
              {formatTimerDisplay(derived.timer.secondsRemaining)}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${derived.timer.progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">{derived.displayMessage}</p>
          </div>
        )}

        {kit.status === 'INCUBATING' && (
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">First check-in</p>
            <div className="text-4xl font-bold text-primary-600">
              {derived.hoursUntil48hrCheck}h
            </div>
            <p className="text-sm text-gray-500">remaining</p>
          </div>
        )}

        {(kit.status === 'AWAITING_48HR_PHOTO' ||
          kit.status === 'AWAITING_72HR_PHOTO') && (
          <div className="text-center space-y-2">
            <div className="text-4xl">📸</div>
            <p className="text-sm font-medium text-gray-900">
              {derived.displayMessage}
            </p>
          </div>
        )}

        {kit.status === 'EXPOSURE_COMPLETE' && (
          <div className="text-center space-y-2 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-3xl">⏰</div>
            <p className="text-sm font-semibold text-orange-800">
              {derived.displayMessage}
            </p>
          </div>
        )}

        {kit.status === 'REGISTERED' && (
          <div className="text-center space-y-2">
            <div className="text-4xl">🧪</div>
            <p className="text-sm text-gray-600">{derived.displayMessage}</p>
          </div>
        )}

        {kit.status === 'COMPLETED' && (
          <div className="text-center space-y-2 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-3xl">✅</div>
            <p className="text-sm font-medium text-green-800">
              {derived.displayMessage}
            </p>
          </div>
        )}
      </div>

      {/* Action Button */}
      {getActionButton()}

      {/* Kit ID */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Kit ID: <span className="font-mono">{kit.kit_id}</span>
        </p>
      </div>
    </div>
  );
}
