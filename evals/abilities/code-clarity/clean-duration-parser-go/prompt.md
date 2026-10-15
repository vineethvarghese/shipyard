---
name: clean-duration-parser-go
description: >
  False-positive check: a small, clear Go parser with focused tests must not receive BLOCKING or taste-only
  findings.
tags: [ability, code-clarity]
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
Feature-branch: feature/config-durations
Slice-branch: feature/config-durations-slice-01
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

Objective: let operators write timeouts as "90s", "15m" or "2h" in the service config.
- AC-1: `ParseDuration` accepts a positive whole number followed by one unit `s`, `m` or `h`.
- AC-2: Empty input, a missing number, zero or negative numbers, and unknown units return `ErrInvalidDuration`.
- AC-3: Values above 24 hours return `ErrInvalidDuration`.

### Diff

```diff
diff --git a/internal/config/duration.go b/internal/config/duration.go
new file mode 100644
--- /dev/null
+++ b/internal/config/duration.go
@@ -0,0 +1,36 @@
+package config
+
+import (
+	"errors"
+	"strconv"
+	"time"
+)
+
+// ErrInvalidDuration is returned for input that is not a positive whole number followed by s, m or h,
+// or that exceeds maxDuration.
+var ErrInvalidDuration = errors.New("invalid duration")
+
+const maxDuration = 24 * time.Hour
+
+var unitBySuffix = map[byte]time.Duration{
+	's': time.Second,
+	'm': time.Minute,
+	'h': time.Hour,
+}
+
+// ParseDuration parses values such as "90s", "15m" or "2h" (AC-1..AC-3).
+func ParseDuration(s string) (time.Duration, error) {
+	if len(s) < 2 {
+		return 0, ErrInvalidDuration
+	}
+	unit, ok := unitBySuffix[s[len(s)-1]]
+	if !ok {
+		return 0, ErrInvalidDuration
+	}
+	n, err := strconv.Atoi(s[:len(s)-1])
+	// Compare before multiplying so a huge number cannot overflow.
+	if err != nil || n <= 0 || n > int(maxDuration/unit) {
+		return 0, ErrInvalidDuration
+	}
+	return time.Duration(n) * unit, nil
+}

diff --git a/internal/config/duration_test.go b/internal/config/duration_test.go
new file mode 100644
--- /dev/null
+++ b/internal/config/duration_test.go
@@ -0,0 +1,25 @@
+package config
+
+import (
+	"errors"
+	"testing"
+	"time"
+)
+
+func TestParseDurationAcceptsEachUnit(t *testing.T) {
+	cases := map[string]time.Duration{"90s": 90 * time.Second, "15m": 15 * time.Minute, "24h": 24 * time.Hour}
+	for in, want := range cases {
+		got, err := ParseDuration(in)
+		if err != nil || got != want {
+			t.Errorf("ParseDuration(%q) = %v, %v; want %v", in, got, err, want)
+		}
+	}
+}
+
+func TestParseDurationRejectsInvalidInput(t *testing.T) {
+	for _, in := range []string{"", "s", "5", "0s", "-1m", "10d", "1.5h", "25h", "99999999999999h"} {
+		if _, err := ParseDuration(in); !errors.Is(err, ErrInvalidDuration) {
+			t.Errorf("ParseDuration(%q) error = %v; want ErrInvalidDuration", in, err)
+		}
+	}
+}
```
