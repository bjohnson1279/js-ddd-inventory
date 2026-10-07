## 2024-06-11 - Add Dynamic titles to disabled buttons & Make alerts accessible
**Learning:** Adding `aria-live` and `role="status"` to dynamic alert/feedback messages ensures that screen reader users are automatically notified when error or success states occur without requiring focus changes. Additionally, providing dynamic `title` attributes on `disabled` buttons gives immediate context to mouse users on *why* the action is currently blocked.
**Action:** When adding toast notifications or error banners, always include `role="status"` and `aria-live="polite"`. When disabling interactive elements, always pair the `disabled` state with a `title` explaining the condition.

## 2024-06-12 - Added Aria-Label to Clear All Scanned Items
**Learning:** In dynamically generated lists with a summary section, actions that affect the entire list (like "Clear All") can be ambiguous when read by a screen reader without context of what they are clearing.
**Action:** Always add explicit aria-labels explaining the scope of the action (e.g. `aria-label="Clear all scanned items in session"`) to avoid confusion, especially for state-clearing actions in high-intensity flows like cycle counting.

## 2024-06-12 - Added Aria-Label to Delete Scanned Item
**Learning:** In dynamic item lists, recurring buttons (like a delete "❌" button on every row) lack context when announced by screen readers out of the surrounding visual flow, as they simply announce "Delete item count" or "❌".
**Action:** Use a dynamic `aria-label` interpolating the item identifier (like SKU) for every recurring row action (e.g. `aria-label={\`Delete item count for \${c.sku}\`}`) to ensure screen reader users have exact context before committing destructive actions.

## 2024-06-13 - Enhance Visibility of Delete Action in Mobile Scanner Cycle Count
**Learning:** Icon-only buttons representing destructive actions (like "❌") in lists can blend into the background or look disabled when they lack distinct styling and hover states, leading to poor usability for users expecting clear interactive cues.
**Action:** Always provide adequate padding and clear hover transition states (e.g., background highlight and text color change) to icon-only buttons to reinforce their interactivity and ensure destructive actions are easily identifiable and visually responsive to pointer events.

## 2026-06-14 - Accessibility improvements to span elements simulating buttons
**Learning:** Found several `span` elements acting as buttons (e.g., `onClick` handlers) missing keyboard support (like `tabIndex={0}` and `onKeyDown`) and focus visibility. Adding these ensures users navigating with a keyboard can access all interactive elements properly.
**Action:** Always ensure that when `span` or `div` elements are given `onClick` handlers, they are also made keyboard accessible by adding `role="button"`, `tabIndex={0}`, an `onKeyDown` handler for 'Enter' and 'Space', and focus visible styles.

## 2024-06-15 - Interactive Div Accessibility
**Learning:** Found \`div\` elements (like shipping rate cards) acting as buttons via \`onClick\` handlers, but completely lacking keyboard accessibility. This makes them unreachable for users relying on keyboard navigation or screen readers. Also found that navigation tab buttons containing icons and text may not be read by screen readers if not properly associated with an \`aria-label\`.
**Action:** When a \`div\` or \`span\` is used as an interactive element, always add \`role="button"\`, \`tabIndex={0}\`, \`onKeyDown\` support (for Enter and Space keys), and a dynamic \`aria-label\`. Also ensure it has a \`:focus-visible\` style so keyboard users can see when it's focused. For navigation tab buttons, always add explicit \`aria-label\` attributes to give exact context for screen readers.

## 2024-06-16 - Dynamic Titles and Aria-Labels on Disabled Text Inputs
**Learning:** Text inputs that enter disabled states (like barcode scan buffers during async loading) can leave screen reader and keyboard users confused if there's no dynamic label or title explaining the locked state.
**Action:** When disabling interactive text inputs during loading or blocking operations, pair `disabled={state}` with a dynamic `title` attribute explaining the state (e.g. `title={loading ? "Processing..." : "Ready"}`), and set `aria-busy` to `true` to ensure the loading context is communicated properly to assistive tech.

## 2024-06-17 - Add aria-labels to interactive span and div elements
**Learning:** Interactive elements like `span` and `div` acting as buttons need explicit `aria-label` attributes to provide exact context for screen reader users, especially in lists and dynamic components where visual context isn't available.
**Action:** Always add an `aria-label` when giving a `role="button"` to non-button semantic elements, ensuring screen reader users understand what action they are about to perform.
## 2024-06-22 - Add loading states to scan triggers
**Learning:** In React applications interacting with async services, buttons that trigger long-running actions (like ingestion scanning) need immediate visual feedback and disabled states to prevent double submissions and assure the user that the action is processing. Combining `disabled`, `aria-busy`, and `title` updates ensures robust accessibility for assistive tech.
**Action:** Always add local boolean loading state to async button actions, applying `disabled={loading}` and `aria-busy={loading}` for UX and accessibility.

## 2024-06-23 - Add aria-busy to disabled action buttons
**Learning:** Adding `aria-busy` along with `disabled` state on buttons during asynchronous actions greatly improves the screen reader experience, giving context that something is processing.
**Action:** Make sure to consistently pair `disabled` with `aria-busy` for buttons executing network requests.

## 2024-06-24 - Forms without proper labels
**Learning:** Found a recurring pattern in `webapp/src/App.tsx` where many forms used `<label>` directly wrapping the text but failed to associate with the corresponding `<input>` via the `htmlFor` attribute.
**Action:** Always ensure that when implementing form components, `htmlFor` is provided on the label and matching `id` on the input to improve accessibility for screen readers and increase the clickable hit area.

## 2026-06-25 - Handling Time-Series Data in UI Components
**Learning:** Displaying time-series historical data (like ledger entries or stock transactions) requires clean sorting and efficient pagination to prevent DOM bloat and layout shift when huge lists are loaded.
**Action:** Always implement server-side pagination, sorting by timestamp, and clear date/time formatters in UI displays of ledger, transaction, or dispatch lists. Ensure that dynamic alert messages or state loading components (like fetching older history chunks) use appropriate ARIA live regions to notify the user of background updates.

## 2024-05-24 - Dynamic ARIA Labels on Emoji-Based State Buttons
**Learning:** State-change buttons that rely primarily on emojis or brief text (like terminal mode selectors) lack context when read by screen readers. Furthermore, standard `aria-label` or `title` attributes alone don't convey the current active/inactive state dynamically, making navigation confusing.
**Action:** Always provide explicit, dynamic `aria-label` and `title` attributes (e.g., `aria-label={isActive ? "Mode active" : "Switch to Mode"}`) to state-change buttons to ensure robust accessibility and clear state indication for screen readers and tooltips.

## 2024-06-26 - Replacing alert() with Accessible Toast Notifications
**Learning:** Native `alert()` calls disrupt the user flow and lack robust accessibility controls. Screen readers may handle them inconsistently, and they freeze the main thread.
**Action:** Replace `alert()` calls with dynamic in-page toast or banner notifications. Ensure these notifications are wrapped in a container with `role="status"` and `aria-live="polite"` so screen readers announce them automatically without stealing focus.

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks for edits to `schema.prisma`, `index.ts`, `public/index.php`, `db/schema.rb`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Completeness & Verification Directives
- **Explicit Parameter & Contract Validation**: When creating or modifying API endpoints (Express, Fastify, Rails, Laravel), always implement explicit parameter and request body validation schemas (e.g. `z.string().uuid()`) to prevent unhandled 404/500 fallthroughs.
- **Database Indexing for Queries**: When addressing query bottlenecks or adding query lookup filters, always implement native database index migrations rather than loading collections into memory and performing array filtering (`.filter()`, `.select`).
- **Co-Occurring Dependency Auditing**: When bumping any dependency version, verify that other transitive dependencies do not carry high/critical security advisories (e.g. run `bundler-audit`, `npm audit`). Never introduce a version bump that breaks underlying framework APIs.
- **Self-Verification Before Commit**: Always run syntax checks (`bash -n` for shell scripts, `tsc --noEmit` for TypeScript, linter checks) and targeted test runners locally before opening or updating a PR.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **No Journal-Only PRs**: Never open a pull request that only contains updates to .jules/*.md files without corresponding functional code changes and tests.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

## Assertiveness, Decisive PR Execution & Comparative Recommendations
- **Proactive & Decisive PR Submission**: Do NOT repeatedly pause to ask permission to open a pull request (e.g., avoid "Would you like me to open a PR for this?", "Can I submit the PR?", "Should I go ahead and create the PR?"). When an optimization, fix, or feature satisfies requirements, passes local test runners/linters, and preserves architectural invariants, proceed decisively to create and submit the Pull Request with a clear, structured summary and rationale.
- **Explicit Recommendations on Options**: When presenting multiple implementation strategies or architecture options (e.g., Option A vs. Option B), NEVER leave the choice open-ended or passive. Always make an explicit, reasoned recommendation (prefixed with `(Recommended)`) based on **overall technical effectiveness**:
  1. *Algorithmic & Complexity Gains*: Time and space complexity impact (O(N*M) -> O(N+M), reduction of nested scans).
  2. *Resource Overhead*: Heap allocations, memory pressure, and GC pause reduction.
  3. *Domain & Architecture Invariants*: Strict backward compatibility, contract stability, and prevention of regression risks.
  4. *Security & Reliability*: Input validation, cryptographic safety, and concurrency safety.
- **Lead with Recommended Path**: State clearly why the recommended solution delivers the highest net value and immediately execute or propose it as the primary course of action rather than asking open-ended questions.

## Scope Verification, Minimal Churn & CI Protection Directives
- **Scope Verification Before Variable Binding**: When adding interactive states or accessibility attributes (e.g. `disabled={loading}`, `aria-busy={loading}`, `isSubmitting`), NEVER assume a variable identifier exists. Always inspect component props, local state hooks (`useState`), or declaration scope first. If not defined, declare the state hook or reuse an existing scope variable. Never introduce TS2304 / TS2552 ("Cannot find name") compile errors.
- **Surgical Edits Only (No Whole-File Formatting)**: Never run whole-file code formatters (Prettier, Black, Pint, rustfmt) across unmodified lines. Changes must be strictly range-scoped and limited to the minimal AST block needed. Avoid noisy quote/whitespace churn that masks real logic changes and causes merge conflicts. Verify with `git diff -w` that non-functional churn is zero.
- **Zero Scratch File Commits**: Never stage or commit ad-hoc verification, patch, or debug scripts (`test.cjs`, `fix_*.cjs`, `fix_*.php`, `patch_*.py`, `patch_*.sh`, `scratch_*`). Execute checks via the project's native test commands (`npm test`, `pytest`, `phpunit`, etc.) and delete temporary scripts before creating git commits.
- **Never Weaken CI Workflows**: Do not modify `.github/workflows/**` to bypass failures (e.g. adding `|| true`, setting `continue-on-error: true`, or commenting out assertions). Always resolve the defect in the source code or test fixture.
- **Explicit Parameter & Variable Types**: In TypeScript files, avoid implicit `any` by always providing explicit types on functions, parameters, and arrow callbacks (e.g. `(id: string) => ...`). Verify zero type errors with `tsc --noEmit` before committing.

## 2026-09-29 - Scope Verification for Async Loading Attributes
**Learning:** Blindly injecting `disabled={loading}` or `aria-busy={loading}` into JSX/TSX buttons causes fatal TypeScript compilation errors (`TS2304: Cannot find name 'loading'`) when `loading` is not declared in component props, state hooks (`useState`), or mutation results. Furthermore, using temporary patch scripts (`fix_*.cjs`) to manipulate source code pollutes the git index.
**Action:** Before referencing any state identifier (such as `loading`, `isSubmitting`, `isPending`) in `disabled` or `aria-busy`, inspect the component scope. If no loading state is tracked, define it using `useState(false)` or check existing query/mutation hooks. Never bind undeclared variables. Always run `tsc --noEmit` locally and never commit temporary fix scripts.

## Additive Documentation & Scratch Cleanliness Directives
- **Strictly Additive Journal Updates**: When updating `.jules/*.md`, strictly append new dated entries (`## YYYY-MM-DD - Title`). NEVER delete, truncate, or overwrite historical learnings or previous entries.
- **Substantive Code Diff Requirement**: Pull requests must include substantive code changes in `src/`, `app/`, `lib/`, or `tests/`. Never open PRs that modify only `.jules/*.md` journals or root scratch scripts.
- **Zero Scratch File Commits**: Never commit `*.diff`, `*.patch`, `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `patch_*.py` files. Always remove temporary debugging or verification scripts prior to committing.

## Scope Quarantine, Journaling & Security Test Invariants
- **Strictly Append-Only Journaling**: When adding learnings to `.jules/*.md`, append strictly at the end of the file. Do not rewrite, deduplicate, or remove lines beginning with `## YYYY-MM-DD`.
- **Surgical Scope Quarantine**: Modify only the files directly involved in the issue and their corresponding test fixtures. Do not delete, rename, or perform drive-by cleanups of unrelated root-level scripts or legacy files.
- **Coupled Test Fixture Awareness for Security Invariants**: When changing fail-open fallback behavior (such as hardening decryption to fail closed), always update upstream test mocks that rely on plaintext credentials or mock values.

## 2026-10-07 - Process Streamlining, Sibling Coalescence & Autoloading Invariants
**Learning:**
1. Fragmenting stub methods across multiple micro-PRs on the same class causes unavoidable sibling merge collisions and wasted CI cycles.
2. Placing multiple domain services into a single file breaks Composer PSR-4 autoloader discovery in PHP, triggering fatal `Class not found` errors.
3. Writing service calls against unverified entity methods causes fatal runtime errors.
4. String-escaping markdown journal updates corrupts rendered formatting.

**Action:**
- **Coalesce Micro-PRs**: When implementing or scaffolding related controller endpoints, stub methods, or repository queries on a single class, consolidate all changes into a single coherent pull request. Never create separate fragmented PRs for each individual method of the same class.
- **Strict PSR-4 Isolation in PHP**: In PHP codebases, place every class, interface, and enum in its own file named `<ClassName>.php` matching its namespace path. Never combine multiple domain classes into a single file.
- **Domain Contract Verification**: Always inspect entity and aggregate root definitions to verify exact method and property names before writing service logic or test fixtures.
- **Clean Markdown Formatting**: Always append journal entries using actual newline characters, never literal string escape sequences.
