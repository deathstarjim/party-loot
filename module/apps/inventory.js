import { moduleId, localizationID } from '../const.js';
import { Currency } from '../currency.js';
import { Scratchpad } from '../scratchpad.js';
import { SplitCurrency } from './split-currency.js';
import { TakeCurrency } from './take-currency.js';
import { DistributeItem } from './distribute-item.js';
import { requestItemDistribution } from './give-item.js';

export class PartyLoot extends FormApplication
{
    static instance = null;

    static get defaultOptions()
    {
        const defaults = super.defaultOptions;

        const overrides = {
            classes: ['dnd5e', 'sheet', 'actor'],
            height: 600,
            width: 600,
            resizable: true,
            editable: true,
            id: moduleId,
            template: `modules/${moduleId}/templates/party-loot.hbs`,
            title: `${localizationID}.window-title`,
            userId: game.userId,
            closeOnSubmit: false,
            submitOnChange: true,
            scrollY: ['.items-list'],
            dragDrop: [
                {
                    dragSelector: '.scratchpad .item',
                }
            ]
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);

        return mergedOptions;
    }

    static activate()
    {
        if (!this.instance)
        {
            this.instance = new PartyLoot();
        }

        if (!this.instance.rendered)
        {
            this.instance.render(true);
        } else
        {
            this.instance.bringToTop();
        }
    }

    static async refresh()
    {
        const focus = this.instance?.element.find("input:focus, textarea:focus");
        const focusElement = focus?.length ? focus[0] : null;
        const focusContent = focus?.val();

        await this.instance?.render();

        if (focusElement && focusElement.name)
        {
            setTimeout(() =>
            {
                const input = this.instance?.form[focusElement.name];
                $(input).val(focusContent);
                $(input).trigger('change');
                if (input && (input.focus instanceof Function)) input.focus();
            }, 0);
        }
    }

    _items = null;

    detectQuantity(input)
    {
        if (input)
        {
            const re = /(?:(\d+)\s+)?(.+?)(?:\s+\((\d+)\)|$)/;
            const matches = input.match(re);

            if (matches)
            {
                if (matches[1])
                {
                    return { name: matches[2], quantity: parseInt(matches[1]), style: 'prefix' };
                } else if (matches[3])
                {
                    return { name: matches[2], quantity: parseInt(matches[3]), style: 'suffix' };
                }
            }
        }

        return { name: input, quantity: 1 };
    }

    splitItem(input)
    {
        const source = this.detectQuantity(input);

        const makeName = (name, quantity, style) =>
        {
            if (quantity > 1)
            {
                if (style == 'suffix')
                {
                    return `${name} (${quantity})`;
                } else
                {
                    return `${quantity} ${name}`;
                }
            }
            return name;
        }

        if (source.style)
        {
            return {
                source: makeName(source.name, Math.ceil(source.quantity / 2), source.style),
                target: makeName(source.name, Math.floor(source.quantity / 2), source.style)
            }
        }

        return null;
    }

    async getData(options)
    {
        const items = game
            .actors
            .filter(a => a.hasPlayerOwner)
            .flatMap(a => a.items.contents)
            .filter(i => i.getFlag(moduleId, 'inPartyLoot'))

        items.sort((a, b) => a.name.localeCompare(b.name));

        this._items = items;

        const partyActors = game.actors.filter(a => a.hasPlayerOwner && a.type === 'character');
        items.forEach(i =>
        {
            const quantity = Math.max(1, Number(i.system.quantity ?? 1));
            const recipientCount = partyActors.filter(a => a.id !== i.actor.id).length;
            i.isStack = quantity > 1;
            i.actorId = i.actor.id;
            i.actorName = i.actor.name;
            i.partyQuantity = quantity;
            i.distributionQuantity = Math.min(quantity, recipientCount || quantity);
            i.canDistributeEvenly = recipientCount > 0 && quantity >= recipientCount;
            i.distributionRecipientCount = recipientCount;
        });
        items.forEach(i => { i.charName = i.actor.name });

        // Only expose valid dnd5e item types that have proper system data (avoids crashing sheets with "base" etc.)
        const dnd5eItemTypes = ["weapon", "equipment", "consumable", "tool", "loot", "container"];
        const typeLabels = Object.fromEntries(
            Object.entries(CONFIG.Item.typeLabels)
                .filter(([k]) => dnd5eItemTypes.includes(k))
                .sort(([, a], [, b]) => game.i18n.localize(a).localeCompare(game.i18n.localize(b)))
        );

        const scratchpadItems = foundry.utils.deepClone(Scratchpad.items);
        for (const i of scratchpadItems)
        {
            // Support both explicit quantity field and legacy name-encoded quantity
            if (i.quantity == null)
            {
                const qr = this.detectQuantity(i.name);
                i.quantity = qr.quantity;
            }
            if (!i.quantity || i.quantity < 1) i.quantity = 1;
            i.canSplit = i.quantity > 1;
            i.hasFootnote = !!i.sourceData;
            // Default collapsed so the description textarea is hidden unless the user opens it
            if (i.isCollapsed == null) i.isCollapsed = true;

            // Enrich HTML description so inline rolls and links are clickable
            {
                const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
                i.enrichedDescription = await TE.enrichHTML(i.description ?? '', { async: true });
            }

            // Pre-compute form field target for the editor helper
            // Also populate this.object so FormApplication's activateEditor can read the initial content
            i.descriptionTarget = `scratchpad.${i.id}.description`;
            foundry.utils.setProperty(this.object, i.descriptionTarget, i.description ?? '');

            // Show a truncated plain-text preview of the source item description
            if (!i.description && i.sourceData?.system?.description?.value)
            {
                const div = document.createElement('div');
                div.innerHTML = i.sourceData.system.description.value;
                const text = (div.textContent || div.innerText || '').trim();
                if (text)
                {
                    i.sourceDescriptionPreview = text.length > 160 ? text.substring(0, 160) + '\u2026' : text;
                    i.hasFootnote = true;
                }
            }
        }

        const currency = Currency.values;
        const isGM = game.user.isGM;

        const labels = {
            splitItem: game.i18n.localize(`${localizationID}.split-item`),
            distributeItem: game.i18n.localize(`${localizationID}.distribute-item-title`),
            collapseItem: game.i18n.localize(`${localizationID}.collapse-item`),
            deleteItem: game.i18n.localize(`${localizationID}.delete-item`),
            namePlaceholder: game.i18n.localize(`${localizationID}.name-placeholder`),
            descriptionPlaceholder: game.i18n.localize(`${localizationID}.description-placeholder`),
            hasSourceData: game.i18n.localize(`${localizationID}.item-has-source-data`),
            hasCustomDescription: game.i18n.localize(`${localizationID}.item-has-custom-description`),
            distributionQuantity: game.i18n.localize(`${localizationID}.distribution-quantity`),
            distributeEvenly: game.i18n.localize(`${localizationID}.distribute-party-item-evenly`),
        };

        return { items, typeLabels, scratchpadItems, currency, isGM, labels };
    }

    async _updateObject(event, formData)
    {
        const expanded = foundry.utils.expandObject(formData);
        const scratchpad = expanded.scratchpad ?? {};
        const currency = expanded.currency;

        for (let id in scratchpad)
        {
            const existing = Scratchpad.getItem(id);
            if (!existing) continue;
            const diff = foundry.utils.diffObject(existing, scratchpad[id]);
            if (!foundry.utils.isEmpty(diff))
            {
                Scratchpad.requestUpdate(id, diff);
            }
        }

        if (currency) Currency.requestUpdate(currency);
    }

    activateListeners(html)
    {
        super.activateListeners(html);

        const self = this;
        const tidyActive = game.modules.get('tidy5e-sheet')?.active || game.modules.get('tidy5e-sheet5e')?.active;
        this.element.toggleClass('party-loot--tidy', !!tidyActive);
        this.element.toggleClass('party-loot--dnd5e', !tidyActive);

        html.find('.currency-input').change(this._onChangeCurrencyDelta.bind(this));

        // Open summary from name
        html.find('h4').on('click', this._onItemSummary.bind(this));

        // Button handling
        html.on('click', "[data-action]", this._handleButtonClick.bind(this));

        // Image browsing
        html.find('img[data-edit]').click(ev => this._onEditImage(ev));

        let IconPicker = game.modules.get('icon-picker')?.api;
        if (IconPicker)
        {
            if (!game.user.can("FILES_BROWSE"))
            {
                html.find('img[data-edit]').click(async function (ev)
                {
                    const picker = new IconPicker();

                    try
                    {
                        let result = await picker.pick();
                        $(this).attr('src', result);
                        $(this).closest('form').submit();
                    } catch { }
                });
            } else
            {
                html.find('img[data-edit]').on("contextmenu", async function (ev)
                {
                    const picker = new IconPicker();

                    try
                    {
                        let result = await picker.pick();
                        $(this).attr('src', result);
                        $(this).closest('form').submit();
                    } catch { }
                });
            }
        }

        // Text area resize
        html.find("textarea").each(function ()
        {
            this.setAttribute("style", "height:" + (this.scrollHeight) + "px;overflow-y:hidden;");
            // The is needed to render properly on the first time
            requestAnimationFrame(() =>
            {
                this.style.height = "auto";
                this.style.height = (this.scrollHeight) + "px";
            });
        }).on("input", function ()
        {
            this.style.height = "auto";
            this.style.height = (this.scrollHeight) + "px";
        });

        // Preview item with data
        html.find(".preview-item").click(function ()
        {
            const itemId = this.closest('[data-item-id]').dataset.itemId;
            const data = self._constructExportableData(itemId);
            const item = new CONFIG.Item.documentClass(data);
            item.testUserPermission = () => true;
            item.update = () => { };
            const sheet = item.sheet
            sheet.render(true, { editable: false });
        });
    }

    _onChangeCurrencyDelta(event)
    {
        const input = event.target;
        const value = input.value;
        if (["+", "-"].includes(value[0]))
        {
            let delta = parseFloat(value);
            input.value = Currency.values[input.name.split('.')[1]] + delta;
        } else if (value[0] === "=")
        {
            input.value = value.slice(1);
        }
    }

    async _onItemSummary(event)
    {
        event.preventDefault();
        const li = $(event.currentTarget).parents(".item");
        const item = this._items.find(i => i.id == li.data("item-id"));

        // Toggle summary
        if (li.hasClass("expanded"))
        {
            let summary = li.children(".item-summary");
            summary.slideUp(200, () => summary.remove());
        } else
        {
            let description = '';
            let properties = [];
            try
            {
                if (typeof item.getChatData === 'function')
                {
                    const chatData = await item.getChatData({ secrets: false });
                    description = chatData.description?.value ?? chatData.description ?? '';
                    properties = chatData.properties ?? [];
                }
            } catch (e) { /* ignore – getChatData removed in newer dnd5e */ }
            if (!description) description = item.system?.description?.value ?? '';

            let div = $(`<div class="item-summary">${description}</div>`);
            let props = $('<div class="item-properties"></div>');
            properties.forEach(p => props.append(`<span class="tag">${typeof p === 'string' ? p : (p.label ?? '')}</span>`));
            div.append(props);
            li.append(div.hide());
            div.slideDown(200);
        }
        li.toggleClass("expanded");
    }

    async _handleButtonClick(event)
    {
        const clickedElement = $(event.currentTarget);
        const action = clickedElement.data().action;
        const itemId = clickedElement.parents('[data-item-id]').data()?.itemId;
        const item = Scratchpad.getItem(itemId);

        switch (action)
        {
            case 'create':
                Scratchpad.requestCreate({
                    img: CONFIG.Item.documentClass.DEFAULT_ICON ?? "icons/svg/item-bag.svg"
                });
                break;
            case 'delete':
                Scratchpad.requestDelete(itemId);
                break;
            case 'split':
                {
                    const qty = (item.quantity != null && item.quantity >= 1) ? item.quantity : this.detectQuantity(item.name).quantity;
                    if (qty > 1)
                    {
                        const half1 = Math.ceil(qty / 2);
                        const half2 = Math.floor(qty / 2);
                        const cleanName = (item.quantity != null) ? item.name : this.detectQuantity(item.name).name;
                        Scratchpad.requestUpdate(itemId, { name: cleanName, quantity: half1 });
                        Scratchpad.requestCreate({
                            img: item.img,
                            name: cleanName,
                            quantity: half2,
                            description: item.description,
                            type: item.type,
                            sourceData: item.sourceData
                        }, { after: itemId });
                    }
                    break;
                }
            case 'collapse':
                item.isCollapsed = !item.isCollapsed;
                Scratchpad.requestUpdate(itemId, item);
                break;
            case 'distribute':
                {
                    const distApp = new DistributeItem(itemId);
                    distApp.render(true);
                    break;
                }
            case 'distribute-party-item':
                {
                    const li = clickedElement.parents('[data-item-id]');
                    const sourceItem = this._items.find(i => i.id === itemId && i.actor?.id === li.data('actor-id'));
                    if (!sourceItem) break;

                    const maxQuantity = Math.max(1, Number(sourceItem.system?.quantity ?? 1));
                    const recipients = game.actors
                        .filter(a => a.hasPlayerOwner && a.type === 'character' && a.id !== sourceItem.actor.id)
                        .sort((a, b) => a.name.localeCompare(b.name));

                    if (!recipients.length)
                    {
                        ui.notifications.warn(game.i18n.localize(`${localizationID}.give-no-recipients`));
                        break;
                    }

                    this._showPartyItemDistributionDialog(sourceItem, recipients, maxQuantity);
                    break;
                }
            case 'take-currency':
                const takeApp = new TakeCurrency();
                takeApp.render(true);
                break;
            case 'split-currency':
                const splitApp = new SplitCurrency();
                splitApp.render(true);
                break;
        }
    }

    async _showPartyItemDistributionDialog(item, recipients, maxQuantity)
    {
        const defaultQuantity = Math.floor(maxQuantity / recipients.length) || 0;
        const rows = recipients.map(actor => `
            <div class="party-loot-distribution-row">
                <label for="party-loot-distribution-${actor.id}">${foundry.utils.escapeHTML(actor.name)}</label>
                <input id="party-loot-distribution-${actor.id}" type="number" name="${actor.id}"
                    value="${defaultQuantity}" min="0" max="${maxQuantity}" step="1">
            </div>`).join('');
        const content = `
            <form class="party-loot-distribution-form">
                <p>${game.i18n.format(`${localizationID}.distribute-party-item-dialog-hint`, {
            count: maxQuantity,
            item: foundry.utils.escapeHTML(item.name)
        })}</p>
                ${rows}
            </form>`;

        const DialogV2 = foundry.applications?.api?.DialogV2;
        const result = DialogV2
            ? await DialogV2.wait({
                window: { title: game.i18n.format(`${localizationID}.distribute-party-item-dialog-title`, { item: item.name }) },
                content,
                buttons: [
                    {
                        action: 'distribute',
                        label: game.i18n.localize(`${localizationID}.distribute-item`),
                        icon: 'fas fa-share',
                        default: true,
                        callback: (_event, _button, dialog) =>
                        {
                            return new foundry.applications.ux.FormDataExtended(dialog.element.querySelector('form')).object;
                        }
                    },
                    { action: 'cancel', label: game.i18n.localize('Cancel'), icon: 'fas fa-times' }
                ],
                rejectClose: false
            })
            : await this._legacyDistributionDialog(content, item.name);

        if (!result || result === 'cancel') return;

        const allocations = Object.fromEntries(
            Object.entries(result).map(([actorId, quantity]) => [actorId, Math.floor(Number(quantity)) || 0])
        );
        const total = Object.values(allocations).reduce((sum, quantity) => sum + quantity, 0);
        if (total < 1 || total > maxQuantity)
        {
            ui.notifications.warn(game.i18n.format(`${localizationID}.distribute-party-item-invalid-quantity`, {
                min: 1,
                max: maxQuantity
            }));
            return;
        }

        requestItemDistribution({
            sourceActorId: item.actor.id,
            itemId: item.id,
            allocations
        });
    }

    _legacyDistributionDialog(content, itemName)
    {
        return new Promise(resolve =>
        {
            new Dialog({
                title: game.i18n.format(`${localizationID}.distribute-party-item-dialog-title`, { item: itemName }),
                content,
                buttons: {
                    distribute: {
                        icon: '<i class="fas fa-share"></i>',
                        label: game.i18n.localize(`${localizationID}.distribute-item`),
                        callback: html =>
                        {
                            const FormDataClass = foundry.applications?.ux?.FormDataExtended ?? FormDataExtended;
                            resolve(new FormDataClass(html[0].querySelector('form')).object);
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize('Cancel'),
                        callback: () => resolve(null)
                    }
                },
                default: 'distribute',
                close: () => resolve(null)
            }).render(true);
        });
    }

    _onEditImage(event)
    {
        const li = $(event.currentTarget).parents(".item");
        const itemId = li.data("item-id");
        const current = Scratchpad.getItem(itemId)?.img

        const fp = new FilePicker({
            type: "image",
            current: current,
            callback: path =>
            {
                event.currentTarget.src = path;
                if (this.options.submitOnChange)
                {
                    this._onSubmit(event);
                }
            },
            top: this.position.top + 40,
            left: this.position.left + 10
        });
        return fp.browse();
    }

    _canDragStart(event)
    {
        return true;
    }

    _canDragDrop(event)
    {
        return true;
    }

    _constructExportableData(itemId)
    {
        const item = Scratchpad.getItem(itemId);

        const nameInfo = this.detectQuantity(item.name);
        // Use explicit quantity field if present, fall back to name-encoded quantity for legacy items
        const quantity = (item.quantity != null && item.quantity >= 1) ? item.quantity : nameInfo.quantity;

        let data = {
            type: item.type,
            name: nameInfo.name,
            img: item.img,
            system: {
                quantity: quantity
            },
            flags: {
                [moduleId]: {
                    scratchpadId: itemId
                }
            }
        };
        if (item.description && item.description.trim())
        {
            data = foundry.utils.mergeObject(data, {
                system: {
                    description: { value: `<p>${item.description}</p>` }
                }
            });
        }
        if (item.sourceData)
        {
            data = foundry.utils.mergeObject(item.sourceData, data);
        }

        return data;
    }

    _onDragStart(event)
    {
        const li = $(event.currentTarget);
        const itemId = li.data("item-id");
        const data = this._constructExportableData(itemId);

        event.dataTransfer.setData("text/plain", JSON.stringify({
            type: "Item",
            data: data
        }));
        event.dataTransfer.setDragImage(
            li[0],
            event.pageX - li.offset().left,
            event.pageY - li.offset().top);
    }

    async _onDrop(event)
    {
        const dataStr = event.dataTransfer.getData('text/plain');
        if (!dataStr || dataStr === "") { return false; }
        const dragData = JSON.parse(dataStr);

        function createFromData(data)
        {
            const quantity = data.system?.quantity ?? 1;
            let description = '';
            if (data.system?.description?.value)
            {
                const div = document.createElement('div');
                div.innerHTML = data.system.description.value;
                description = (div.textContent || div.innerText || '').trim();
            }
            Scratchpad.requestCreate({
                type: data.type,
                name: data.name,
                img: data.img,
                quantity: quantity,
                description: data.system?.description?.value ?? '',
                sourceData: foundry.utils.duplicate(data)
            });
        }

        if (dragData.data)
        {
            const itemData = dragData.data;
            const scratchpadId = itemData.flags?.[moduleId]?.scratchpadId;
            const onScratchpad = !!Scratchpad.items.find(i => i.id === scratchpadId)

            // Reorder
            if (onScratchpad)
            {
                const targetId = event.target.closest('.item')?.dataset?.itemId;
                if (targetId)
                {
                    Scratchpad.requestReorder(scratchpadId, targetId);
                }
                return false;
            }

            createFromData(itemData);
            return false;
        } else if (dragData.uuid)
        {
            const item = fromUuidSync(dragData.uuid);

            if (dragData.type !== 'Item') { return false; }

            if (item.pack && item._id)
            {
                const pack = game.packs.get(item.pack);
                if (pack.documentName == 'Item')
                {
                    const packItem = await pack.getDocument(item._id);
                    createFromData(packItem._source);
                    return false;
                }
            } else if (item.system)
            {
                createFromData(item._source);

                if (item.actor && game.settings.get(moduleId, 'deleteActorItemOnDrag'))
                {
                    if (item.actor.isOwner)
                    {
                        item.delete();
                    }
                }

                return false;
            }
        }

        return true;
    }
}


