const { getFromServer, postToServer, getFileFromServer, getPageFromServer, getTemplateFromServer, whatColorsHaveFilamentIcons } = window.network;

function getElement(id) {
    return document.getElementById(id);
}

function createElement(type, parent, options, replacements) {
    const element = document.createElement(type);

    let innerHTML = options.InnerHTML;

    for (const replacementName in replacements) {
        const replacementValue = replacements[replacementName];

        innerHTML = innerHTML.replaceAll(`{{${replacementName}}}`, replacementValue);
    }

    element.className = options.ClassName;
    element.id = options.Id;
    element.innerHTML = innerHTML;
    element.value = options.Value;

    parent.appendChild(element);

    return element;
}