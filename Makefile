# DispatchR Makefile
# Usage examples:
#   make up
#   make logs
#   make health
#   make job-sleep SECONDS=2
#   make stream JOB_ID=<uuid>
#   make test-live SECONDS=2

SHELL := /bin/bash

COMPOSE ?= docker compose

# Docker Compose publishes the API port on host loopback.
API_HOST ?= 127.0.0.1
API_PORT ?= 8000
API_BASE := http://$(API_HOST):$(API_PORT)

# Tools
CURL ?= curl
PY   ?= python3

SECONDS ?= 2
JOB_ID ?=
DISPATCHR_SMOKE_SECONDS := $(value SECONDS)
export DISPATCHR_SMOKE_SECONDS

.PHONY: help up build rebuild down restart ps logs logs-api logs-worker logs-scheduler \
        health executors jobs job-sleep events stream tail \
        rq-len rq-peek rq-keys \
        test-live test-retry

help:
	@echo "DispatchR Make targets:"
	@echo ""
	@echo "  make up                Start all services (api, worker, scheduler, db, redis)"
	@echo "  make build             Build images"
	@echo "  make rebuild           Rebuild + restart"
	@echo "  make down              Stop and remove containers"
	@echo "  make restart           Restart services"
	@echo "  make ps                Show container status"
	@echo "  make logs              Tail all logs"
	@echo "  make logs-api          Tail api logs"
	@echo "  make logs-worker       Tail worker logs"
	@echo "  make logs-scheduler    Tail scheduler logs"
	@echo ""
	@echo "API quick checks:"
	@echo "  make health            GET /health"
	@echo "  make executors         GET /executors"
	@echo "  make jobs              GET /jobs"
	@echo ""
	@echo "Jobs:"
	@echo "  make job-sleep SECONDS=2       Create a sleep job, prints JOB_ID"
	@echo "  make events JOB_ID=<uuid>      GET /jobs/<id>/events"
	@echo "  make stream JOB_ID=<uuid>      SSE stream from beginning"
	@echo "  make tail   JOB_ID=<uuid>      SSE tail (new events only)"
	@echo ""
	@echo "Redis/RQ debug:"
	@echo "  make rq-len            LLEN rq:queue:dispatchr"
	@echo "  make rq-peek           LRANGE rq:queue:dispatchr 0 10"
	@echo ""
	@echo "End-to-end demos:"
	@echo "  make test-live SECONDS=2       Create job + stream it live"
	@echo "  make test-retry               Create failing job (http_request) + stream"
	@echo ""
	@echo "Config overrides:"
	@echo "  API_HOST=127.0.0.1 API_PORT=8000"
	@echo "  Override API_HOST when Docker host routing differs."

up:
	$(COMPOSE) up -d

build:
	$(COMPOSE) build

rebuild:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f

logs-api:
	$(COMPOSE) logs -f api

logs-worker:
	$(COMPOSE) logs -f worker

logs-scheduler:
	$(COMPOSE) logs -f scheduler

health:
	@$(CURL) -sS $(API_BASE)/health && echo

executors:
	@$(CURL) -sS $(API_BASE)/executors && echo

jobs:
	@$(CURL) -sS $(API_BASE)/jobs && echo

job-sleep:
	@$(CURL) -sS -X POST $(API_BASE)/jobs \
	  -H 'Content-Type: application/json' \
	  -d '{"type":"sleep","payload":{"seconds":$(SECONDS)}}' \
	  | $(PY) -c "import sys,json; print(json.load(sys.stdin)['id'])"

events:
	@if [ -z "$(JOB_ID)" ]; then echo "ERROR: JOB_ID is required. Example: make events JOB_ID=<uuid>"; exit 1; fi
	@$(CURL) -sS $(API_BASE)/jobs/$(JOB_ID)/events && echo

stream:
	@if [ -z "$(JOB_ID)" ]; then echo "ERROR: JOB_ID is required. Example: make stream JOB_ID=<uuid>"; exit 1; fi
	@$(CURL) -N $(API_BASE)/jobs/$(JOB_ID)/stream?from_id=0

tail:
	@if [ -z "$(JOB_ID)" ]; then echo "ERROR: JOB_ID is required. Example: make tail JOB_ID=<uuid>"; exit 1; fi
	@$(CURL) -N $(API_BASE)/jobs/$(JOB_ID)/stream?from_id=999999

rq-len:
	@$(COMPOSE) exec redis redis-cli LLEN rq:queue:dispatchr

rq-peek:
	@$(COMPOSE) exec redis redis-cli LRANGE rq:queue:dispatchr 0 10

rq-keys:
	@$(COMPOSE) exec redis redis-cli KEYS "rq:*"

test-live: export DISPATCHR_SMOKE_TYPE = sleep
test-live: export DISPATCHR_SMOKE_TERMINAL = succeeded
test-live: export DISPATCHR_SMOKE_REQUIRE_RETRY = 0
test-retry: export DISPATCHR_SMOKE_TYPE = retry
test-retry: export DISPATCHR_SMOKE_TERMINAL = failed
test-retry: export DISPATCHR_SMOKE_REQUIRE_RETRY = 1
test-live test-retry:
	@set -o pipefail; \
	if [[ "$${DISPATCHR_SMOKE_TYPE}" == "sleep" ]]; then \
	  if [[ ! "$${DISPATCHR_SMOKE_SECONDS}" =~ ^[0-9]+$$ ]]; then echo "ERROR: SECONDS must contain only digits" >&2; exit 2; fi; \
	  STREAM_MAX_TIME=$$($(PY) -c 'import os, sys; seconds = int(os.environ["DISPATCHR_SMOKE_SECONDS"], 10); print(seconds + 15) if seconds <= 2_147_483_600 else sys.exit("ERROR: SECONDS exceeds supported range")') || exit $$?; \
	  PAYLOAD=$$($(PY) -c 'import json, os; print(json.dumps({"type": "sleep", "payload": {"seconds": int(os.environ["DISPATCHR_SMOKE_SECONDS"])}}))') || exit $$?; \
	else \
	  STREAM_MAX_TIME=30; \
	  PAYLOAD='{"type":"http_request","payload":{"url":"http://127.0.0.1:1"}}'; \
	fi; \
	RESPONSE=$$($(CURL) --connect-timeout 5 -fsS -X POST $(API_BASE)/jobs \
	  -H 'Content-Type: application/json' \
	  -d "$$PAYLOAD") || exit $$?; \
	JOB_ID=$$(printf '%s' "$$RESPONSE" | $(PY) -c "import sys,json; print(json.load(sys.stdin)['id'])") || exit $$?; \
	echo "JOB_ID=$$JOB_ID"; \
	$(CURL) --connect-timeout 5 --max-time "$$STREAM_MAX_TIME" -sN "$(API_BASE)/jobs/$$JOB_ID/stream?from_id=0" | \
	  awk -v expected="$${DISPATCHR_SMOKE_TERMINAL}" -v require_retry="$${DISPATCHR_SMOKE_REQUIRE_RETRY}" '{ sub(/\r$$/, ""); print; fflush() } $$1 == "event:" { current = $$2; if (current == "retrying") saw_retry = 1 } $$0 == "" && (current == "succeeded" || current == "failed") { terminal = 1; if (current != expected) { print "ERROR: unexpected terminal event " current "; expected " expected > "/dev/stderr"; exit 3 } if (require_retry == 1 && !saw_retry) { print "ERROR: terminal failed arrived before any retrying event" > "/dev/stderr"; exit 5 } exit 0 } END { if (!terminal) { print "ERROR: SSE ended before terminal event " expected > "/dev/stderr"; exit 4 } }'; \
	statuses=("$${PIPESTATUS[@]}"); \
	curl_status=$${statuses[0]}; awk_status=$${statuses[1]}; \
	if (( curl_status != 0 && curl_status != 23 )); then echo "ERROR: SSE curl exited $$curl_status" >&2; exit "$$curl_status"; fi; \
	exit "$$awk_status"

.PHONY: test lint fmt

lint:
	cd backend && ruff check .

fmt:
	cd backend && ruff format --check .

test:
	cd backend && pytest -q

DB_URL ?= postgresql+asyncpg://dispatchr:dispatchr@localhost:5433/dispatchr

migrate:
	cd backend && DATABASE_URL=$(DB_URL) alembic -c alembic.ini upgrade head

stamp:
	cd backend && DATABASE_URL=$(DB_URL) alembic -c alembic.ini stamp head

downgrade:
	cd backend && DATABASE_URL=$(DB_URL) alembic -c alembic.ini downgrade -1

revision:
	cd backend && DATABASE_URL=$(DB_URL) alembic -c alembic.ini revision -m "$(MSG)" --autogenerate

req:
	cd backend && python -m pip install -r requirements.txt
