let order;
let items;
let materials;
let existingItemRowTemplate;
let customItemRowTemplate;
let existingItemColorOptionTemplate;
let existingItemColorImageOptionTemplate;
let customItemColorOptionTemplate;
let customItemColorImageOptionTemplate;
let existingItemRowCount = 0;
let customItemRowCount = 0;
let isEditing = false;
let hasUnsavedChanges = false;
let originalOrderSnapshot = null;
let existingItemsPriceRequestId = 0;
const filamentIconColorsByMaterial = new Map();

function getElement(id) {
    return document.getElementById(id);
}

function createOption(select, value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
    return option;
}

function setSelectOptions(select, options, placeholder, selectedValue) {
    select.innerHTML = '';
    createOption(select, '', placeholder);

    for (const option of options) {
        createOption(select, option, option);
    }

    if (selectedValue && !Array.from(select.options).some(option => option.value === selectedValue)) {
        createOption(select, selectedValue, selectedValue);
    }

    select.value = selectedValue || '';
}

function createTemplateOption(select, value, template, replacements) {
    let html = template;
    for (const [name, replacement] of Object.entries(replacements)) {
        html = html.replaceAll(`{{${name}}}`, replacement);
    }

    const option = document.createElement('option');
    option.value = value;
    option.innerHTML = html;
    select.appendChild(option);
    return option;
}

async function getFilamentIconColors(material) {
    if (!filamentIconColorsByMaterial.has(material)) {
        filamentIconColorsByMaterial.set(
            material,
            whatColorsHaveFilamentIcons(encodeURIComponent(material))
        );
    }

    try {
        const colors = await filamentIconColorsByMaterial.get(material);
        if (!Array.isArray(colors)) {
            throw new Error('The server returned invalid filament icon data.');
        }
        return colors;
    } catch (error) {
        filamentIconColorsByMaterial.delete(material);
        throw error;
    }
}

async function setColorOptions(materialSelect, colorSelect, selectedColor, colorOptionTemplate, colorImageOptionTemplate) {
    const materialName = materialSelect.value;
    setSelectOptions(colorSelect, [], 'Select Color', '');

    const material = materials[materialName];
    if (!material) return;

    const colorsWithFilamentIcons = await getFilamentIconColors(materialName);
    if (materialSelect.value !== materialName) return;

    colorSelect.innerHTML = '';
    createOption(colorSelect, '', 'Select Color');
    for (const [colorName, colorHex] of Object.entries(material.Colors)) {
        if (colorsWithFilamentIcons.includes(colorName)) {
            createTemplateOption(colorSelect, colorName, colorImageOptionTemplate, {
                COLOR_NAME: colorName,
                IMAGE_PATH: `/images/filamentIcons/${encodeURIComponent(materialName)}/${encodeURIComponent(colorName)}.webp`
            });
        } else {
            createTemplateOption(colorSelect, colorName, colorOptionTemplate, {
                COLOR_NAME: colorName,
                COLOR_HEX: colorHex
            });
        }
    }

    if (selectedColor && !Array.from(colorSelect.options).some(option => option.value === selectedColor)) {
        createOption(colorSelect, selectedColor, selectedColor);
    }
    colorSelect.value = selectedColor || '';
}

function createOrderRow(container, template, rowClass, rowId, replacements) {
    let html = template;
    for (const [name, value] of Object.entries(replacements)) {
        html = html.replaceAll(`{{${name}}}`, value);
    }

    const row = document.createElement('div');
    row.className = rowClass;
    row.id = `${rowClass}-${rowId}`;
    row.innerHTML = html;
    container.appendChild(row);
    return row;
}

function markChanged() {
    if (originalOrderSnapshot === null) return;

    hasUnsavedChanges = getOrderFormSnapshot() !== originalOrderSnapshot;
    if (isEditing) {
        getElement('orderSaveButton').hidden = !hasUnsavedChanges;
    }
}

function updateOrderEmptyMessage(container, label) {
    const hasRows = container.querySelector('.existing-item-row, .custom-item-row');
    let message = container.querySelector('.order-empty-message');

    if (!hasRows && !message) {
        message = document.createElement('p');
        message.className = 'order-empty-message';
        message.textContent = `No ${label} in this order.`;
        container.appendChild(message);
    } else if (hasRows && message) {
        message.remove();
    }
}

function getExistingItemDefinition(name) {
    return Object.prototype.hasOwnProperty.call(items, name) ? items[name] : null;
}

async function updateExistingItemColors(row, selectedColor) {
    const materialSelect = row.querySelector('.existing-item-material');
    const colorSelect = row.querySelector('.existing-item-color');
    await setColorOptions(
        materialSelect,
        colorSelect,
        selectedColor,
        existingItemColorOptionTemplate,
        existingItemColorImageOptionTemplate
    );
}

async function updateExistingItemMaterials(row, selectedMaterial, selectedColor) {
    const nameSelect = row.querySelector('.existing-item-name');
    const materialSelect = row.querySelector('.existing-item-material');
    const item = getExistingItemDefinition(nameSelect.value);
    const materialOptions = item ? item.Materials : [];
    const materialValue = selectedMaterial || (item ? item.DefaultMaterial : '');

    setSelectOptions(materialSelect, materialOptions, 'Select Material', materialValue);
    await updateExistingItemColors(row, selectedColor);
}

async function addExistingItemRow(existingItem = {}) {
    const container = getElement('existingItemsContainer');
    const rowId = existingItemRowCount++;
    const row = createOrderRow(
        container,
        existingItemRowTemplate,
        'existing-item-row',
        rowId,
        { ROW_ID: rowId }
    );
    const nameSelect = row.querySelector('.existing-item-name');
    const materialSelect = row.querySelector('.existing-item-material');
    const colorSelect = row.querySelector('.existing-item-color');
    const quantityInput = row.querySelector('.existing-item-quantity');
    const removeButton = row.querySelector('.existing-item-remove-button');

    setSelectOptions(nameSelect, Object.keys(items), 'Select Product', existingItem.Name || '');
    quantityInput.value = existingItem.Quantity || 1;
    removeButton.style.display = '';

    nameSelect.addEventListener('change', async () => {
        markChanged();
        try {
            await updateExistingItemMaterials(row, '', '');
            markChanged();
        } catch (error) {
            showColorLoadError(error);
        }
        updateExistingItemsTotalPrice();
    });
    materialSelect.addEventListener('change', async () => {
        markChanged();
        try {
            await updateExistingItemColors(row, '');
            markChanged();
        } catch (error) {
            showColorLoadError(error);
        }
        updateExistingItemsTotalPrice();
    });
    colorSelect.addEventListener('change', markChanged);
    quantityInput.addEventListener('input', () => {
        markChanged();
        updateExistingItemsTotalPrice();
    });
    removeButton.addEventListener('click', () => {
        row.remove();
        updateOrderEmptyMessage(container, 'existing prints');
        markChanged();
        updateExistingItemsTotalPrice();
    });

    await updateExistingItemMaterials(row, existingItem.Material || '', existingItem.Color || '');
    updateOrderEmptyMessage(container, 'existing prints');
    return row;
}

async function updateCustomItemColors(row, selectedColor) {
    const materialSelect = row.querySelector('.custom-item-material');
    const colorSelect = row.querySelector('.custom-item-color');
    await setColorOptions(
        materialSelect,
        colorSelect,
        selectedColor,
        customItemColorOptionTemplate,
        customItemColorImageOptionTemplate
    );
}

async function addCustomItemRow(customItem = {}) {
    const container = getElement('customItemsContainer');
    const rowId = customItemRowCount++;
    const row = createOrderRow(
        container,
        customItemRowTemplate,
        'custom-item-row',
        rowId,
        { ROW_ID: rowId }
    );
    const linkInput = row.querySelector('.custom-item-link');
    const materialSelect = row.querySelector('.custom-item-material');
    const colorSelect = row.querySelector('.custom-item-color');
    const quantityInput = row.querySelector('.custom-item-quantity');
    const removeButton = row.querySelector('.custom-item-remove-button');

    setSelectOptions(materialSelect, Object.keys(materials), 'Select Material', customItem.Material || '');
    linkInput.value = customItem.Link || '';
    quantityInput.value = customItem.Quantity || 1;
    removeButton.style.display = '';

    linkInput.addEventListener('input', markChanged);
    materialSelect.addEventListener('change', async () => {
        markChanged();
        try {
            await updateCustomItemColors(row, '');
            markChanged();
        } catch (error) {
            showColorLoadError(error);
        }
    });
    colorSelect.addEventListener('change', markChanged);
    quantityInput.addEventListener('input', markChanged);
    removeButton.addEventListener('click', () => {
        row.remove();
        updateOrderEmptyMessage(container, 'custom prints');
        markChanged();
    });

    await updateCustomItemColors(row, customItem.Color || '');
    updateOrderEmptyMessage(container, 'custom prints');
    return row;
}

function showColorLoadError(error) {
    showOrderError(`Unable to load filament colors: ${error.message}`);
}

function showOrderError(message) {
    const errorElement = getElement('orderError');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    window.scrollTo(0, 0);
}

function clearOrderError() {
    const errorElement = getElement('orderError');
    errorElement.textContent = '';
    errorElement.style.display = 'none';
}

async function updateExistingItemsTotalPrice() {
    const requestId = ++existingItemsPriceRequestId;
    const existingItems = [];

    for (const row of getElement('existingItemsContainer').querySelectorAll('.existing-item-row')) {
        const values = getRowValues(row, {
            Name: '.existing-item-name',
            Material: '.existing-item-material',
            Quantity: '.existing-item-quantity'
        });

        if (values.Name && values.Material && values.Quantity) {
            existingItems.push({
                Name: values.Name,
                Material: values.Material,
                Quantity: values.Quantity
            });
        }
    }

    if (existingItems.length === 0) {
        getElement('existingItemsTotalPriceText').textContent = '0.00';
        return;
    }

    try {
        const price = await postToServer('calculateOrderPrice', existingItems);
        if (requestId !== existingItemsPriceRequestId) return;

        const numericPrice = Number(price);
        if (!Number.isFinite(numericPrice)) {
            throw new Error(`Could not calculate the existing prints total: ${price}`);
        }
        getElement('existingItemsTotalPriceText').textContent = numericPrice.toFixed(2);
    } catch (error) {
        if (requestId === existingItemsPriceRequestId) {
            showOrderError(`Unable to update existing prints total: ${error.message}`);
        }
    }
}

function getRowValues(row, selectors) {
    const values = {};
    for (const [key, selector] of Object.entries(selectors)) {
        values[key] = row.querySelector(selector).value.trim();
    }
    return values;
}

function getOrderFormSnapshot() {
    function getRows(containerId, rowSelector, selectors) {
        return Array.from(getElement(containerId).querySelectorAll(rowSelector), row => {
            const values = getRowValues(row, selectors);
            const quantity = Number(values.Quantity);
            if (values.Quantity !== '' && Number.isFinite(quantity)) {
                values.Quantity = String(quantity);
            }
            return values;
        });
    }

    return JSON.stringify({
        FirstName: getElement('firstName').value.trim(),
        LastName: getElement('lastName').value.trim(),
        Contact: getElement('contact').value.trim(),
        Notes: getElement('notes').value.trim(),
        ExistingItems: getRows('existingItemsContainer', '.existing-item-row', {
            Name: '.existing-item-name',
            Material: '.existing-item-material',
            Color: '.existing-item-color',
            Quantity: '.existing-item-quantity'
        }),
        CustomItems: getRows('customItemsContainer', '.custom-item-row', {
            Link: '.custom-item-link',
            Material: '.custom-item-material',
            Color: '.custom-item-color',
            Quantity: '.custom-item-quantity'
        })
    });
}

function readOrderDetails() {
    const firstName = getElement('firstName').value.trim();
    const lastName = getElement('lastName').value.trim();
    if (!firstName || !lastName) {
        throw new Error('First name and last name are required.');
    }

    const existingItems = [];
    for (const row of getElement('existingItemsContainer').querySelectorAll('.existing-item-row')) {
        const values = getRowValues(row, {
            Name: '.existing-item-name',
            Material: '.existing-item-material',
            Color: '.existing-item-color',
            Quantity: '.existing-item-quantity'
        });

        if (!values.Name || !values.Material || !values.Color) {
            throw new Error('Complete or remove each existing print row.');
        }

        const quantity = Number(values.Quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
            throw new Error('Existing print quantities must be whole numbers from 1 to 100.');
        }

        existingItems.push({ ...values, Quantity: quantity });
    }

    const customItems = [];
    for (const row of getElement('customItemsContainer').querySelectorAll('.custom-item-row')) {
        const values = getRowValues(row, {
            Link: '.custom-item-link',
            Material: '.custom-item-material',
            Color: '.custom-item-color',
            Quantity: '.custom-item-quantity'
        });

        if (!values.Link || !values.Material || !values.Color) {
            throw new Error('Complete or remove each custom print row.');
        }

        const quantity = Number(values.Quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
            throw new Error('Custom print quantities must be whole numbers from 1 to 100.');
        }

        customItems.push({ ...values, Quantity: quantity });
    }

    if (existingItems.length === 0 && customItems.length === 0) {
        throw new Error('An order must contain at least one print.');
    }

    return {
        FirstName: firstName,
        LastName: lastName,
        FullName: `${firstName} ${lastName}`,
        Contact: getElement('contact').value.trim(),
        Notes: getElement('notes').value.trim(),
        ExistingItems: existingItems,
        CustomItems: customItems
    };
}

function setEditing(editing) {
    isEditing = editing;
    const possessiveSuffix = String(order.LastName || '').trim().toLowerCase().endsWith('s') ? "'" : "'s";
    getElement('orderTitle').textContent = `${editing ? 'Editing' : 'Viewing'} ${order.FullName}${possessiveSuffix} Order`;

    for (const id of ['firstName', 'lastName', 'contact', 'notes']) {
        getElement(id).readOnly = !editing;
    }

    for (const select of document.querySelectorAll('.existing-item-row select, .custom-item-row select')) {
        select.disabled = !editing;
    }
    for (const input of document.querySelectorAll('.existing-item-quantity, .custom-item-quantity')) {
        input.readOnly = !editing;
    }

    for (const button of document.querySelectorAll('.existing-item-remove-button, .custom-item-remove-button')) {
        button.hidden = !editing;
    }
    getElement('addExistingItemButton').hidden = !editing;
    getElement('addCustomItemButton').hidden = !editing;
    getElement('orderSaveButton').hidden = !editing || !hasUnsavedChanges;
    getElement('orderBackButton').hidden = editing;
    getElement('orderFinishButton').hidden = editing;
    getElement('orderModeImage').src = `/images/menuIcons/${editing ? 'revert' : 'pencil'}.svg`;
    getElement('orderModeButton').setAttribute('aria-label', editing ? 'Undo edits' : 'Edit order');
    getElement('orderModeButton').title = editing ? 'Undo' : 'Edit';
}

async function saveOrder() {
    clearOrderError();

    let editedDetails;
    try {
        editedDetails = readOrderDetails();
    } catch (error) {
        showOrderError(`Unable to save order: ${error.message}`);
        return;
    }

    const saveButton = getElement('orderSaveButton');
    saveButton.disabled = true;
    try {
        const price = await postToServer('calculateOrderPrice', editedDetails.ExistingItems);
        if (!Number.isFinite(Number(price))) {
            throw new Error(`Could not calculate the order price: ${price}`);
        }

        const editedOrder = {
            ...order,
            ...editedDetails,
            Price: Number(price)
        };
        const response = await postToServer('editOrder', editedOrder);
        if (response !== 'Successfully Edited Order!') {
            throw new Error(response || 'The server did not confirm the order update.');
        }

        order = editedOrder;
        originalOrderSnapshot = getOrderFormSnapshot();
        hasUnsavedChanges = false;
        existingItemsPriceRequestId++;
        getElement('existingItemsTotalPriceText').textContent = Number(price).toFixed(2);
        clearOrderError();
        setEditing(false);
    } catch (error) {
        showOrderError(`Error Saving Order: ${error.message}`);
    } finally {
        saveButton.disabled = false;
    }
}

async function finishOrder() {
    if (!confirm('Finish this order? It will be removed from the active orders list.')) return;

    const finishButton = getElement('orderFinishButton');
    finishButton.disabled = true;
    try {
        const response = await postToServer('finishOrder', { OrderId: order.TimePlaced });
        if (response !== 'Successfully Finished Order!') {
            throw new Error(response || 'The server did not confirm that the order was finished.');
        }
        window.location.href = '/pages/orders';
    } catch (error) {
        alert(`Error Finishing Order: ${error.message}`);
        finishButton.disabled = false;
    }
}

async function setup() {
    const actionButtons = document.querySelectorAll('#orderActionButtons button');
    actionButtons.forEach(button => button.disabled = true);

    try {
        const orderId = decodeURIComponent(window.location.pathname.split('/').pop());
        if (!/^\d+$/.test(orderId)) {
            throw new Error('The order URL contains an invalid order ID.');
        }

        const [
            orderData,
            itemData,
            materialData,
            existingRowTemplate,
            customRowTemplate,
            existingColorOptionTemplate,
            existingColorImageOptionTemplate,
            customColorOptionTemplate,
            customColorImageOptionTemplate
        ] = await Promise.all([
            postToServer('getOrder', { OrderId: orderId }),
            getFromServer('items'),
            getFromServer('materials'),
            getTemplateFromServer('existingItemRow'),
            getTemplateFromServer('customItemRow'),
            getTemplateFromServer('existingItemColorOption'),
            getTemplateFromServer('existingItemColorImageOption'),
            getTemplateFromServer('customItemColorOption'),
            getTemplateFromServer('customItemColorImageOption')
        ]);
        order = orderData;
        items = itemData;
        materials = materialData;
        existingItemRowTemplate = existingRowTemplate;
        customItemRowTemplate = customRowTemplate;
        existingItemColorOptionTemplate = existingColorOptionTemplate;
        existingItemColorImageOptionTemplate = existingColorImageOptionTemplate;
        customItemColorOptionTemplate = customColorOptionTemplate;
        customItemColorImageOptionTemplate = customColorImageOptionTemplate;
        if (!order || typeof order !== 'object' || Array.isArray(order)) {
            throw new Error(typeof order === 'string' ? order : 'The server returned invalid order details.');
        }
        const existingItemsPrice = Number(order.Price);
        if (!Number.isFinite(existingItemsPrice)) {
            throw new Error('The server returned an invalid existing prints total.');
        }

        getElement('firstName').value = order.FirstName || '';
        getElement('lastName').value = order.LastName || '';
        getElement('contact').value = order.Contact || '';
        getElement('notes').value = order.Notes || '';
        getElement('existingItemsTotalPriceText').textContent = existingItemsPrice.toFixed(2);

        await Promise.all((order.ExistingItems || []).map(existingItem => addExistingItemRow(existingItem)));
        await Promise.all((order.CustomItems || []).map(customItem => addCustomItemRow(customItem)));
        updateOrderEmptyMessage(getElement('existingItemsContainer'), 'existing prints');
        updateOrderEmptyMessage(getElement('customItemsContainer'), 'custom prints');

        for (const id of ['firstName', 'lastName', 'contact', 'notes']) {
            getElement(id).addEventListener('input', markChanged);
        }
        getElement('addExistingItemButton').addEventListener('click', () => {
            addExistingItemRow()
                .catch(showColorLoadError);
            markChanged();
            updateExistingItemsTotalPrice();
        });
        getElement('addCustomItemButton').addEventListener('click', () => {
            addCustomItemRow()
                .catch(showColorLoadError);
            markChanged();
        });
        getElement('orderModeButton').addEventListener('click', () => {
            if (isEditing && hasUnsavedChanges) {
                if (!confirm('Discard your unsaved edits?')) return;
                window.location.reload();
                return;
            }
            setEditing(!isEditing);
        });
        getElement('orderSaveButton').addEventListener('click', saveOrder);
        getElement('orderBackButton').addEventListener('click', () => {
            window.location.href = '/pages/orders';
        });
        getElement('orderFinishButton').addEventListener('click', finishOrder);

        originalOrderSnapshot = getOrderFormSnapshot();
        setEditing(false);
        actionButtons.forEach(button => button.disabled = false);
    } catch (error) {
        showOrderError(`Unable to load order: ${error.message}`);
        getElement('orderBackButton').disabled = false;
    }
}

setup();
