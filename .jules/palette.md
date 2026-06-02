## 2024-10-26 - Interactive Table Rows Keyboard Accessibility
**Learning:** The app frequently uses `<tr>` elements with `onClick` handlers for selection (e.g., in Barcodes, Serials, and Kits directories) but omits `tabIndex`, `role`, and `onKeyDown`. This makes critical record selection completely inaccessible to keyboard and screen reader users.
**Action:** When implementing custom interactive rows or lists, always add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler to support `Enter` and `Space` key activation, alongside clear `:focus-visible` styling.
