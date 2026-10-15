---
name: webhook-forwarder-rust
description: >
  Reliability-reviewer finds the unbounded queue, missing timeout and endless fixed-delay retries, each with a
  failure scenario, plausibility and minimum correction.
tags: [ability, reliability-review]
runs: 3
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

Use the `shipyard:reliability-reviewer` agent to review the slice below and give me its review in Shipyard finding format.

Start the agent's prompt with this brief, then paste everything under "Slice material" below it unchanged:

```text
Caller: shipyard:coordinator
Mode: SLICE
Slice: 01
Round: 0
Feature-branch: feature/partner-webhooks
Slice-branch: feature/partner-webhooks-slice-01
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

Objective: forward order events to a partner's webhook.
- AC-1: Every order event received on the internal event stream is POSTed to the partner webhook URL.
- AC-2: Delivery is at least once; the partner deduplicates by the `event_id` field in the body.
- AC-3: Peak load is 200 events per second. The partner endpoint sometimes slows to several seconds per
  request during their deploys.

#### INVARIANTS.md (excerpt)

- INV-003: The forwarder process stays under 512 MB of memory.

### Diff

```diff
diff --git a/src/forwarder.rs b/src/forwarder.rs
new file mode 100644
--- /dev/null
+++ b/src/forwarder.rs
@@ -0,0 +1,31 @@
+use std::time::Duration;
+use tokio::sync::mpsc;
+
+#[derive(serde::Serialize, Clone)]
+pub struct OrderEvent {
+    pub event_id: String,
+    pub order_id: String,
+    pub payload: serde_json::Value,
+}
+
+pub fn start(webhook_url: String) -> mpsc::UnboundedSender<OrderEvent> {
+    let (tx, mut rx) = mpsc::unbounded_channel::<OrderEvent>();
+    let client = reqwest::Client::new();
+    tokio::spawn(async move {
+        while let Some(event) = rx.recv().await {
+            let client = client.clone();
+            let url = webhook_url.clone();
+            tokio::spawn(async move { deliver(&client, &url, event).await });
+        }
+    });
+    tx
+}
+
+async fn deliver(client: &reqwest::Client, url: &str, event: OrderEvent) {
+    loop {
+        match client.post(url).json(&event).send().await {
+            Ok(resp) if resp.status().is_success() => return,
+            _ => tokio::time::sleep(Duration::from_millis(100)).await,
+        }
+    }
+}
```
