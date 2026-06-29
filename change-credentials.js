const readline = require('readline');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const credentialsFile = path.join(__dirname, 'credentials.json');

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

async function changeCredentials() {
    try {
        console.log('\nChange Admin Credentials\n');

        //Get User Input
        const Username = await prompt('Enter New Username (Leave Blank To Keep Unchanged): ');
        const Password = await prompt('Enter New Password: ');
        const ConfirmPassword = await prompt('Confirm New Password: ');

        //Check User Input
        if (Password !== ConfirmPassword) {
            console.error('Passwords Do Not Match!');
            readlineInterface.close();
            return;
        }

        if (Password.length < 8) {
            console.error('Password Must Be At Least 8 Characters Long');
            readlineInterface.close();
            return;
        }

        if (!(/\d/.test(Password))) {
            console.error('Password Must Contain A Number!');
            readlineInterface.close();
            return;
        }

        //Get Current Credentials
        let credentials = { Username: 'admin', PasswordHash: ''};
        if (fs.existsSync(credentialsFile)) {
            try {
                const fileContent = fs.readFileSync(credentialsFile, 'utf-8');
                if (fileContent.trim()) {
                    credentials = JSON.parse(fileContent);
                }
            } catch (parseError) {
                console.warn('Warning: Could Not Parse credentials.json, Using Defaults.');
            }
        }

        if (Username && Username !== '') {
            credentials.Username = Username;
        }

        //Generate Password Hash
        const saltRounds = 12;
        credentials.PasswordHash = await bcrypt.hash(Password, saltRounds);

        fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2));

        console.log('\nCredentials Updated Successfully!')
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        readlineInterface.close();
    }
}

changeCredentials();