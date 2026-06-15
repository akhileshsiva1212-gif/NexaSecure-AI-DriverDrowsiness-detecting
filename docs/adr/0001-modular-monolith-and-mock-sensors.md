# ADR-0001: Modular monolith backend with simulated sensor sources

- **Status:** Accepted
- **Date:** 2026-06-11

## Context

NexaSecure AI has 12 features and is built by a beginner. We need an architecture that is
clean and scalable but not operationally overwhelming, and we need to develop the full
pipeline before any real in-vehicle hardware is available.

## Decision

1. **Backend is a modular monolith** (one FastAPI app, internally split into `features/*`
   modules with a shared decision engine and event bus) rather than microservices.
2. **Sensor sources are abstracted behind an interface**, with a **mock implementation**
   selected via the `NEXA_OBD_SOURCE=mock` env var, so the entire pipeline runs without
   hardware.
3. **SQLite** is the development database, wrapped by a repository layer so it can be swapped
   for PostgreSQL/TimescaleDB later without touching business logic.

## Consequences

- ✅ One process to run and reason about; features stay decoupled and independently testable.
- ✅ End-to-end development and testing with zero hardware.
- ✅ Clear migration paths (mock→real sensors, SQLite→Postgres) without rewrites.
- ⚠️ A monolith must be split later if a single feature needs independent scaling — accepted,
  and the module boundaries are designed to make that split clean.
