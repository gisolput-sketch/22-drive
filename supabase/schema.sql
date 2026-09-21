-- 22 DRIVE — Supabase base
-- Execute no SQL Editor do projeto Supabase.
-- Protótipo: as políticas públicas permitem o fluxo sem login.
-- Para produção, recomenda-se migrar o painel do motorista para Supabase Auth.

create extension if not exists pgcrypto;

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  passenger_name text not null,
  passenger_phone text not null,
  passenger_email text,
  trip_type text not null default 'ida',
  travel_date date not null,
  travel_time time not null,
  return_date date,
  return_time time,
  origin text not null,
  destination text not null,
  distance_km numeric(10,2) default 0,
  passengers integer not null default 1,
  baggage text,
  observation text,
  payment_method text,
  payment_date date,
  sound_preference text,
  music_style text,
  music_artist text,
  trip_value numeric(10,2) default 0,
  toll_value numeric(10,2) default 0,
  total_value numeric(10,2) default 0,
  deposit_value numeric(10,2) default 0,
  status text not null default 'new'
    check (status in ('new','accepted','confirmed','cancelled','finished')),
  driver_name text,
  driver_phone text,
  accepted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_date date,
  confirmed_time time,
  confirm_note text,
  cancelled_at timestamptz,
  cancelled_by text,
  finished_at timestamptz,
  public_token uuid not null default gen_random_uuid()
);

create index if not exists reservas_status_created_idx
  on public.reservas(status, created_at desc);

create index if not exists reservas_schedule_idx
  on public.reservas(travel_date, travel_time);

alter table public.reservas enable row level security;

-- Permite ao site público criar solicitações.
drop policy if exists "public can insert reservas" on public.reservas;
create policy "public can insert reservas"
on public.reservas for insert
to anon, authenticated
with check (true);

-- Permite o painel consultar solicitações no protótipo.
drop policy if exists "public can read reservas" on public.reservas;
create policy "public can read reservas"
on public.reservas for select
to anon, authenticated
using (true);

-- Permite ao painel atualizar o fluxo da viagem no protótipo.
drop policy if exists "public can update reservas" on public.reservas;
create policy "public can update reservas"
on public.reservas for update
to anon, authenticated
using (true)
with check (true);

-- Realtime: habilita eventos da tabela para o painel.
do $$
begin
  alter publication supabase_realtime add table public.reservas;
exception
  when duplicate_object then null;
end $$;

-- Cadastro do passageiro, compatível com o RPC já chamado pelo site.
create table if not exists public.passageiros (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null,
  whatsapp text not null unique,
  email text,
  favoritos jsonb not null default '[]'::jsonb
);

alter table public.passageiros enable row level security;

drop policy if exists "public can read passageiros" on public.passageiros;
create policy "public can read passageiros"
on public.passageiros for select
to anon, authenticated
using (true);

drop policy if exists "public can insert passageiros" on public.passageiros;
create policy "public can insert passageiros"
on public.passageiros for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update passageiros" on public.passageiros;
create policy "public can update passageiros"
on public.passageiros for update
to anon, authenticated
using (true)
with check (true);

create or replace function public.salvar_passageiro(
  p_nome text,
  p_whatsapp text,
  p_email text default null,
  p_favoritos jsonb default '[]'::jsonb
)
returns public.passageiros
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.passageiros;
begin
  insert into public.passageiros(nome, whatsapp, email, favoritos)
  values (p_nome, p_whatsapp, p_email, coalesce(p_favoritos, '[]'::jsonb))
  on conflict (whatsapp)
  do update set
    nome = excluded.nome,
    email = excluded.email,
    favoritos = excluded.favoritos
  returning * into result;

  return result;
end;
$$;

grant execute on function public.salvar_passageiro(text,text,text,jsonb)
to anon, authenticated;

-- Função simples para o site localizar cadastro pelo WhatsApp.
create or replace function public.buscar_passageiro(p_whatsapp text)
returns public.passageiros
language sql
security definer
set search_path = public
as $$
  select * from public.passageiros
  where whatsapp = p_whatsapp
  limit 1;
$$;

grant execute on function public.buscar_passageiro(text)
to anon, authenticated;
