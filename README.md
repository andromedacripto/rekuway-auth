# Rekuway Auth — 3-Touch

MVP real de autenticação multidispositivo, security-first, sem senha.
`email → REKUWAY AUTH → prova adicional → acesso`.

Produto **independente** do Rekuway IDN AI: sem código, banco, API ou runtime compartilhado.

**Status:** MVP funcional, testado ponta a ponta (registro com passkey → 3-Touch → login → sessão → dashboard) em ambiente local Windows + Docker.

---

## Índice

- [O problema](#o-problema)
- [O protocolo 3-Touch](#o-protocolo-3-touch)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Troubleshooting](#troubleshooting-problemas-reais-encontrados-durante-o-setup)
- [Desenvolvimento](#desenvolvimento)
- [Testes](#testes)
- [CI](#ci)
- [Deploy](#deploy)
- [Limitações](#limitações)
- [Roadmap](#roadmap)

---

## O problema

Account Takeover causado por credenciais roubadas, credential stuffing, reutilização de senha
e phishing. O Rekuway Auth reduz esse risco exigindo uma prova que um atacante não consegue
obter apenas com uma senha vazada — porque **não existe senha**.

Este projeto **não promete segurança absoluta**. Veja [Limitações](#limitações).

---

## O protocolo 3-Touch

CONFIRME SEU ACESSO

■ ○ ▲
▲ ■ ○
○ ▲ ■


**Importante — leia isto antes de mexer no código:** a sequência de 3 símbolos **não é um fator
criptográfico**. Ela tem baixa entropia (≈7 bits com 6 símbolos) e é tratada exclusivamente como
uma camada de UX/confirmação de intenção, **sempre vinculada a uma autenticação WebAuthn já
verificada com sucesso**.

### Fluxo real de login
WebAuthn (fator criptográfico)
→ challenge assinado pelo autenticador (passkey)
→ servidor verifica challenge, origin, RP ID, assinatura, counter
→ sucesso emite um "intermediate nonce" (short-lived, single-use)
3-Touch (confirmação de intenção)
→ usuário toca a sequência
→ servidor exige o intermediate nonce válido — nunca aceita a sequência sozinha
→ sucesso cria a sessão

### Fluxo de registro (primeira vez)
WebAuthn cria a credencial (passkey)
→ servidor verifica e persiste a credencial
→ login automático (sessão criada), já que uma passkey nova
recém-verificada já é prova forte de identidade
3-Touch — o usuário define a sequência que vai usar depois pra confirmar logins

O servidor **nunca** aceita `POST /auth/login/3touch/verify` sem um `nonceId` que prove que o
WebAuthn já foi validado. Veja `apps/api/test/intermediateNonce.test.ts` e
`apps/api/test/http.test.ts` para os testes que garantem isso.

---

## Arquitetura

rekuway-auth/
├── apps/
│ ├── api/ Fastify + TypeScript strict — a API real
│ ├── web/ Next.js — login, registro, 3-touch, dashboard
│ └── mobile/ Expo/React Native — shell mínimo (veja limitações)
├── packages/
│ ├── auth-core/ estados, eventos, RiskEngine determinístico
│ ├── security/ IDs seguros, hash do 3-Touch, políticas (TTL, rate limit)
│ ├── shared/ schemas Zod, erros padronizados
│ └── config/ validação de env com Zod
├── prisma/schema.prisma
└── docker-compose.yml Postgres + Redis para desenvolvimento local


### WebAuthn / Passkeys

`@simplewebauthn/server` (v10) e `@simplewebauthn/browser` (v10) fazem toda a criptografia.
Nada de criptografia caseira. A chave privada nunca sai do dispositivo — o servidor só vê a
chave pública e verifica assinaturas.

**Detalhe crítico de implementação:** o `challenge` enviado ao navegador é gerado pela própria
biblioteca `@simplewebauthn/server` (nunca por nós) e persistido exatamente como ela retorna.
Gerar nosso próprio challenge e passá-lo para a lib causa dupla codificação base64url e quebra
a verificação — veja o comentário em `apps/api/src/lib/webauthn.ts`.

### Dispositivos

- **Web (desktop/mobile/tablet):** WebAuthn nativo do navegador, incluindo o fluxo
  cross-device (PC → celular via QR/hybrid transport), delegado ao navegador/SO.
- **Android:** Credential Manager / Passkeys / Android Keystore / BiometricPrompt.
- **iOS/iPadOS:** Passkeys / Keychain / Secure Enclave / LocalAuthentication (Face ID/Touch ID).
- Biometria **nunca** é enviada ao servidor — ela apenas desbloqueia a credencial local.

### Redis (temporário)

Challenges, intermediate nonces, rate limit counters, cache de sessão. TTL curto, single-use.
PostgreSQL continua sendo a fonte de verdade permanente.

### PostgreSQL (permanente)

`User`, `WebAuthnCredential`, `TouchSequence` (hash bcrypt, nunca plaintext), `Device`,
`Session`, `SecurityEvent`.

### Sessões

Server-side, **sem JWT**. Cookie `HttpOnly; Secure; SameSite=Strict` carrega só um ID opaco;
todo o estado real fica no Postgres (com cache em Redis). Revogação individual e "revoke all"
implementadas.

---

## Instalação

Pré-requisitos: Node.js 20+, pnpm 9+, Docker Desktop (aberto e rodando).

```bash
git clone <este-repositório>
cd rekuway-auth
pnpm install

cp .env.example .env
# gere SESSION_SECRET com: openssl rand -base64 48
# cole no .env

pnpm docker:up                 # sobe Postgres + Redis locais
```

**No Windows, o Prisma CLI precisa achar o `.env` na pasta onde ele é executado.** Copie o
`.env` também para dentro de `apps/api`:

```bash
cp .env apps/api/.env
```

Gere o client e crie as tabelas:

```bash
cd apps/api
pnpm exec prisma generate
pnpm exec prisma migrate dev
# quando pedir um nome para a migration, digite: init
```

Suba a API e o Web em terminais separados:

```bash
# terminal 1
cd apps/api
pnpm dev        # http://localhost:3001

# terminal 2
cd apps/web
pnpm dev        # http://localhost:3000
```

### Se estiver testando em uma nova sessão de terminal

Lembre de conferir que os containers Docker (`docker ps`) ainda estão de pé — se reiniciou o
PC, rode `pnpm docker:up` de novo antes de subir a API.

---

## Troubleshooting (problemas reais encontrados durante o setup)

Estes já foram corrigidos no código deste repositório, mas ficam documentados para referência
e para o caso de reaparecerem em outro ambiente:

| Sintoma | Causa | Correção |
|---|---|---|
| `Command failed: pnpm add prisma@... --silent` ao rodar `prisma generate` | O Prisma CLI tenta "auto-curar" quando não se enxerga como dependência direta do `package.json` mais próximo do diretório de execução | Instalar `prisma` e `@prisma/client` explicitamente tanto em `apps/api` quanto na raiz do workspace (`pnpm add ... -D -w`) |
| `Environment variable not found: DATABASE_URL` no `prisma migrate dev` | O Prisma CLI só lê `.env` do diretório onde é executado, não da raiz do monorepo | Copiar `.env` também para `apps/api/.env` |
| `fastify-plugin: @fastify/cors - expected '5.x' fastify version, '4.x' is installed` | Os plugins `@fastify/*` no `package.json` estavam pinados em versões pra Fastify 5, mas `fastify` está pinado em `^4.28.1` | Usar `@fastify/cors@^9`, `@fastify/helmet@^11`, `@fastify/rate-limit@^9`, `@fastify/cookie@^9` (compatíveis com Fastify 4) |
| `NOAUTH Authentication required` nos logs do Redis | O Docker Compose configura o Redis com senha, mas `REDIS_URL` no `.env` não incluía a senha | `REDIS_URL=redis://:SENHA@localhost:6379` (senha vem depois dos dois-pontos, sem usuário) |
| `Authentication could not be completed` no registro de passkey | Challenge gerado localmente e re-codificado pela lib `@simplewebauthn/server`, causando dupla codificação base64url | Deixar a própria lib gerar o challenge e persistir exatamente `options.challenge` |
| `401 Not authenticated` ao tentar definir a sequência 3-Touch logo após o registro | A rota de enrollment do 3-Touch exige sessão ativa, mas nenhuma sessão era criada durante o registro (só no login) | Criar sessão automaticamente logo após o WebAuthn de registro ser verificado com sucesso |
| `Error: Text content does not match server-rendered HTML` na tela do 3-Touch | O embaralhamento dos símbolos (`Math.random()`) rodava tanto no servidor (SSR) quanto no cliente, com resultados diferentes | Embaralhar só depois do componente montar no navegador (`useEffect`), nunca durante a renderização inicial |

---

## Desenvolvimento

```bash
pnpm lint                      # ESLint (security-first ruleset)
pnpm typecheck                 # TypeScript strict em todo o monorepo
pnpm test                      # Vitest — apps/api
pnpm format                    # Prettier
pnpm security:audit            # npm audit
pnpm security:secrets          # gitleaks
pnpm verify                    # tudo acima
```

O Husky roda lint + typecheck em todo commit (`.husky/pre-commit`), depois de `git init` +
primeiro commit.

---

## Testes

`apps/api/test/` cobre:

- **Challenge Layer:** criação, single-use, anti-replay, expiração, bloqueio por tentativas
  (`challengeStore.test.ts`)
- **3-Touch binding:** o nonce intermediário é obrigatório e single-use
  (`intermediateNonce.test.ts`)
- **Sequência 3-Touch:** hash bcrypt, nunca plaintext, verificação correta/incorreta
  (`touchSequence.test.ts`)
- **Sessões:** criação, revogação, revoke-all (`sessionManager.test.ts`)
- **Rate limiting:** contador de janela fixa (`rateLimiter.test.ts`)
- **HTTP/integração:** validação Zod, payloads gigantes, proteção contra enumeração,
  security headers, rejeição de sessão forjada, rejeição de WebAuthn fabricado, rejeição de
  3-touch sem nonce (`http.test.ts`)

**Limitação de teste documentada:** os testes acima cobrem toda a lógica de servidor
(challenge lifecycle, sessões, rate limiting, binding do 3-Touch) e confirmam que payloads
WebAuthn fabricados são corretamente rejeitados. Eles **não** simulam uma cerimônia WebAuthn
real ponta-a-ponta com um autenticador virtual — isso foi validado manualmente com uma passkey
real (Windows Hello / Gestor de Palavras-passe do Google) durante o desenvolvimento.

```bash
cd apps/api
pnpm test
```

---

## CI

`.github/workflows/ci.yml`: install → lint → typecheck → prisma migrate → test → build →
`npm audit` → gitleaks. PR não é mergeável com falhas.

---

## Deploy

| Camada | Sugestão | Por quê |
|---|---|---|
| `apps/web` | Vercel | Next.js nativo, HTTPS automático (exigido por WebAuthn) |
| `apps/api` | Railway / Render | Container simples, sem lock-in |
| PostgreSQL | Neon | Postgres padrão, branching, tier gratuito |
| Redis | Upstash | Protocolo redis padrão, tier gratuito |

Nenhuma dessas escolhas prende a arquitetura ao fornecedor — API roda em qualquer container,
banco é Postgres padrão, Redis é protocol-compatible.

**Antes de ir pra produção:** trocar `RP_ID` e `ORIGIN` no `.env` para o domínio real, gerar um
`SESSION_SECRET` novo (nunca reutilizar o de desenvolvimento), e configurar `CORS_ORIGINS` com
o domínio real do frontend.

---

## Limitações

Documentadas de propósito, não escondidas:

1. **Sem recovery de conta.** Perder todos os dispositivos com passkey = perder acesso. Um
   fluxo de recovery seguro exige um threat model próprio, fora do escopo deste MVP.
2. **Mobile é um shell mínimo.** Expo *managed workflow* não expõe uma cerimônia WebAuthn
   nativa completa via Secure Enclave/Keystore sem um módulo nativo customizado. Este MVP
   direciona a cerimônia real para o navegador do sistema (que já tem suporte nativo). Um
   módulo nativo dedicado é o próximo passo documentado, não uma simulação.
3. **Dispositivo comprometido** (malware, root/jailbreak) pode comprometer qualquer
   armazenamento local — Keystore/Secure Enclave mitigam, não eliminam.
4. **3-Touch é UX, não criptografia.** Quem observa o usuário tocando aprende a sequência.
5. **Fluxo cross-device (PC → celular)** depende do suporte do navegador/SO ao WebAuthn
   hybrid transport — não é garantido em todo ambiente.
6. **Sem 2FA de fallback (SMS/TOTP)** — decisão deliberada para não introduzir um bypass
   menos seguro que o próprio WebAuthn.

Nunca afirme "100% seguro", "impossível de hackear" ou "elimina fraude" sobre este sistema.

---

## Roadmap

- WebAuthn PRF extension (documentado, não obrigatório neste MVP)
- Módulo nativo mobile para cerimônia WebAuthn in-app completa
- Fluxo de recovery com threat model dedicado
- Observabilidade (métricas, tracing) além de `/health` e `/ready`
- Testes automatizados com autenticador WebAuthn virtual (CDP/Playwright)

---

## Licença

MIT — veja `LICENSE`.