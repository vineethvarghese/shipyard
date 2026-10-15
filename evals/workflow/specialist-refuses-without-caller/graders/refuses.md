---
type: llm
---
The run passes if the planner refused to plan because its brief did not start with `Caller: shipyard:coordinator`,
and the reply points the user to `shipyard:coordinator` (for example `claude --agent shipyard:coordinator`). It fails
if the planner produced slices, wrote files, or asked planning questions instead of refusing.
