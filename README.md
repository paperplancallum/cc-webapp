# 🔬 Mold Testing Companion App

A mobile-web application that guides homeowners through a scientific mold testing process with precision timer logic, automated email reminders, and photo capture functionality.

## 🎯 Features

- **QR Code Registration**: Scan petri dish QR codes to register test kits
- **Precision Timer**: 60-minute exposure timer with server-side timestamp logic (survives page refreshes)
- **Multi-Kit Dashboard**: Manage multiple tests across different locations
- **Automated Email Reminders**: 48hr and 72hr incubation notifications with deep linking
- **Camera Integration**: Built-in photo capture with visual guides
- **Real-Time Status Updates**: Live timer updates and state synchronization
- **Secure Authentication**: Passwordless magic link login via email
- **Mobile-First Design**: Responsive UI optimized for mobile devices

## 🏗️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage)
- **State Management**: TanStack Query + Zustand
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth (Magic Links)

## 📦 Project Structure

```
cc-webapp/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/               # Magic link login
│   │   └── callback/            # Auth callback handler
│   ├── (dashboard)/             # Protected dashboard routes
│   │   └── page.tsx             # Multi-kit dashboard
│   ├── scan/                    # QR code scanner
│   ├── kit/[kitId]/             # Dynamic kit routes
│   │   ├── page.tsx             # Kit detail page
│   │   ├── start/               # Start exposure flow
│   │   ├── seal/                # Seal lid confirmation
│   │   └── upload/              # Photo upload
│   └── api/                     # API routes (future)
├── components/                   # React components
│   └── kit-card.tsx             # Reusable kit card
├── lib/                         # Utilities and logic
│   ├── supabase/                # Supabase clients
│   ├── hooks/                   # React Query hooks
│   └── utils/                   # Helper functions
│       ├── timer.ts             # Timer calculations
│       ├── kit-state.ts         # State machine logic
│       └── cn.ts                # Tailwind class merger
├── types/                       # TypeScript types
│   ├── database.types.ts        # Database schema types
│   └── kit.types.ts             # Derived state types
├── supabase/                    # Supabase configuration
│   ├── migrations/              # Database migrations
│   └── README.md                # Supabase setup guide
└── public/                      # Static assets
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account ([sign up free](https://supabase.com))

### 1. Clone and Install

```bash
git clone <repository-url>
cd cc-webapp
npm install
```

### 2. Set Up Supabase

Follow the detailed guide in [`supabase/README.md`](./supabase/README.md):

1. Create a new Supabase project
2. Run the database migration (`supabase/migrations/001_initial_schema.sql`)
3. Create the `photos` storage bucket
4. Copy your API keys

### 3. Configure Environment Variables

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Test the App

1. Navigate to `/login`
2. Enter your email and click "Send Magic Link"
3. Check your email and click the login link
4. You'll be redirected to the dashboard
5. Click "Scan Your First Kit" to start testing

## 📱 User Flow

### Complete Testing Journey

```
1. QR Scan → Register Kit with Location Name
                ↓
2. Start Test → Open petri dish lid, start 60min timer
                ↓
3. Timer Runs → (User can close browser, timer persists)
                ↓
4. Timer Complete → Notification to seal lid
                ↓
5. Seal Lid → Close petri dish, start incubation
                ↓
6. Wait 48hrs → Email reminder sent
                ↓
7. Upload Photo 1 → Capture first photo via camera
                ↓
8. Wait 72hrs → Email reminder sent
                ↓
9. Upload Photo 2 → Capture second photo
                ↓
10. Complete → Test finished, results analyzed by lab
```

## 🔐 Database Schema

### Core Tables

- **kits**: Tracks test kits and their state machine status
- **photos**: Stores photo metadata (48hr, 72hr)
- **magic_tokens**: Secure tokens for email deep links

### State Machine

The app uses a 7-state machine:

1. `REGISTERED` → Kit scanned, not started
2. `EXPOSING` → 60-minute timer running
3. `EXPOSURE_COMPLETE` → Timer done, awaiting lid seal
4. `INCUBATING` → Lid sealed, waiting 48 hours
5. `AWAITING_48HR_PHOTO` → Ready for first photo
6. `AWAITING_72HR_PHOTO` → Ready for second photo
7. `COMPLETED` → Test finished

See [`TECHNICAL_PROPOSAL.md`](./TECHNICAL_PROPOSAL.md) for full architecture details.

## ⏱️ Timer Logic (Critical Feature)

The timer uses **server-side timestamps** to ensure reliability:

```typescript
// Stored in database
exposure_started_at: "2025-01-15T10:00:00Z"
exposure_duration_minutes: 60

// Calculated on-demand
secondsRemaining = (started_at + duration) - NOW()
```

**Benefits:**
- ✅ Survives page refreshes
- ✅ Survives browser closures
- ✅ Works across devices (user can switch phones)
- ✅ No client-side state to manage

## 📧 Email Reminders (Future Implementation)

The database schema supports automated email reminders:

- **48hr reminder**: Sent via Supabase Edge Function + pg_cron
- **72hr reminder**: Same mechanism
- **Deep linking**: Email contains magic token that logs user in and opens camera

**Implementation Plan:**

1. Create Supabase Edge Functions (`supabase/functions/`)
2. Set up pg_cron jobs to check for reminders every 15 minutes
3. Generate magic tokens and send emails via Resend/SendGrid

See [`TECHNICAL_PROPOSAL.md`](./TECHNICAL_PROPOSAL.md) Section 3.3 for details.

## 🎨 UI/UX Design Principles

- **Color Coding**:
  - 🟢 **Teal/Green**: All good, proceed
  - 🟠 **Orange/Red**: Action required
  - 🔵 **Blue**: Informational

- **Visual Hierarchy**:
  - **Exposing**: Timer is the largest element
  - **Incubating**: "Hours until check-in" is prominent
  - **Photo Required**: Camera icon + CTA button

- **Tone**: Scientific but accessible, calming (users are worried about mold)

## 🧪 Testing Locally

### Manual Testing Checklist

1. **Registration**:
   - [ ] Scan QR code (or enter manually)
   - [ ] Name the kit location
   - [ ] Kit appears on dashboard

2. **Exposure Timer**:
   - [ ] Start 60-minute timer
   - [ ] Refresh page → timer shows correct remaining time
   - [ ] Close browser, reopen → timer still accurate
   - [ ] Timer auto-completes at 00:00

3. **Seal Lid**:
   - [ ] Confirmation checkbox required
   - [ ] Status changes to INCUBATING

4. **Photo Upload**:
   - [ ] Camera opens with overlay guide
   - [ ] Capture and preview photo
   - [ ] Retake option works
   - [ ] Photo uploads to Supabase Storage
   - [ ] Status updates after upload

5. **Multi-Kit**:
   - [ ] Register second kit
   - [ ] Both kits visible on dashboard
   - [ ] Can switch between kits

## 🚧 Future Enhancements

### Phase 2 Features (Not Yet Implemented)

- [ ] **Lab/Admin Portal**: Dashboard for lab technicians to view submitted photos
- [ ] **Email Reminder System**: Supabase Edge Functions + pg_cron
- [ ] **Magic Link Deep Linking**: One-click from email to camera
- [ ] **Photo Quality Validation**: Check resolution, file size, blur detection
- [ ] **Offline Support**: PWA with Service Worker for offline timer
- [ ] **Results Dashboard**: Show lab analysis results to users
- [ ] **Notifications**: Push notifications in addition to email
- [ ] **Export Data**: Download test history as PDF

### Technical Debt

- [ ] Add comprehensive error boundaries
- [ ] Implement retry logic for network failures
- [ ] Add loading skeletons for better perceived performance
- [ ] Write unit tests (Jest + React Testing Library)
- [ ] Add E2E tests (Playwright)
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Implement analytics (PostHog or Mixpanel)

## 🐛 Troubleshooting

### Camera Not Working

- **Check browser permissions**: Ensure camera access is granted
- **Use HTTPS**: Camera API requires secure context (https:// or localhost)
- **Try different browser**: Some browsers have better camera support

### Timer Not Updating

- **Check network connection**: Timer relies on server timestamp
- **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- **Clear cache**: Browser cache might be stale

### Auth Issues

- **Check email**: Magic link may be in spam folder
- **Link expired**: Magic links expire after 24 hours
- **Try incognito**: Rule out cookie/session issues

## 📄 License

[MIT](./LICENSE) – feel free to use this project for your own mold testing needs!

## 🤝 Contributing

This is a production-ready MVP. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For questions or issues:
- Open a GitHub issue
- Check the [Technical Proposal](./TECHNICAL_PROPOSAL.md) for architecture details
- Review the [Supabase Setup Guide](./supabase/README.md) for database configuration

---

Built with ❤️ for homeowners concerned about mold safety.
