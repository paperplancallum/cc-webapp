'use client';

import { useKit, useStartExposure } from '@/lib/hooks/use-kits';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function StartExposurePage() {
  const params = useParams();
  const router = useRouter();
  const kitId = params.kitId as string;

  const { data: kit, isLoading } = useKit(kitId);
  const startExposure = useStartExposure();
  const [confirmed, setConfirmed] = useState(false);

  const handleStart = async () => {
    try {
      await startExposure.mutateAsync(kitId);
      router.push(`/kit/${kitId}`);
    } catch (error) {
      console.error('Failed to start exposure:', error);
    }
  };

  if (isLoading || !kit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (kit.status !== 'REGISTERED') {
    router.push(`/kit/${kitId}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Start Exposure Test
            </h1>
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="card space-y-6">
          <div className="text-center">
            <div className="text-6xl mb-4">🧪</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {kit.location_name}
            </h2>
            <p className="text-sm text-gray-600 font-mono">{kit.kit_id}</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">
              📋 Before You Start
            </h3>
            <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
              <li>
                <strong>Remove the petri dish lid</strong> and place it aside
              </li>
              <li>
                <strong>Position the dish</strong> in the location you want to
                test ({kit.location_name})
              </li>
              <li>
                <strong>Ensure the dish is stable</strong> and won't be
                disturbed
              </li>
              <li>
                <strong>The test will run for 60 minutes</strong> – do not close
                the lid during this time
              </li>
            </ol>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800">
              ⚠️ <strong>Important:</strong> Once you start the timer, you must
              leave the petri dish lid open for the full 60 minutes. The timer
              will continue even if you close this app.
            </p>
          </div>

          <div className="flex items-start gap-3 pt-4">
            <input
              id="confirm"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 text-primary-600 rounded"
            />
            <label htmlFor="confirm" className="text-sm text-gray-700">
              I confirm that the petri dish lid is removed and the dish is
              positioned in the correct location
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => router.back()}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={!confirmed || startExposure.isPending}
              className="btn-primary flex-1"
            >
              {startExposure.isPending
                ? 'Starting...'
                : '🚀 Start 60-Minute Timer'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
