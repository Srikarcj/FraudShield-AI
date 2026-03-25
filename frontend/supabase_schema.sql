-- Enable UUID generation
create extension if not exists "pgcrypto";

-- App user profile table linked to Supabase Auth users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text,
  name text,
  phone text,
  created_at timestamptz not null default now()
);

-- Safe migration for existing deployments created before `phone` existed
alter table if exists public.users add column if not exists phone text;

-- Prediction history table
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  input_type text not null,
  prediction smallint not null,
  confidence double precision not null,
  model_used text not null,
  created_at timestamptz not null default now()
);

-- Uploaded files table (optional)
create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  file_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_predictions_user_created_at on public.predictions(user_id, created_at desc);

-- Basic RLS (tighten for production)
alter table public.users enable row level security;
alter table public.predictions enable row level security;
alter table public.uploaded_files enable row level security;

-- Dev-only permissive policies. Replace with user-scoped policies in production.
drop policy if exists "dev_users_all" on public.users;
create policy "dev_users_all" on public.users for all using (true) with check (true);

drop policy if exists "dev_predictions_all" on public.predictions;
create policy "dev_predictions_all" on public.predictions for all using (true) with check (true);

drop policy if exists "dev_uploaded_files_all" on public.uploaded_files;
create policy "dev_uploaded_files_all" on public.uploaded_files for all using (true) with check (true);
