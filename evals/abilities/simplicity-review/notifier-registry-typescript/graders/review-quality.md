---
type: llm
---

PASS only if all of these hold in the final message:
1. A finding names the Notifier interface, NotifierFactory and NotifierRegistry (and/or the SMS/PUSH enum
   values) as new constructs with one implementation (EmailNotifier) and one channel actually used, backed by a
   count of implementations or call sites, and traces them to no AC (SMS/push are explicit non-goals).
2. It proposes a concrete replacement: signup calls a plain email function or EmailNotifier directly.
3. The unused `retryStrategy` configuration knob is flagged as speculative (retries are a non-goal).
4. Severity is MAJOR or BLOCKING; BLOCKING is acceptable only if the finding meets all five conditions (new,
   no requirement, shown unnecessary, safe deletion with replacement, HIGH confidence).
5. The review does not propose removing the AC-2 try/catch and logging; ideally it lists that and the email
   sending itself under "What stays".
6. A ranked deletion list (the 20% exercise) names actual constructs and files.
FAIL if the review is vague ("over-engineered") without naming constructs and replacements, or if it proposes
deleting something AC-1 or AC-2 needs.
