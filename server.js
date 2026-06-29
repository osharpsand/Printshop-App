const expressRateLimit = require('express-rate-limit');
const expressSession = require('express-session');
const express = require('express');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const https = require('https');
const path = require('path');
const fs = require('fs');

const FileStore = require('session-file-store')(expressSession);

process.loadEnvFile();

const port = process.env.PORT || 3000;
const secret = process.env.SECRET;
const production = process.env.PRODUCTION == 'true';
const domain = process.env.URL;

const app = express();

const credentialsFile = path.join(__dirname, 'credentials.json');
const itemsFile = path.join(__dirname, 'items.json');
const materialsFile = path.join(__dirname, 'materials.json');

const credentials = readJson(credentialsFile, true);
const items = readJson(itemsFile, true)
const materials = readJson(materialsFile, true);

const pagesDirectory = path.join(__dirname, 'public', 'pages');
const ordersDirectory = path.join(__dirname, 'orders');

//Functions

function readJson(path, killOnFail = false) {
    try {
        const jsonData = fs.readFileSync(path, 'utf8');

        if (jsonData && jsonData != '') {
            return JSON.parse(jsonData);
        }

        throw new Error(`Path: ${path} Is Inaccessible Or Empty`);
    } catch (Err) {
        if (killOnFail == true) {
            console.error(`Error Loading JSON File At ${path}: ${Err}`);
            process.exit(1);
        } else {
            throw new Error(`Error Loading JSON File At ${path}: ${Err}`);
        }
    }
}

function writeJson(path, data) {
    const jsonData = JSON.stringify(data, null, 2);

    if (jsonData && jsonData != '') {
        fs.writeFileSync(path, jsonData);
        return;
    }

    throw new Error(`Path: ${path} Is Inaccessible Or Data Is Empty`);
}

function calculateTotalOrderPrice(items) {
    let total = 0;

    if (!Array.isArray(items)) {
        items = [items];
    }

    for (const item of items) {
        total += calculateIndividualItemPrice(item);
    }

    return total;
}

function calculateIndividualItemPrice(item) {
    const itemDetails = getItemDetailsByName(item.Name);

    const materialPriceRatio = materials[item.Material].Price / materials[itemDetails.DefaultMaterial].Price;
    return itemDetails.Price * materialPriceRatio * item.Quantity;
}

function getItemDetailsByName(itemName) {
    for (const item of items) {
        if (item.Name == itemName) {
            return item;
        }
    }
    console.error(`Did Not Find Item "${itemName}" In Items List`);
}

function verifyOrder(order) {
    if (!order.FirstName || order.FirstName == '' || !order.LastName || order.LastName == '') {
        throw new Error('Name Is Invalid.');
    }

    const existingItems = order.ExistingItems || '';
    const customItems = order.CustomItems || '';

    let anyItems = false;

    if (existingItems && existingItems != '') {
        anyItems = true;

        for (const existingItem of existingItems) {
            if (!doesItemExist(existingItem.Name)) {
                throw new TypeError('Item Does Not Exist.');
            }

            const itemDetails = getItemDetailsByName(existingItem.Name);

            if (itemDetails.Materials.indexOf(existingItem.Material) == -1) {
                throw new TypeError('Material Is Invalid For Item Type.')
            }

            const itemMaterial = existingItem.Material;
            const colorDetails = materials[itemMaterial].Colors;

            if (!Object.prototype.hasOwnProperty.call(colorDetails, existingItem.Color)) {
                throw new TypeError('Color Is Invalid For Material Type.');
            }
        }
    }
    if (customItems && customItems != '') {
        anyItems = true;
        for (const customItem of customItems) {
            if (!isValidUrl(customItem.URL)) {
                throw new TypeError('Item URL Is Invalid.');
            }

            if (doesItemExist(customItem.Name)) {
                throw new Error('Item Already Exists.');
            }

            if (!Object.prototype.hasOwnProperty.call(materials, customItem.Material)) {
                throw new TypeError('Item Material Is Invalid');
            }

            const itemMaterial = customItem.Material;
            const colorDetails = materials[itemMaterial].Colors;

            if (!Object.prototype.hasOwnProperty.call(colorDetails, customItem.Color)) {
                throw new TypeError('Color Is Invalid For Material Type.');
            }
        }
    }
        
    if (!anyItems) {
        throw new Error("No Items Have Been Ordered.");
    }

    return true;
}

function doesItemExist(itemName) {
    for (const item of items) {
        if (item.Name == itemName) {
            return true;
        }
    }
    return false;
}

function isValidUrl(url) {
    try {
        const urlTest = new URL(url.includes('://') ? url : `https://${url}`);
        return url.hostname.includes('.');
    } catch {
        return false;
    }
}

function getPageDirectory(name) {
    return path.join(pagesDirectory, name + '.html');
}

function getPageUrl(name) {
    const domain = production ? domain : ('localhost:' + port);

    return `https://${domain}/pages/${name}`;
}

function getOrderPath(name) {
    return path.join(ordersDirectory, name.includes('.json') ? name : name + '.json' );
}

function submitOrder(order) {
    const time = Date.now();

    order.FullName = order.FirstName + ' ' + order.LastName;
    order.Price = calculateTotalOrderPrice(order.ExistingItems);
    order.TimePlaced = time;

    const orderPath = getOrderPath(time.toString());

    writeJson(orderPath, order);
}

function getOrders() {
    const orderFilenames = fs.readdirSync(ordersDirectory);
    let formattedOrders = {};

    for (const orderFilename of orderFilenames) {
        const order = readJson(getOrderPath(orderFilename));
        const orderId = order.TimePlaced;

        formattedOrders[orderId] = order;
    }

    return formattedOrders;
}

function getOrder(orderId) {
    const orderPath = getOrderPath(orderId);

    return readJson(orderPath);
}

function editOrder(editedOrder) {
    const orderId = editedOrder.TimePlaced;
    const orderPath = getOrderPath(orderId);

    writeJson(orderPath, editedOrder);
}

function finishOrder(orderId) {
    const orderPath = getOrderPath(orderId);

    fs.unlinkSync(orderPath);
}

//Middleware

const submitOrderRateLimit = expressRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1,
    message: 'Too Many Requests, Please Try Agian Later'
});

const loginRateLimit = expressRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too Many Requests, Please Try Again Later'
});

function requireAuthentication(req, res, next) {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.status(403);
        res.setHeader('Content-Type', 'text/plain');
        res.send('You Must Be Authenticated To Do That.');
    }
}

function redirectToLoginIfNotAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect(303, getPageUrl('login'));
    }
}

//Network

app.set('trust proxy', production);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(expressSession({
    store: new FileStore(),
    secret: secret,
    resave: false,
    saveUninitialized: false,
    proxy: production,
    name: 'printshop.sid',
    cookie:  {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
    }
}));
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    return res.redirect(301, cleanPath);
  } else {
    next();
  }
});

app.get('/', (req, res) => {
    res.redirect(301, getPageUrl('form'));
});

app.get('/api/items', (req, res) => {
    res.json(items);
});

app.get('/api/materials', (req, res) => {
    res.json(materials);
});

app.post('/api/calculatePrice', (req, res) => {
    /* items FORMAT
    [
        {
            "Name": "ItemName",
            "Material": "ItemMaterial",
            "Quantity": ItemQuantity
        },
        {
            "Name": "ItemName",
            "Material": "ItemMaterial",
            "Quantity": ItemQuantity
        }
    ]
    */
    let items = req.body;

    const totalOrderPrice = calculateTotalOrderPrice(items);
    res.setHeader('Content-Type', 'text/plain');
    res.send(totalOrderPrice.toFixed(2));
});

app.post('/api/submitOrder', submitOrderRateLimit, (req, res) => {
    /* order FORMAT
        {
            "FirstName": "String",
            "LastName": "String"
            "FullName": "String", (Server-Side)
            "Contact": "String"
            "Notes": "String",
            "Price": "String", (Formatted Like Decimal) (Server-Side)
            "TimePlaced": "Integer" (Server-Side)
            "ExistingItems": [
                {
                    "Name": "String",
                    "Material": "String",
                    "Color": "String",
                    "Quantity": Integer
                },
                {
                    ...
                }
            ],
            "CustomItems": [
                "Name": "String",
                "URL": "String",
                "Material": "String",
                "Color": "String",
                "Quantity": Integer
            ]
        }
    */
    try {
        let order = req.body;

        try {
            verifyOrder(order);
        } catch (Error) {
            res.status(400);
            res.setHeader('Content-Type', 'text/plain');
            res.send(`An Error Occurred While Verifying Your Submitted Order: ${Error}`);
            return;
        }

        submitOrder(order);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Refresh', '5');
        res.send('Successfully Submitted Your Order!');
    } catch (Error) {
        res.status(400);
        res.setHeader('Content-Type', 'text/plain');
        res.send(`An Error Occurred While Submitting Your Order: ${Error}`);
    }
});

app.post('/api/login', loginRateLimit, async (req, res) => {
    const { Username, Password } = req.body;

    try {
        if (Username === credentials.Username) {
            if (await bcrypt.compare(Password, credentials.PasswordHash)) {
                req.session.isAuthenticated = true;

                req.session.save((Error) => {
                    if (Error) { return res.status(500).send(`Error Saving Session: ${Error}`); }
                    res.redirect(303, getPageUrl('orders'));
                });
                return;
            }
        }

        res.setHeader('Content-Type', 'text/plain');
        res.status(401).send('Incorrect Username Or Password.');
    } catch (Error) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(500).send(`An Error Occurred While Signing In: ${Error}`);
    }
});

app.get('/api/logout', async (req, res) => {
    req.session.destroy((Error) => {
        if (Error) {
            res.status(500);
            res.setHeader('Content-Type', 'text/plain');
            res.send(`An Error Occurred While Logging Out: ${Error}`);
            return;
        }
        res.clearCookie('printshop.sid');
        res.redirect(303, getPageUrl('login'));
    });
});

app.post('/api/getOrder', requireAuthentication, async (req, res) => {
    try {
        const orderId = req.body.OrderId;

        const order = getOrder(orderId);
        res.json(order);
    } catch (Error) {
        res.status(500);
        res.setHeader('Content-Type', 'text/plain');
        res.send(`An Error Occurred While Getting Order: ${Error}`);
    }
});

app.get('/api/getOrders', requireAuthentication, async (req, res) => {
    try {
        const orders = getOrders();
        
        res.json(orders);
    } catch (Error) {
        res.status(500);
        res.setHeader('Content-Type', 'text/plain');
        res.send(`An Error Occurred While Getting Orders: ${Error}`);
    }
});

app.post('/api/editOrder', requireAuthentication, async (req, res) => {
    try {
        const editedOrder = req.body;

        try {
            verifyOrder(editedOrder);
        } catch (Error) {
            res.status(400);
            res.setHeader('Content-Type', 'text/plain');
            res.send(`An Error Occurred While Verifying The Edited Order: ${Error}`);
            return;
        }

        editOrder(editedOrder);

        res.setHeader('Content-Type', 'text/plain');
        res.send('Successfully Edited Order!');
    } catch (Error) {
        res.status(500);
        res.setHeader('Content-Type', 'text/plain');
        res.send(`An Error Occurred While Editing Order: ${Error}`);
    }
});

app.post('/api/finishOrder', requireAuthentication, async (req, res) => {
    try {
        const orderId = req.body.OrderId;

        finishOrder(orderId);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Refresh', '5');
        res.send('Successfully Finished Order!');
    } catch (Error) {
        res.status(500);
        res.setHeader('Content-Type', 'text/plain');
        res.send(`An Error Occurred While Finishing Order: ${Error}`);
    }
});

app.get('/pages/login', (req, res) => {
    if (req.session.isAuthenticated) {
        res.redirect(303, getPageUrl('orders'));
    } else {
        res.sendFile(getPageDirectory('login'));
    }
});

app.get('/pages/orders', redirectToLoginIfNotAuthenticated, (req, res) => {
    res.sendFile(getPageDirectory('orders'));
});

app.get('pages/orders/:id/view', redirectToLoginIfNotAuthenticated, (req, res) => {
    res.sendFile(getPageDirectory('view-order'));
})

app.get('/pages/orders/:id/edit', redirectToLoginIfNotAuthenticated, (req, res) => {
    res.sendFile(getPageDirectory('edit-order'));
})

app.use(express.static('public', {
    extensions: ['html']
}));

if (production) {
    app.listen(port, () => {
        console.log(`Server Running On Port ${port}!`);
    });
} else {
    const sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'localhost-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'localhost.pem')),
    };

    https.createServer(sslOptions, app).listen(port, () => {
        console.log(`Server Running On Port ${port}!`);
    });
}

