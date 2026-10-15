---
name: bounded-rate-refresher-java
description: >
  False-positive check: a bounded, timed-out, idempotent refresher with clean shutdown must not get BLOCKING
  findings or theoretical MAJORs.
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
Feature-branch: feature/exchange-rates
Slice-branch: feature/exchange-rates-slice-01
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

Objective: keep exchange rates for 20 currencies fresh from the internal rates service.
- AC-1: Every 60 seconds (after the previous run ends) fetch each currency's rate with `GET /rates/{code}`.
- AC-2: If a fetch fails, keep the last good rate and log a warning; never block callers of `rate()`.
- AC-3: On shutdown, stop within 10 seconds.
- AC-4: While the rates service is reachable, a rate is at most 10 minutes stale.

### Diff

```diff
diff --git a/src/main/java/rates/RateRefresher.java b/src/main/java/rates/RateRefresher.java
new file mode 100644
--- /dev/null
+++ b/src/main/java/rates/RateRefresher.java
@@ -0,0 +1,86 @@
+package rates;
+
+import java.io.IOException;
+import java.net.URI;
+import java.net.http.HttpClient;
+import java.net.http.HttpRequest;
+import java.net.http.HttpResponse;
+import java.time.Duration;
+import java.util.List;
+import java.util.Map;
+import java.util.Optional;
+import java.util.concurrent.ConcurrentHashMap;
+import java.util.concurrent.Executors;
+import java.util.concurrent.ScheduledExecutorService;
+import java.util.concurrent.TimeUnit;
+import java.util.logging.Logger;
+
+/** Refreshes exchange rates every minute and keeps the last good value per currency. */
+public final class RateRefresher implements AutoCloseable {
+    private static final Logger LOG = Logger.getLogger(RateRefresher.class.getName());
+    private static final int MAX_ATTEMPTS = 3;
+
+    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
+    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
+    private final Map<String, Double> lastGood = new ConcurrentHashMap<>();
+    private final URI baseUri;
+    private final List<String> currencies;
+
+    public RateRefresher(URI baseUri, List<String> currencies) {
+        this.baseUri = baseUri;
+        this.currencies = List.copyOf(currencies);
+    }
+
+    public void start() {
+        scheduler.scheduleWithFixedDelay(this::refreshAll, 0, 60, TimeUnit.SECONDS);
+    }
+
+    /** Last successfully fetched rate, or empty if none yet. Never blocks (AC-2). */
+    public Optional<Double> rate(String currency) {
+        return Optional.ofNullable(lastGood.get(currency));
+    }
+
+    void refreshAll() {
+        for (String currency : currencies) {
+            try {
+                lastGood.put(currency, fetchWithRetry(currency));
+            } catch (InterruptedException e) {
+                Thread.currentThread().interrupt();   // shutting down (AC-3)
+                return;
+            } catch (Exception e) {
+                LOG.warning("rate refresh failed for " + currency + ": " + e);   // keep last good (AC-2)
+            }
+        }
+    }
+
+    private double fetchWithRetry(String currency) throws Exception {
+        HttpRequest request = HttpRequest.newBuilder(baseUri.resolve("/rates/" + currency))
+                .timeout(Duration.ofSeconds(5))
+                .GET()
+                .build();
+        Exception last = null;
+        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
+            try {
+                HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
+                if (response.statusCode() == 200) {
+                    return Double.parseDouble(response.body().trim());
+                }
+                last = new IOException("status " + response.statusCode());
+            } catch (IOException e) {
+                last = e;
+            }
+            if (attempt < MAX_ATTEMPTS) {
+                Thread.sleep(200L << (attempt - 1));   // 200 ms, then 400 ms
+            }
+        }
+        throw last;
+    }
+
+    @Override
+    public void close() throws InterruptedException {
+        scheduler.shutdownNow();   // interrupts an in-flight refresh (AC-3)
+        if (!scheduler.awaitTermination(10, TimeUnit.SECONDS)) {
+            LOG.warning("rate refresher did not stop within 10 s");
+        }
+    }
+}
```
