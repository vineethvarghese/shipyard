---
name: minimal-bookmark-store-go
description: >
  False-positive check: a minimal store that serves two required backends without extra layers must not get
  BLOCKING findings.
tags: [ability, simplicity-review]
runs: 3
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

Use the `shipyard:simplicity-reviewer` agent to review the slice below and give me its review in Shipyard finding format.

Start the agent's prompt with this brief, then paste everything under "Slice material" below it unchanged:

```text
Caller: shipyard:coordinator
Mode: SLICE
Slice: 01
Round: 0
Feature-branch: feature/bookmarks-cli
Slice-branch: feature/bookmarks-cli-slice-01
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

Objective: the bookmarks CLI can save and list bookmarks.
- AC-1: By default bookmarks are stored in a local SQLite file `bookmarks.db` with no setup.
- AC-2: With `--db-url postgres://...` bookmarks are stored in a shared Postgres database (teams use this).
- AC-3: `bm add <url> <title>` saves a bookmark; `bm list` prints all bookmarks sorted by URL.
- The `bookmarks` table already exists in both databases (created by an earlier slice).

### Diff

```diff
diff --git a/internal/store/store.go b/internal/store/store.go
new file mode 100644
--- /dev/null
+++ b/internal/store/store.go
@@ -0,0 +1,58 @@
+package store
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"strings"
+
+	_ "github.com/jackc/pgx/v5/stdlib" // registers "pgx" (AC-2)
+	_ "modernc.org/sqlite"             // registers "sqlite" (AC-1)
+)
+
+type Bookmark struct {
+	URL   string
+	Title string
+}
+
+// Store saves bookmarks in SQLite (a local file, the default) or Postgres (a URL starting with postgres://).
+type Store struct {
+	db        *sql.DB
+	insertSQL string
+}
+
+func Open(dsn string) (*Store, error) {
+	driver, insertSQL := "sqlite", "INSERT INTO bookmarks (url, title) VALUES (?, ?)"
+	if strings.HasPrefix(dsn, "postgres://") {
+		driver, insertSQL = "pgx", "INSERT INTO bookmarks (url, title) VALUES ($1, $2)"
+	}
+	db, err := sql.Open(driver, dsn)
+	if err != nil {
+		return nil, fmt.Errorf("open %s store: %w", driver, err)
+	}
+	return &Store{db: db, insertSQL: insertSQL}, nil
+}
+
+func (s *Store) Add(ctx context.Context, b Bookmark) error {
+	_, err := s.db.ExecContext(ctx, s.insertSQL, b.URL, b.Title)
+	return err
+}
+
+func (s *Store) List(ctx context.Context) ([]Bookmark, error) {
+	rows, err := s.db.QueryContext(ctx, "SELECT url, title FROM bookmarks ORDER BY url")
+	if err != nil {
+		return nil, err
+	}
+	defer rows.Close()
+	var out []Bookmark
+	for rows.Next() {
+		var b Bookmark
+		if err := rows.Scan(&b.URL, &b.Title); err != nil {
+			return nil, err
+		}
+		out = append(out, b)
+	}
+	return out, rows.Err()
+}
+
+func (s *Store) Close() error { return s.db.Close() }

diff --git a/cmd/bm/main.go b/cmd/bm/main.go
--- a/cmd/bm/main.go
+++ b/cmd/bm/main.go
@@ -12,3 +12,12 @@
 func main() {
+	dbURL := flag.String("db-url", "bookmarks.db", "SQLite file path or postgres:// URL")
 	flag.Parse()
+	s, err := store.Open(*dbURL)
+	if err != nil {
+		log.Fatal(err)
+	}
+	defer s.Close()
+	if err := run(context.Background(), s, flag.Args()); err != nil {
+		log.Fatal(err)
+	}
 }
```
