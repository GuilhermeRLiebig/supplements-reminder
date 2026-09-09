# Supplements Reminder 💊

PWA pessoal para cadastrar suplementos, receber lembretes persistentes no Telegram e registrar se cada dose foi tomada, adiada ou pulada.

## Stack

- React + TypeScript + Vite
- Cloudflare Workers + Static Assets
- Cloudflare D1 (SQLite serverless)
- Cloudflare Cron Triggers
- Telegram Bot API
- PWA instalável no iPhone

## Funcionalidades

- Cadastro de suplemento, dose, unidade, horário e dias da semana
- Lembretes repetidos enquanto a dose não for confirmada
- Botões `Tomei`, `+15 min` e `Pular hoje` diretamente no Telegram
- Histórico dos últimos 30 dias
- Adesão e streak
- Dashboard responsivo e instalável como PWA
- Painel protegido por um token pessoal
- Segredos fora do Git/GitHub

## 0. Pré-requisitos

- Node.js LTS
- npm
- Git
- conta gratuita Cloudflare
- Telegram

## 1. Instale as dependências

```bash
npm install
```

## 2. Entre na Cloudflare

```bash
npx wrangler login
```

## 3. Crie o banco D1

```bash
npx wrangler d1 create dosetrack-db
```

O comando retornará um `database_id`. Copie-o e substitua `COLE_AQUI_O_DATABASE_ID` em `wrangler.jsonc`.

## 4. Rode a migration

Banco local:

```bash
npm run db:migrate:local
```

Banco da Cloudflare:

```bash
npm run db:migrate:remote
```

## 5. Crie o bot no Telegram

1. No Telegram, abra `@BotFather`.
2. Envie `/newbot`.
3. Escolha nome e username.
4. Guarde o token retornado pelo BotFather.

Nunca coloque o token no GitHub.

## 6. Configure secrets locais

Copie:

```bash
cp .dev.vars.example .dev.vars
```

Edite `.dev.vars`:

```env
ADMIN_TOKEN=uma-chave-pessoal-grande
TELEGRAM_BOT_TOKEN=token-do-botfather
TELEGRAM_WEBHOOK_SECRET=um-segredo-so-com-letras-numeros-hifen-ou-underscore
TELEGRAM_PAIR_CODE=um-codigo-que-so-voce-sabe
```

`ADMIN_TOKEN` é a senha/bearer token do seu painel. Ela fica apenas no seu navegador e nos secrets do Worker, nunca no código.

## 7. Desenvolvimento local

```bash
npm run dev
```

Abra o endereço mostrado pelo Vite. No login, use o mesmo `ADMIN_TOKEN` de `.dev.vars`.

> O Telegram webhook é mais simples de testar depois do primeiro deploy HTTPS. O restante do app pode ser desenvolvido localmente.

## 8. Faça o primeiro deploy

Antes, cadastre os secrets na Cloudflare:

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put TELEGRAM_PAIR_CODE
```

Depois:

```bash
npm run deploy
```

Você receberá uma URL semelhante a:

```text
https://dosetrack.SEUSUBDOMINIO.workers.dev
```

## 9. Configure o webhook do Telegram

Substitua os valores abaixo e execute:

```bash
curl -X POST "https://api.telegram.org/botSEU_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://SEU_DOMINIO/telegram/webhook",
    "secret_token": "SEU_TELEGRAM_WEBHOOK_SECRET",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }'
```

Para verificar:

```bash
curl "https://api.telegram.org/botSEU_BOT_TOKEN/getWebhookInfo"
```

## 10. Pareie seu Telegram

Abra seu bot e envie:

```text
/start SEU_TELEGRAM_PAIR_CODE
```

O bot deve responder:

```text
✅ Supplemenrs Reminder conectado. Você receberá seus lembretes por aqui.
```

Entre em **Config** no painel e pressione **Testar notificação**.

## 11. Cadastre sua creatina

Exemplo:

- Nome: Creatina
- Dose: 5
- Unidade: g
- Horário: 14:00
- Dias: todos
- Repetir: 30 minutos
- Máximo: 4 lembretes

O Worker é executado pelo Cron a cada 5 minutos. Quando o horário chegar, ele cria a ocorrência do dia e envia o lembrete. Enquanto a ocorrência estiver `pending`, novos lembretes serão enviados no intervalo escolhido. Após o máximo configurado, vira `missed`.

## 12. Instale como PWA no iPhone

1. Abra a URL do Supplemenrs Reminder no iPhone.
2. Abra o menu Compartilhar.
3. Toque em **Adicionar à Tela de Início**.
4. Abra o Supplemenrs Reminder pelo novo ícone.

A V1 usa Telegram para as notificações. Web Push pode ser adicionado em uma próxima versão.

## Fluxo do sistema

```text
Cadastro no painel
      │
      ▼
Cloudflare D1
      │
      ▼
Cron a cada 5 min
      │
      ▼
Cria intake do dia
      │
      ▼
Telegram
  ┌───┼────────┐
  ▼   ▼        ▼
Tomei +15m    Pular
  │   │        │
  └───┴────────┘
      │
      ▼
Atualiza D1
      │
      ▼
Dashboard / histórico
```

## Banco

### supplements
Dados permanentes do suplemento.

### schedules
Horário, dias, timezone e política de repetição.

### intakes
Uma ocorrência por suplemento/agendamento/dia. É aqui que ficam `pending`, `taken`, `skipped` e `missed`.

### app_settings
Guarda configurações de runtime, como `telegram_chat_id`.

## Segurança

- `.dev.vars` está no `.gitignore`.
- Tokens do Telegram devem ser configurados com `wrangler secret put`.
- O painel exige `ADMIN_TOKEN` em todas as rotas `/api/*`.
- O webhook valida `X-Telegram-Bot-Api-Secret-Token`.
- O pareamento exige um código independente (`TELEGRAM_PAIR_CODE`).

Para uso pessoal isso é simples e suficiente. Se um dia o projeto virar multiusuário, substitua o token único por autenticação real (OAuth/Passkeys/etc.).

## GitHub

```bash
git init
git add .
git commit -m "feat: initial DoseTrack MVP"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/dosetrack.git
git push -u origin main
```

Antes de `git add`, confirme:

```bash
git status
```

Nunca envie `.dev.vars`.

## Deploy automático opcional via GitHub Actions

Crie no GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

em **Settings → Secrets and variables → Actions**. O workflow em `.github/workflows/deploy.yml` fará o deploy em pushes para `main`.

## Roadmap sugerido

### V1
- [x] PWA
- [x] CRUD básico de suplementos (criar/listar/editar/excluir)
- [x] agendamento semanal
- [x] Telegram
- [x] confirmação / adiar / pular
- [x] histórico
- [x] adesão e streak

### V1.1
- [ ] pausar/reativar suplemento
- [ ] calendário mensal
- [ ] filtros no histórico
- [ ] exportar CSV

### V2
- [ ] Web Push na própria PWA
- [ ] horários múltiplos para o mesmo suplemento
- [ ] lembrete baseado em refeição
- [ ] tema claro/escuro
- [ ] estatísticas por suplemento

### V3
- [ ] agente de linguagem natural (`"creatina 5g todo dia às 14"`)
- [ ] autenticação multiusuário
- [ ] Apple Health / HealthKit via app nativo, caso faça sentido

## Observação

Supplemenrs Reminder registra os horários e doses cadastrados pelo próprio usuário. Ele não recomenda doses nem substitui orientação médica ou nutricional.
