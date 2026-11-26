-- Unified Sijil: verified email / Google identities with backward-compatible phone rows.
-- Never merge an existing phone identity with a different email identity automatically.
alter table public.profiles alter column phone_e164 drop not null;
alter table public.profiles add column if not exists email text;
create unique index if not exists profiles_verified_email_unique
  on public.profiles (lower(email)) where email is not null;

alter table public.customer_links add column if not exists customer_email text;
create unique index if not exists customer_links_business_email_unique
  on public.customer_links (business_id, lower(customer_email))
  where customer_email is not null;

create index if not exists customer_links_email_lookup_idx
  on public.customer_links (lower(customer_email))
  where customer_email is not null;

-- Only verified email/phone identities acquire profile rows or pending invitations.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_phone text;
  v_email text;
begin
  if new.phone_confirmed_at is not null and nullif(trim(new.phone), '') is not null
     and '+' || ltrim(trim(new.phone), '+') ~ '^\+[1-9][0-9]{7,14}$' then
    v_phone := '+' || ltrim(trim(new.phone), '+');
  end if;

  if new.email_confirmed_at is not null and nullif(trim(new.email), '') is not null
     and length(trim(new.email)) <= 254 then
    v_email := lower(trim(new.email));
  end if;

  if v_phone is null and v_email is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sijil-user:' || new.id::text, 0));
  insert into public.profiles (id, phone_e164, email, preferred_locale)
  values (
    new.id, v_phone, v_email,
    case when new.raw_user_meta_data ->> 'preferred_locale' = 'ckb' then 'ckb' else 'ar' end
  )
  on conflict (id) do update
  set phone_e164 = coalesce(excluded.phone_e164, public.profiles.phone_e164),
      email = coalesce(excluded.email, public.profiles.email);

  if v_phone is not null then
    perform pg_advisory_xact_lock(hashtextextended('invite-phone:' || v_phone, 0));
    update public.customer_links cl set customer_user_id = new.id
    where cl.customer_phone_e164 = v_phone
      and cl.status = 'invited' and cl.customer_user_id is null
      and not exists (
        select 1 from public.customer_links existing
        where existing.business_id = cl.business_id and existing.customer_user_id = new.id
      );
  end if;

  if v_email is not null then
    perform pg_advisory_xact_lock(hashtextextended('invite-email:' || v_email, 0));
    update public.customer_links cl set customer_user_id = new.id
    where lower(cl.customer_email) = v_email
      and cl.status = 'invited' and cl.customer_user_id is null
      and not exists (
        select 1 from public.customer_links existing
        where existing.business_id = cl.business_id and existing.customer_user_id = new.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert or update of phone, phone_confirmed_at, email, email_confirmed_at on auth.users
for each row execute function public.handle_new_auth_user();

-- Reconcile verified existing identities and invites without modifying balances/transactions.
insert into public.profiles (id, phone_e164, email, preferred_locale)
select u.id,
       case when u.phone_confirmed_at is not null and nullif(trim(u.phone), '') is not null
         and '+' || ltrim(trim(u.phone), '+') ~ '^\+[1-9][0-9]{7,14}$'
         then '+' || ltrim(trim(u.phone), '+') else null end,
       case when u.email_confirmed_at is not null and nullif(trim(u.email), '') is not null
         then lower(trim(u.email)) else null end,
       case when u.raw_user_meta_data ->> 'preferred_locale' = 'ckb' then 'ckb' else 'ar' end
from auth.users u
where u.phone_confirmed_at is not null or u.email_confirmed_at is not null
on conflict (id) do update
set phone_e164 = coalesce(excluded.phone_e164, public.profiles.phone_e164),
    email = coalesce(excluded.email, public.profiles.email);

update public.customer_links cl set customer_user_id = p.id
from public.profiles p
join auth.users u on u.id = p.id
where cl.status = 'invited' and cl.customer_user_id is null
  and cl.customer_email is not null
  and p.email is not null and u.email_confirmed_at is not null
  and lower(cl.customer_email) = p.email
  and not exists (
    select 1 from public.customer_links existing
    where existing.business_id = cl.business_id and existing.customer_user_id = p.id
  );

-- Merchant-only, verified-email invitation creator. Client writes remain RPC-only.
create or replace function public.add_customer_email(
  p_email text, p_display_name text, p_credit_limit_iqd bigint
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_business_id uuid;
  v_customer_user_id uuid;
  v_link_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into v_business_id from public.businesses
  where owner_user_id = auth.uid();
  if v_business_id is null then raise exception 'Business not found'; end if;
  if not public.merchant_write_allowed(v_business_id) then
    raise exception 'Subscription required; account is read-only';
  end if;

  if length(v_email) < 5 or length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email address';
  end if;
  if length(trim(coalesce(p_display_name, ''))) not between 1 and 120 then
    raise exception 'Invalid customer name';
  end if;
  if p_credit_limit_iqd is null or p_credit_limit_iqd < 0 then
    raise exception 'Credit limit cannot be negative';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('invite-email:' || v_email, 0));
  select p.id into v_customer_user_id
  from public.profiles p join auth.users u on u.id = p.id
  where p.email = v_email
    and u.email_confirmed_at is not null
    and lower(trim(u.email)) = v_email;
  if v_customer_user_id = auth.uid() then
    raise exception 'You cannot invite yourself';
  end if;

  insert into public.customer_links (
    business_id, customer_user_id, customer_email,
    customer_display_name, credit_limit_iqd
  ) values (
    v_business_id, v_customer_user_id, v_email,
    trim(p_display_name), p_credit_limit_iqd
  ) returning id into v_link_id;

  if v_customer_user_id is not null then
    insert into public.notification_outbox (recipient_user_id, event_type, payload)
    values (v_customer_user_id, 'shop_link_invitation', jsonb_build_object('link_id', v_link_id));
  end if;
  return v_link_id;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.add_customer_email(text, text, bigint) from public, anon;
grant execute on function public.add_customer_email(text, text, bigint) to authenticated;

-- Pseudonymize email identifiers too when an approved deletion is processed.
create or replace function public.process_account_deletion(
  p_user_id uuid, p_requested_at timestamptz, p_retention_policy_reference text
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_phone text;
  v_email text;
begin
  if nullif(trim(p_retention_policy_reference), '') is null then
    raise exception 'An approved retention policy reference is required';
  end if;

  perform 1 from public.account_deletion_requests
    where user_id = p_user_id and requested_at = p_requested_at for update;
  if not found then return false; end if;

  select p.phone_e164, p.email into strict v_phone, v_email
    from public.profiles p where p.id = p_user_id;

  if v_phone is not null then
    perform pg_advisory_xact_lock(hashtextextended('invite-phone:' || v_phone, 0));
  end if;
  if v_email is not null then
    perform pg_advisory_xact_lock(hashtextextended('invite-email:' || lower(v_email), 0));
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  perform 1 from public.businesses where owner_user_id = p_user_id for update;
  perform 1 from public.customer_links cl
    where cl.customer_user_id = p_user_id
       or exists (select 1 from public.businesses b
                  where b.id = cl.business_id and b.owner_user_id = p_user_id)
    order by cl.id for update of cl;

  with closed as (
    update public.ledger_transactions t
      set status = 'cancelled', responded_by = p_user_id, responded_at = now()
      from public.customer_links cl, public.businesses b
      where cl.id = t.customer_link_id and b.id = t.business_id
        and t.status = 'pending'
        and (cl.customer_user_id = p_user_id or b.owner_user_id = p_user_id)
      returning t.id
  )
  insert into public.transaction_events(transaction_id, actor_user_id, event_type, event_payload, idempotency_key)
  select id, null, 'cancelled', jsonb_build_object('reason','account_deleted'), gen_random_uuid()
    from closed;

  update public.customer_links
    set customer_user_id = null, customer_phone_e164 = null, customer_email = null,
        customer_display_name = 'حساب محذوف', status = 'blocked', credit_limit_iqd = 0
    where customer_user_id = p_user_id
       or (customer_user_id is null and status = 'invited' and
         ((v_phone is not null and customer_phone_e164 = v_phone) or
          (v_email is not null and lower(customer_email) = lower(v_email))));

  update public.customer_links cl set status = 'blocked'
    where cl.status = 'invited' and exists (
      select 1 from public.businesses b
      where b.id = cl.business_id and b.owner_user_id = p_user_id
    );

  update public.merchant_entitlements e
    set revenuecat_app_user_id = null, paid_until = null
    where exists (select 1 from public.businesses b
                  where b.id = e.business_id and b.owner_user_id = p_user_id);

  delete from auth.users where id = p_user_id;
  if not found then raise exception 'Authentication account not found'; end if;
  return true;
end;
$$;

revoke all on function public.process_account_deletion(uuid, timestamptz, text)
  from public, anon, authenticated, service_role;
