---
description: Swaps mock data out for live Convex database hooks.
---

Take this selected component. It is currently using hardcoded mock data. 
Refactor it to pull this data dynamically from our Convex backend. 
1. Write the necessary `useQuery` or `useMutation` hook.
2. Add a loading state (e.g., a skeleton loader) for while the data is fetching.
3. Keep all of the shadcn-ui styling exactly the same.