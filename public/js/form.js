import { getFromServer, postToServer, getFileFromServer, getPageFromServer, getTemplateFromServer } from './network.js';

const materials = await getFromServer('materials');
const existingItems = await getFromServer('items');

const existingItemRow = await getTemplateFromServer('existingItemRow');
const customItemRow = await getTemplateFromServer('customItemRow');

const existingItemColorOption = await getTemplateFromServer('existingItemColorOption');
const customItemColorOption = await getTemplateFromServer('customItemColorOption');

let existingItemsCount = 0;
let customItemsCount = 0;

function setup() {
    addExistingItemRow();
    addCustomItemRow();

    const form = getElement('orderForm');
    form.addEventListener('submit', handleFormSubmit())
}

function getElement(id) {
    return document.getElementById(id);
}

function createElement(type, parent, options) {
    const element = document.createElement(type);

    element.className = options.ClassName;
    element.id = options.Id;
    element.innerHTML = options.InnerHTML;
    element.value = options.Value;

    parent.appendChild(element);

    return element;
}

function getExistingItemRow(rowId) {
    return getElement(`existingItemRow-${rowId}`);
}

function getExistingItemRowId(rowElement) {
    return rowElement.id.split('-')[1];
}

function isExistingItemRowEmpty(rowId) {
    const existingItemRow = getExistingItemRow(rowId);

    const existingItemNameSelection = existingItemRow.querySelector('.existing-item-name');
    const existingItemQuantitySelection = existingItemRow.querySelector('.existing-item-quantity');

    const existingItemName = existingItemNameSelection.value;
    const existingItemQuantity = existingItemQuantitySelection.value;

    return existingItemName == '' && existingItemQuantity == 1;
}

function addExistingItemRow() {
    const existingItemsContainer = getElement('existingItemsContainer');
    const rowId = existingItemsCount++;

    const newExistingItemContent = existingItemRow.replaceAll('{{ROW_ID}}', rowId);

    const newExistingItemRow = createElement('div', existingItemsContainer, {
        ClassName: 'existing-item-row',
        Id: `existingItemRow-${rowId}`,
        InnerHTML: newExistingItemContent
    });

    const newExistingItemNameSelection = newExistingItemRow.querySelector('.existing-item-name')
    const newExistingItemMaterialSelection = newExistingItemRow.querySelector('.existing-item-material');

    for (const existingItemName in existingItems) {
        const existingItem = existingItems[existingItemName];

        createElement('option', newExistingItemNameSelection, {
            InnerHTML: `${existingItemName} - $${Number(existingItem.Price).toFixed(2)}`,
            Value: existingItemName
        });
    }

    const newExistingItemQuantitySelection = newExistingItemRow.querySelector('.existing-item-quantity');
    const newExistingItemRemoveBtn = newExistingItemRow.querySelector('.remove-existing-item');

    newExistingItemNameSelection.addEventListener('change', () => {
        updateExistingItemMaterialOptions(rowId);
        updateExistingItemRemoveBtn(rowId);
        cleanupExistingItemRows();
    });

    newExistingItemMaterialSelection.addEventListener('change', () => { 
        updateExistingItemColorOptions(rowId);
        updateExistingItemRemoveBtn(rowId);
        cleanupExistingItemRows();
    });

    newExistingItemQuantitySelection.addEventListener('input', () => {
        updateExistingItemRemoveBtn(rowId);
        cleanupExistingItemRows();
    });

    newExistingItemRemoveBtn.addEventListener('click', () => {
        newExistingItemRow.remove();
        cleanupExistingItemRows();
    });
}

function updateExistingItemMaterialOptions(rowId) {
    const existingItemRow = getExistingItemRow(rowId);
    const existingItemNameSelection = existingItemRow.querySelector('.existing-item-name');
    const existingItemName = existingItemNameSelection.value;

    const existingItemMaterialSelection = existingItemRow.querySelector('.existing-item-material');

    existingItemMaterialSelection.innerHTML = '';
    createElement('option', existingItemMaterialSelection, {
        InnerHTML: 'Select Material',
        Value: ''
    });
    
    if (!existingItems.hasOwnProperty(existingItemName)) {
        updateExistingItemColorOptions(rowId);
        return;
    }

    const existingItem = existingItems[existingItemName];
    const existingItemDefaultMaterial = existingItem.DefaultMaterial;
    const existingItemMaterialOptions = existingItem.Materials;

    for (const existingItemMaterialOptionName of existingItemMaterialOptions) {
        createElement('option', existingItemMaterialSelection, {
            InnerHTML: existingItemMaterialOptionName,
            Value: existingItemMaterialOptionName
        });
    }

    existingItemMaterialSelection.value = existingItemDefaultMaterial;
    updateExistingItemColorOptions(rowId);
}

function updateExistingItemColorOptions(rowId) {
    const existingItemRow = getExistingItemRow(rowId);

    const existingItemMaterialSelection = existingItemRow.querySelector('.existing-item-material');
    const existingItemMaterial = existingItemMaterialSelection.value;

    const existingItemColorSelection = existingItemRow.querySelector('.existing-item-color');

    existingItemColorSelection.innerHTML = '';
    createElement('option', existingItemColorSelection, {
        InnerHTML: 'Select Color',
        Value: ''
    });

    if (!materials.hasOwnProperty(existingItemMaterial)) return;

    const colorOptions = materials[existingItemMaterial].Colors;

    for (const colorOptionName of Object.keys(colorOptions)) {
        const colorHex = colorOptions[colorOptionName];

        const colorOption = existingItemColorOption
            .replaceAll('{{COLOR_HEX}}', colorHex)
            .replaceAll('{{COLOR_NAME}}', colorOptionName);

        createElement('option', existingItemColorSelection, {
            InnerHTML: colorOption,
            Value: colorOptionName
        });
    }
}

function updateExistingItemRemoveBtn(rowId) {
    const existingItemRow = getExistingItemRow(rowId);
    const existingItemRemoveBtn = existingItemRow.querySelector('.danger-btn');
    
    existingItemRemoveBtn.style.display = isExistingItemRowEmpty(rowId) ? 'none' : 'block';
}

function cleanupExistingItemRows() {
    const existingItemsContainer = getElement('existingItemsContainer');
    const existingItemRows = Array.from(existingItemsContainer.children);

    if (existingItemRows.length <= 0) addExistingItemRow();

    for (const existingItemRow of existingItemRows.slice(0, -1)) {
        const existingItemRowId = getExistingItemRowId(existingItemRow);
        
        if (isExistingItemRowEmpty(existingItemRowId)) existingItemRow.remove();
    }

    const existingItemRowsCount = existingItemRows.length;

    const lastExistingItemRow = existingItemRows[existingItemRowsCount - 1];
    const lastExistingItemRowId = getExistingItemRowId(lastExistingItemRow);

    if (!isExistingItemRowEmpty(lastExistingItemRowId)) addExistingItemRow();
}

function getCustomItemRow(rowId) {
    return getElement(`customItemRow-${rowId}`);
}

function getCustomItemRowId(rowElement) {
    return rowElement.id.split('-')[1];
}

function isCustomItemRowEmpty(rowId) {
    const customItemRow = getCustomItemRow(rowId);

    const customItemLinkSelection = customItemRow.querySelector('.custom-item-link');
    const customItemMaterialSelection = customItemRow.querySelector('.custom-item-material');
    const customItemQuantitySelection = customItemRow.querySelector('.custom-item-quantity');

    const customItemLink = customItemLinkSelection.value;
    const customItemMaterial = customItemMaterialSelection.value;
    const customItemQuantity = customItemQuantitySelection.value;

    return ( customItemLink == '' || customItemLink == 'https://example.com' ) &&
        ( customItemMaterial == '' || customItemMaterial == 'Select Material' ) &&
        customItemQuantity == 1;
}

function addCustomItemRow() {
    const customItemsContainer = getElement('customItemsContainer');
    const rowId = customItemsCount++;

    const newCustomItemContent = customItemRow.replaceAll('{{ROW_ID}}', rowId);

    const newCustomItemRow = createElement('div', customItemsContainer, {
        ClassName: 'custom-item-row',
        Id: `customItemRow-${rowId}`,
        InnerHTML: newCustomItemContent
    });

    const newCustomItemMaterialSelection = newCustomItemRow.querySelector('.custom-item-material');

    for (const material in materials) {
        createElement('option', newCustomItemMaterialSelection, {
            InnerHTML: material,
            Value: material
        });
    }

    const newCustomItemLinkSelection = newCustomItemRow.querySelector('.custom-item-link');
    const newCustomItemQuantitySelection = newCustomItemRow.querySelector('.custom-item-quantity');
    const newCustomItemRemoveBtn = newCustomItemRow.querySelector('.remove-custom-item');

    newCustomItemLinkSelection.addEventListener('input', () => {
        updateCustomItemRemoveBtn(rowId);
        cleanupCustomItemRows();
    });

    newCustomItemMaterialSelection.addEventListener('change', () => {
        updateCustomItemColorOptions(rowId);
        updateCustomItemRemoveBtn(rowId);
        cleanupCustomItemRows();
    });

    newCustomItemQuantitySelection.addEventListener('input', () => {
        updateCustomItemRemoveBtn(rowId);
        cleanupCustomItemRows();
    });

    newCustomItemRemoveBtn.addEventListener('click', () => {
        newCustomItemRow.remove();
        cleanupCustomItemRows();
    });
}

function updateCustomItemColorOptions(rowId) {
    const customItemRow = getCustomItemRow(rowId);

    const customItemMaterialSelection = customItemRow.querySelector('.custom-item-material');
    const customItemMaterial = customItemMaterialSelection.value;

    const customItemColorSelection = customItemRow.querySelector('.custom-item-color');

    customItemColorSelection.innerHTML = '';
    createElement('option', customItemColorSelection, {
        InnerHTML: 'Select Color',
        Value: ''
    });

    if (!materials.hasOwnProperty(customItemMaterial)) return;

    const colorOptions = materials[customItemMaterial].Colors;

    for (const colorOptionName of Object.keys(colorOptions)) {
        const colorHex = colorOptions[colorOptionName];

        const colorOption = customItemColorOption
            .replaceAll('{{COLOR_HEX}}', colorHex)
            .replaceAll('{{COLOR_NAME}}', colorOptionName);

        createElement('option', customItemColorSelection, {
            InnerHTML: colorOption,
            Value: colorOptionName
        });
    }
}

function updateCustomItemRemoveBtn(rowId) {
    const customItemRow = getCustomItemRow(rowId);
    const customItemRemoveBtn = customItemRow.querySelector('.remove-custom-item');

    customItemRemoveBtn.style.display = isCustomItemRowEmpty(rowId) ? 'none' : 'block';
}

function cleanupCustomItemRows() {
    const customItemsContainer = getElement('customItemsContainer');
    const customItemRows = Array.from(customItemsContainer.children);

    if (customItemRows.length <= 0) addCustomItemRow();

    for (const customItemRow of customItemRows.slice(0, -1)) {
        const customItemRowId = getCustomItemRowId(customItemRow);
        
        if (isCustomItemRowEmpty(customItemRowId)) customItemRow.remove(); 
    }

    const customItemRowsCount = customItemRows.length;

    const lastCustomItemRow = customItemRows[customItemRowsCount - 1];
    const lastCustomItemRowId = getCustomItemRowId(lastCustomItemRow);

    if (!isCustomItemRowEmpty(lastCustomItemRowId)) addCustomItemRow();
}

function handleFormSubmit() {

}

setup();