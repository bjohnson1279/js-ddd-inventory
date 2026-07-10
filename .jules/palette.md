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
## 2026-07-01 - Redundant ARIA Labels
**Learning:** Adding an `aria-label` that exactly matches the visible text of an element (e.g., `<button aria-label="Submit">Submit</button>`) causes redundant announcements for screen readers and is an accessibility anti-pattern. `aria-label` should be reserved for elements lacking visible text, like icon-only buttons, or when the visible text lacks necessary context.
**Action:** Before adding an `aria-label` to a button, check if the button already contains sufficient visible text. If it does, rely on the visible text instead of adding a redundant `aria-label`.
