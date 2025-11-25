# Technical Proposal: Mold Testing Companion Web App

**Author**: Senior Full Stack Developer
**Date**: 2025-11-25
**Tech Stack**: Next.js 15, Tailwind CSS, Supabase (Auth/DB/Storage)

---

## 1. Database Schema Design

### 1.1 Core Tables

```sql
-- ============================================
-- KITS TABLE (Core State Machine)
-- ============================================
CREATE TABLE kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  kit_id TEXT UNIQUE NOT NULL,              -- QR code value (e.g., "KIT-ABC-123")
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  location_name TEXT NOT NULL,              -- User-friendly name: "Basement", "Attic"

  -- State Machine
  status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (
    status IN (
      'REGISTERED',           -- QR scanned, not started
      'EXPOSING',            -- Timer actively running
      'EXPOSURE_COMPLETE',   -- Timer done, awaiting lid seal confirmation
      'INCUBATING',          -- Lid sealed, waiting for 48hr
      'AWAITING_48HR_PHOTO', -- Ready for first photo
      'AWAITING_72HR_PHOTO', -- First photo done, ready for second
      'COMPLETED'            -- Both photos submitted
    )
  ),

  -- Timer Logic (Timestamp-Based)
  exposure_started_at TIMESTAMPTZ,          -- When user clicked "Start Test"
  exposure_duration_minutes INTEGER DEFAULT 60,
  exposure_completed_at TIMESTAMPTZ,        -- Calculated: started_at + duration

  -- Incubation Phase
  lid_sealed_at TIMESTAMPTZ,                -- When user confirmed "Lid Sealed"

  -- Email Reminder Tracking
  reminder_48hr_sent_at TIMESTAMPTZ,
  reminder_72hr_sent_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHOTOS TABLE
-- ============================================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE NOT NULL,

  photo_type TEXT NOT NULL CHECK (photo_type IN ('48HR', '72HR')),
  storage_path TEXT NOT NULL,               -- Supabase Storage: kits/{kit_id}/{photo_type}.jpg

  -- Photo Metadata
  file_size_bytes INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,

  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one photo per type per kit
  UNIQUE(kit_id, photo_type)
);

-- ============================================
-- MAGIC_TOKENS TABLE (Deep Linking)
-- ============================================
CREATE TABLE magic_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE NOT NULL,

  token TEXT UNIQUE NOT NULL,               -- UUID or nanoid
  action TEXT NOT NULL CHECK (
    action IN ('UPLOAD_48HR_PHOTO', 'UPLOAD_72HR_PHOTO')
  ),

  expires_at TIMESTAMPTZ NOT NULL,          -- Tokens valid for 7 days
  used_at TIMESTAMPTZ,                      -- Track if link was clicked

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_kits_user_id ON kits(user_id);
CREATE INDEX idx_kits_status ON kits(status);
CREATE INDEX idx_kits_lid_sealed_at ON kits(lid_sealed_at) WHERE status IN ('INCUBATING', 'AWAITING_48HR_PHOTO');
CREATE INDEX idx_photos_kit_id ON photos(kit_id);
CREATE INDEX idx_magic_tokens_token ON magic_tokens(token) WHERE used_at IS NULL;
```

### 1.2 Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_tokens ENABLE ROW LEVEL SECURITY;

-- Kits: Users can only see their own kits
CREATE POLICY "Users can view their own kits"
  ON kits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own kits"
  ON kits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kits"
  ON kits FOR UPDATE
  USING (auth.uid() = user_id);

-- Photos: Users can only access photos for their kits
CREATE POLICY "Users can view photos for their kits"
  ON photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kits
      WHERE kits.id = photos.kit_id
      AND kits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert photos for their kits"
  ON photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kits
      WHERE kits.id = photos.kit_id
      AND kits.user_id = auth.uid()
    )
  );

-- Magic Tokens: Readable by owner or when using the token
CREATE POLICY "Users can view their own magic tokens"
  ON magic_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kits
      WHERE kits.id = magic_tokens.kit_id
      AND kits.user_id = auth.uid()
    )
  );
```

---

## 2. State Machine Logic

### 2.1 State Transition Diagram

```
┌─────────────┐
│ REGISTERED  │ ← QR Scanned, Location Named
└──────┬──────┘
       │ User clicks "Start Test"
       │ SET exposure_started_at = NOW()
       ▼
┌─────────────┐
│  EXPOSING   │ ← Timer Running (60 min default)
└──────┬──────┘
       │ Auto-transition when NOW() >= exposure_started_at + duration
       │ SET exposure_completed_at
       ▼
┌──────────────────┐
│EXPOSURE_COMPLETE │ ← Timer Done, Awaiting User Confirmation
└────────┬─────────┘
         │ User confirms "Lid Sealed"
         │ SET lid_sealed_at = NOW()
         │ SCHEDULE 48hr & 72hr emails
         ▼
┌─────────────┐
│ INCUBATING  │ ← Waiting for 48 hours
└──────┬──────┘
       │ Auto-transition when NOW() >= lid_sealed_at + 48 hours
       │ SEND 48hr email with magic link
       ▼
┌────────────────────┐
│AWAITING_48HR_PHOTO │ ← Email Sent, Awaiting First Photo
└─────────┬──────────┘
          │ User uploads 48hr photo
          │ INSERT INTO photos
          ▼
┌────────────────────┐
│AWAITING_72HR_PHOTO │ ← Waiting for 72 hours (from lid_sealed_at)
└─────────┬──────────┘
          │ User uploads 72hr photo (after lid_sealed_at + 72 hours)
          │ INSERT INTO photos
          ▼
┌─────────────┐
│  COMPLETED  │ ← Test Finished
└─────────────┘
```

### 2.2 State Transition Rules

| From State | To State | Trigger | Actions | Validation |
|------------|----------|---------|---------|------------|
| `REGISTERED` | `EXPOSING` | User clicks "Start Test" | - Set `exposure_started_at = NOW()`<br>- Calculate `exposure_completed_at` | - Kit must have `user_id` and `location_name` |
| `EXPOSING` | `EXPOSURE_COMPLETE` | Automatic (time-based) | - Status update via background job or client check | - `NOW() >= exposure_completed_at` |
| `EXPOSURE_COMPLETE` | `INCUBATING` | User confirms "Lid Sealed" | - Set `lid_sealed_at = NOW()`<br>- Create magic tokens<br>- Schedule email jobs | - User must explicitly confirm |
| `INCUBATING` | `AWAITING_48HR_PHOTO` | Automatic (time-based) | - Send 48hr email<br>- Set `reminder_48hr_sent_at` | - `NOW() >= lid_sealed_at + 48 hours` |
| `AWAITING_48HR_PHOTO` | `AWAITING_72HR_PHOTO` | User uploads photo | - Insert into `photos` table<br>- Upload to Supabase Storage | - Photo must meet quality requirements |
| `AWAITING_72HR_PHOTO` | `COMPLETED` | User uploads photo | - Insert into `photos` table<br>- Upload to Supabase Storage | - Must be at least 72 hours since `lid_sealed_at` |

### 2.3 Computed Properties (Derived State)

These are NOT stored in the database but calculated on-demand:

```typescript
interface KitDerivedState {
  // Timer calculations
  timerSecondsRemaining: number | null;  // null if not exposing
  timerProgress: number;                 // 0-100%

  // Incubation calculations
  hoursUntil48hrCheck: number | null;
  hoursUntil72hrCheck: number | null;

  // Boolean flags
  canStartExposure: boolean;
  canSealLid: boolean;
  canUpload48hrPhoto: boolean;
  canUpload72hrPhoto: boolean;

  // Display state
  primaryAction: 'START_TEST' | 'SEAL_LID' | 'UPLOAD_PHOTO' | 'WAIT' | null;
  displayMessage: string;
}
```

---

## 3. Technical Architecture Decisions

### 3.1 Frontend Architecture (Next.js 15)

**App Router Structure**:
```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx              # Magic link email login
│   └── magic/
│       └── page.tsx              # Magic link handler for deep links
│
├── (dashboard)/
│   ├── layout.tsx                # Authenticated layout
│   ├── page.tsx                  # Multi-kit dashboard
│   └── kit/
│       └── [kitId]/
│           ├── page.tsx          # Dynamic kit detail page
│           ├── start/page.tsx    # Start exposure flow
│           ├── seal/page.tsx     # Seal lid confirmation
│           └── upload/page.tsx   # Photo upload (48hr or 72hr)
│
├── scan/
│   └── page.tsx                  # QR code scanner (register new kit)
│
└── api/
    ├── kits/
    │   ├── [kitId]/
    │   │   ├── start/route.ts    # POST: Start exposure
    │   │   ├── seal/route.ts     # POST: Seal lid
    │   │   └── upload/route.ts   # POST: Upload photo
    │   └── register/route.ts     # POST: Register new kit
    └── cron/
        └── check-reminders/route.ts  # Background job (Vercel Cron)
```

**State Management Strategy**:

1. **Server State**: TanStack Query (React Query)
   - Fetching kits from Supabase
   - Real-time subscriptions for timer updates
   - Optimistic updates for mutations

2. **Client State**: Zustand (lightweight)
   - Active camera state
   - Photo preview before upload
   - UI state (modals, toast notifications)

3. **No Global State for Business Logic**
   - All business logic lives server-side
   - Client only handles presentation and user input

### 3.2 Timer Implementation (Critical Requirement)

**Problem**: Timer must survive page refreshes, browser closes, and network outages.

**Solution**: Server-Side Timestamp Calculation

```typescript
// lib/timer.ts
export function calculateTimerState(kit: Kit): TimerState {
  if (kit.status !== 'EXPOSING') {
    return { isActive: false, secondsRemaining: 0 };
  }

  const startedAt = new Date(kit.exposure_started_at);
  const durationMs = kit.exposure_duration_minutes * 60 * 1000;
  const completesAt = new Date(startedAt.getTime() + durationMs);
  const now = new Date();

  const msRemaining = completesAt.getTime() - now.getTime();
  const secondsRemaining = Math.max(0, Math.floor(msRemaining / 1000));

  return {
    isActive: secondsRemaining > 0,
    secondsRemaining,
    completesAt: completesAt.toISOString(),
  };
}
```

**Client-Side Timer Component**:
```typescript
'use client';

export function ExposureTimer({ kit }: { kit: Kit }) {
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = calculateTimerState(kit);
      setSecondsRemaining(state.secondsRemaining);

      if (!state.isActive) {
        // Timer complete - trigger status check
        queryClient.invalidateQueries(['kit', kit.id]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [kit]);

  // Format as MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="text-6xl font-mono">
      {minutes.toString().padStart(2, '0')}:
      {seconds.toString().padStart(2, '0')}
    </div>
  );
}
```

**Auto-Transition Logic**:
```typescript
// Supabase Edge Function: check-timer-completion
// Runs every 30 seconds via pg_cron

export async function checkTimerCompletion() {
  const { data: kits } = await supabase
    .from('kits')
    .select('*')
    .eq('status', 'EXPOSING')
    .lte('exposure_completed_at', new Date().toISOString());

  for (const kit of kits) {
    await supabase
      .from('kits')
      .update({ status: 'EXPOSURE_COMPLETE' })
      .eq('id', kit.id);
  }
}
```

### 3.3 Email Reminder System

**Architecture**: Supabase Edge Functions + pg_cron

**Job 1: Check for 48hr Reminders**
```typescript
// supabase/functions/send-48hr-reminder/index.ts

Deno.serve(async (req) => {
  const supabase = createClient(...);

  // Find kits ready for 48hr reminder
  const { data: kits } = await supabase
    .from('kits')
    .select('*')
    .eq('status', 'INCUBATING')
    .lte('lid_sealed_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .is('reminder_48hr_sent_at', null);

  for (const kit of kits) {
    // Create magic token
    const token = crypto.randomUUID();
    await supabase.from('magic_tokens').insert({
      kit_id: kit.id,
      token,
      action: 'UPLOAD_48HR_PHOTO',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Send email
    const magicLink = `https://yourapp.com/magic?token=${token}`;
    await sendEmail({
      to: kit.user_email,
      subject: '🔬 Time to Check Your Mold Test',
      html: `
        <h2>Your ${kit.location_name} test is ready for inspection</h2>
        <p>It's been 48 hours. Click below to upload your first photo:</p>
        <a href="${magicLink}">📸 Upload Photo Now</a>
      `,
    });

    // Update kit
    await supabase
      .from('kits')
      .update({
        status: 'AWAITING_48HR_PHOTO',
        reminder_48hr_sent_at: new Date().toISOString(),
      })
      .eq('id', kit.id);
  }

  return new Response('OK', { status: 200 });
});
```

**pg_cron Setup**:
```sql
-- Run every 15 minutes
SELECT cron.schedule(
  'check-48hr-reminders',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/send-48hr-reminder',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

**Alternative**: Use Vercel Cron Jobs (if deploying to Vercel)
```typescript
// app/api/cron/reminders/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Same logic as above
  await send48HrReminders();
  await send72HrReminders();

  return Response.json({ success: true });
}
```

### 3.4 Photo Upload & Validation

**Flow**:
1. User opens camera (native browser API)
2. Capture photo with overlay guide
3. Client-side validation (size, format)
4. Preview & confirm
5. Upload to Supabase Storage
6. Create database record
7. Update kit status

**Implementation**:
```typescript
// components/PhotoUploader.tsx
'use client';

export function PhotoUploader({ kit, photoType }: Props) {
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Start camera
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // Back camera
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  // Capture photo
  const capturePhoto = () => {
    const canvas = document.createElement('canvas');
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      setPhotoBlob(blob);
      // Stop camera
      video.srcObject.getTracks().forEach(track => track.stop());
    }, 'image/jpeg', 0.9);
  };

  // Upload to Supabase
  const uploadPhoto = async () => {
    const filePath = `kits/${kit.kit_id}/${photoType}.jpg`;

    // Upload to Storage
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('photos')
      .upload(filePath, photoBlob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (storageError) throw storageError;

    // Create photo record
    const { error: dbError } = await supabase
      .from('photos')
      .insert({
        kit_id: kit.id,
        photo_type: photoType,
        storage_path: filePath,
        file_size_bytes: photoBlob.size,
        mime_type: photoBlob.type,
      });

    if (dbError) throw dbError;

    // Update kit status
    const newStatus = photoType === '48HR'
      ? 'AWAITING_72HR_PHOTO'
      : 'COMPLETED';

    await supabase
      .from('kits')
      .update({ status: newStatus })
      .eq('id', kit.id);
  };

  return (
    <div className="relative">
      {!photoBlob ? (
        <>
          <video ref={videoRef} autoPlay playsInline className="w-full" />

          {/* Overlay Guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-4 border-teal-400 rounded-full opacity-50" />
          </div>

          <button onClick={capturePhoto} className="btn-primary">
            📸 Capture Photo
          </button>
        </>
      ) : (
        <>
          <img src={URL.createObjectURL(photoBlob)} alt="Preview" />

          <div className="flex gap-4">
            <button onClick={() => setPhotoBlob(null)} className="btn-secondary">
              Retake
            </button>
            <button onClick={uploadPhoto} className="btn-primary">
              Submit Photo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

### 3.5 Magic Link Deep Linking

**Flow**:
1. User clicks email link: `https://app.com/magic?token=abc123`
2. App validates token
3. Signs user in (Supabase Auth)
4. Redirects to specific kit upload page

**Implementation**:
```typescript
// app/magic/page.tsx
export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: { token: string };
}) {
  const supabase = createServerClient(...);

  // Validate token
  const { data: magicToken } = await supabase
    .from('magic_tokens')
    .select('*, kits(id, user_id)')
    .eq('token', searchParams.token)
    .gt('expires_at', new Date().toISOString())
    .is('used_at', null)
    .single();

  if (!magicToken) {
    return <div>Invalid or expired link</div>;
  }

  // Mark token as used
  await supabase
    .from('magic_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', magicToken.id);

  // Sign in user (create session)
  const { data: user } = await supabase.auth.admin.getUserById(
    magicToken.kits.user_id
  );

  // Create session (implementation depends on your auth setup)
  await supabase.auth.signInWithOtp({
    email: user.email,
  });

  // Redirect to upload page
  redirect(`/kit/${magicToken.kit_id}/upload?type=${magicToken.action}`);
}
```

---

## 4. Multi-Kit Dashboard Design

**Requirements**:
- See all kits at a glance
- Quick status overview
- Jump to active task for each kit

**UI Layout**:
```typescript
// app/page.tsx (Dashboard)
export default function Dashboard() {
  const { data: kits } = useQuery(['kits'], fetchKits);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {kits.map(kit => (
        <KitCard key={kit.id} kit={kit} />
      ))}

      <button className="border-2 border-dashed border-teal-400">
        + Add New Kit
      </button>
    </div>
  );
}

function KitCard({ kit }: { kit: Kit }) {
  const derived = useDerivedKitState(kit);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">{kit.location_name}</h3>
        <StatusBadge status={kit.status} />
      </div>

      {/* Primary Content - Conditional based on status */}
      {kit.status === 'EXPOSING' && (
        <div className="mb-4">
          <TimerDisplay kit={kit} />
          <ProgressBar value={derived.timerProgress} />
        </div>
      )}

      {kit.status === 'INCUBATING' && (
        <div className="mb-4 text-center">
          <p className="text-sm text-gray-600">First check-in</p>
          <p className="text-3xl font-bold text-teal-600">
            {derived.hoursUntil48hrCheck}h
          </p>
        </div>
      )}

      {kit.status === 'AWAITING_48HR_PHOTO' && (
        <div className="mb-4">
          <p className="text-lg font-semibold text-orange-600">
            📸 Photo Required
          </p>
          <p className="text-sm text-gray-600">48-hour check-in</p>
        </div>
      )}

      {/* Action Button */}
      <ActionButton kit={kit} derived={derived} />
    </div>
  );
}
```

---

## 5. Technology Recommendations

### 5.1 Required Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.5.0",
    "tailwindcss": "^3.4.0",
    "@headlessui/react": "^1.7.18",
    "clsx": "^2.1.0",
    "date-fns": "^3.0.0",
    "react-webcam": "^7.2.0",
    "qr-scanner": "^1.4.2"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.11.0"
  }
}
```

### 5.2 Supabase Configuration

**Storage Bucket**:
```sql
-- Create photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false);

-- RLS policy for photos bucket
CREATE POLICY "Users can upload photos for their kits"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = 'kits' AND
  auth.uid() IN (
    SELECT user_id FROM kits
    WHERE kit_id = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Users can view photos for their kits"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos' AND
  auth.uid() IN (
    SELECT user_id FROM kits
    WHERE kit_id = (storage.foldername(name))[2]
  )
);
```

**Auth Configuration**:
- Enable Email Provider (Magic Links)
- Set Magic Link Expiry: 24 hours
- Redirect URL: `https://yourapp.com/auth/callback`

---

## 6. Implementation Plan

### Phase 1: Foundation (Week 1)
1. ✅ Set up Next.js 15 project with App Router
2. ✅ Configure Supabase client (server & client components)
3. ✅ Create database schema and RLS policies
4. ✅ Implement auth flow (magic link login)
5. ✅ Build QR scanner page

### Phase 2: Core Timer Logic (Week 2)
1. ✅ Implement kit registration flow
2. ✅ Build "Start Test" page with timer component
3. ✅ Create server-side timer calculation utilities
4. ✅ Test timer persistence across page refreshes
5. ✅ Build "Seal Lid" confirmation flow

### Phase 3: Photo Upload (Week 3)
1. ✅ Implement camera component with overlay guide
2. ✅ Build photo preview & retake flow
3. ✅ Create Supabase Storage upload logic
4. ✅ Test photo upload for both 48hr & 72hr
5. ✅ Build photo gallery view (admin/lab side)

### Phase 4: Email Reminders (Week 4)
1. ✅ Set up Supabase Edge Functions
2. ✅ Implement 48hr reminder job
3. ✅ Implement 72hr reminder job
4. ✅ Configure pg_cron or Vercel Cron
5. ✅ Build magic link handler page
6. ✅ Test deep linking flow

### Phase 5: Multi-Kit Dashboard (Week 5)
1. ✅ Build dashboard layout
2. ✅ Implement kit card components
3. ✅ Add status badges and progress indicators
4. ✅ Build quick-action buttons
5. ✅ Polish UI/UX

### Phase 6: Testing & Polish (Week 6)
1. ✅ End-to-end testing (full user journey)
2. ✅ Mobile responsiveness testing
3. ✅ Performance optimization
4. ✅ Error handling & edge cases
5. ✅ Documentation

---

## 7. Key Technical Decisions Summary

| Decision Point | Chosen Approach | Rationale |
|----------------|----------------|-----------|
| **Timer Logic** | Server-side timestamps | Survives page refreshes, browser closes, network outages |
| **State Management** | TanStack Query + Zustand | Server state separate from UI state; minimal boilerplate |
| **Email System** | Supabase Edge Functions + pg_cron | Native to Supabase; reliable scheduling |
| **Photo Storage** | Supabase Storage | Integrated with RLS; CDN delivery |
| **Authentication** | Supabase Auth (Magic Links) | Passwordless; better UX for mobile |
| **Deep Linking** | Magic tokens table | Secure, trackable, expirable links |
| **State Machine** | Status column + timestamps | Simple, queryable, audit-friendly |
| **Frontend Framework** | Next.js 15 App Router | SSR for SEO; server components for performance |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Email deliverability | High | Use reputable provider (Resend/SendGrid); SPF/DKIM records |
| Timer drift on slow connections | Medium | Always calculate from server timestamps; client is display-only |
| Camera API browser support | Medium | Feature detection; fallback to file upload |
| Supabase free tier limits | Medium | Monitor usage; upgrade plan if needed |
| User closes browser during exposure | Low | Timer persists; status shown on dashboard return |

---

## 9. Next Steps

**To proceed with implementation, I recommend:**

1. **Review & Approve** this proposal
2. **Clarify ambiguities**:
   - What happens if a user starts a test but never seals the lid?
   - Can a user upload photos early (before 48/72 hours)?
   - Do you need a lab/admin portal to view submitted photos?
3. **Provision infrastructure**:
   - Create Supabase project
   - Set up email provider (Resend recommended)
   - Configure domain and SSL
4. **Begin Phase 1 implementation**

---

**Questions for Product Owner:**

1. Should users be able to pause/restart the exposure timer?
2. What happens to a kit if the user loses access to their email?
3. Do we need offline support (PWA/Service Worker)?
4. Should the lab receive notifications when photos are uploaded?
5. What photo quality requirements are needed (resolution, file size)?

---

**I'm ready to begin implementation once you approve this architecture.** 🚀
