const selfSigned = require('selfsigned');
const readline = require('readline');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { execSync } = require('child_process');

const envFile = path.join(__dirname, '.env');
const credentialsFile = path.join(__dirname, 'credentials.json');
const sslKeyFile = path.join(__dirname, 'cert', 'key.pem');
const sslCertFile = path.join(__dirname, 'cert', 'cert.pem');
const launchFile = path.join(__dirname, '.vscode', 'launch.json');
const packageFile = path.join(__dirname, 'package.json');

const setupFolder = path.join(__dirname, '.setup');

const defaultLaunchFile = path.join(setupFolder, 'launch.json');
const defaultStartFile = path.join(setupFolder, 'start.sh');
const defaultServiceFile = path.join(setupFolder, 'printshop-app.service')

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

if (!fs.existsSync(setupFolder)) {
    console.error('It Appears Setup Has Already Ran!');
    process.exit(0);
}

//.env
console.log('\n');
const port = Number(await prompt('What Port Should The Server Run On? (Hit Enter For Default: 3000): ')) || 3000;
production = await promptYesOrNo('Should This Server Have Production Mode On? ');
console.log('Generating Random Secret...');
const secret = crypto.randomBytes(32).toString('hex');

const envLines = `PORT=${port}\nPRODUCTION=${production}\nSECRET=${secret}`;

fs.writeFileSync(envFile, envLines);

//credentials.json
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

if (!production && !fs.existsSync(certFolder)) {
    console.log('\nGenerating SSL Certificates For Development...');
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
    fs.copyFileSync(defaultLaunchFile, path.join(vscodeFolder, 'launch.json'));
}

if (await promptYesOrNo('Would You Like To Generate A start.sh File For Production', production)) {
    fs.copyFileSync(defaultStartFile, path.join(__dirname, 'start.sh'));
    fs.chmodSync(path.join(__dirname, 'start.sh'), 0o755);

    let package = JSON.parse(fs.readFileSync(packageFile));
    package.scripts.start = '/bin/sh start.sh';
    fs.writeFileSync(packageFile, JSON.stringify(package, null, 2));
}

if (await promptYesOrNo('Would You Like To Generate A printshop.service File For Prodcution And Enable It?', production)) {
    let defaultService = fs.readFileSync(defaultServiceFile, 'utf8');

    defualtService = defaultService.replaceAll('{{USERNAME}}', os.userInfo().username);
    defaultService = defaultService.replaceAll('{{WORKING_DIRECTORY}}', path.resolve(__dirname));

    fs.writeFileSync(path.join(__dirname, 'printshop-app.service'), defaultService);

    execSync(`sudo ln -s ${path.join(__dirname, 'printshop-app.service')} ${'/etc/systemd/system/printshop-app.service'}`, { stdio: 'inherit' });
    execSync('sudo systemctl daemon-reload', { stdio: 'inherit' });
    execSync('sudo systemctl enable printshop-app', { stdio: 'inherit' });
}

if (production) {
    console.log('Changing git Branch To Production...');
    execSync('git checkout -b production');
}

if (production || await promptYesOrNo('Would You Like To Delete The Setup Helper?')) {
    fs.unlinkSync(path.resolve(__filename));
    fs.rmSync(setupFolder, { recursive: true });

    let package = JSON.parse(fs.readFileSync(packageFile));
    delete package.scripts.setup;
    fs.writeFileSync(packageFile, JSON.stringify(package, null, 2));
}

if (!fs.existsSync(ordersFolder)) { fs.mkdirSync(ordersFolder); }
if (!fs.existsSync(sessionsFolder)) { fs.mkdirSync(sessionsFolder); }

console.log('\nSetup Complete!');
process.exit(0);

}

setup();