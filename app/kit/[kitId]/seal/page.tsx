'use client';

import { useKit, useSealLid } from '@/lib/hooks/use-kits';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SealLidPage() {
  const params = useParams();
  const router = useRouter();
  const kitId = params.kitId as string;

  const { data: kit, isLoading } = useKit(kitId);
  const sealLid = useSealLid();
  const [confirmed, setConfirmed] = useState(false);

  const handleSeal = async () => {
    try {
      await sealLid.mutateAsync(kitId);
      router.push(`/kit/${kitId}`);
    } catch (error) {
      console.error('Failed to seal lid:', error);
    }
  };

  if (isLoading || !kit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (kit.status !== 'EXPOSURE_COMPLETE') {
    router.push(`/kit/${kitId}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Seal Petri Dish
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
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Timer Complete!
            </h2>
            <p className="text-gray-600">
              The 60-minute exposure period is finished
            </p>
          </div>

          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-6">
            <h3 className="font-semibold text-orange-900 mb-3">
              ⏰ Action Required
            </h3>
            <p className="text-sm text-orange-800 mb-4">
              You must now close the petri dish lid to begin the incubation
              period. Once sealed, do not open the lid again.
            </p>
            <ol className="text-sm text-orange-800 space-y-2 list-decimal list-inside">
              <li>
                <strong>Carefully place the lid</strong> back onto the petri
                dish
              </li>
              <li>
                <strong>Ensure it's sealed properly</strong> to prevent
                contamination
              </li>
              <li>
                <strong>Leave the dish undisturbed</strong> in a safe location
              </li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              📧 What Happens Next?
            </h3>
            <p className="text-sm text-blue-800 mb-3">
              After you confirm the lid is sealed, the incubation period begins:
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>
                <strong>48 hours from now:</strong> We'll email you to upload
                your first photo
              </li>
              <li>
                <strong>72 hours from now:</strong> We'll email you to upload
                your second photo
              </li>
              <li>You can check progress anytime from your dashboard</li>
            </ul>
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
              I confirm that I have placed the lid back on the petri dish and
              sealed it properly
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
              onClick={handleSeal}
              disabled={!confirmed || sealLid.isPending}
              className="btn-primary flex-1"
            >
              {sealLid.isPending
                ? 'Confirming...'
                : '✅ Confirm Lid Sealed'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
