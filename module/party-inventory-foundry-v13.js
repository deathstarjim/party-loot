import { moduleId, localizationID } from './const.js';
import { addTogglePartyButton, addTogglePartyButtonTidy, addGroupInventoryIndicatorTidy, addTogglePartyButtonV2 } from './sheet-inject.js';
import { PartyInventory } from './apps/inventory.js';
import { SplitCurrency } from './apps/split-currency.js';

Hooks.on('setup', () =>
{
    const debouncedReload = foundry.utils.debounce(() => window.location.reload(), 100);

    game.settings.register(moduleId, 'scratchpad', {
        scope: 'world',
        type: Object,
        default: {
            items: {},
            order: []
        },
        onChange: value =>
        {
            PartyInventory.refresh();
        }
    });
    game.settings.register(moduleId, 'currency', {
        scope: 'world',
        type: Object,
        default: {
            pp: 0,
            gp: 0,
            ep: 0,
            sp: 0,
            cp: 0
        },
        onChange: value =>
        {
            PartyInventory.refresh();
        }
    });
    game.settings.register(moduleId, 'excludedActors', {
        scope: 'world',
        type: Object,
        default: [],
        onChange: value =>
        {
            Object.values(ui.windows).filter(w => w instanceof SplitCurrency).forEach(w => w.render());
        }
    });
    game.settings.register(moduleId, 'controlButtonGroup', {
        name: `${localizationID}.setting-control-group`,
        scope: 'client',
        config: true,
        type: String,
        default: "tokens",
        choices: {
            "tokens": `${localizationID}.token-group`,
            "notes": `${localizationID}.notes-group`
        },
        onChange: debouncedReload
    });
    game.settings.register(moduleId, 'currencyNotifications', {
        name: `${localizationID}.setting-currency-notifications`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    game.settings.register(moduleId, 'deleteActorItemOnDrag', {
        name: `${localizationID}.setting-delete-actor-item-on-drag`,
        hint: `${localizationID}.setting-delete-actor-item-on-drag-hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
});

Hooks.on('renderActorSheet5eCharacter', (sheet, html, character) =>
{
    let sheetClasses = sheet.options.classes;
    if (sheetClasses[0] === "tidy5e")
    {
        addTogglePartyButtonTidy(html, sheet.actor);
        addGroupInventoryIndicatorTidy(html, sheet.actor);
    } else
    {
        addTogglePartyButton(html, sheet.actor);
    }
});

// dnd5e v4+ uses ApplicationV2 character sheet (ActorSheet5eCharacter2)
Hooks.on('renderActorSheet5eCharacter2', (sheet, html, context) =>
{
    addTogglePartyButtonV2(html, sheet.actor);
    // Handle clicks on the Party Inventory header control button
    html.addEventListener('click', (e) =>
    {
        if (e.target.closest('[data-action="openPartyInventory"]')) PartyInventory.activate();
    });
});

// All ApplicationV2 actor sheets fire renderActorSheetV2 (default dnd5e v4 and Tidy 5e)
Hooks.on('renderActorSheetV2', (sheet, element, data) =>
{
    if (sheet.actor?.type !== 'character') return;
    addTogglePartyButtonV2(element, sheet.actor);

    // Tidy 5e-specific: add Party Inventory button to sheet header
    if (!element.classList.contains('tidy5e-sheet')) return;
    // Add Party Inventory button to Tidy 5e sheet header if not already present
    if (element.querySelector('.open-party-inventory-button')) return;
    const header = element.querySelector('.sheet-header-buttons, .window-header .header-actions, .tidy5e-sheet .header-button-bar');
    if (!header) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'open-party-inventory-button';
    btn.title = game.i18n.localize(`${localizationID}.button-title`);
    btn.innerHTML = `<i class="fas fa-users"></i> ${game.i18n.localize(`${localizationID}.button-title`)}`;
    btn.addEventListener('click', () => PartyInventory.activate());
    header.prepend(btn);
});

// V13 ApplicationV2 header controls hook — covers default dnd5e v4 sheet and any other AppV2 actor sheet
Hooks.on('getHeaderControlsApplicationV2', (app, controls) =>
{
    if (!(app.actor instanceof Actor)) return;
    if (app.element?.classList?.contains('tidy5e-sheet')) return; // Tidy handles its own header
    controls.push({
        icon: 'fas fa-users',
        label: game.i18n.localize(`${localizationID}.button-title`),
        action: 'openPartyInventory',
        ownership: 'OBSERVER'
    });
});


Hooks.on('getSceneControlButtons', (controls) =>
{
    const groupName = game.settings.get(moduleId, 'controlButtonGroup');
    const group = controls[groupName];
    if (!group) return;
    group.tools[moduleId] = {
        name: moduleId,
        title: `${localizationID}.button-title`,
        icon: 'fas fa-users',
        order: Object.keys(group.tools).length,
        button: true,
        visible: true,
        onChange: () => PartyInventory.activate()
    };
});

Hooks.on('updateItem', (item) =>
{
    PartyInventory.refresh();
});
Hooks.on('deleteItem', (item) =>
{
    PartyInventory.refresh();
});

Hooks.on('init', () =>
{
    game.modules.get(moduleId).api = {
        openWindow: () => { PartyInventory.activate(); }
    }
});
