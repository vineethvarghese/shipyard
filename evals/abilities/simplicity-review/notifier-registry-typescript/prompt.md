---
name: notifier-registry-typescript
description: >
  Simplicity-reviewer proposes deleting a one-implementation interface, factory, registry and unused retry
  knob, with counts, a ranked deletion list and What stays.
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
Feature-branch: feature/welcome-email
Slice-branch: feature/welcome-email-slice-01
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

Objective: send a welcome email when a user signs up.
- AC-1: After a successful signup, exactly one welcome email is sent to the new user's address.
- AC-2: If sending fails, signup still succeeds and the failure is logged with the user id.
- Non-goals: SMS, push notifications, retries.

#### INVARIANTS.md (excerpt)

- (no entries about notifications)

### Diff

```diff
diff --git a/src/notify/Notifier.ts b/src/notify/Notifier.ts
new file mode 100644
--- /dev/null
+++ b/src/notify/Notifier.ts
@@ -0,0 +1,7 @@
+export interface NotificationMessage { subject: string; body: string }
+
+export interface Notifier {
+  send(to: string, message: NotificationMessage): Promise<void>;
+}
+
+export enum NotificationChannel { EMAIL = "email", SMS = "sms", PUSH = "push" }

diff --git a/src/notify/NotifierRegistry.ts b/src/notify/NotifierRegistry.ts
new file mode 100644
--- /dev/null
+++ b/src/notify/NotifierRegistry.ts
@@ -0,0 +1,15 @@
+import { Notifier, NotificationChannel } from "./Notifier";
+
+export class NotifierRegistry {
+  private readonly notifiers = new Map<NotificationChannel, Notifier>();
+
+  register(channel: NotificationChannel, notifier: Notifier): void {
+    this.notifiers.set(channel, notifier);
+  }
+
+  get(channel: NotificationChannel): Notifier {
+    const notifier = this.notifiers.get(channel);
+    if (!notifier) throw new Error(`no notifier for ${channel}`);
+    return notifier;
+  }
+}

diff --git a/src/notify/NotifierFactory.ts b/src/notify/NotifierFactory.ts
new file mode 100644
--- /dev/null
+++ b/src/notify/NotifierFactory.ts
@@ -0,0 +1,11 @@
+import { Notifier, NotificationChannel } from "./Notifier";
+import { NotifierRegistry } from "./NotifierRegistry";
+import { NotifyConfig } from "./config";
+
+export class NotifierFactory {
+  constructor(private readonly registry: NotifierRegistry, private readonly config: NotifyConfig) {}
+
+  create(channel: NotificationChannel = this.config.defaultChannel): Notifier {
+    return this.registry.get(channel);
+  }
+}

diff --git a/src/notify/config.ts b/src/notify/config.ts
new file mode 100644
--- /dev/null
+++ b/src/notify/config.ts
@@ -0,0 +1,8 @@
+import { NotificationChannel } from "./Notifier";
+
+export interface NotifyConfig {
+  defaultChannel: NotificationChannel;
+  retryStrategy: "none" | "linear" | "exponential";
+}
+
+export const notifyConfig: NotifyConfig = { defaultChannel: NotificationChannel.EMAIL, retryStrategy: "none" };

diff --git a/src/notify/EmailNotifier.ts b/src/notify/EmailNotifier.ts
new file mode 100644
--- /dev/null
+++ b/src/notify/EmailNotifier.ts
@@ -0,0 +1,10 @@
+import { Notifier, NotificationMessage } from "./Notifier";
+import type { SmtpClient } from "../mail/smtp";
+
+export class EmailNotifier implements Notifier {
+  constructor(private readonly smtp: SmtpClient) {}
+
+  async send(to: string, message: NotificationMessage): Promise<void> {
+    await this.smtp.sendMail({ to, subject: message.subject, text: message.body });
+  }
+}

diff --git a/src/notify/bootstrap.ts b/src/notify/bootstrap.ts
new file mode 100644
--- /dev/null
+++ b/src/notify/bootstrap.ts
@@ -0,0 +1,11 @@
+import { smtpClient } from "../mail/smtp";
+import { EmailNotifier } from "./EmailNotifier";
+import { NotificationChannel } from "./Notifier";
+import { NotifierFactory } from "./NotifierFactory";
+import { NotifierRegistry } from "./NotifierRegistry";
+import { notifyConfig } from "./config";
+
+const registry = new NotifierRegistry();
+registry.register(NotificationChannel.EMAIL, new EmailNotifier(smtpClient));
+
+export const notifierFactory = new NotifierFactory(registry, notifyConfig);

diff --git a/src/signup/signup.ts b/src/signup/signup.ts
--- a/src/signup/signup.ts
+++ b/src/signup/signup.ts
@@ -40,2 +40,7 @@
   await users.insert(user);
+  try {
+    await notifierFactory.create().send(user.email, welcomeMessage(user));
+  } catch (err) {
+    log.error("welcome email failed", { userId: user.id, err }); // AC-2
+  }
   return user;
```
