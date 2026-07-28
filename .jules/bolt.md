## 2024-05-18 - Hallucinatory Methods in Code Review Feedback
**Learning:** Code review automated feedback correctly pointed out potential for crashing the application with missing methods, however it hallucinates `consumeFifoLayersBatch` missing from `CostLayerService.ts` when it IS in fact present (lines 108-112).
**Action:** When automated code review flags a method as hallucinatory, use `grep` or `cat` to verify its existence in the codebase before reverting correct optimization changes.
