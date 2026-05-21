import { moduleId, localizationID } from '../const.js';
import { Scratchpad } from '../scratchpad.js';

export class DistributeItem extends FormApplication
{
    constructor(itemId)
    {
        super({});
        this.itemId = itemId;
    }

    static get defaultOptions()
    {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ['sheet', 'dnd5e'],
            height: 'auto',
            width: 480,
            resizable: true,
            editable: true,
            id: `${moduleId}-distribute-item`,
            template: `modules/${moduleId}/templates/distribute-item.hbs`,
            title: `${localizationID}.distribute-item`,
            closeOnSubmit: true,
            submitOnChange: false
        });
    }

    getData(options)
    {
        const item = Scratchpad.getItem(this.itemId);
        if (!item) return {};

        const quantity = item.quantity ?? 1;
        const actors = game.actors
            .filter(a => a.hasPlayerOwner && a.type === 'character')
            .sort((a, b) => a.name.localeCompare(b.name));

        const perActor = actors.length ? Math.floor(quantity / actors.length) : 0;

        return {
            item,
            quantity,
            actors: actors.map(a => ({
                id: a.id,
                name: a.name,
                img: a.img,
                quantity: perActor
            }))
        };
    }

    activateListeners(html)
    {
        super.activateListeners(html);
        html.find('.distribute-qty-input').on('input', () => this._updateRemainder(html));
        this._updateRemainder(html);
    }

    _updateRemainder(html)
    {
        const item = Scratchpad.getItem(this.itemId);
        if (!item) return;
        const total = item.quantity ?? 1;
        let assigned = 0;
        html.find('.distribute-qty-input').each(function ()
        {
            assigned += parseInt(this.value) || 0;
        });
        const remaining = total - assigned;
        html.find('.distribute-remainder-value').text(remaining);
        html.find('[type="submit"]').prop('disabled', remaining < 0);
    }

    async _updateObject(event, formData)
    {
        const expanded = foundry.utils.expandObject(formData);
        const actorQuantities = expanded.actors ?? {};
        const item = Scratchpad.getItem(this.itemId);
        if (!item) return;

        let totalDistributed = 0;

        for (const [actorId, qty] of Object.entries(actorQuantities))
        {
            const quantity = parseInt(qty) || 0;
            if (quantity <= 0) continue;

            const actor = game.actors.get(actorId);
            if (!actor) continue;

            let itemData = {
                type: item.type ?? 'loot',
                name: item.name,
                img: item.img,
                system: { quantity }
            };

            if (item.description?.trim())
            {
                itemData.system.description = { value: `<p>${item.description}</p>` };
            }

            if (item.sourceData)
            {
                itemData = foundry.utils.mergeObject(
                    foundry.utils.duplicate(item.sourceData),
                    itemData
                );
                itemData.system.quantity = quantity;
            }

            delete itemData._id;

            await actor.createEmbeddedDocuments('Item', [itemData]);
            totalDistributed += quantity;
        }

        const remaining = (item.quantity ?? 1) - totalDistributed;
        if (remaining <= 0)
        {
            Scratchpad.requestDelete(this.itemId);
        } else
        {
            Scratchpad.requestUpdate(this.itemId, { quantity: remaining });
        }
    }
}

