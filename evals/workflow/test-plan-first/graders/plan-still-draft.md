---
type: regex
pattern: "^Status: DRAFT$"
flags: m
target: {source: file, path: .ai/slices/01/TEST_PLAN.md}
---
The test plan was not flipped to APPROVED by anyone but the code-reviewer.
