//const getTemplateFromServer = window.network.getTemplateFromServer;

async function loadFooter() {
    let footerContent = await getTemplateFromServer('footer');

    footerContent = footerContent.replace('{{YEAR}}', new Date().getFullYear());

    const footer = document.createElement('footer');
    footer.innerHTML = footerContent;
    document.body.appendChild(footer);
}

loadFooter();