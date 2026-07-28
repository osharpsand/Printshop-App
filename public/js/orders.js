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

async function loadOrders() {
    const ordersContainer = getElement('ordersContainer');
    const ordersCountDisplay = getElement('ordersCountDisplay');

    ordersContainer.innerHTML = '';

    const orders = await getFromServer('getOrders');
    const orderRowTemplate = await getTemplateFromServer('orderRow');

    const ordersCount = orders.length;

    if (ordersCount <= 0) {
        ordersCountDisplay.innerHTML = 'No Orders Yet!';
    } else {
        ordersCountDisplay.innerHTML = `${ordersCount} Order${ordersCount == 1 ? '' : 's'}`
    }

    for (const order of orders) {
        const orderId = order.TimePlaced;

        const orderRow = createElement('div', ordersContainer, {
            ClassName: 'order-row',
            Id: `orderRow-${orderId}`,
            InnerHTML: orderRowTemplate
        }, {
            'ORDER_ID': orderId,
            'ORDER_NAME': order.FullName,
            'ORDER_TIME': new Date(order.TimePlaced).toLocaleString(),
            'ORDER_CONTACT': order.Contact || 'None',
            'ORDER_PRICE': order.Price == '' ? 'None' : `$${Number(order.Price).toFixed(2)}`
        });

        const finishOrderButton = orderRow.querySelector('.order-complete-button');

        finishOrderButton.addEventListener('click', async () => {
            await postToServer('finishOrder', {
                'OrderId': orderId
            });
            loadOrders();
        });
    }
}

function setup() {
    getElement('ordersRefreshButton').addEventListener('click', loadOrders);

    getElement('ordersLogoutButton').addEventListener('click', async () => {
        await getFromServer('logout');
        location.reload();
    });

    loadOrders();
}

setup();