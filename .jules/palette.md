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
