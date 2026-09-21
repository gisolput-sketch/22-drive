-- 22 DRIVE — Painel do motorista / solicitações pendentes
-- Execute no Supabase SQL Editor depois do SQL anterior.

alter table public.reservas
  add column if not exists status text not null default 'confirmada';

alter table public.reservas
  add column if not exists valor numeric(10,2);

alter table public.reservas
  add column if not exists forma_pagamento text;

alter table public.reservas
  add column if not exists observacoes text;

alter table public.reservas
  add column if not exists passageiros integer;

alter table public.reservas
  add column if not exists bagagem text;

alter table public.reservas
  add column if not exists som text;

alter table public.reservas
  add column if not exists estilo_musical text;

alter table public.reservas
  add column if not exists artista text;

create or replace function public.criar_solicitacao(
  p_data_ida date,
  p_hora_ida time,
  p_data_volta date default null,
  p_hora_volta time default null,
  p_tipo_viagem text default 'ida',
  p_nome text default '',
  p_whatsapp text default '',
  p_embarque text default '',
  p_destino text default '',
  p_valor numeric default null,
  p_forma_pagamento text default null,
  p_observacoes text default null,
  p_passageiros integer default null,
  p_bagagem text default null,
  p_som text default null,
  p_estilo_musical text default null,
  p_artista text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.reservas(
    data_ida,hora_ida,data_volta,hora_volta,tipo_viagem,nome,whatsapp,
    embarque,destino,status,valor,forma_pagamento,observacoes,passageiros,
    bagagem,som,estilo_musical,artista
  )
  values(
    p_data_ida,p_hora_ida,p_data_volta,p_hora_volta,p_tipo_viagem,p_nome,p_whatsapp,
    p_embarque,p_destino,'pendente',p_valor,p_forma_pagamento,p_observacoes,p_passageiros,
    p_bagagem,p_som,p_estilo_musical,p_artista
  )
  returning id into v_id;

  return jsonb_build_object('sucesso',true,'reserva_id',v_id,'status','pendente');
end;
$$;

create or replace function public.listar_solicitacoes_motorista()
returns setof public.reservas
language sql
security definer
set search_path = public
as $$
  select r.*
  from public.reservas r
  where r.status in ('pendente','confirmada','recusada')
  order by
    case when r.status='pendente' then 0 when r.status='confirmada' then 1 else 2 end,
    r.data_ida,
    r.hora_ida;
$$;

create or replace function public.confirmar_solicitacao(p_reserva_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservas;
  v_exists integer;
begin
  select * into r from public.reservas where id=p_reserva_id for update;
  if not found then raise exception 'RESERVA_NAO_ENCONTRADA'; end if;
  if r.status='confirmada' then
    return jsonb_build_object('sucesso',true,'reserva_id',r.id,'status','confirmada');
  end if;
  if r.status<>'pendente' then raise exception 'SOLICITACAO_NAO_PENDENTE'; end if;

  select count(*) into v_exists from public.reserva_horarios
  where (data=r.data_ida and hora=r.hora_ida)
     or (r.data_volta is not null and data=r.data_volta and hora=r.hora_volta);

  if v_exists>0 then raise exception 'HORARIO_OCUPADO'; end if;

  insert into public.reserva_horarios(reserva_id,data,hora)
  values(r.id,r.data_ida,r.hora_ida);
  if r.data_volta is not null and r.hora_volta is not null then
    insert into public.reserva_horarios(reserva_id,data,hora)
    values(r.id,r.data_volta,r.hora_volta);
  end if;

  update public.reservas set status='confirmada',updated_at=now() where id=r.id;
  return jsonb_build_object('sucesso',true,'reserva_id',r.id,'status','confirmada');
exception
  when unique_violation then
    raise exception 'HORARIO_OCUPADO';
end;
$$;

create or replace function public.recusar_solicitacao(p_reserva_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reservas set status='recusada',updated_at=now()
  where id=p_reserva_id and status='pendente';
  if not found then raise exception 'SOLICITACAO_NAO_PENDENTE'; end if;
  return jsonb_build_object('sucesso',true,'reserva_id',p_reserva_id,'status','recusada');
end;
$$;

revoke all on function public.criar_solicitacao(date,time,date,time,text,text,text,text,text,numeric,text,text,integer,text,text,text,text) from public,anon,authenticated;
revoke all on function public.listar_solicitacoes_motorista() from public,anon,authenticated;
revoke all on function public.confirmar_solicitacao(bigint) from public,anon,authenticated;
revoke all on function public.recusar_solicitacao(bigint) from public,anon,authenticated;

grant execute on function public.criar_solicitacao(date,time,date,time,text,text,text,text,text,numeric,text,text,integer,text,text,text,text) to anon,authenticated;
grant execute on function public.listar_solicitacoes_motorista() to anon,authenticated;
grant execute on function public.confirmar_solicitacao(bigint) to anon,authenticated;
grant execute on function public.recusar_solicitacao(bigint) to anon,authenticated;
