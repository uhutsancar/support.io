# Audit Logs

This document describes the centralized audit logging added to the backend.

- Collection: `audit_logs`
- Immutable: audit entries cannot be updated or deleted via the API. The model enforces immutability on `createdAt` and the pre-save rejects updates to existing docs.
- Required fields: `action`, other fields such as `organizationId` are strongly recommended. Login attempts for unknown organizations will still be recorded with `organizationId: null`.
- Indexes: compound index on `{ organizationId: 1, createdAt: -1 }`, index on `action`.

Archive strategy (recommended)
- Use a time-based archiving approach (monthly/quarterly): move older records older than N months (e.g., 12 months) to a separate archival database/collection (e.g., `audit_logs_archive_YYYY_MM`).
- Archival process should be run as a separate background job or cron process, which:
  - Exports selected documents into archive storage (compressed JSON/Parquet) or a separate MongoDB collection.
  - Verifies checksum/count and then deletes from the active `audit_logs` collection (deletion in archive step only).
  - Keep an audit of archival operations.
- Consider TTL indexes for archived collections if you want automatic removal after an even longer retention period.

Security and multi-tenancy
- All audit queries are scoped by `organizationId` to prevent cross-tenant access.
- The API enforces organization isolation by reading `req.organization` or `req.user.organizationId` and rejecting queries without an organization context.

Operational notes
- Do not log message bodies or user content. Only log high-level actions and metadata (old/new values).
- Ensure backups and monitoring on the `audit_logs` collection.

API
- `GET /api/audit` supports filters: `action`, `start` (ISO date), `end` (ISO date), `page`, `limit`.
- Pagination is required; default `limit=25`, max `limit=100`.

***
When ready, I can add a front-end admin-panel component to view logs and filter them.