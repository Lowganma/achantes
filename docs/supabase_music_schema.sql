-- Achantes: esquema mínimo para sync de música (Fase 5)
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  guest_name text not null,
  role text not null default 'guest' check (role in ('owner','guest')),
  created_at timestamptz not null default now(),
  primary key (room_id, guest_name)
);

create table if not exists public.music_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  module_item_id text not null,
  current_track_url text,
  current_video_id text,
  embed_url text,
  status text not null default 'paused' check (status in ('playing','paused')),
  position_ms int not null default 0,
  event_id text not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.music_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  module_item_id text not null,
  client_event_id text not null unique,
  event_type text not null check (event_type in ('MUSIC_PLAY','MUSIC_PAUSE','MUSIC_SEEK','MUSIC_CHANGE_TRACK')),
  payload jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_music_events_room_created_at on public.music_events (room_id, created_at desc);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.music_state enable row level security;
alter table public.music_events enable row level security;

-- MVP abierto: permite operación anónima desde frontend.
-- Luego se endurece con auth real.
create policy if not exists "rooms_all" on public.rooms for all using (true) with check (true);
create policy if not exists "room_members_all" on public.room_members for all using (true) with check (true);
create policy if not exists "music_state_all" on public.music_state for all using (true) with check (true);
create policy if not exists "music_events_all" on public.music_events for all using (true) with check (true);

alter publication supabase_realtime add table public.music_events;
