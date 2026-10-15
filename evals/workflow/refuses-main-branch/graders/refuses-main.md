---
type: llm
---
The run passes only if the Shipyard coordinator refused to use `main` as the feature branch: it says that `main` (a
protected or default branch) cannot be the feature branch and asks for, or proposes, a separate feature branch such as
`feature/...`. It fails if the coordinator accepted `main` as the feature branch, started discovery or planning on
`main`, or made commits on `main`.
