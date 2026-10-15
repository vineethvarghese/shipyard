---
name: sqli-idor-invoices-go
description: >
  Security-reviewer finds SQL injection and a cross-tenant IDOR with attack paths, CWE and OWASP ids, and
  corrected snippets; both BLOCKING.
tags: [ability, security-audit]
runs: 3
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

Use the `shipyard:security-reviewer` agent to review the slice below and give me its review in Shipyard finding format.

Start the agent's prompt with this brief, then paste everything under "Slice material" below it unchanged:

```text
Caller: shipyard:coordinator
Mode: SLICE
Slice: 01
Round: 0
Feature-branch: feature/invoices-api
Slice-branch: feature/invoices-api-slice-01
Diff: inline below (evaluation run: the workspace has no repository)
Read: inline below
Write: none (evaluation run): return every finding inline in your final message
Budget: 12 turns
```

This is an evaluation run in an empty workspace: there is no git repository and no `.ai/` folder, so the slice
spec, the relevant planning excerpts and the diff are all inline. Tell the agent to review only what is shown and
not to look for files. Report each finding as one block with the lines `ID:`, `Severity:`, `Category:`, `Location:`, `Finding:`,
`Why it matters:`, `Evidence:`, `Required resolution:`, `Confidence:`, `Owner:`, `Status:` (the Shipyard
finding format), or the single line `NO FINDINGS`.

When the agent returns, repeat its findings verbatim in your final answer (do not summarise or re-rate them).

## Slice material

#### SLICE.md (excerpt)

Objective: tenant users can list and view invoices.
- AC-1: `GET /invoices?status=paid` lists the caller's tenant invoices, optionally filtered by status
  (`draft`, `sent`, `paid`).
- AC-2: `GET /invoices/{id}` returns one invoice of the caller's tenant; another tenant's invoice returns 404.
- The existing auth middleware (unchanged, already reviewed) verifies the session and puts the tenant id in
  the request context under `tenantKey`.

#### INVARIANTS.md (excerpt)

- INV-001: A user can never read another tenant's data.

### Diff

```diff
diff --git a/internal/api/invoices.go b/internal/api/invoices.go
new file mode 100644
--- /dev/null
+++ b/internal/api/invoices.go
@@ -0,0 +1,51 @@
+package api
+
+import (
+	"database/sql"
+	"encoding/json"
+	"net/http"
+)
+
+type InvoiceHandler struct{ DB *sql.DB }
+
+type Invoice struct {
+	ID            string `json:"id"`
+	TenantID      string `json:"tenantId"`
+	AmountCents   int64  `json:"amountCents"`
+	Status        string `json:"status"`
+	CustomerEmail string `json:"customerEmail"`
+}
+
+// List handles GET /invoices?status=...
+func (h *InvoiceHandler) List(w http.ResponseWriter, r *http.Request) {
+	tenantID := r.Context().Value(tenantKey).(string)
+	q := "SELECT id, tenant_id, amount_cents, status, customer_email FROM invoices WHERE tenant_id = '" + tenantID + "'"
+	if status := r.URL.Query().Get("status"); status != "" {
+		q += " AND status = '" + status + "'"
+	}
+	rows, err := h.DB.QueryContext(r.Context(), q)
+	if err != nil {
+		http.Error(w, err.Error(), http.StatusInternalServerError)
+		return
+	}
+	defer rows.Close()
+	writeInvoices(w, rows)
+}
+
+// Get handles GET /invoices/{id}
+func (h *InvoiceHandler) Get(w http.ResponseWriter, r *http.Request) {
+	var inv Invoice
+	err := h.DB.QueryRowContext(r.Context(),
+		"SELECT id, tenant_id, amount_cents, status, customer_email FROM invoices WHERE id = $1",
+		r.PathValue("id"),
+	).Scan(&inv.ID, &inv.TenantID, &inv.AmountCents, &inv.Status, &inv.CustomerEmail)
+	if err == sql.ErrNoRows {
+		http.NotFound(w, r)
+		return
+	}
+	if err != nil {
+		http.Error(w, err.Error(), http.StatusInternalServerError)
+		return
+	}
+	json.NewEncoder(w).Encode(inv)
+}
```
