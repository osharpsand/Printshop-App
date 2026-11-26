let csrfTokenPromise;

function getBaseUrl() {
    return window.location.origin || (window.location.protocol + '//' + window.location.host);
}

async function getCsrfToken() {
    if (!csrfTokenPromise) {
        csrfTokenPromise = fetch(getBaseUrl() + '/api/csrf-token', {
            method: 'GET'
        }).then(async response => {
            if (!response.ok) {
                throw new Error(`Failed to get CSRF token: ${response.status}`);
            }

            const data = await response.json();
            if (typeof data.token !== 'string' || data.token.length === 0) {
                throw new Error('The server returned an invalid CSRF token.');
            }

            return data.token;
        }).catch(error => {
            csrfTokenPromise = undefined;
            throw error;
        });
    }

    return csrfTokenPromise;
}

async function processResponse(response) {
    if (response.redirected) {
        window.location.href = response.url;
        return response.url;
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

async function getFromServer(address) {
    const response = await fetch(getBaseUrl() + '/api/' + address, {
        method: 'GET'
    });

    return processResponse(response);
}

async function postToServer(address, data) {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getBaseUrl() + '/api/' + address, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-CSRF-Token': csrfToken
        }
    });

    return processResponse(response);
}

async function getFileFromServer(address) {
    const response = await fetch(getBaseUrl() + '/' + address, {
        method: 'GET'
    });

    return processResponse(response);
}

async function getPageFromServer(page) {
    return getFileFromServer('pages/' + page);
}

async function getTemplateFromServer(template) {
    return getFileFromServer('templates/' + template);
}

/* No Longer In Use:
async function doesFilamentIconExist(material, color) {
    return (await getFromServer('doesFilamentIconExist/' + material + '/' + color)) === 'true';
}
*/

async function whatColorsHaveFilamentIcons(material) {
    return await getFromServer('whatColorsHaveFilamentIcons/' + material);
}