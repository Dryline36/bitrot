-- BIT ROT: ROT METER (additive only, bitrot_ prefix). RLS on, no client policies: only the bitrot-rot edge function (service role) touches these.
create table if not exists public.bitrot_rot_meter (
  id smallint primary key default 1 check (id = 1),
  level numeric(7,3) not null default 100 check (level between 0 and 100),   -- level as of last_updated
  last_updated timestamptz not null default now(),
  decay_per_hour numeric(6,3) not null default 1,     -- % lost per hour
  feed_amount numeric(6,3) not null default 5,        -- % gained per feed
  streak_goal int not null default 7,                 -- consecutive UTC days for WL
  total_feeds bigint not null default 0,
  last_fed_at timestamptz,
  last_fed_by text
);
insert into public.bitrot_rot_meter (id) values (1) on conflict (id) do nothing;

create table if not exists public.bitrot_rot_streaks (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{40}$'),
  streak int not null default 0,
  best_streak int not null default 0,
  total_feeds int not null default 0,
  last_fed_day date,
  last_fed_at timestamptz,
  wl_eligible boolean not null default false,
  wl_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bitrot_rot_feeds (
  id bigserial primary key,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  day date not null,
  nonce text not null unique,
  level_before numeric(7,3) not null,
  level_after numeric(7,3) not null,
  fed_at timestamptz not null default now(),
  unique (wallet, day)
);

alter table public.bitrot_rot_meter enable row level security;
alter table public.bitrot_rot_streaks enable row level security;
alter table public.bitrot_rot_feeds enable row level security;
revoke all on public.bitrot_rot_meter, public.bitrot_rot_streaks, public.bitrot_rot_feeds from anon, authenticated;
revoke all on sequence public.bitrot_rot_feeds_id_seq from anon, authenticated;

-- current meter level with decay applied
create or replace function public.bitrot_rot_level(m public.bitrot_rot_meter, t timestamptz default now())
returns numeric language sql stable set search_path = public as $$
  select greatest(0, least(100, m.level - m.decay_per_hour * extract(epoch from (t - m.last_updated)) / 3600.0))
$$;

-- read state (+ one wallet's streak). Effective streak drops to 0 once a UTC day is missed.
create or replace function public.bitrot_rot_get(p_wallet text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.bitrot_rot_meter; s public.bitrot_rot_streaks; today date := (now() at time zone 'utc')::date;
begin
  select * into m from public.bitrot_rot_meter where id = 1;
  if p_wallet is not null then select * into s from public.bitrot_rot_streaks where wallet = lower(p_wallet); end if;
  return jsonb_build_object(
    'level', round(public.bitrot_rot_level(m), 3), 'decay_per_hour', m.decay_per_hour, 'feed_amount', m.feed_amount,
    'streak_goal', m.streak_goal, 'total_feeds', m.total_feeds, 'last_fed_at', m.last_fed_at, 'server_time', now(), 'today', today,
    'wallet', case when p_wallet is null then null else jsonb_build_object(
      'wallet', lower(p_wallet),
      'streak', case when s.last_fed_day >= today - 1 then s.streak else 0 end,
      'best_streak', coalesce(s.best_streak, 0), 'total_feeds', coalesce(s.total_feeds, 0),
      'fed_today', coalesce(s.last_fed_day = today, false), 'last_fed_at', s.last_fed_at,
      'wl_eligible', coalesce(s.wl_eligible, false)) end);
end $$;

-- feed: one per wallet per UTC day, atomic
create or replace function public.bitrot_rot_feed(p_wallet text, p_nonce text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.bitrot_rot_meter; s public.bitrot_rot_streaks; w text := lower(p_wallet);
  today date := (now() at time zone 'utc')::date; cur numeric; nxt numeric; ns int;
begin
  if w !~ '^0x[0-9a-f]{40}$' then return jsonb_build_object('error', 'bad_wallet'); end if;
  select * into m from public.bitrot_rot_meter where id = 1 for update;
  cur := public.bitrot_rot_level(m); nxt := least(100, cur + m.feed_amount);
  begin
    insert into public.bitrot_rot_feeds (wallet, day, nonce, level_before, level_after) values (w, today, p_nonce, cur, nxt);
  exception when unique_violation then
    return jsonb_build_object('error', 'already_fed') || public.bitrot_rot_get(w);
  end;
  update public.bitrot_rot_meter set level = nxt, last_updated = now(), total_feeds = total_feeds + 1, last_fed_at = now(), last_fed_by = w where id = 1;
  select * into s from public.bitrot_rot_streaks where wallet = w for update;
  ns := case when s.wallet is not null and s.last_fed_day = today - 1 then s.streak + 1 else 1 end;
  insert into public.bitrot_rot_streaks as x (wallet, streak, best_streak, total_feeds, last_fed_day, last_fed_at, wl_eligible, wl_at)
    values (w, ns, ns, 1, today, now(), ns >= m.streak_goal, case when ns >= m.streak_goal then now() end)
  on conflict (wallet) do update set streak = ns, best_streak = greatest(x.best_streak, ns), total_feeds = x.total_feeds + 1,
    last_fed_day = today, last_fed_at = now(), wl_eligible = x.wl_eligible or ns >= m.streak_goal,
    wl_at = coalesce(x.wl_at, case when ns >= m.streak_goal then now() end);
  return jsonb_build_object('ok', true, 'level_before', round(cur, 3)) || public.bitrot_rot_get(w);
end $$;

revoke all on function public.bitrot_rot_level(public.bitrot_rot_meter, timestamptz) from public, anon, authenticated;
revoke all on function public.bitrot_rot_get(text) from public, anon, authenticated;
revoke all on function public.bitrot_rot_feed(text, text) from public, anon, authenticated;
grant execute on function public.bitrot_rot_get(text), public.bitrot_rot_feed(text, text), public.bitrot_rot_level(public.bitrot_rot_meter, timestamptz) to service_role;
grant all on public.bitrot_rot_meter, public.bitrot_rot_streaks, public.bitrot_rot_feeds to service_role;
grant usage on sequence public.bitrot_rot_feeds_id_seq to service_role;

-- WL list: select * from public.bitrot_rot_wl;
create or replace view public.bitrot_rot_wl with (security_invoker = true) as
  select wallet, wl_at, best_streak, total_feeds, last_fed_at from public.bitrot_rot_streaks where wl_eligible order by wl_at;
revoke all on public.bitrot_rot_wl from anon, authenticated;
grant select on public.bitrot_rot_wl to service_role;
