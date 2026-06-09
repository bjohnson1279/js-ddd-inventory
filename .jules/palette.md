## 2024-06-04 - Keyboard Focus & Tab Accessibility
**Learning:** Adding `:focus-visible` alone is not enough for custom navigation interfaces. Custom tab components must use semantic HTML attributes (`role="tablist"`, `role="tab"`, and `aria-selected`) to be fully interpretable by screen readers. Furthermore, using `:focus:not(:focus-visible) { outline: none; }` provides a robust pattern to deliver highly visible focus rings for keyboard users without compromising the aesthetic experience for mouse click users.
**Action:** Always implement semantic ARIA roles (`tablist`, `tab`, `aria-selected`) alongside `focus-visible` CSS rings when creating non-native navigation tab patterns.
## 2024-06-05 - Add tooltips to disabled buttons\n**Learning:** Tooltips on disabled buttons are helpful, but the native `disabled` attribute prevents tooltip display in some browsers/screen-readers due to absorbing pointer events. Future enhancements might wrap disabled buttons in a `span` or `div` for better tooltip access if full accessibility is required, though native `title` works for many mouse users.\n**Action:** Apply `title` attributes conditionally matching the `disabled` logic to give immediate context on missing prerequisites.

## 2026-06-06 - ARIA Live Regions for Dynamic Feedback
**Learning:** Dynamically rendered feedback messages (like success/error toasts) must include `role="status"` and `aria-live="polite"` to be announced by screen readers. Otherwise, visually impaired users may not realize an action succeeded or failed.
**Action:** Always add ARIA live attributes to conditionally rendered feedback messages that appear without a page reload or focus change.
## 2026-06-07 - Add tooltips to disabled selections
**Learning:** Adding a `title` attribute to disabled `<select>` elements can provide immediate context to the user regarding why an option is unavailable, greatly improving accessibility and intuitiveness. While full tooltips via wrapping `<div>`s are more robust, standard HTML `title` attributes remain effective for standard inputs.
**Action:** Always add native `title` attributes to dynamically disabled form controls matching the disabled state conditionally to ensure clear system feedback without relying solely on documentation or generic UI text.

## 2024-06-08 - Contextual ARIA labels for dynamic lists
**Learning:** Repeating action buttons in dynamic lists (like 'Remove' buttons on form rows) lack context for screen reader users when read in isolation. They just read as 'Remove button'.
**Action:** Always provide a dynamic `aria-label` (e.g., `Remove item ${index + 1}` or incorporating the item name) to repeating action buttons to give immediate context on exactly which entity the action affects.

## 2026-06-09 - Keyboard Accessibility for Interactive Table Rows
**Learning:** Interactive table rows (<tr onClick={...}>) require explicit keyboard support (tabIndex, role='button', and onKeyDown for Enter/Space) and focus indicators to be accessible to screen readers and keyboard users.
**Action:** Always pair onClick handlers on non-interactive elements with corresponding keyboard event handlers and semantic ARIA roles.
