// Database types generated from Supabase schema

export type KitStatus =
  | 'REGISTERED'
  | 'EXPOSING'
  | 'EXPOSURE_COMPLETE'
  | 'INCUBATING'
  | 'AWAITING_48HR_PHOTO'
  | 'AWAITING_72HR_PHOTO'
  | 'COMPLETED';

export type PhotoType = '48HR' | '72HR';

export type MagicTokenAction = 'UPLOAD_48HR_PHOTO' | 'UPLOAD_72HR_PHOTO';

export interface Kit {
  id: string;
  kit_id: string;
  user_id: string;
  location_name: string;
  status: KitStatus;
  exposure_started_at: string | null;
  exposure_duration_minutes: number;
  exposure_completed_at: string | null;
  lid_sealed_at: string | null;
  reminder_48hr_sent_at: string | null;
  reminder_72hr_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  kit_id: string;
  photo_type: PhotoType;
  storage_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
}

export interface MagicToken {
  id: string;
  kit_id: string;
  token: string;
  action: MagicTokenAction;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

// Database insert types (without auto-generated fields)
export type KitInsert = Omit<Kit, 'id' | 'created_at' | 'updated_at'>;
export type PhotoInsert = Omit<Photo, 'id' | 'uploaded_at'>;
export type MagicTokenInsert = Omit<MagicToken, 'id' | 'created_at'>;
