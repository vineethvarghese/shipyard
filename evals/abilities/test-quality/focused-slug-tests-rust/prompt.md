---
name: focused-slug-tests-rust
description: >
  False-positive check: focused Rust tests that map one-to-one to the ACs and boundaries must not get BLOCKING
  findings.
tags: [ability, test-quality]
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
Feature-branch: feature/post-slugs
Slice-branch: feature/post-slugs-slice-01
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

Objective: build URL slugs from post titles.
- AC-1: ASCII letters and digits are kept (lower-cased); every run of other characters becomes one `-`;
  leading and trailing `-` are removed.
- AC-2: A title with no ASCII letters or digits returns `SlugError::EmptySlug`.
- AC-3: A slug is at most 64 characters and never ends with `-`.

### Diff

```diff
diff --git a/src/slug.rs b/src/slug.rs
new file mode 100644
--- /dev/null
+++ b/src/slug.rs
@@ -0,0 +1,72 @@
+#[derive(Debug, PartialEq, Eq)]
+pub enum SlugError {
+    EmptySlug,
+}
+
+pub const MAX_SLUG_LEN: usize = 64;
+
+/// Builds a URL slug (AC-1..AC-3).
+pub fn slugify(title: &str) -> Result<String, SlugError> {
+    let mut slug = String::with_capacity(title.len().min(MAX_SLUG_LEN + 1));
+    let mut pending_dash = false;
+    for c in title.chars() {
+        if c.is_ascii_alphanumeric() {
+            if pending_dash && !slug.is_empty() {
+                slug.push('-');
+            }
+            pending_dash = false;
+            slug.push(c.to_ascii_lowercase());
+        } else {
+            pending_dash = true;
+        }
+        if slug.len() >= MAX_SLUG_LEN {
+            break;
+        }
+    }
+    slug.truncate(MAX_SLUG_LEN);
+    while slug.ends_with('-') {
+        slug.pop();
+    }
+    if slug.is_empty() {
+        Err(SlugError::EmptySlug)
+    } else {
+        Ok(slug)
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn lowercases_and_joins_words_with_one_dash() {
+        assert_eq!(slugify("Hello, World!"), Ok("hello-world".to_string()));
+    }
+
+    #[test]
+    fn collapses_separator_runs_and_trims_edges() {
+        assert_eq!(slugify("  --Rust__2024--  "), Ok("rust-2024".to_string()));
+    }
+
+    #[test]
+    fn treats_non_ascii_letters_as_separators() {
+        assert_eq!(slugify("Café au lait"), Ok("caf-au-lait".to_string()));
+    }
+
+    #[test]
+    fn rejects_title_without_ascii_letters_or_digits() {
+        assert_eq!(slugify("!!! ???"), Err(SlugError::EmptySlug));
+        assert_eq!(slugify(""), Err(SlugError::EmptySlug));
+    }
+
+    #[test]
+    fn cuts_long_slug_without_trailing_dash() {
+        let title = format!("{} {}", "a".repeat(63), "bbbb");
+        assert_eq!(slugify(&title), Ok("a".repeat(63)));
+    }
+
+    #[test]
+    fn keeps_slug_of_exactly_max_length() {
+        assert_eq!(slugify(&"b".repeat(64)), Ok("b".repeat(64)));
+    }
+}
```
