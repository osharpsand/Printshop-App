const selfSigned = require('selfsigned');
const readline = require('readline');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const envFile = path.join(__dirname, '.env');
const credentialsFile = path.join(__dirname, 'credentials.json');
const sslKeyFile = path.join(__dirname, 'cert', 'key.pem');
const sslCertFile = path.join(__dirname, 'cert', 'cert.pem');
const launchFile = path.join(__dirname, '.vscode', 'launch.json');
const packageFile = path.join(__dirname, 'package.json');

const vscodeFolder = path.join(__dirname, '.vscode');
const certFolder = path.join(__dirname, 'cert');
const ordersFolder = path.join(__dirname, 'orders');
const sessionsFolder = path.join(__dirname, 'sessions');

let production = false;

const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function prompt(question) {
    return new Promise((resolve) => {
        readlineInterface.question(question, (answer) => {
            resolve(answer);
        })
    })
}

function promptYesOrNo(question, defaultValue = false) {
    return new Promise((resolve) => {
        readlineInterface.question(`${question} [y]es/[n]o (Hit Enter For Default Value: ${defaultValue ? 'yes' : 'no'}): `, (answer) => {
            if (answer == '') {
                resolve(defaultValue);
            }
            const lowercaseAnswer = answer.toLowerCase();
            resolve(lowercaseAnswer == 'y' || lowercaseAnswer == 'yes');
        })
    })
}

async function setup() {

if (await promptYesOrNo('Would You Like To Create/Edit .env File?', !fs.existsSync(envFile))) {
    console.log('\n');
    const port = Number(await prompt('What Port Should The Server Run On? (Hit Enter For Default: 3000): ')) || 3000;
    production = await promptYesOrNo('Should This Server Have Production Mode On? ');
    console.log('Generating Random Secret...');
    const secret = crypto.randomBytes(32).toString('hex');

    const envLines = `PORT=${port}\nPRODUCTION=${production}\nSECRET=${secret}`;

    try {
        fs.writeFileSync(envFile, envLines);
    } catch (Error) {
        console.error(`Failed To Save .env File: ${Error}`);
    }

    console.log('\n');
}

if (await promptYesOrNo('Would You Like To Create/Edit credentials.json?', !fs.existsSync(credentialsFile))) {
    let trying = true;
    
    while (trying) {
        trying = false;
        console.log('\n');
        const username = await prompt('What Should The Username Be? (Hit Enter For Default: admin): ') || 'admin';
        const password = await prompt('What Should The Password Be? ');
        const confirmPassword = await prompt('Confirm Password: ');

        if (password != confirmPassword) {
            trying = true;
            console.log('Passwords Do Not Match, Retrying');
        } else if (password.length < 8) {
            trying = true;
            console.log('Password Must Contain At Least 8 Characters, Retrying');
        } else if (!(/\d/.test(password))) {
            trying = true;
            console.log('Password Must Contain At A Digit, Retrying');
        } else {
            const credentials = { Username: username, PasswordHash: await bcrypt.hash(password, 12)};

            try {
                fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2));
            } catch (Error) {
                console.error(`Failed To Save credentials.json: ${Error}`);
            }
        }
    }
}

if (await promptYesOrNo('Would You Like To Generate SSL Certificates For Testing?', !production && !fs.existsSync(certFolder))) {
    console.log('\nGenerating SSL Certificates...');
    const pems = await selfSigned.generate([{ name: 'commonName', value: 'localhost' }], 
        { 
            days: 365,
            algorithm: 'sha256'
        });
    console.log('\nGenerated SSL Certificates, Saving To Disk.');

    try {
        if (!fs.existsSync(certFolder)) { fs.mkdirSync(certFolder); }
        fs.writeFileSync(sslKeyFile, pems.private);
        fs.writeFileSync(sslCertFile, pems.cert);
    } catch (Error) {
        console.error(`Error Saving SSL Certificates: ${Error}`);
    }
}

if (await promptYesOrNo('Would You Like To Generate A launch.json for Vscode Debugging?', !production && !fs.existsSync(vscodeFolder))) {
    if (!fs.existsSync(vscodeFolder)) { fs.mkdirSync(vscodeFolder); }
    fs.writeFileSync(launchFile, JSON.stringify({"version": "0.2.0","configurations": [{"type": "node","request": "launch","name": "Launch Program","skipFiles": ["<node_internals>/**"],"program": "${workspaceFolder}/server.js"}]}, null, 2));
}

if (await promptYesOrNo('Would You Like To Delete The Setup Helper?', production)) {
    fs.unlinkSync(path.resolve(__filename));

    let package = JSON.parse(fs.readFileSync(packageFile));
    package.scripts.setup = null;
    package.scripts.postinstall = null;
    fs.writeFileSync = JSON.stringify(package, null, 2);
}

if (!fs.existsSync(ordersFolder)) { fs.mkdirSync(ordersFolder); }
if (!fs.existsSync(sessionsFolder)) { fs.mkdirSync(sessionsFolder); }

console.log('\nSetup Complete!');
process.exit(0);

}

setup();