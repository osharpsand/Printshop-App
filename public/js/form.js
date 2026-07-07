import { getFromServer, postToServer, getFileFromServer, getPageFromServer, getTemplateFromServer } from './network.js';

const materials = await getFromServer('materials');
const existingItems = await getFromServer('items');

const existingItemRow = await getTemplateFromServer('existingItemRow');
const customItemRow = await getTemplateFromServer('customItemRow');

const existingItemColorOption = await getTemplateFromServer('existingItemColorOption');

let existingItemsCount = 0;
let customItemsCount = 0;

function setup() {
    addExistingItemRow();
    addCustomItemRow();

    const form = getElement('orderForm');
    form.addEventListener('submit', handleFormSubmit())

    const existingItemsContainer = getElement('existingItemsContainer');
    const existingItemsContainerObserver = new MutationObserver((Mutations) => {
       cleanupExistingItemRows();
    });

    existingItemsContainerObserver.observe(existingItemsContainer, {
        childList: true,
        characterData: true,
        subtree: true
    });
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

    const newExistingItemRemoveBtn = newExistingItemRow.querySelector('.remove-existing-item');

    newExistingItemNameSelection.addEventListener('change', () => {
        updateExistingItemMaterialOptions(rowId);
        updateExistingItemRemoveButton(rowId);
    });

    newExistingItemMaterialSelection.addEventListener('change', () => updateExistingItemColorOptions(rowId));
    newExistingItemRemoveBtn.addEventListener('click', () => newExistingItemRow.remove());
}

function updateExistingItemMaterialOptions(rowId) {
    const row = getExistingItemRow(rowId);
    const existingItemNameSelection = row.querySelector('.existing-item-name');
    const existingItemName = existingItemNameSelection.value;

    const existingItemMaterialSelection = row.querySelector('.existing-item-material');

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
    const defaultMaterial = existingItem.DefaultMaterial;
    const materialOptions = existingItem.Materials;

    for (const materialOptionName of materialOptions) {
        createElement('option', existingItemMaterialSelection, {
            InnerHTML: materialOptionName,
            Value: materialOptionName
        });
    }

    existingItemMaterialSelection.value = defaultMaterial;
    updateExistingItemColorOptions(rowId);
}

function updateExistingItemColorOptions(rowId) {
    const row = getExistingItemRow(rowId);
    const existingItemMaterialSelection = row.querySelector('.existing-item-material');
    const existingItemMaterial = existingItemMaterialSelection.value;

    const existingItemColorSelection = row.querySelector('.existing-item-color');

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

function updateExistingItemRemoveButton(rowId) {
    const existingItemRow = getExistingItemRow(rowId);
    const removeBtn = existingItemRow.querySelector('.danger-btn');
    
    removeBtn.style.display = isExistingItemRowEmpty(rowId) ? 'none' : 'block';
}

function cleanupExistingItemRows() {
    const container = getElement('existingItemsContainer');
    const existingItemRows = Array.from(container.children);

    if (existingItemRows.length <= 0) addExistingItemRow();

    for (const existingItemRow of existingItemRows.slice(0, -1)) {
        const rowId = getExistingItemRowId(existingItemRow);
        const itemRow = getExistingItemRow(rowId);
        
        if (isExistingItemRowEmpty(rowId)) itemRow.remove();
    }

    const existingItemRowsCount = existingItemRows.length;

    const lastExistingItemRow = existingItemRows[existingItemRowsCount - 1];
    const lastExistingItemRowId = getExistingItemRowId(lastExistingItemRow);

    if (!isExistingItemRowEmpty(lastExistingItemRowId)) addExistingItemRow();
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

    const newCustomItemMaterialSection = newCustomItemRow.querySelector('.custom-item-material');

    for (const material in materials) {
        createElement('option', newCustomItemMaterialSection, {
            InnerHTML: material,
            Value: material
        });
    }

    const newCustomItemRemoveBtn = newCustomItemRow.querySelector('.remove-custom-item');

    newCustomItemMaterialSection.addEventListener('change', () => updateCustomItemColorOptions(rowId));
    newCustomItemRemoveBtn.addEventListener('change', () => newCustomItemRow.remove());
}

function updateCustomItemColorOptions(rowId) {

}

function handleFormSubmit() {

}

setup();