import { getFromServer, postToServer, getFileFromServer, getPageFromServer, getTemplateFromServer } from './network.js';

const materials = await getFromServer('materials');
const existingItems = await getFromServer('items');

const existingItemRow = await getTemplateFromServer('existingItemRow');
const customItemRow = await getTemplateFromServer('customItemRow');

const existingItemColorOption = await getTemplateFromServer('existingItemColorOption');

let existingItemsCount = 0;
let customItemsCount = 0;

function setup() {
    addExistingItem();
    addCustomItem();

    const form = getElement('orderForm');
    form.addEventListener('submit', handleFormSubmit())
}

function getElement(id) {
    return document.getElementById(id);
}

function getExistingItemRow(rowId) {
    return getElement(`existing-item-row-${rowId}`);
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

function addExistingItem() {
    const container = getElement('existingItemsContainer');
    const elementId = existingItemsCount++;

    const itemRow = existingItemRow
        .replaceAll('/*{{ROW_ID}}*/', elementId)
        .replaceAll('{{ROW_ID}}', elementId);

    const existingItem = createElement('div', container, {
        ClassName: 'existing-item-row',
        Id: `existing-item-row-${elementId}`,
        InnerHTML: itemRow
    });

    const existingItemNameSelection = existingItem.querySelector('.existing-item-name')
    const existingItemMaterialSelection = existingItem.querySelector('.existing-item-material');

    for (const existingItemName in existingItems) {
        const existingItem = existingItems[existingItemName];
        createElement('option', existingItemNameSelection, {
            InnerHTML: `${existingItemName} - $${Number(existingItem.Price).toFixed(2)}`,
            Value: existingItemName
        });
    }

    existingItemNameSelection.addEventListener('change', () => {
        updateExistingItemMaterialOptions(elementId);
    });

    existingItemMaterialSelection.addEventListener('change', () => {
        updateExistingItemColorOptions(elementId);
    })
}

function addCustomItem() {
    const container = getElement('customItemsContainer');
    const elementId = customItemsCount++;

    let itemRow = customItemRow;
    itemRow = itemRow.replaceAll('/*{{ROW_ID}}*/', elementId);
    itemRow = itemRow.replaceAll('{{ROW_ID}}', elementId);

    const customItem = createElement('div', container, {
        ClassName: 'custom-item-row',
        Id: `existing-item-${elementId}`,
        InnerHTML: itemRow
    });
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
    
    if (!existingItems.hasOwnProperty(existingItemName)) { return; }

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

    if (!materials.hasOwnProperty(existingItemMaterial)) { return; }

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

function handleFormSubmit() {

}

setup();