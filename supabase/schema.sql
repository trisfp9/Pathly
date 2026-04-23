-- Pathly Database Schema
-- Run this in Supabase SQL Editor

-- Profiles table
create table if not exists profiles (
  id uuid references auth.users primary key,
  name text,
  grade text,
  country text,
  target_country text,
  dream_college text,
  aiming_level text,
  major_interest text,
  gpa_range text,
  test_scores text,
  extracurricular_interests text[],
  time_available text,
  biggest_concern text,
  is_pro boolean default false,
  stripe_customer_id text,
  subscription_start date,
  xp integer default 0,
  streak integer default 0,
  last_active date,
  ai_messages_used integer default 0,
  ai_messages_this_month integer default 0,
  profile_strength integer default 0,
  extracurricular_recommendations jsonb,
  selected_extracurricular_categories text[],
  college_list_cache jsonb,
  daily_tip_cache jsonb,
  detailed_profile jsonb,
  current_activities jsonb,        -- array of activities the student has already done
  completed_activities jsonb,      -- array of activities they've marked as completed via the app
  profile_strength_breakdown jsonb, -- AI-computed breakdown { grades, activities, etc }
  profile_strength_updated_at timestamp with time zone,
  awards jsonb,                    -- array of { name, level, year, description }
  essay_text text,                 -- latest essay draft submitted by user
  essay_score integer,             -- AI grade 0-100 on latest submission
  essay_feedback jsonb,            -- AI feedback { strengths[], weaknesses[], rewrite_suggestions[] }
  essay_last_reviewed_at timestamp with time zone,
  roadmaps jsonb,                  -- array of SavedRoadmap objects with task checklists
  onboarding_completed boolean default false,
  created_at timestamp with time zone default now()
);

-- Safe migration for existing installs
alter table profiles add column if not exists current_activities jsonb;
alter table profiles add column if not exists completed_activities jsonb;
alter table profiles add column if not exists profile_strength_breakdown jsonb;
alter table profiles add column if not exists profile_strength_updated_at timestamp with time zone;
alter table profiles add column if not exists awards jsonb;
alter table profiles add column if not exists essay_text text;
alter table profiles add column if not exists essay_score integer;
alter table profiles add column if not exists essay_feedback jsonb;
alter table profiles add column if not exists essay_last_reviewed_at timestamp with time zone;
alter table profiles add column if not exists roadmaps jsonb;

-- Saved items table
create table if not exists saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  item_type text check (item_type in ('extracurricular','scholarship','college','competition')),
  item_id text not null,
  item_data jsonb not null,
  status text default 'interested',
  saved_at timestamp with time zone default now(),
  unique(user_id, item_id)
);

-- Chat messages table
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('user','assistant')),
  content text not null,
  created_at timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_saved_items_user_id on saved_items(user_id);
create index if not exists idx_chat_messages_user_created on chat_messages(user_id, created_at);

-- Row Level Security (idempotent — drop-then-create so this file can be re-run safely)
alter table profiles enable row level security;
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can delete own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can delete own profile" on profiles for delete using (auth.uid() = id);

alter table saved_items enable row level security;
drop policy if exists "Users can view own saved items" on saved_items;
drop policy if exists "Users can insert own saved items" on saved_items;
drop policy if exists "Users can update own saved items" on saved_items;
drop policy if exists "Users can delete own saved items" on saved_items;
create policy "Users can view own saved items" on saved_items for select using (auth.uid() = user_id);
create policy "Users can insert own saved items" on saved_items for insert with check (auth.uid() = user_id);
create policy "Users can update own saved items" on saved_items for update using (auth.uid() = user_id);
create policy "Users can delete own saved items" on saved_items for delete using (auth.uid() = user_id);

alter table chat_messages enable row level security;
drop policy if exists "Users can view own messages" on chat_messages;
drop policy if exists "Users can insert own messages" on chat_messages;
drop policy if exists "Users can delete own messages" on chat_messages;
create policy "Users can view own messages" on chat_messages for select using (auth.uid() = user_id);
create policy "Users can insert own messages" on chat_messages for insert with check (auth.uid() = user_id);
create policy "Users can delete own messages" on chat_messages for delete using (auth.uid() = user_id);
