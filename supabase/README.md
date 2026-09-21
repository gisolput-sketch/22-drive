# 22 DRIVE — configuração Supabase

## 1. Banco
Abra o **SQL Editor** do projeto Supabase e execute:

supabase/schema.sql

Isso cria:
- public.reservas
- public.passageiros
- RPC salvar_passageiro()
- RPC buscar_passageiro()
- Realtime para public.reservas

## 2. Fluxo
Passageiro cria uma reserva -> INSERT em public.reservas -> Realtime entrega o evento ao painel do motorista.

A etapa de push para o aplicativo quando ele estiver fechado precisa de uma Edge Function e de credenciais do provedor de Web Push/FCM. Não coloque service-role key no GitHub.

## 3. Segurança
As policies deste arquivo são de protótipo, pois o painel atual ainda usa login local. Antes de colocar o sistema em produção, o motorista deve usar Supabase Auth e as policies devem restringir alterações ao motorista autenticado.

## 4. Publicação
Depois de executar o SQL, o próximo ajuste é ligar index.html e motorista.html ao Realtime, substituindo a dependência de localStorage para reservas entre aparelhos.
