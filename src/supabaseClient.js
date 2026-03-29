// SQL to run in Supabase SQL editor:
// create table if not exists messages (id uuid primary key default gen_random_uuid(), from_user text not null, to_user text not null, text text not null, created_at timestamptz default now(), read boolean default false);
// create table if not exists stories (id uuid primary key default gen_random_uuid(), user_id text not null, title text not null, body text not null, meta text, created_at timestamptz default now());
// alter table messages enable row level security;
// alter table stories enable row level security;
// create policy "allow all" on messages for all using (true);
// create policy "allow all" on stories for all using (true);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
