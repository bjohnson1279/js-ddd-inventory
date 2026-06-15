## 2024-06-11 - Add Dynamic titles to disabled buttons & Make alerts accessible
**Learning:** Adding `aria-live` and `role="status"` to dynamic alert/feedback messages ensures that screen reader users are automatically notified when error or success states occur without requiring focus changes. Additionally, providing dynamic `title` attributes on `disabled` buttons gives immediate context to mouse users on *why* the action is currently blocked.
**Action:** When adding toast notifications or error banners, always include `role="status"` and `aria-live="polite"`. When disabling interactive elements, always pair the `disabled` state with a `title` explaining the condition.
## 2024-06-12 - Added Aria-Label to Clear All Scanned Items
**Learning:** In dynamically generated lists with a summary section, actions that affect the entire list (like "Clear All") can be ambiguous when read by a screen reader without context of what they are clearing.
**Action:** Always add explicit aria-labels explaining the scope of the action (e.g. `aria-label="Clear all scanned items in session"`) to avoid confusion, especially for state-clearing actions in high-intensity flows like cycle counting.

## 2024-06-12 - Added Aria-Label to Delete Scanned Item
**Learning:** In dynamic item lists, recurring buttons (like a delete "❌" button on every row) lack context when announced by screen readers out of the surrounding visual flow, as they simply announce "Delete item count" or "❌".
**Action:** Use a dynamic `aria-label` interpolating the item identifier (like SKU) for every recurring row action (e.g. `aria-label={\`Delete item count for \${c.sku}\`}`) to ensure screen reader users have exact context before committing destructive actions.
## 2026-06-14 - Accessibility improvements to span elements simulating buttons
**Learning:** Found several `span` elements acting as buttons (e.g., `onClick` handlers) missing keyboard support (like `tabIndex={0}` and `onKeyDown`) and focus visibility. Adding these ensures users navigating with a keyboard can access all interactive elements properly.
**Action:** Always ensure that when `span` or `div` elements are given `onClick` handlers, they are also made keyboard accessible by adding `role="button"`, `tabIndex={0}`, an `onKeyDown` handler for 'Enter' and 'Space', and focus visible styles.
## 2024-06-15 - Interactive Div Accessibility
**Learning:** Found \`div\` elements (like shipping rate cards) acting as buttons via \`onClick\` handlers, but completely lacking keyboard accessibility. This makes them unreachable for users relying on keyboard navigation or screen readers. Also found that navigation tab buttons containing icons and text may not be read by screen readers if not properly associated with an \`aria-label\`.
**Action:** When a \`div\` or \`span\` is used as an interactive element, always add \`role="button"\`, \`tabIndex={0}\`, \`onKeyDown\` support (for Enter and Space keys), and a dynamic \`aria-label\`. Also ensure it has a \`:focus-visible\` style so keyboard users can see when it's focused. For navigation tab buttons, always add explicit \`aria-label\` attributes to give exact context for screen readers.
