import { moduleId, localizationID } from './const.js';

// dnd5e v4+ ApplicationV2 character sheet — html is a plain HTMLElement
export function addTogglePartyButtonV2(html, actor)
{
    const enableTitle = game.i18n.localize(`${localizationID}.enable-item-title`);
    const disableTitle = game.i18n.localize(`${localizationID}.disable-item-title`);

    const inventoryTab = html.querySelector('[data-tab="inventory"]');
    const itemEls = (inventoryTab ?? html).querySelectorAll('[data-item-id]');

    // Only physical item types belong in a party inventory
    const physicalTypes = new Set(['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container', 'backpack']);

    // Selector covers the primary dnd5e v4/v5 sheet item-control edit button patterns
    itemEls.forEach(itemEl =>
    {
        const currentItemId = itemEl.dataset.itemId;
        const currentItem = actor.items.get(currentItemId);
        if (!currentItem) return;
        if (!physicalTypes.has(currentItem.type)) return;

        const isInPartyInventory = currentItem.getFlag(moduleId, 'inPartyInventory');
        const title = isInPartyInventory ? disableTitle : enableTitle;
        const activeClass = isInPartyInventory ? 'active' : '';

        // If already injected, just sync the active state and title rather than duplicating
        const existing = itemEl.querySelector('.party-inventory-module.item-toggle');
        if (existing)
        {
            existing.title = title;
            existing.classList.toggle('active', !!isInPartyInventory);
            return;
        }

        // Find any existing edit control to insert after
        const editControl = itemEl.querySelector('[data-action="edit"], [data-action="editDocument"], .item-control.item-edit');
        // For Tidy 5e v2 table rows, fall back to the actions cell (match by data attr or class)
        const tidyActionsCell = editControl ? null : itemEl.querySelector('[data-tidy-column-key="actions"], .tidy-table-actions');
        // For default dnd5e v4 sheet in play mode (no edit buttons visible), fall back to the controls column
        const dnd5eControlsDiv = (!editControl && !tidyActionsCell) ? itemEl.querySelector('[data-column-id="controls"]') : null;
        // dnd5e v5: controls wrapper may lack data-column-id; fall back to a direct .item-control[data-context-menu] on the row
        const dnd5eContextMenuBtn = (!editControl && !tidyActionsCell && !dnd5eControlsDiv) ? itemEl.querySelector('.item-control[data-context-menu]') : null;
        // For Tidy 5e classic sheet, fall back to the classic controls div
        const tidyClassicControls = (!editControl && !tidyActionsCell && !dnd5eControlsDiv && !dnd5eContextMenuBtn) ? itemEl.querySelector('.tidy5e-classic-controls') : null;

        if (!editControl && !tidyActionsCell && !dnd5eControlsDiv && !dnd5eContextMenuBtn && !tidyClassicControls) return;

        const btn = document.createElement('a');
        btn.title = title;
        btn.innerHTML = '<i class="fas fa-users"></i>';
        // Read fresh flag state at click time to avoid stale closure issues
        btn.addEventListener('click', (e) =>
        {
            e.preventDefault();
            e.stopPropagation();
            const item = actor.items.get(currentItemId);
            if (!item) return;
            const current = item.getFlag(moduleId, 'inPartyInventory');
            item.setFlag(moduleId, 'inPartyInventory', !current).then(() =>
            {
                game.modules.get(moduleId).api.openWindow();
            });
        });

        if (editControl)
        {
            btn.className = `item-control party-inventory-module item-toggle ${activeClass}`;
            editControl.insertAdjacentElement('afterend', btn);
        }
        else if (dnd5eControlsDiv)
        {
            btn.className = `unbutton config-button item-control item-action always-interactive party-inventory-module item-toggle ${activeClass}`;
            const contextMenuBtn = dnd5eControlsDiv.querySelector('[data-context-menu]');
            if (contextMenuBtn)
                dnd5eControlsDiv.insertBefore(btn, contextMenuBtn);
            else
                dnd5eControlsDiv.appendChild(btn);
        }
        else if (dnd5eContextMenuBtn)
        {
            btn.className = `unbutton config-button item-control item-action always-interactive party-inventory-module item-toggle ${activeClass}`;
            dnd5eContextMenuBtn.insertAdjacentElement('beforebegin', btn);
        }
        else if (tidyActionsCell)
        {
            btn.className = `tidy-table-button party-inventory-module item-toggle ${activeClass}`;
            const contextMenuBtn = tidyActionsCell.querySelector('[data-action="showContextMenu"], a.tidy-table-button:has(.fa-ellipsis-vertical)');
            if (contextMenuBtn)
                tidyActionsCell.insertBefore(btn, contextMenuBtn);
            else
                tidyActionsCell.appendChild(btn);
        }
        else if (tidyClassicControls)
        {
            // Classic Tidy uses <button> elements; swap the <a> for a <button> to match
            const classicBtn = document.createElement('button');
            classicBtn.type = 'button';
            classicBtn.title = title;
            classicBtn.innerHTML = btn.innerHTML;
            classicBtn.className = `item-list-button party-inventory-module item-toggle ${activeClass}`;
            classicBtn.addEventListener('click', (e) =>
            {
                e.preventDefault();
                e.stopPropagation();
                const item = actor.items.get(currentItemId);
                if (!item) return;
                const current = item.getFlag(moduleId, 'inPartyInventory');
                item.setFlag(moduleId, 'inPartyInventory', !current).then(() =>
                {
                    game.modules.get(moduleId).api.openWindow();
                });
            });
            const editBtn = tidyClassicControls.querySelector('button[title="Edit Item"]');
            if (editBtn)
                tidyClassicControls.insertBefore(classicBtn, editBtn);
            else
                tidyClassicControls.appendChild(classicBtn);
            return; // skip the generic btn which isn't appended here
        }
    });
}

export function addTogglePartyButton(html, actor)
{
    const enableTitle = game.i18n.localize(`${localizationID}.enable-item-title`);
    const disableTitle = game.i18n.localize(`${localizationID}.disable-item-title`);

    html.find(".inventory ol:not(.currency-list)  .item-control.item-edit").each(function ()
    {
        const currentItemId = this.closest(".item").dataset.itemId;
        const currentItem = actor.items.find(item => item.id === currentItemId);
        const isInPartyInventory = currentItem.getFlag(moduleId, 'inPartyInventory');

        const title = isInPartyInventory ? disableTitle : enableTitle;
        const active = isInPartyInventory ? 'active' : '';

        $(`
            <a class="item-control party-inventory-module item-toggle ${active}" title="${title}">
            <i class="fas fa-users"></i>
            </a>
        `).insertAfter(this);

        $(this.nextElementSibling).on('click', function ()
        {
            currentItem.setFlag(moduleId, 'inPartyInventory', !isInPartyInventory);
        });
    });
}

export function addTogglePartyButtonTidy(html, actor)
{
    const enableTitle = game.i18n.localize(`${localizationID}.enable-item-title`);
    const disableTitle = game.i18n.localize(`${localizationID}.disable-item-title`);

    const title = enableTitle;

    html.find(".inventory .item-control.item-edit").each(function ()
    {
        const currentItemId = this.closest(".item").dataset.itemId;
        const currentItem = actor.items.find(item => item.id === currentItemId);
        const isInPartyInventory = currentItem.getFlag(moduleId, 'inPartyInventory');

        const title = isInPartyInventory ? disableTitle : enableTitle;
        const active = isInPartyInventory ? 'active' : '';

        $(`
            <a class="item-control party-inventory-module" title="${title}">
                <i class="fas fa-users"></i>
                <span class="control-label">${title}</span>
            </a>
        `).insertAfter(this);

        $(this.nextElementSibling).on('click', function ()
        {
            currentItem.setFlag(moduleId, 'inPartyInventory', !isInPartyInventory);
        });
    });
}

export function addGroupInventoryIndicatorTidy(html, actor)
{
    const title = game.i18n.localize(`${localizationID}.is-in-party-inventory`);

    html.find(".inventory .item .item-name").each(function ()
    {
        const currentItemId = this.closest(".item").dataset.itemId;
        const currentItem = actor.items.find(item => item.id === currentItemId);
        const isInPartyInventory = currentItem.getFlag(moduleId, 'inPartyInventory');

        if (isInPartyInventory)
        {
            $(`
                <div class="item-state-icon" title="${title}">
                    <i class="fas fa-users"></i>
                </div>
            `).insertAfter(this);
        }
    });
}
