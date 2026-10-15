---
name: simple-tags-crud-python
description: >
  False-positive check: plain CRUD for tags must not get BLOCKING findings or demands for
  repository/factory/aggregate ceremony.
tags: [ability, domain-design]
runs: 3
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

Use the `shipyard:code-reviewer` agent to review the slice below and give me its review in Shipyard finding format.

Start the agent's prompt with this brief, then paste everything under "Slice material" below it unchanged:

```text
Caller: shipyard:coordinator
Mode: SLICE
Slice: 01
Round: 0
Feature-branch: feature/note-tags
Slice-branch: feature/note-tags-slice-01
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

Objective: users can create, list and delete tags for their notes.
- AC-1: `POST /tags` creates a tag for the current user; a duplicate name for the same user returns 409.
- AC-2: `GET /tags` lists the current user's tags sorted by name.
- AC-3: `DELETE /tags/{id}` deletes the current user's tag; another user's tag returns 404.

#### PROJECT.md — Key terminology (excerpt)

- Tag: a free-text label a user attaches to notes. No other rules.

#### INVARIANTS.md (excerpt)

- INV-002: Tag names are unique per user.

### Diff

```diff
diff --git a/migrations/versions/0007_tags.py b/migrations/versions/0007_tags.py
new file mode 100644
--- /dev/null
+++ b/migrations/versions/0007_tags.py
@@ -0,0 +1,8 @@
+def upgrade(op, sa):
+    op.create_table(
+        "tags",
+        sa.Column("id", sa.Integer, primary_key=True),
+        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
+        sa.Column("name", sa.String(64), nullable=False),
+        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_name"),  # INV-002
+    )

diff --git a/app/tags/routes.py b/app/tags/routes.py
new file mode 100644
--- /dev/null
+++ b/app/tags/routes.py
@@ -0,0 +1,45 @@
+from fastapi import APIRouter, Depends, HTTPException, status
+from pydantic import BaseModel, constr
+from sqlalchemy.exc import IntegrityError
+from sqlalchemy.orm import Session
+
+from app.auth import User, current_user
+from app.db import get_session
+from app.tags.models import Tag
+
+router = APIRouter(prefix="/tags")
+
+
+class TagIn(BaseModel):
+    name: constr(strip_whitespace=True, min_length=1, max_length=64)
+
+
+class TagOut(BaseModel):
+    id: int
+    name: str
+
+
+@router.post("", status_code=status.HTTP_201_CREATED, response_model=TagOut)
+def create_tag(body: TagIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
+    tag = Tag(user_id=user.id, name=body.name)
+    db.add(tag)
+    try:
+        db.commit()
+    except IntegrityError:
+        db.rollback()
+        raise HTTPException(status.HTTP_409_CONFLICT, "tag already exists")
+    return TagOut(id=tag.id, name=tag.name)
+
+
+@router.get("", response_model=list[TagOut])
+def list_tags(user: User = Depends(current_user), db: Session = Depends(get_session)):
+    tags = db.query(Tag).filter(Tag.user_id == user.id).order_by(Tag.name).all()
+    return [TagOut(id=t.id, name=t.name) for t in tags]
+
+
+@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
+def delete_tag(tag_id: int, user: User = Depends(current_user), db: Session = Depends(get_session)):
+    deleted = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == user.id).delete()
+    if not deleted:
+        raise HTTPException(status.HTTP_404_NOT_FOUND, "tag not found")
+    db.commit()
```
