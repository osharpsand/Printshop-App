let order;
let items;
let materials;
let existingItemRowTemplate;
let customItemRowTemplate;
let existingItemRowCount = 0;
let customItemRowCount = 0;
let isEditing = false;
let hasUnsavedChanges = false;

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
    hasUnsavedChanges = true;
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

function updateExistingItemColors(row, selectedColor) {
    const materialSelect = row.querySelector('.existing-item-material');
    const colorSelect = row.querySelector('.existing-item-color');
    const material = materials[materialSelect.value];
    const colors = material ? Object.keys(material.Colors) : [];
    setSelectOptions(colorSelect, colors, 'Select Color', selectedColor);
}

function updateExistingItemMaterials(row, selectedMaterial, selectedColor) {
    const nameSelect = row.querySelector('.existing-item-name');
    const materialSelect = row.querySelector('.existing-item-material');
    const item = getExistingItemDefinition(nameSelect.value);
    const materialOptions = item ? item.Materials : [];
    const materialValue = selectedMaterial || (item ? item.DefaultMaterial : '');

    setSelectOptions(materialSelect, materialOptions, 'Select Material', materialValue);
    updateExistingItemColors(row, selectedColor);
}

function addExistingItemRow(existingItem = {}) {
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
    updateExistingItemMaterials(row, existingItem.Material || '', existingItem.Color || '');
    quantityInput.value = existingItem.Quantity || 1;
    removeButton.style.display = '';

    nameSelect.addEventListener('change', () => {
        updateExistingItemMaterials(row, '', '');
        markChanged();
    });
    materialSelect.addEventListener('change', () => {
        updateExistingItemColors(row, '');
        markChanged();
    });
    colorSelect.addEventListener('change', markChanged);
    quantityInput.addEventListener('input', markChanged);
    removeButton.addEventListener('click', () => {
        row.remove();
        updateOrderEmptyMessage(container, 'existing prints');
        markChanged();
    });

    updateOrderEmptyMessage(container, 'existing prints');
    return row;
}

function updateCustomItemColors(row, selectedColor) {
    const materialSelect = row.querySelector('.custom-item-material');
    const colorSelect = row.querySelector('.custom-item-color');
    const material = materials[materialSelect.value];
    const colors = material ? Object.keys(material.Colors) : [];
    setSelectOptions(colorSelect, colors, 'Select Color', selectedColor);
}

function addCustomItemRow(customItem = {}) {
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
    updateCustomItemColors(row, customItem.Color || '');
    linkInput.value = customItem.Link || '';
    quantityInput.value = customItem.Quantity || 1;
    removeButton.style.display = '';

    linkInput.addEventListener('input', markChanged);
    materialSelect.addEventListener('change', () => {
        updateCustomItemColors(row, '');
        markChanged();
    });
    colorSelect.addEventListener('change', markChanged);
    quantityInput.addEventListener('input', markChanged);
    removeButton.addEventListener('click', () => {
        row.remove();
        updateOrderEmptyMessage(container, 'custom prints');
        markChanged();
    });

    updateOrderEmptyMessage(container, 'custom prints');
    return row;
}

function getRowValues(row, selectors) {
    const values = {};
    for (const [key, selector] of Object.entries(selectors)) {
        values[key] = row.querySelector(selector).value.trim();
    }
    return values;
}

function isBlankRow(values, keys) {
    return keys.every(key => values[key] === '');
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

        if (isBlankRow(values, ['Name', 'Material', 'Color'])) continue;
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

        if (isBlankRow(values, ['Link', 'Material', 'Color'])) continue;
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
    getElement('orderTitle').textContent = `${editing ? 'Editing' : 'Viewing'} ${order.FullName}'s Order`;

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
    getElement('orderSaveButton').hidden = !editing;
    getElement('orderModeImage').src = `/images/menuIcons/${editing ? 'eye' : 'pencil'}.svg`;
    getElement('orderModeButton').setAttribute('aria-label', editing ? 'View order' : 'Edit order');
    getElement('orderModeButton').title = editing ? 'View order' : 'Edit order';
}

async function saveOrder() {
    let editedDetails;
    try {
        editedDetails = readOrderDetails();
    } catch (error) {
        alert(error.message);
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
        hasUnsavedChanges = false;
        setEditing(false);
    } catch (error) {
        alert(`Error Saving Order: ${error.message}`);
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

        const results = await Promise.all([
            postToServer('getOrder', { OrderId: orderId }),
            getFromServer('items'),
            getFromServer('materials'),
            getTemplateFromServer('existingItemRow'),
            getTemplateFromServer('customItemRow')
        ]);
        [order, items, materials, existingItemRowTemplate, customItemRowTemplate] = results;
        if (!order || typeof order !== 'object' || Array.isArray(order)) {
            throw new Error(typeof order === 'string' ? order : 'The server returned invalid order details.');
        }

        getElement('firstName').value = order.FirstName || '';
        getElement('lastName').value = order.LastName || '';
        getElement('contact').value = order.Contact || '';
        getElement('notes').value = order.Notes || '';

        for (const existingItem of order.ExistingItems || []) {
            addExistingItemRow(existingItem);
        }
        for (const customItem of order.CustomItems || []) {
            addCustomItemRow(customItem);
        }
        updateOrderEmptyMessage(getElement('existingItemsContainer'), 'existing prints');
        updateOrderEmptyMessage(getElement('customItemsContainer'), 'custom prints');

        for (const id of ['firstName', 'lastName', 'contact', 'notes']) {
            getElement(id).addEventListener('input', markChanged);
        }
        getElement('addExistingItemButton').addEventListener('click', () => {
            addExistingItemRow();
            markChanged();
        });
        getElement('addCustomItemButton').addEventListener('click', () => {
            addCustomItemRow();
            markChanged();
        });
        getElement('orderModeButton').addEventListener('click', () => {
            if (isEditing && hasUnsavedChanges) {
                if (!confirm('Discard your unsaved changes?')) return;
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

        setEditing(false);
        actionButtons.forEach(button => button.disabled = false);
    } catch (error) {
        const errorElement = getElement('orderError');
        errorElement.textContent = `Unable to load order: ${error.message}`;
        errorElement.style.display = 'block';
        getElement('orderBackButton').disabled = false;
    }
}

setup();
