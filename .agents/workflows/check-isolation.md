---
description: QA check to ensure code doesn't leak data between Workspaces.
---

Review this selected code against the strict "Multi-Tenancy" rule of FounderOS. 
1. Does this code accidentally leak global state?
2. Is it properly scoped so that it would only render or interact with data inside a specific, isolated Workspace ID?
3. Suggest any refactors necessary to ensure total data and visual isolation.