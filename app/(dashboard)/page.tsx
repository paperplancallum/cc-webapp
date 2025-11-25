'use client';

import { useKits } from '@/lib/hooks/use-kits';
import { KitCard } from '@/components/kit-card';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { data: kits, isLoading, error } = useKits();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your kits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md">
          <div className="text-center text-red-600">
            <p className="font-semibold mb-2">Error loading kits</p>
            <p className="text-sm">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🔬 Mold Testing Companion
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {kits && kits.length > 0
                  ? `Managing ${kits.length} test ${kits.length === 1 ? 'kit' : 'kits'}`
                  : 'Get started by scanning your first kit'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {kits && kits.length > 0 ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {kits.map((kit) => (
                <KitCard key={kit.id} kit={kit} />
              ))}
            </div>

            {/* Add New Kit Button */}
            <Link
              href="/scan"
              className="block border-2 border-dashed border-primary-300 rounded-xl p-8 text-center hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <div className="text-4xl mb-2">➕</div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                Add New Kit
              </p>
              <p className="text-sm text-gray-600">
                Scan the QR code on your petri dish
              </p>
            </Link>
          </>
        ) : (
          /* Empty State */
          <div className="text-center py-12">
            <div className="card max-w-md mx-auto">
              <div className="text-6xl mb-4">🧪</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                No Kits Yet
              </h2>
              <p className="text-gray-600 mb-6">
                Get started by scanning the QR code on your mold testing kit
              </p>
              <Link href="/scan" className="btn-primary">
                📱 Scan Your First Kit
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
