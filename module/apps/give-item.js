import { moduleId, localizationID } from '../const.js';

const physicalTypes = new Set(['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container', 'backpack']);

export async function showGiveItemDialog(actor, itemId)
{
    const item = actor.items.get(itemId);
    if (!item || !physicalTypes.has(item.type)) return;

    const recipients = getRecipients(actor);
    if (!recipients.length)
    {
        ui.notifications.warn(game.i18n.localize(`${localizationID}.give-no-recipients`));
        return;
    }

    const maxQuantity = Math.max(1, Number(item.system?.quantity ?? 1));
    const options = recipients
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`)
        .join('');

    const content = `
        <form class="party-inventory-give-form">
            <div class="form-group">
                <label>${game.i18n.localize(`${localizationID}.give-recipient`)}</label>
                <select name="recipient">${options}</select>
            </div>
            <div class="form-group">
                <label>${game.i18n.localize(`${localizationID}.give-quantity`)}</label>
                <input type="number" name="quantity" value="1" min="1" max="${maxQuantity}" step="1">
            </div>
        </form>`;

    const DialogV2 = foundry.applications?.api?.DialogV2;
    const result = DialogV2
        ? await DialogV2.wait({
            window: { title: game.i18n.format(`${localizationID}.give-dialog-title`, { name: item.name }) },
            content,
            buttons: [
                {
                    action: 'give',
                    label: game.i18n.localize(`${localizationID}.give-item`),
                    icon: 'fas fa-handshake-angle',
                    default: true,
                    callback: (_event, _button, dialog) =>
                    {
                        return new foundry.applications.ux.FormDataExtended(dialog.element.querySelector('form')).object;
                    }
                },
                {
                    action: 'cancel',
                    label: game.i18n.localize('Cancel'),
                    icon: 'fas fa-times'
                }
            ],
            rejectClose: false
        })
        : await legacyDialog(content, item.name);

    if (!result || result === 'cancel') return;

    const targetActorId = result.recipient;
    const quantity = Math.floor(Number(result.quantity));
    if (!targetActorId || !Number.isInteger(quantity) || quantity < 1)
    {
        ui.notifications.warn(game.i18n.localize(`${localizationID}.give-invalid-quantity`));
        return;
    }
    if (quantity > maxQuantity)
    {
        ui.notifications.error(game.i18n.format(`${localizationID}.give-too-many`, { count: maxQuantity }));
        return;
    }

    requestItemTransfer({
        sourceActorId: actor.id,
        targetActorId,
        itemId,
        quantity
    });
}

export function registerGiveItemSocket()
{
    game.socket.on(`module.${moduleId}`, async packet =>
    {
        if (packet?.type === 'transfer-item' && game.user.isGM)
        {
            const result = await completeItemTransfer(packet.data);
            game.socket.emit(`module.${moduleId}`, {
                type: 'transfer-item-result',
                data: result
            });
        }

        if (packet?.type === 'transfer-item-result' && packet.data?.requestingUserId === game.user.id)
        {
            if (packet.data.ok)
            {
                ui.notifications.info(game.i18n.format(`${localizationID}.give-complete`, {
                    quantity: packet.data.quantity,
                    item: packet.data.itemName,
                    recipient: packet.data.targetActorName
                }));
            } else
            {
                ui.notifications.error(packet.data.message);
            }
        }
    });
}

function requestItemTransfer(data)
{
    const payload = {
        ...data,
        requestingUserId: game.user.id
    };

    if (game.user.isGM)
    {
        completeItemTransfer(payload).then(result =>
        {
            if (result.ok)
            {
                ui.notifications.info(game.i18n.format(`${localizationID}.give-complete`, {
                    quantity: result.quantity,
                    item: result.itemName,
                    recipient: result.targetActorName
                }));
            } else
            {
                ui.notifications.error(result.message);
            }
        });
        return;
    }

    const gmAvailable = !!game.users.find(u => u.isGM && u.active);
    if (!gmAvailable)
    {
        ui.notifications.warn(game.i18n.localize(`${localizationID}.give-no-gm`));
        return;
    }

    game.socket.emit(`module.${moduleId}`, {
        type: 'transfer-item',
        data: payload
    });
}

async function completeItemTransfer({ sourceActorId, targetActorId, itemId, quantity, requestingUserId })
{
    const requester = game.users.get(requestingUserId);
    const sourceActor = game.actors.get(sourceActorId);
    const targetActor = game.actors.get(targetActorId);
    const item = sourceActor?.items.get(itemId);

    if (!requester || !sourceActor || !targetActor || !item)
    {
        return failed(requestingUserId, game.i18n.localize(`${localizationID}.give-missing-data`));
    }
    if (!sourceActor.testUserPermission(requester, 'OWNER'))
    {
        return failed(requestingUserId, game.i18n.localize(`${localizationID}.give-no-permission`));
    }
    if (sourceActor.id === targetActor.id || targetActor.type !== 'character')
    {
        return failed(requestingUserId, game.i18n.localize(`${localizationID}.give-invalid-recipient`));
    }
    if (!physicalTypes.has(item.type))
    {
        return failed(requestingUserId, game.i18n.localize(`${localizationID}.give-invalid-item`));
    }

    const currentQuantity = Math.max(1, Number(item.system?.quantity ?? 1));
    const transferQuantity = Math.floor(Number(quantity));
    if (!Number.isInteger(transferQuantity) || transferQuantity < 1 || transferQuantity > currentQuantity)
    {
        return failed(requestingUserId, game.i18n.format(`${localizationID}.give-too-many`, { count: currentQuantity }));
    }

    const itemData = item.toObject();
    delete itemData._id;
    foundry.utils.setProperty(itemData, 'system.quantity', transferQuantity);

    const existing = targetActor.items.find(i => i.name === item.name && i.type === item.type && Number.isFinite(Number(i.system?.quantity)));
    if (existing)
    {
        await existing.update({ 'system.quantity': Number(existing.system.quantity ?? 0) + transferQuantity });
    } else
    {
        await targetActor.createEmbeddedDocuments('Item', [itemData]);
    }

    const remaining = currentQuantity - transferQuantity;
    if (remaining <= 0)
    {
        await item.delete();
    } else
    {
        await item.update({ 'system.quantity': remaining });
    }

    whisperTransferLog(sourceActor, targetActor, item.name, transferQuantity, requester);

    return {
        ok: true,
        requestingUserId,
        quantity: transferQuantity,
        itemName: item.name,
        targetActorName: targetActor.name
    };
}

function getRecipients(currentActor)
{
    return game.actors
        .filter(a => a.type === 'character' && a.hasPlayerOwner && a.id !== currentActor.id)
        .sort((a, b) => a.name.localeCompare(b.name));
}

function failed(requestingUserId, message)
{
    return { ok: false, requestingUserId, message };
}

function whisperTransferLog(sourceActor, targetActor, itemName, quantity, requester)
{
    const whisper = [
        ...game.users.filter(u => u.isGM).map(u => u.id),
        requester?.id
    ].filter(Boolean);

    ChatMessage.create({
        content: game.i18n.format(`${localizationID}.give-chat-log`, {
            source: sourceActor.name,
            recipient: targetActor.name,
            quantity,
            item: itemName
        }),
        whisper,
        speaker: ChatMessage.getSpeaker({ actor: sourceActor })
    });
}

function legacyDialog(content, itemName)
{
    return new Promise(resolve =>
    {
        new Dialog({
            title: game.i18n.format(`${localizationID}.give-dialog-title`, { name: itemName }),
            content,
            buttons: {
                give: {
                    icon: '<i class="fas fa-handshake-angle"></i>',
                    label: game.i18n.localize(`${localizationID}.give-item`),
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
            default: 'give',
            close: () => resolve(null)
        }).render(true);
    });
}
