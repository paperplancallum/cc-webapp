'use client';

import { useKit } from '@/lib/hooks/use-kits';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PhotoType } from '@/types/database.types';

export default function UploadPhotoPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const kitId = params.kitId as string;
  const photoType = (searchParams.get('type') || '48HR') as PhotoType;

  const { data: kit, isLoading: kitLoading } = useKit(kitId);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supabase = createClient();

  useEffect(() => {
    return () => {
      // Cleanup: stop camera when component unmounts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        setError('');
      }
    } catch (err) {
      setError(
        'Unable to access camera. Please check your browser permissions.'
      );
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPhotoBlob(blob);
          setPhotoPreview(URL.createObjectURL(blob));

          // Stop camera
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
          }
          setCameraActive(false);
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const retakePhoto = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
    startCamera();
  };

  const uploadPhoto = async () => {
    if (!photoBlob || !kit) return;

    setUploading(true);
    setError('');

    try {
      // Upload to Supabase Storage
      const filePath = `kits/${kit.kit_id}/${photoType}.jpg`;

      const { error: storageError } = await supabase.storage
        .from('photos')
        .upload(filePath, photoBlob, {
          cacheControl: '3600',
          upsert: true,
        });

      if (storageError) throw storageError;

      // Create photo record in database
      const { error: dbError } = await supabase.from('photos').insert({
        kit_id: kit.id,
        photo_type: photoType,
        storage_path: filePath,
        file_size_bytes: photoBlob.size,
        mime_type: photoBlob.type,
      });

      if (dbError) throw dbError;

      // Update kit status
      const newStatus =
        photoType === '48HR' ? 'AWAITING_72HR_PHOTO' : 'COMPLETED';

      const { error: updateError } = await supabase
        .from('kits')
        .update({ status: newStatus })
        .eq('id', kit.id);

      if (updateError) throw updateError;

      // Success! Redirect to kit detail page
      router.push(`/kit/${kitId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
      setUploading(false);
    }
  };

  if (kitLoading || !kit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Validate user is allowed to upload this photo type
  const canUpload =
    (photoType === '48HR' && kit.status === 'AWAITING_48HR_PHOTO') ||
    (photoType === '72HR' && kit.status === 'AWAITING_72HR_PHOTO');

  if (!canUpload) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <p className="text-red-600 font-semibold mb-4">
            Cannot upload photo at this time
          </p>
          <button onClick={() => router.push(`/kit/${kitId}`)} className="btn-primary">
            ← Back to Kit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              📸 {photoType === '48HR' ? '48-Hour' : '72-Hour'} Photo
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
          {!cameraActive && !photoPreview && (
            <>
              <div className="text-center">
                <div className="text-6xl mb-4">📸</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {kit.location_name} – {photoType === '48HR' ? '48hr' : '72hr'}{' '}
                  Check
                </h2>
                <p className="text-gray-600">
                  Take a clear photo of your petri dish
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  📋 Photo Guidelines
                </h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Ensure good lighting</li>
                  <li>Hold camera directly above the petri dish</li>
                  <li>Keep the lid closed (do not open)</li>
                  <li>Capture the entire dish in the frame</li>
                  <li>Make sure the photo is clear and in focus</li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button onClick={startCamera} className="btn-primary w-full">
                📷 Open Camera
              </button>
            </>
          )}

          {cameraActive && (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full"
                  style={{ maxHeight: '60vh' }}
                />

                {/* Overlay Guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 border-4 border-primary-400 rounded-full opacity-50" />
                </div>
              </div>

              <p className="text-sm text-center text-gray-600">
                Position the petri dish within the circle
              </p>

              <button onClick={capturePhoto} className="btn-primary w-full">
                📸 Capture Photo
              </button>
            </>
          )}

          {photoPreview && (
            <>
              <div className="rounded-lg overflow-hidden">
                <img
                  src={photoPreview}
                  alt="Photo preview"
                  className="w-full"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={retakePhoto}
                  disabled={uploading}
                  className="btn-secondary flex-1"
                >
                  ↻ Retake
                </button>
                <button
                  onClick={uploadPhoto}
                  disabled={uploading}
                  className="btn-primary flex-1"
                >
                  {uploading ? 'Uploading...' : '✅ Submit Photo'}
                </button>
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </main>
    </div>
  );
}
