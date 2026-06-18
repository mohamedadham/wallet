# Station Transfer Reconciliation

Ingest station transfer events **idempotently** and **concurrency-safely**, and expose a **per-station reconciliation summary**.

The design principle throughout: **make the database enforce correctness, keep the application thin and well-separated, and prove it with tests that actually exercise concurrency.**

---

## Tech stack & requirements

| | |
|---|---|
| Language / runtime | TypeScript on Node.js 20 |
| Framework | NestJS 10 |
| Persistence | PostgreSQL 16 via TypeORM (migrations, **no `synchronize`**) |
| Validation | `class-validator` + global `ValidationPipe` |
| API docs | OpenAPI (Swagger) at `/docs` |
| Logging | Nest Logger, request-id correlated, quiet (no payloads) |
| Security | `helmet`, strict input validation, body/batch size caps |
| Tests | Jest + Supertest |

**To run locally you need:** Node.js 20+ and npm. A reachable PostgreSQL (or just use Docker, below).

---

## Architecture — Ports & Adapters (Hexagonal)

```
HTTP → Controller → Application Service → TransferRepository PORT (abstract class)
                         (use cases)              │
                                                  ├── PostgresTransferRepository (adapter)
                                                  └── InMemoryTransferRepository (adapter)
```

- **Controller** (`transfers.controller.ts`) — HTTP only: parse, map wire ⇄ domain, return. No SQL.
- **Application service** (`transfers.service.ts`) — the use cases (*ingest a batch*, *get a summary*) and the only app-side logic (in-batch de-dup). Depends on the **port**, never a concrete store.
- **Port** (`ports/transfer-repository.port.ts`) — an abstract class used as a NestJS DI token. Speaks domain *outcomes* (`insertNewEvents`, `getStationSummary`), never SQL.
- **Adapters** — `adapters/postgres/` and `adapters/in-memory/` both implement the port. **Swapping them is one line** (`STORE_DRIVER` env) — the proof of Dependency Inversion.

```
src/
  config/                         env schema + validation, typed config
  common/                         request-id middleware, global exception filter
  health/                         liveness + readiness
  transfers/
    transfers.controller.ts
    transfers.service.ts
    dto/                          request/response shapes + validation
    domain/                       framework-free model + the "approved" rule
    ports/                        TransferRepository (the port)
    adapters/
      postgres/                   entity, repository, migration, data-source
      in-memory/                  repository
  main.ts
test/
  contract/                       shared port contract + in-memory runner
  e2e/                            HTTP validation, Postgres contract, concurrency
```

### SOLID, concretely
- **S** — validation in DTOs, the "approved counts" rule in `domain/`, persistence in adapters, HTTP mapping in the controller.
- **O** — a new store (SQLite, Kafka-backed…) is a new adapter; zero edits to the service.
- **L** — one **shared contract test suite** runs against *both* adapters; if they disagree, the build fails.
- **I** — the port is tiny and intention-revealing; no leaky generic `query()`.
- **D** — the service depends on the abstract `TransferRepository`; the module wires the concrete class.

---

## How to run locally

```bash
# 1. Install
npm ci                      # or: make install

# 2. Configure
cp .env.example .env        # then edit DATABASE_URL if needed

# 3. Start Postgres however you like, e.g. just the DB from compose:
docker compose up -d postgres

# 4. Apply migrations
npm run migration:run       # or: make migrate   /   ./scripts/migrate.sh

# 5. Run
npm run start               # or: make run        /   ./scripts/run.sh
```

API on `http://localhost:3000`, interactive docs on `http://localhost:3000/docs`.

> Want zero local DB setup? Set `STORE_DRIVER=memory` and skip steps 3–4 — the API runs against the in-memory store. (Process-local; see *Concurrency strategy*.)

## How to run with Docker

```bash
docker compose up --build         # or: make up
```

This builds the image, starts Postgres (with a healthcheck), waits for it, **runs migrations**, then boots the API — a true one-command run. API on `http://localhost:3000`.

## How to run tests

```bash
# Locally — DB-backed specs run if DATABASE_URL/TEST_DATABASE_URL is set, else skip cleanly:
npm test                          # or: make test     /   ./scripts/test.sh
npm run test:unit                 # fast unit + in-memory contract only

# In Docker, against a real Postgres (runs EVERY test incl. concurrency):
docker compose run --rm test      # or: make docker-test
```

---

## API examples (curl)

### `POST /transfers` — ingest a batch (idempotent)

```bash
curl -s -X POST http://localhost:3000/transfers \
  -H 'Content-Type: application/json' \
  -d '{
    "events": [
      {"event_id":"e1","station_id":"S1","amount":100.5,"status":"approved","created_at":"2026-02-19T10:00:00Z"},
      {"event_id":"e2","station_id":"S1","amount":50.25,"status":"declined","created_at":"2026-02-19T10:05:00Z"}
    ]
  }'
# => {"inserted":2,"duplicates":0}
```

**Re-send the same batch (idempotency) — nothing is stored again:**

```bash
curl -s -X POST http://localhost:3000/transfers \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"event_id":"e1","station_id":"S1","amount":100.5,"status":"approved","created_at":"2026-02-19T10:00:00Z"}]}'
# => {"inserted":0,"duplicates":1}
```

**Invalid event → whole batch rejected (fail-fast), nothing persisted:**

```bash
curl -s -X POST http://localhost:3000/transfers \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"event_id":"e3","station_id":"S1","amount":-5,"status":"approved","created_at":"2026-02-19T10:00:00Z"}]}'
# => 400
# {"error":{"code":"VALIDATION_ERROR","message":"Request validation failed.","fields":{"amount":["amount must be a non-negative number"]}},"requestId":"..."}
```

### `GET /stations/{station_id}/summary`

```bash
curl -s http://localhost:3000/stations/S1/summary
# => {"station_id":"S1","total_approved_amount":"100.50","events_count":2}

curl -s http://localhost:3000/stations/unknown/summary
# => {"station_id":"unknown","total_approved_amount":"0.00","events_count":0}   (200, not 404)
```

`total_approved_amount` is returned as a **string** to preserve exact decimal precision.

---

## Design notes

### Idempotency strategy
Idempotency is enforced by a **database constraint**, not by app code. `event_id` is the table's **PRIMARY KEY**, and inserts use a single atomic statement:

```sql
INSERT INTO transfer_events (...) VALUES (...) ON CONFLICT (event_id) DO NOTHING
```

`inserted` is read from the rows the database reports as actually inserted (`RETURNING`); `duplicates = received − inserted`. There is **no window** between "check if exists" and "insert" for a race to slip through — the check and the insert are one statement. Retries are therefore safe by construction: a client that times out and resends gets `inserted: 0` and zero side effects.

The application service additionally **de-duplicates within a batch first**, so counts are deterministic and a single multi-row upsert never hits the "cannot affect row a second time" edge case.

### Concurrency strategy
**The database is the only component that sees all concurrent writers, so it is the only honest place to enforce uniqueness.** Two concurrent POSTs with the same `event_id` both attempt the insert; the PRIMARY KEY lets exactly one win and the other is skipped by `DO NOTHING`. No double insert, no application lock, no Redis.

- **Why not an in-app mutex?** It only coordinates one Node process. Run two instances (any real deployment) and in-app locks are blind to each other — double-insert returns. The DB constraint scales horizontally for free.
- **Isolation level:** default `READ COMMITTED` is sufficient because correctness rests on the unique constraint, not on transaction isolation. `SERIALIZABLE` is not needed.
- **In-memory adapter, honestly:** Node is single-threaded; the adapter's check-and-insert is synchronous (no `await` between `has` and `set`), so it is effectively atomic *within one process* — which is why it passes the single-process tests. This safety is **process-local**; Postgres is what makes it safe across instances. (Documented in code.)

### Out-of-order arrival
A non-issue **by construction**: the summary is a pure aggregation (count + conditional sum), so arrival order cannot affect the result. The "out-of-order produces same totals" test passes without any order-handling code.

### Money / precision
`amount` is `NUMERIC(14,2)` in Postgres and a **string** throughout the app — never a JS `float`. Floating point can't represent `0.1 + 0.2` exactly, and summing thousands of approved amounts as floats drifts. The approved sum is computed **in the database** over `NUMERIC` and returned as a string; we never `parseFloat` it. (The in-memory adapter mirrors this using integer-cents `BigInt` arithmetic.)

### Validation & errors
- Global `ValidationPipe` with `whitelist` (strip unknown fields) and `forbidNonWhitelisted`.
- **Fail-fast** on shape: any structurally invalid event rejects the **whole batch** with `400`. See the decision log for the tradeoff vs. partial-accept.
- One consistent error envelope via a global exception filter: `{ error: { code, message, fields? }, requestId }`. Stack traces, SQL and driver errors are never leaked to clients — they're logged server-side.

### Security
No secrets in the repo (all config via env, validated at boot; `.env.example` has placeholders only). Strict DTO validation + `whitelist`, a **max batch size** and **request body size limit** (cheap-DoS guards), parameterised queries only (zero SQL-injection surface), `helmet` headers, and quiet logging (identifiers and counts, never payloads or amounts). Rate limiting (`@nestjs/throttler`) is the recommended production add-on. In production the app's DB role needs only `INSERT`/`SELECT` on this table.

---

## Decision log

Every choice below has a defensible alternative; here's what was chosen and why.

1. **`event_id` as PRIMARY KEY** — uniqueness, idempotency anchor and concurrency guard are one DB object. *(Alt: surrogate PK + unique index — equivalent correctness, an extra column, no benefit here.)*
2. **`NUMERIC(14,2)` for `amount`, strings in the app** — exact money; never float.
3. **Idempotency via `ON CONFLICT DO NOTHING`** — atomic; survives retries and concurrency with no app locks.
4. **Concurrency via the DB constraint, `READ COMMITTED`** — the DB is the only writer that sees everyone; `SERIALIZABLE` isn't needed.
5. **Fail-fast validation, whole-batch rejection** — reconciliation data must not land in an ambiguous partial state; safe *because* ingestion is idempotent (fix the bad event, resend the whole batch). *(Alt: partial accept with a per-event error list — rejected to keep the success path one atomic insert. A valid-but-duplicate event is **not** an error — it's counted in `duplicates`.)*
6. **`events_count` = all statuses; totals = approved only** — intentional asymmetry by design.
7. **Unknown station → `200` with zeros** — a station is any id that has events; no registration concept invented. *(Alt: `404`.)*
8. **In-memory store safety is process-local** — fine for tests; Postgres makes it safe across instances.
9. **Migrations over `synchronize`** — schema changes are reviewable and safe; `synchronize` is never enabled.
10. **OpenAPI over Postman** — generated from the DTOs, so it can't drift from validation; served at `/docs`.

---

## Tests

The suite is a small pyramid; the concurrency test is the centerpiece. The **contract suite runs against both adapters** to enforce Liskov.

| # | Test | Proves | Where |
|---|------|--------|-------|
| 1 | Batch insert returns correct `inserted`/`duplicates` (+ in-batch dedup) | counting logic | `transfers.service.spec.ts`, contract |
| 2 | Re-sending a stored event doesn't change totals | idempotency across requests | contract |
| 3 | Out-of-order arrival → identical totals | aggregation is order-independent | contract |
| 4 | **Concurrent POSTs of same `event_id` → exactly one insert** | the headline guarantee (real DB) | `concurrency.e2e-spec.ts` |
| 5 | Summary correctness (mixed statuses; approved-only sum) | the business rule | contract + e2e |
| 6 | Validation failure → `400`, whole batch rejected, nothing persisted | fail-fast choice | `validation.e2e-spec.ts` |
| 7 | Sum of many decimals stays exact | the `NUMERIC` decision | contract |

DB-backed specs (4, and the Postgres run of the contract) **skip cleanly** when no `DATABASE_URL`/`TEST_DATABASE_URL` is present, so `npm test` is green without a database — and run for real in `docker compose run --rm test`. The concurrency test is **never** mocked: the guarantee lives in the DB constraint.

---

## Non-functional notes

`/health/live` (liveness) and `/health/ready` (readiness — pings the DB in Postgres mode). Graceful shutdown via Nest shutdown hooks (drains the DB pool). Structured logging with a per-request correlation id (`x-request-id`, honoured if inbound), deliberately quiet — no per-event or payload logging in the batch path.
