# Operação da automação de afiliados

## Agendamento

- `/api/enqueue`: todos os dias às 03:00 UTC (00:00 no horário de Brasília). Identifica produtos elegíveis, processa uma fila limitada e chama a função de publicação protegida.
- `/api/automation-worker`: todos os dias às 03:15 UTC (00:15 no horário de Brasília). Processa uma segunda leva limitada e tenta publicar os rascunhos prontos.
- Os dois endpoints exigem `Authorization: Bearer <CRON_SECRET>`. Não remova essa validação.

## Variáveis no Vercel (Production)

- `CRON_SECRET`: segredo usado pelos cron jobs.
- `SUPABASE_SERVICE_ROLE_KEY`: chave de serviço do Supabase; deve permanecer secreta.
- `SUPABASE_URL`: somente a URL raiz do projeto, no formato `https://<project-ref>.supabase.co`. Não acrescente `/rest/v1` nem `/functions/v1`.

## Secrets das Edge Functions do Supabase

A publicação Meta fica bloqueada por padrão. Antes de habilitá-la, configure os seguintes secrets no projeto correto:

- `META_PUBLISHING_ENABLED`: manter como `false` até validar os acessos e o produto de teste.
- `FACEBOOK_PAGE_ID`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_ACCOUNT_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `META_GRAPH_API_VERSION` (opcional; o código usa `v26.0` por padrão).

Nunca grave tokens no repositório, no navegador ou em mensagens de chat. Não registre tokens nos logs.

## Requisitos do produto

A fila só deve incluir produtos ativos, identificados como afiliados, com publicação automática aprovada, URL de afiliado HTTPS e imagem pública HTTPS. Não habilite registros de teste/placeholder. Ative `auto_publish` apenas para cada produto real depois de revisar título, preço, imagem e link.

A função `publish-affiliate-posts` é a única responsável por publicar no Facebook e Instagram; ela verifica a flag de habilitação, os secrets e a elegibilidade do produto, e registra o identificador retornado pela Meta.

## Estado verificado em 27/10/2026

- Há 11 registros de produtos; os placeholders não têm imagem e permanecem com publicação automática desativada.
- O produto real cadastrado também está com `auto_publish = false`.
- Não há produtos elegíveis para publicação automática, nem posts ou tarefas pendentes no momento da verificação.
- Portanto, a infraestrutura está preparada, mas nenhuma publicação real deve ser considerada ativa até configurar e testar os secrets da Meta e aprovar ao menos um produto.
