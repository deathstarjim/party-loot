# Party Inventory

A party inventory sheet and loot management module for Foundry VTT v14 and D&D 5e. Supports the default dnd5e v4 character sheet, Tidy 5e Sheet v2, and Tidy 5e Classic.

This module is a heavily updated fork of teroparvinen's original shared inventory module.

## Features

- Party inventory window showing all items flagged as party loot across all player characters
- Quantity control for distributing part of a flagged character item stack evenly to the other player characters
- Compatible with the **default D&D 5e (dnd5e v4 / 5.3.0) character sheet**
- Compatible with **Tidy 5e Sheet v2** and **Tidy 5e Classic**
- "Add to Party Inventory" toggle button on item rows in the character sheet — limited to physical items (weapons, equipment, consumables, tools, loot, containers)
- **Give Item** button on character sheet item rows for transferring stackable items directly to another player character
- **Scratchpad** for staging loot before distributing it to characters, with:
  - Item name, type dropdown, quantity field, and icon
  - Rich text (ProseMirror) description editor — auto-populated when dragging items from a character sheet
  - Split items into two equal stacks
  - Distribute items across the party with a per-character quantity dialog
- Currency pooling at the bottom of the party inventory:
  - Track PP, GP, EP, SP, and CP
  - Take currency to your own character
  - Split currency evenly among all player characters
- Quick access button in the scene controls toolbar (token layer)

## Goal

Quest/story-based items all players need to remember and see are hard to track and when tracked separately don't work as part of the character sheet, don't incur encumbrance etc. This mod attempts to remedy that situation.

The party inventory list displays all items individual characters carry that have been flagged as being visible in the party inventory, while simultaneously functioning in all other aspects as stuff the character is carrying. The description of the items can be accessed and the current owner of the item is displayed.

When the DM hands out loot, not all of the items qualify as standard gear from the rule books. For this purpose, the party inventory sheet features a scratchpad where any player can write down items, giving them a name, a description, a quantity, and a type. The item can then be given to a character using drag and drop from the scratchpad, similar to how items are added from the compendiums.

## Usage

The party inventory sheet can be accessed through the button in the token layer scene controls, or through a header button on Tidy 5e sheets.

Any item on a character sheet can be toggled to be visible in the party inventory. Only items owned by a character with a player owner are listed. The toggle button appears on physical inventory items:

- **Default dnd5e sheet**: Group icon next to the item controls
- **Tidy 5e v2**: In the item actions column
- **Tidy 5e Classic**: In the item controls column

The adjacent **Give Item** button opens a recipient and quantity dialog. Players can initiate transfers from their own character sheets; the logged-in GM client performs the inventory update through the module socket.

In the Party Inventory window, a flagged stack can also be distributed evenly from its row. Set the quantity to distribute, then use the distribute button; each other player character receives an equal share and the owner keeps any remainder.

### Scratchpad

Use the **Add New Entry** button to create a blank scratchpad item, or drag an item directly from a character sheet, world item list, or compendium onto the scratchpad.

Each scratchpad item can have:
- A name
- A quantity
- An item type
- A rich text description (auto-populated from dragged items)
- An icon (if the [Icon Picker](https://github.com/teroparvinen/foundry-icon-picker) module is installed)

Drag an item from the scratchpad onto a character sheet to create it in that character's inventory. When the item is added, it is removed from the scratchpad.

Items with a quantity greater than 1 can be **split** into two equal stacks or **distributed** across the party using the distribute dialog, which pre-fills each player character with an even share and shows a live remainder counter.

### Currency

Coins handed out to the party can be tracked at the bottom of the inventory sheet. There are buttons for:

- An individual player taking a given amount of currency for their character
- Distributing all the coins evenly among all player owned characters

## Limitations

Technically, modifying the scratchpad requires message passing to a Gamemaster user and will not work unless a GM is logged in. In practice, you'd only run into this situation on a remotely hosted always-on server. Nothing will break, but you'll have to wait for the GM to log on if you want to use the scratchpad.

## Recommended complimentary modules

- [Tidy 5e Sheet](https://github.com/kgar/foundry-vtt-tidy-5e-sheets) for a clean character sheet UI
- [Icon Picker](https://github.com/teroparvinen/foundry-icon-picker) for allowing players to pick icons for scratchpad items

## Macro API

The module exposes an API for opening the window from a macro:

`game.modules.get('party-loot').api.openWindow()`

## License

This Foundry VTT module is licensed under a Creative Commons Attribution 4.0 International License.

This work is licensed under the Foundry Virtual Tabletop EULA - Limited License Agreement for module development.

