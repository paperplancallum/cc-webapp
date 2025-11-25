# Supabase Setup Instructions

## 1. Create a New Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization and region
4. Set a strong database password
5. Wait for the project to be provisioned (~2 minutes)

## 2. Run Database Migration

### Option A: Using Supabase Dashboard (SQL Editor)

1. Go to your project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the contents of `migrations/001_initial_schema.sql`
5. Click "Run" to execute the migration

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## 3. Create Storage Bucket

1. Go to "Storage" in the left sidebar
2. Click "Create new bucket"
3. Name: `photos`
4. Public: **No** (keep it private)
5. Click "Create bucket"

### Storage Policies

After creating the bucket, add these policies:

**Policy 1: Users can upload photos for their kits**
```sql
CREATE POLICY "Users can upload photos for their kits"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' AND
  auth.uid() IN (
    SELECT user_id FROM kits
    WHERE kit_id = (storage.foldername(name))[2]
  )
);
```

**Policy 2: Users can view photos for their kits**
```sql
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

## 4. Configure Authentication

1. Go to "Authentication" → "Providers"
2. Ensure "Email" is enabled
3. Configure email templates (optional):
   - Go to "Authentication" → "Email Templates"
   - Customize the "Magic Link" template

## 5. Get API Keys

1. Go to "Settings" → "API"
2. Copy the following values:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key**: `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

## 6. Update Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your-random-secret
```

## 7. Test the Setup

Run the app locally:

```bash
npm run dev
```

Visit `http://localhost:3000/login` and test the magic link authentication.

## Schema Overview

### Tables

- **kits**: Main table tracking test kits and their state
- **photos**: Stores metadata for uploaded photos
- **magic_tokens**: Secure tokens for email deep links

### Key Features

- ✅ Row Level Security (RLS) on all tables
- ✅ Automatic `updated_at` trigger on kits
- ✅ Indexes for performance
- ✅ Foreign key constraints with CASCADE delete
- ✅ Check constraints for valid enums
