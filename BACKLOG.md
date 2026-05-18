# Party Inventory — Backlog

## Planned Features

### 1. Quick Even Distribution
**Priority:** High

When a scratchpad item's quantity equals or exceeds the number of active party members, show a one-click **Distribute Evenly** button that assigns one item to each party member automatically, bypassing the full DistributeItem dialog.

**Details:**
- Button appears on scratchpad items when `quantity >= partyMemberCount`
- Assigns `floor(quantity / partyMemberCount)` to each member; remainder stays on the scratchpad
- Uses the same socket-safe distribution path as the existing distribute flow

---

### 2. PC-to-PC Direct Item Transfer
**Status:** Completed

**Priority:** High

Allow a player to give an item directly to another party member without GM involvement or the scratchpad workflow.

**Possible UX:**
- A **"Give to…"** button on the character sheet item row opens a small dialog to select a party member and quantity
- Alternatively: a context menu option on items in the shared inventory section of the party inventory window

**Details:**
- Item is removed from the giver's inventory and created in the recipient's inventory
- Quantity selector for stackable items (e.g. give 2 of 5 arrows)
- Socket-based so non-GM players can initiate; GM executes the transfer

---

### 3. Accessibility
**Priority:** Medium

Ensure the module is fully usable by players with visual impairments or motor disabilities.

**Tasks:**
- Add `aria-label` to all icon-only buttons (split, distribute, collapse, delete, take-currency, split-currency, party-toggle)
- Add `role` and `aria-pressed` to the per-item party toggle button to reflect on/off state
- Keyboard navigation throughout all dialogs (Tab, Enter, Escape, Arrow keys)
- Screen reader live-region announcements when items are added to or removed from the party inventory
- Focus management: return focus to the trigger element when a dialog closes
- Verify sufficient color contrast on the `.active` state for the party toggle button

---

### 4. Bulk Scratchpad Operations
**Priority:** Low

Quality-of-life operations for managing many scratchpad items at once.

**Tasks:**
- Checkbox multi-select on scratchpad item rows
- Bulk delete selected items (with confirmation prompt)
- Bulk distribute selected items (opens DistributeItem pre-populated for each)

---

## Completed

- [x] v13 → v14 Foundry compatibility (FA7 icon renames, dnd5e v5 sheet selectors, module.json verified bump)
- [x] Module renamed from `party-inventory-foundry-v13` to `party-inventory`
- [x] PC-to-PC direct item transfer from character sheet inventory rows
