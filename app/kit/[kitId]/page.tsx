'use client';

import { useKit } from '@/lib/hooks/use-kits';
import { deriveKitState, getStatusBadgeClass } from '@/lib/utils/kit-state';
import { formatTimerDisplay } from '@/lib/utils/timer';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { format } from 'date-fns';

export default function KitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kitId = params.kitId as string;

  const { data: kit, isLoading, error } = useKit(kitId);
  const [derived, setDerived] = useState(() =>
    kit ? deriveKitState(kit) : null
  );

  useEffect(() => {
    if (kit) {
      const interval = setInterval(() => {
        setDerived(deriveKitState(kit));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [kit]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading kit details...</p>
        </div>
      </div>
    );
  }

  if (error || !kit || !derived) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <p className="text-red-600 font-semibold mb-4">Kit not found</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {kit.location_name}
              </h1>
              <p className="text-sm text-gray-600 mt-1 font-mono">
                {kit.kit_id}
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Status Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Status</h2>
            <span className={cn('badge', getStatusBadgeClass(kit.status))}>
              {derived.statusLabel}
            </span>
          </div>

          {/* Dynamic Content Based on Status */}
          {kit.status === 'EXPOSING' && derived.timer && (
            <div className="space-y-4">
              <div className="text-center bg-primary-50 rounded-lg p-8">
                <div className="text-7xl font-mono font-bold text-primary-600 mb-4">
                  {formatTimerDisplay(derived.timer.secondsRemaining)}
                </div>
                <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-primary-600 h-3 rounded-full transition-all"
                    style={{ width: `${derived.timer.progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-700 mt-4">
                  {derived.displayMessage}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  ⏱️ Keep the petri dish lid open and in position. The timer will automatically complete when the exposure time is finished.
                </p>
              </div>
            </div>
          )}

          {kit.status === 'INCUBATING' && (
            <div className="text-center bg-primary-50 rounded-lg p-8">
              <div className="text-5xl mb-2">⏳</div>
              <p className="text-sm text-gray-600 mb-2">First check-in</p>
              <div className="text-5xl font-bold text-primary-600 mb-2">
                {derived.hoursUntil48hrCheck}h
              </div>
              <p className="text-sm text-gray-600">remaining</p>
              <p className="text-sm text-gray-500 mt-4">
                We'll email you when it's time to upload your first photo
              </p>
            </div>
          )}

          {kit.status === 'REGISTERED' && (
            <div className="text-center space-y-4">
              <div className="text-6xl">🧪</div>
              <p className="text-gray-600">{derived.displayMessage}</p>
              <Link href={`/kit/${kit.id}/start`} className="btn-primary inline-block">
                🚀 Start Test
              </Link>
            </div>
          )}

          {kit.status === 'EXPOSURE_COMPLETE' && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-6 text-center space-y-4">
              <div className="text-5xl">⏰</div>
              <p className="text-lg font-semibold text-orange-900">
                {derived.displayMessage}
              </p>
              <Link href={`/kit/${kit.id}/seal`} className="btn-primary inline-block">
                🔒 Confirm Lid Sealed
              </Link>
            </div>
          )}

          {(kit.status === 'AWAITING_48HR_PHOTO' || kit.status === 'AWAITING_72HR_PHOTO') && (
            <div className="text-center space-y-4">
              <div className="text-6xl">📸</div>
              <p className="text-lg font-medium text-gray-900">
                {derived.displayMessage}
              </p>
              {kit.status === 'AWAITING_48HR_PHOTO' && (
                <Link
                  href={`/kit/${kit.id}/upload?type=48HR`}
                  className="btn-primary inline-block"
                >
                  📸 Upload 48hr Photo
                </Link>
              )}
              {kit.status === 'AWAITING_72HR_PHOTO' && derived.canUpload72hrPhoto && (
                <Link
                  href={`/kit/${kit.id}/upload?type=72HR`}
                  className="btn-primary inline-block"
                >
                  📸 Upload 72hr Photo
                </Link>
              )}
              {kit.status === 'AWAITING_72HR_PHOTO' && !derived.canUpload72hrPhoto && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    Next photo available in <strong>{derived.hoursUntil72hrCheck}h</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {kit.status === 'COMPLETED' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-4">
              <div className="text-6xl">✅</div>
              <p className="text-lg font-medium text-green-800">
                {derived.displayMessage}
              </p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
          <div className="space-y-3">
            <TimelineItem
              label="Kit Registered"
              timestamp={kit.created_at}
              completed
            />
            {kit.exposure_started_at && (
              <TimelineItem
                label="Exposure Started"
                timestamp={kit.exposure_started_at}
                completed
              />
            )}
            {kit.lid_sealed_at && (
              <TimelineItem
                label="Lid Sealed"
                timestamp={kit.lid_sealed_at}
                completed
              />
            )}
            {kit.reminder_48hr_sent_at && (
              <TimelineItem
                label="48hr Reminder Sent"
                timestamp={kit.reminder_48hr_sent_at}
                completed
              />
            )}
            {kit.reminder_72hr_sent_at && (
              <TimelineItem
                label="72hr Reminder Sent"
                timestamp={kit.reminder_72hr_sent_at}
                completed
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TimelineItem({
  label,
  timestamp,
  completed,
}: {
  label: string;
  timestamp: string;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-3 h-3 rounded-full flex-shrink-0',
          completed ? 'bg-primary-600' : 'bg-gray-300'
        )}
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">
          {format(new Date(timestamp), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  );
}
