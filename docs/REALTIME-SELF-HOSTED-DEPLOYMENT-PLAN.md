# Self-hosted Supabase Realtime — deployment plan (JetFarm / Hetzner)

Status: **plan only — nothing applied.** Every production command below is human-run.
Prepared: 2026-10-19. Evidence: `tmp/realtime-plan/` (read-only probes against the live box).

Trigger: the 2026-10-18 production console capture shows repeated
`wss://supabase.818.quest/realtime/v1/websocket` connection failures. They are not cosmetic —
`AutoSyncService` uses realtime as its only *remote → local* pull trigger
(`src/services/AutoSyncService.ts:180-199`), so with no realtime server, another device's changes
reach this device only on the next manual/app-start sync.

---

## 1. What the box already has (verified 2026-10-19, read-only)

| Piece | State | Evidence |
|---|---|---|
| `realtime` service definition in compose | **present, never started** | `/home/deploy/apps/supabase/docker-compose.yml:159-192`, image `supabase/realtime:v2.76.5`, `container_name: realtime-dev.supabase-realtime` |
| Realtime container | **absent** (not even stopped) | `docker ps -a \| grep -i realtime` → no match |
| Kong routes `/realtime/v1/` (ws) | **already declared**, point at `realtime-dev.supabase-realtime:4000/socket` | `/home/deploy/apps/supabase/volumes/api/kong.yml:189-217`; blocked rest sub-routes at `:219-239` |
| TLS/edge | `supabase.818.quest → reverse_proxy 127.0.0.1:8000` (Kong). Caddy upgrades websockets without extra config | `/etc/caddy/apps/818-quest.caddy:11-14` |
| `_realtime` schema in the DB | present, 3 tables (init SQL is mounted at `docker-compose.yml:307`) | `pg_namespace` / `information_schema.tables` probe |
| `wal_level` | `logical`, `max_wal_senders=10`, `max_replication_slots=5`, **0 slots currently used** | `pg_settings` / `pg_replication_slots` probe |
| `supabase_realtime` publication | exists, **36 tables and all of them are `meatshopanti_*` / `crm_chat_messages`** | `pg_publication_tables` probe → `tmp/realtime-plan/publication-tables.txt` |
| Required env vars | `SECRET_KEY_BASE`, `JWT_SECRET`, `POSTGRES_*`, `ANON_KEY` present; **`REALTIME_DB_ENC_KEY` absent**, so compose falls back to the shipped default `supabaserealtime` (`docker-compose.yml:182`) | name-only grep of `/home/deploy/apps/supabase/.env` |
| Image reachability / size | registry reachable; `v2.76.5` = 129,325,260 bytes compressed (~123 MiB, uncompressed materially larger) | Docker Hub tag metadata |

**Conclusion: this is not a config-authoring problem.** Kong, Caddy, the DB schema and the compose
service are already in place. The gap is (a) one container that was never started, (b) JetFarm's
tables are not in the publication, and (c) one weak default secret.

## 2. Constraints that gate the decision

1. **The Supabase instance is shared with other client apps.** `supabase-db`, `supabase-kong`,
   `supabase-auth` etc. serve meatshopanti, bigasanone, tude-accounting, distribution-inventorypro
   and JetFarm from one box. Starting realtime and adding tables to `supabase_realtime` changes
   logical-decoding load for *every* app on it, and meatshopanti's 36 published tables start
   broadcasting the moment the server comes up. That is a cross-tenant behaviour change, not a
   JetFarm-only one.
2. **Memory is the binding limit, not disk.** `free -m`: 3819 MB total, 1146 MB available, and
   1524 MB of swap already in use across 22 containers. A BEAM/Phoenix realtime node is a
   long-lived Erlang VM: budget 150–400 MB resident. It will land on a box that is already swapping.
3. **Disk is now workable but thin:** `df -h /` shows 4.8 GB free (87 % used) and `docker system df`
   reports 10.34 GB of build cache. Clearing build cache first is the cheapest headroom.
4. **`REALTIME_DB_ENC_KEY` default.** Leaving it at `supabaserealtime` means the tenant config
   encryption key is the public stock value. Rotating it *after* the first boot is not free —
   the encrypted tenant rows must be re-seeded — so decide before starting.

## 3. Recommended sequence (human-run, one step at a time, each step reversible)

### Stage 0 — headroom, no service change
```bash
ssh hetzner 'docker builder prune -f && df -h / | tail -2 && free -m'
```
Expected: free disk rises; nothing restarts. Abort Stage 1 if `available` is still under ~1 GB.

### Stage 1 — set the realtime secrets before first boot (operator only)
Append to `/home/deploy/apps/supabase/.env` (never commit, never paste values anywhere):
```
REALTIME_DB_ENC_KEY=<32+ char random string, distinct from every other key on the box>
```
`SECRET_KEY_BASE` and `JWT_SECRET` already exist and are reused as-is.

### Stage 2 — start only the realtime container
`docker compose up -d realtime` would also reconcile its dependency graph; pin it to the one
service so the running database can never be recreated under it:
```bash
ssh hetzner 'cd /home/deploy/apps/supabase && docker compose pull realtime && docker compose up -d --no-deps realtime'
```
Rollback: `docker compose stop realtime && docker compose rm -f realtime` — nothing else on the box
references the service, and the app already degrades to "realtime disabled" today.

### Stage 3 — prove the container, the socket and the proxy are wired
```bash
ssh hetzner 'docker ps --filter name=realtime --format "{{.Names}} | {{.Status}}"'
ssh hetzner 'docker exec realtime-dev.supabase-realtime \
  curl -sSfL --head -o /dev/null -H "Authorization: <ANON_KEY>" http://localhost:4000/api/tenants/realtime-dev/health; echo health_exit=$?'
# edge check: a websocket upgrade through Caddy → Kong must NOT return 404/502
ssh hetzner 'curl -s -o /dev/null -D - -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://supabase.818.quest/realtime/v1/websocket?apikey=<ANON_KEY>&vsn=1.0.0" | head -5'
```
Expected: container `(healthy)`, `health_exit=0`, and the edge probe returning `101` (or Kong's
auth rejection `401` once authenticated with a real token) — either proves the route exists. A `404`
means Kong never reloaded its declarative config after the container appeared.

### Stage 4 — publish the JetFarm tables (the step that actually delivers events)
Do **not** add all 91 sync tables; every published table adds decoder work for the whole shared
instance. Start with the tables where a stale view is operationally wrong — money and task state:
```sql
-- run interactively, after Stage 3 is green
BEGIN;
ALTER PUBLICATION supabase_realtime ADD TABLE
  app_payments, app_loan_applications, app_cash_transactions,
  app_share_capital_transactions, app_expenses, pos_sessions,
  agri_block_assignments, agri_block_progress;
COMMIT;

-- confirm
SELECT tablename FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime' AND tablename LIKE 'app_%' ORDER BY 1;
```
Exact rollback for that statement:
```sql
ALTER PUBLICATION supabase_realtime DROP TABLE
  app_payments, app_loan_applications, app_cash_transactions,
  app_share_capital_transactions, app_expenses, pos_sessions,
  agri_block_assignments, agri_block_progress;
```
Expansion to the remaining sync tables is a separate, measured decision — pull the slot/decoder
metrics first.

### Stage 5 — client-side scoping (code, not ops; separate change)
`src/services/AutoSyncService.ts:181-187` builds one channel with a `postgres_changes` listener per
remote table — ~91 bindings over a single socket on a box that is already swapping. Before widening
Stage 4, the client should subscribe only to the tables it actually displays, and a
`EXPO_PUBLIC_REALTIME_ENABLED`-style kill switch should exist so a build can opt out when the server
lacks realtime (today it can only self-disable after four failed retries,
`AutoSyncService.ts:206-214`). That is an `src/services/` change → risk tier L3, TDD first, and
`npm run check:sync` evidence; it is not part of this ops plan.

## 4. What this plan does **not** change

- No Kong or Caddy edit. Both route `/realtime/v1/` already; the routes were simply pointing at a
  host that did not exist.
- No `docker-compose.yml` rewrite — the service block already exists. `supabase/self-hosted/docker-compose.realtime-override.yml`
  in this repo is a reviewable, additive override (memory cap + explicit env passthrough); applying
  it is optional and human-run.
- No production write of any kind from this change set.

## 5. Acceptance test for "realtime actually works"

1. Two logged-in browser sessions on `https://jetfarm.pages.dev`.
2. In session A, create a payment; watch session B's network tab for a `websocket` frame and its
   sync store for a `remote-change:app_payments` trigger.
3. Session B must pull within ~2 s without a manual refresh. If B never receives a frame while the
   container is healthy, the failure is Stage 4 (publication) or RLS — not the socket.
