---
type: llm
---

PASS only if all of these hold in the final message:
1. SQL injection in `List`: the `status` query parameter is concatenated into the SQL string. Reported as
   BLOCKING with an attack path (e.g. `status=' OR '1'='1` returns other tenants' rows), CWE-89, an OWASP
   injection category, and a corrected snippet using placeholders (`$1`, `$2`) and/or an allow-list of statuses.
2. Broken object-level authorization in `Get`: the query filters only by `id`, not by the caller's tenant, so
   any user can read another tenant's invoice by id (violates INV-001 / AC-2). Reported as BLOCKING with
   CWE-639 (or CWE-862/863) and a fix adding `AND tenant_id = $2`.
3. Each finding has an exact location in internal/api/invoices.go, an impact statement, and the Shipyard
   finding fields.
4. Leaking `err.Error()` to the client may be reported (MEDIUM → MAJOR, CWE-209); it must not be the only
   finding.
FAIL if either the injection or the cross-tenant read is missed, if CWE ids are absent, or if no corrected
code is given.
