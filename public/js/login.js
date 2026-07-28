const loginForm = document.getElementById('loginForm');

const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');

const errorMessage = document.getElementById('errorMessage');

let isRedirecting = false;

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const response = await postToServer('login', {
        'Username': usernameInput.value || '',
        'Password': passwordInput.value || ''
    });

    if (isRedirecting) return;

    errorMessage.innerHTML = response;
    errorMessage.style.display = 'block';

    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
});

window.addEventListener('beforeunload', event => {
    isRedirecting = true;
})