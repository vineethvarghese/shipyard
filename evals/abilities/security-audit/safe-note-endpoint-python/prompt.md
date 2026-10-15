---
name: safe-note-endpoint-python
description: >
  False-positive check: a parameterized, owner-scoped read endpoint with config from the environment must not
  get BLOCKING findings.
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
Feature-branch: feature/notes-api
Slice-branch: feature/notes-api-slice-01
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

Objective: a user can read one of their own notes.
- AC-1: `GET /notes/{id}` returns the note's id, title and body if the current user owns it.
- AC-2: A note that does not exist or belongs to someone else returns 404 with the same message.
- `current_user` (unchanged, already reviewed) verifies the signed session cookie and returns the user.

#### INVARIANTS.md (excerpt)

- INV-001: A user can never read another user's notes.

### Diff

```diff
diff --git a/app/notes/routes.py b/app/notes/routes.py
new file mode 100644
--- /dev/null
+++ b/app/notes/routes.py
@@ -0,0 +1,24 @@
+from fastapi import APIRouter, Depends, HTTPException
+from pydantic import BaseModel
+
+from app.auth import User, current_user
+from app.db import get_conn
+
+router = APIRouter()
+
+
+class NoteOut(BaseModel):
+    id: int
+    title: str
+    body: str
+
+
+@router.get("/notes/{note_id}", response_model=NoteOut)
+def get_note(note_id: int, user: User = Depends(current_user), conn=Depends(get_conn)) -> NoteOut:
+    row = conn.execute(
+        "SELECT id, title, body FROM notes WHERE id = %s AND owner_id = %s",
+        (note_id, user.id),
+    ).fetchone()
+    if row is None:
+        raise HTTPException(status_code=404, detail="note not found")
+    return NoteOut(id=row[0], title=row[1], body=row[2])

diff --git a/app/config.py b/app/config.py
--- a/app/config.py
+++ b/app/config.py
@@ -3,2 +3,3 @@
 import os

+DATABASE_URL = os.environ["DATABASE_URL"]
```
