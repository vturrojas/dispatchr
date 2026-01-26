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

# From WSL, use host.docker.internal (works for Docker Desktop)
API_HOST ?= host.docker.internal
API_PORT ?= 8000
API_BASE := http://$(API_HOST):$(API_PORT)

# Tools
CURL ?= curl
PY   ?= python3

SECONDS ?= 2
JOB_ID ?=

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
	@echo "  API_HOST=host.docker.internal API_PORT=8000"
	@echo "  (Example) make health API_HOST=172.29.224.1"

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

test-live:
	@JOB_ID=$$($(CURL) -sS -X POST $(API_BASE)/jobs \
	  -H 'Content-Type: application/json' \
	  -d '{"type":"sleep","payload":{"seconds":$(SECONDS)}}' \
	  | $(PY) -c "import sys,json; print(json.load(sys.stdin)['id'])"); \
	echo "JOB_ID=$$JOB_ID"; \
	$(CURL) -N "$(API_BASE)/jobs/$$JOB_ID/stream?from_id=0"

# NOTE: This assumes your http_request executor accepts {"url": "..."}.
# If your schema differs, tell me and I’ll adjust this payload.
test-retry:
	@JOB_ID=$$($(CURL) -sS -X POST $(API_BASE)/jobs \
	  -H 'Content-Type: application/json' \
	  -d '{"type":"http_request","payload":{"url":"http://127.0.0.1:1"}}' \
	  | $(PY) -c "import sys,json; print(json.load(sys.stdin)['id'])"); \
	echo "JOB_ID=$$JOB_ID"; \
	$(CURL) -N "$(API_BASE)/jobs/$$JOB_ID/stream?from_id=0"

.PHONY: test lint fmt

lint:
	cd backend && ruff check .

fmt:
	cd backend && ruff format --check .

test:
	cd backend && pytest -q

