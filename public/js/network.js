export async function processResponse(response) {
    if (response.redirected) {
        window.location.href = response.url;
        return response.url;
    }
    if (response.headers.get('content-type').includes('application/json')) {
        return response.json();
    } else {
        return response.text();
    }
}

export async function getFromServer(address) {
    const response = await fetch(`${window.location.origin}/api/${address}`, {
        method: 'GET'
    });

    return await processResponse(response);
}

export async function postToServer(address, data) {
    const response = await fetch(`${window.location.origin}/api/${address}`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json; charset=UTF-8'
        }
    });

    return await processResponse(response);
}

export async function getFileFromServer(address) {
    const response = await fetch(`${window.location.origin}/${address}`, {
        method: 'GET'
    });

    return await processResponse(response);
}

export async function getPageFromServer(page) {
    const response = await getFileFromServer(`pages/${page}`);

    return response;
}

export async function getTemplateFromServer(template) {
    const response = await getFileFromServer(`templates/${template}`);

    return response;
}

export async function doesFilamentIconExist(material, color) {
    return (await getFromServer(`doesFilamentIconExist/${material}/${color}`)) == 'true';
}

//export { getFromServer, postToServer, getFileFromServer, getPageFromServer, getTemplateFromServer };