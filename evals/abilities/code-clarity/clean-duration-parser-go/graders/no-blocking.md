---
type: regex
pattern: 'Severity:\s*BLOCKING'
target: last_message
match: not_contains
---

Clean code that meets its acceptance criteria must not receive a BLOCKING finding.
