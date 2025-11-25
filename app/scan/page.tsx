'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useRegisterKit } from '@/lib/hooks/use-kits';
import QrScanner from 'qr-scanner';

export default function ScanPage() {
  const [scannedId, setScannedId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const router = useRouter();

  const registerKit = useRegisterKit();

  useEffect(() => {
    if (!videoRef.current || !scanning) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        setScannedId(result.data);
        setScanning(false);
        scanner.stop();
      },
      {
        returnDetailedScanResult: true,
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );

    scannerRef.current = scanner;
    scanner.start().catch((err) => {
      setError('Unable to access camera. Please check permissions.');
      setScanning(false);
    });

    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [scanning]);

  const handleManualEntry = () => {
    setScanning(false);
    if (scannerRef.current) {
      scannerRef.current.stop();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!scannedId || !locationName) {
      setError('Please provide both Kit ID and Location Name');
      return;
    }

    try {
      const kit = await registerKit.mutateAsync({
        kit_id: scannedId,
        location_name: locationName,
      });

      // Redirect to the new kit's page
      router.push(`/kit/${kit.id}`);
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        setError('This kit has already been registered');
      } else {
        setError(err.message || 'Failed to register kit');
      }
    }
  };

  const handleRescan = () => {
    setScannedId('');
    setLocationName('');
    setError('');
    setScanning(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              📱 Scan Your Kit
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

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="card">
          {scanning ? (
            <>
              {/* Camera View */}
              <div className="mb-6">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg bg-black"
                  style={{ maxHeight: '400px' }}
                />
              </div>

              <div className="text-center space-y-4">
                <p className="text-gray-600">
                  Position the QR code within the frame
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleManualEntry}
                  className="btn-secondary w-full"
                >
                  Enter Kit ID Manually
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Registration Form */}
              <form onSubmit={handleRegister} className="space-y-6">
                <div>
                  <label
                    htmlFor="kitId"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Kit ID {scannedId && '✓'}
                  </label>
                  <input
                    id="kitId"
                    type="text"
                    value={scannedId}
                    onChange={(e) => setScannedId(e.target.value)}
                    placeholder="KIT-ABC-123"
                    required
                    className="input font-mono"
                  />
                  {scannedId && (
                    <p className="text-sm text-green-600 mt-1">
                      ✓ Kit ID captured
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Location Name
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="e.g., Basement, Attic, Kitchen"
                    required
                    className="input"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Give this test a memorable name to identify the room or area
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRescan}
                    className="btn-secondary flex-1"
                  >
                    ↻ Rescan
                  </button>
                  <button
                    type="submit"
                    disabled={registerKit.isPending}
                    className="btn-primary flex-1"
                  >
                    {registerKit.isPending ? 'Registering...' : 'Register Kit'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Instructions</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Find the QR code on your petri dish lid</li>
            <li>Position it within the camera frame</li>
            <li>Give your test a location name (e.g., "Basement")</li>
            <li>Click "Register Kit" to get started</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
