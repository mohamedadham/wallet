# One clear command per action (mirrors scripts/ for non-make users).

.PHONY: install run dev test test-unit migrate up down docker-test lint build

install:        ## Install dependencies
	npm ci

build:          ## Compile TypeScript
	npm run build

migrate:        ## Run DB migrations (requires DATABASE_URL)
	npm run migration:run

run:            ## Run locally (expects Postgres reachable via DATABASE_URL)
	npm run start

dev:            ## Run locally in watch mode
	npm run start:dev

test:           ## Run all tests (DB-backed specs skip if no DATABASE_URL)
	npm test

test-unit:      ## Run only fast unit + contract (in-memory) tests
	npm run test:unit

lint:           ## Lint
	npm run lint

up:             ## Build + start the full stack (Postgres + API) in Docker
	docker compose up --build

down:           ## Stop the stack and remove volumes
	docker compose down -v

docker-test:    ## Run the full test suite (incl. Postgres) in Docker
	docker compose run --rm test
