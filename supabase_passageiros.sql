-- 22 DRIVE — Cadastro de passageiros e endereços favoritos
-- Execute este SQL uma única vez no Supabase SQL Editor.

create table if not exists public.passageiros (
  id bigint generated always as identity primary key,
  nome text not null,
  whatsapp text not null unique,
  email text,
  favoritos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.passageiros enable row level security;

revoke all on table public.passageiros from anon, authenticated;

create or replace function public.salvar_passageiro(
  p_nome text,
  p_whatsapp text,
  p_email text default null,
  p_favoritos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp,''),'\D','','g');
  v_row public.passageiros;
begin
  if length(v_whatsapp) < 10 then
    raise exception 'WHATSAPP_INVALIDO';
  end if;

  insert into public.passageiros(nome, whatsapp, email, favoritos)
  values (
    trim(p_nome),
    v_whatsapp,
    nullif(trim(coalesce(p_email,'')),''),
    coalesce(p_favoritos,'[]'::jsonb)
  )
  on conflict (whatsapp) do update set
    nome = excluded.nome,
    email = excluded.email,
    favoritos = excluded.favoritos,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,
    'nome',v_row.nome,
    'whatsapp',v_row.whatsapp,
    'email',v_row.email,
    'favoritos',v_row.favoritos
  );
end;
$$;

create or replace function public.buscar_passageiro(p_whatsapp text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp,''),'\D','','g');
  v_row public.passageiros;
begin
  select * into v_row
  from public.passageiros
  where whatsapp=v_whatsapp
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id',v_row.id,
    'nome',v_row.nome,
    'whatsapp',v_row.whatsapp,
    'email',v_row.email,
    'favoritos',v_row.favoritos
  );
end;
$$;

revoke all on function public.salvar_passageiro(text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.buscar_passageiro(text) from public, anon, authenticated;

grant execute on function public.salvar_passageiro(text,text,text,jsonb) to anon, authenticated;
grant execute on function public.buscar_passageiro(text) to anon, authenticated;
