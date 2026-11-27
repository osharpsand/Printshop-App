const expressRateLimit = require('express-rate-limit');
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
const express = require('express');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const crypto = require('crypto');
const lusca = require('lusca');
const https = require('https');
const net = require('net');
const path = require('path');
const fs = require('fs');
const selfsigned = require('selfsigned');

const { archiveCompletedOrderDays, moveOrderToArchive } = require('./order-archive');

const FileStore = require('session-file-store')(expressSession);

const configDirectory = path.join(__dirname, 'config');

const envFile = path.join(configDirectory, '.env');

try {
    process.loadEnvFile(envFile);
} catch (Error) {
    console.error('The .env File Failed To Load, Using Defaults.');
}

const port = process.env.PORT || 3000;
const production = process.env.PRODUCTION == 'true' || false;
const secret = process.env.SECRET || crypto.randomBytes(32).toString('hex');
const domain = process.env.DOMAIN || `localhost:${port}`;

const app = express();

const credentialsFile = path.join(configDirectory, 'credentials.json');
const itemsFile = path.join(configDirectory, 'items.json');
const materialsFile = path.join(configDirectory, 'materials.json');

const items = readJson(itemsFile, true);
const materials = readJson(materialsFile, true);

const pagesDirectory = path.join(__dirname, 'public', 'pages');
const ordersDirectory = path.join(__dirname, 'orders');
const archiveDirectory = path.join(__dirname, 'archive');
const sessionsDirectory = path.join(__dirname, 'sessions');
const certDirectory = path.join(__dirname, 'cert');

const sessionStore = new FileStore({
    path: sessionsDirectory
});

sessionStore.touch = (_sessionId, _session, callback) => callback(null);

const filamentIconsDirectory = path.join(__dirname, 'public', 'images', 'filamentIcons');

fs.writeFileSync(envFile, `PORT=${port}\nPRODUCTION=${production}\nSECRET=${secret}\nDOMAIN=${domain}`);

if (!fs.existsSync(credentialsFile) || process.env.ADMIN_USERNAME || process.env.ADMIN_PASSWORD) {
    const credentials = {
        Username: process.env.ADMIN_USERNAME || 'admin',
        PasswordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin', 12)
    };

    fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2));
}

const credentials = readJson(credentialsFile, true);

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
    const itemDetails = items[item.Name];

    const materialPriceRatio = materials[item.Material].Price / materials[itemDetails.DefaultMaterial].Price;
    return itemDetails.Price * materialPriceRatio * item.Quantity;
}

function verifyOrder(order) {
    if (!order.FirstName || order.FirstName == '' || !order.LastName || order.LastName == '') {
        throw new Error('Name Is Invalid.');
    }

    function verifyItemQuantity(quantity) {
        if (typeof quantity !== 'number' && typeof quantity !== 'string') {
            throw new TypeError('Item Quantity Is Invalid.');
        }

        const numericQuantity = Number(quantity);
        if (!Number.isInteger(numericQuantity) || numericQuantity < 1 || numericQuantity > 100) {
            throw new TypeError('Item Quantity Is Invalid.');
        }
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

            verifyItemQuantity(existingItem.Quantity);

            const itemDetails = items[existingItem.Name];

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
            verifyItemQuantity(customItem.Quantity);

            if (!isValidUrl(customItem.Link)) {
                throw new TypeError('Item Link Is Invalid.');
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
    return items.hasOwnProperty(itemName);
}

function isValidUrl(url) {
    try {
        const urlTest = new URL(url.includes('://') ? url : `https://${url}`);
        return urlTest.hostname.includes('.');
    } catch {
        return false;
    }
}

function getPageDirectory(name) {
    return path.join(pagesDirectory, name + '.html');
}

function getPageUrl(name) {
    return `https://${domain}/pages/${name}`;
}

function getOrderPath(name) {
    const rawName = String(name);
    const baseName = rawName.endsWith('.json') ? rawName.slice(0, -5) : rawName;

    if (!/^\d+$/.test(baseName)) {
        throw new Error('Invalid order id');
    }

    const ordersRoot = path.resolve(ordersDirectory);
    const resolvedOrderPath = path.resolve(ordersRoot, baseName + '.json');

    if (resolvedOrderPath !== ordersRoot && !resolvedOrderPath.startsWith(ordersRoot + path.sep)) {
        throw new Error('Invalid order path');
    }

    return resolvedOrderPath;
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
    let formattedOrders = [];

    for (const orderFilename of orderFilenames) {
        if (orderFilename == '.gitkeep') continue;
        const order = readJson(getOrderPath(orderFilename));

        formattedOrders.push(order);
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
    const orderPath = getOrderPath(orderId.toString());

    moveOrderToArchive(orderPath, archiveDirectory);
}

//Middleware

const submitOrderRateLimit = expressRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2,
    message: 'Too Many Requests, Please Try Agian Later'
});

const loginRateLimit = expressRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too Many Requests, Please Try Again Later'
});

const filamentIconRateLimit = expressRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 250,
    message: 'Too Many Reqests, Please Try Again Later'
});

const getOrderRateLimit = expressRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too Many Requests, Please Try Again Later'
});

const getOrdersRateLimit = expressRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too Many Requests, Please Try Again Later'
});

const getLoginPageRateLimit = expressRateLimit({
    windowMs: 15 * 60 * 100,
    max: 10,
    message: 'Too Many Requests, Please Try Again Later'
});

const getFilamentsWithIconsRateLimit = expressRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    message: 'Too Many Requests, Please Try Again Later'
});

const editOrderRateLimit = expressRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
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

app.set('trust proxy', production ? 1 : 0);

if (production) {
    app.use((req, res, next) => {
        if (!req.secure) {
            return res.redirect(308, `https://${domain}${req.originalUrl}`);
        }

        next();
    });
}

app.use(helmet({
    strictTransportSecurity: production ? undefined : false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(expressSession({
    store: sessionStore,
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
app.use(lusca.csrf());
app.use((req, res, next) => {
    const decodedPath = decodeURIComponent(req.path || '');

    if (decodedPath.includes('..')) {
        res.status(400);
        res.setHeader('Content-Type', 'text/plain');
        res.send('Invalid Search Path');

        return;
    }

    next();
})

app.get('/api/csrf-token', (req, res) => {
    res.json({ token: req.csrfToken() });
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

app.post('/api/calculateOrderPrice', (req, res) => {
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
                {
                    "Link": "String",
                    "Material": "String",
                    "Color": "String",
                    "Quantity": Integer
                },
                {
                    ...
                }
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

app.post('/api/editOrder', editOrderRateLimit, requireAuthentication, async (req, res) => {
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

app.get('/api/whatColorsHaveFilamentIcons/:material', getFilamentsWithIconsRateLimit, (req, res) => {
    const material = req.params.material;

    const iconsBasePath = path.resolve(filamentIconsDirectory);
    const filamentIconsPath = path.resolve(iconsBasePath, material);
    const relativeIconsPath = path.relative(iconsBasePath, filamentIconsPath);

    if (relativeIconsPath.startsWith('..') || path.isAbsolute(relativeIconsPath)) {
        res.json([]);
        return;
    }

    if (!fs.existsSync(filamentIconsPath)) {
        res.json([]);
        return;
    }

    const colorsWtihFilamentIcons = fs.readdirSync(filamentIconsPath).map(color => { return color.endsWith('.webp') ? color.slice(0, -5) : color});

    res.json(colorsWtihFilamentIcons);
})

app.get('/pages/login', getLoginPageRateLimit, (req, res) => {
    if (req.session.isAuthenticated) {
        res.redirect(303, getPageUrl('orders'));
    } else {
        res.sendFile(getPageDirectory('login'));
    }
});

app.get('/pages/orders', getOrdersRateLimit, redirectToLoginIfNotAuthenticated, (req, res) => {
    res.sendFile(getPageDirectory('orders'));
});

app.get('/pages/order/:id', getOrderRateLimit, redirectToLoginIfNotAuthenticated, (req, res) => {
    res.sendFile(getPageDirectory('order'));
});

app.get('/images/filamentIcons/:material/:color.webp', filamentIconRateLimit, async (req, res) => {
    const material = req.params.material;
    const color = req.params.color;

    const iconsBasePath = path.resolve(filamentIconsDirectory);
    const iconPath = path.resolve(iconsBasePath, material, `${color}.webp`);
    const relativeIconPath = path.relative(iconsBasePath, iconPath);

    if (relativeIconPath.startsWith('..') || path.isAbsolute(relativeIconPath)) {
        res.sendStatus(404);
        return;
    }

    if (fs.existsSync(iconPath)) {
        res.sendFile(iconPath);
    }
});

app.use(express.static('public', {
    extensions: ['html']
}));

let orderArchiveMaintenance = Promise.resolve();

function runOrderArchiveMaintenance() {
    orderArchiveMaintenance = orderArchiveMaintenance
        .then(() => archiveCompletedOrderDays(archiveDirectory))
        .catch(error => {
            console.error('Failed to archive completed orders:', error);
        });

    return orderArchiveMaintenance;
}

function scheduleOrderArchiveMaintenance() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const delay = nextMidnight.getTime() - now.getTime();

    const timer = setTimeout(async () => {
        await runOrderArchiveMaintenance();
        scheduleOrderArchiveMaintenance();
    }, delay);

    timer.unref();
}

runOrderArchiveMaintenance();
scheduleOrderArchiveMaintenance();

async function getDevelopmentTlsOptions() {
    fs.mkdirSync(certDirectory, { recursive: true });

    const keyFile = path.join(certDirectory, 'localhost-key.pem');
    const certFile = path.join(certDirectory, 'localhost-cert.pem');

    if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
        const hostname = new URL(`https://${domain}`).hostname.replace(/^\[|\]$/g, '');
        const altNames = [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: '::1' }
        ];

        if (net.isIP(hostname)) {
            altNames.push({ type: 7, ip: hostname });
        } else if (hostname !== 'localhost') {
            altNames.push({ type: 2, value: hostname });
        }

        const certificate = await selfsigned.generate(
            [{ name: 'commonName', value: hostname }],
            {
                days: 365,
                keySize: 2048,
                algorithm: 'sha256',
                extensions: [{ name: 'subjectAltName', altNames }]
            }
        );

        fs.writeFileSync(keyFile, certificate.private, { mode: 0o600 });
        fs.writeFileSync(certFile, certificate.cert);
        console.log(`Generated a self-signed development certificate in ${certDirectory}.`);
    }

    return {
        key: fs.readFileSync(keyFile),
        cert: fs.readFileSync(certFile)
    };
}

async function startServer() {
    const server = production
        ? app
        : https.createServer(await getDevelopmentTlsOptions(), app);

    server.listen(port, () => {
        console.log(`Server Running On Port ${port}!`);
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('The Server Will Shut Down Now.');
    process.exit(0);
});