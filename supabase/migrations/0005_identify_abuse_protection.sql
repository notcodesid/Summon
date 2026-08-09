-- Identification cost and abuse protection.
--
-- Requests are keyed by SHA-256 hashes created in the Edge Function. Raw
-- Privy user ids and IP addresses are never stored in this log.

create table if not exists public.identify_request_log (
  request_id       uuid primary key,
  user_hash        text not null,
  ip_hash          text not null,
  requested_at     timestamptz not null default now(),
  outcome          text not null
                   check (outcome in ('started', 'succeeded', 'failed', 'denied')),
  error_code       text,
  http_status      smallint,
  latency_ms       integer,
  provider_status  smallint,
  detail           jsonb not null default '{}'::jsonb
);

create index if not exists identify_request_user_time_idx
  on public.identify_request_log (user_hash, requested_at desc);

create index if not exists identify_request_ip_time_idx
  on public.identify_request_log (ip_hash, requested_at desc);

alter table public.identify_request_log enable row level security;

revoke all on table public.identify_request_log from public, anon, authenticated;
grant select, insert, update, delete on table public.identify_request_log to service_role;

drop policy if exists identify_request_log_no_direct on public.identify_request_log;
create policy identify_request_log_no_direct
  on public.identify_request_log
  for all to anon, authenticated
  using (false)
  with check (false);

create or replace function public.enforce_identify_rate_limit(
  p_request_id uuid,
  p_user_hash text,
  p_ip_hash text,
  p_min_frequency_seconds integer,
  p_user_hour_limit integer,
  p_user_day_limit integer,
  p_ip_hour_limit integer
)
returns table (
  allowed boolean,
  error_code text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_latest timestamptz;
  v_user_hour_count integer;
  v_user_day_count integer;
  v_ip_hour_count integer;
  v_code text;
  v_retry integer;
begin
  -- Serialize requests sharing either identity. The fixed user-then-IP order
  -- avoids races and deadlocks across concurrent Edge Function instances.
  perform pg_advisory_xact_lock(hashtextextended('identify:user:' || p_user_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('identify:ip:' || p_ip_hash, 0));

  select max(requested_at)
    into v_latest
    from public.identify_request_log
   where user_hash = p_user_hash
      or ip_hash = p_ip_hash;

  if v_latest is not null
     and v_latest > v_now - make_interval(secs => p_min_frequency_seconds) then
    v_code := 'RATE_LIMIT_FREQUENCY';
    v_retry := greatest(
      1,
      ceil(
        extract(
          epoch from (
            v_latest + make_interval(secs => p_min_frequency_seconds) - v_now
          )
        )
      )::integer
    );
  end if;

  if v_code is null then
    select count(*)::integer
      into v_user_hour_count
      from public.identify_request_log
     where user_hash = p_user_hash
       and outcome <> 'denied'
       and requested_at >= v_now - interval '1 hour';

    select count(*)::integer
      into v_user_day_count
      from public.identify_request_log
     where user_hash = p_user_hash
       and outcome <> 'denied'
       and requested_at >= v_now - interval '24 hours';

    if v_user_hour_count >= p_user_hour_limit
       or v_user_day_count >= p_user_day_limit then
      v_code := 'RATE_LIMIT_USER';
      v_retry := 3600;
    end if;
  end if;

  if v_code is null then
    select count(*)::integer
      into v_ip_hour_count
      from public.identify_request_log
     where ip_hash = p_ip_hash
       and outcome <> 'denied'
       and requested_at >= v_now - interval '1 hour';

    if v_ip_hour_count >= p_ip_hour_limit then
      v_code := 'RATE_LIMIT_IP';
      v_retry := 3600;
    end if;
  end if;

  insert into public.identify_request_log (
    request_id,
    user_hash,
    ip_hash,
    requested_at,
    outcome,
    error_code,
    http_status
  )
  values (
    p_request_id,
    p_user_hash,
    p_ip_hash,
    v_now,
    case when v_code is null then 'started' else 'denied' end,
    v_code,
    case when v_code is null then null else 429 end
  );

  return query
  select
    v_code is null,
    v_code,
    case when v_code is null then 0 else v_retry end;
end;
$$;

revoke all on function public.enforce_identify_rate_limit(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.enforce_identify_rate_limit(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) to service_role;
