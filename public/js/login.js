const { postToServer } = window.network;

const loginForm = document.getElementById('loginForm');

const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
//const togglePasswordVisibility = document.getElementById('togglePasswordVisibility');

const errorMessage = document.getElementById('errorMessage');
//const togglePasswordVisibilityIcon = togglePasswordVisibility.querySelector('img');

/*togglePasswordVisibility.addEventListener('click', () => {
    const isPasswordVisible = passwordInput.type === 'text';
    passwordInput.type = isPasswordVisible ? 'password' : 'text';
    togglePasswordVisibility.setAttribute('aria-label', isPasswordVisible ? 'Show password' : 'Hide password');

    if (togglePasswordVisibilityIcon) {
        togglePasswordVisibilityIcon.src = isPasswordVisible
            ? '/images/menuIcons/eye.svg'
            : '/images/menuIcons/eye-slash.svg';
    }
});*/

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const response = await postToServer('login', {
        'Username': usernameInput.value || '',
        'Password': passwordInput.value || ''
    });

    errorMessage.innerHTML = response;
    errorMessage.style.display = 'block';

    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
})