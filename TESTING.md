## Testing Protocol

**Local (fast)**

- make lint
- make fmt
- make test

**End-to-end smoke test**

- make up
- make health
- create a sleep job
- curl /jobs/{id}/events and /jobs/{id}/stream

**CI**

- GitHub Actions runs ruff + formatting check + pytest
