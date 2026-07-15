document.addEventListener('DOMContentLoaded', () => {
  // Set theme from localStorage if available
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
  } else {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark'); // Default to pitch black
  }

  const toggleBtn = document.getElementById('togglePassword');
  const passInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  
  const eyeOpenPath = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>';
  const eyeClosedPath = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

  // Toggle Password Visibility
  toggleBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
      passInput.type = 'text';
      eyeIcon.innerHTML = eyeClosedPath;
    } else {
      passInput.type = 'password';
      eyeIcon.innerHTML = eyeOpenPath;
    }
  });

  // Handle Login
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = passInput.value;
    
    // Simple validation
    let valid = true;
    if (username === '') {
      document.getElementById('username').classList.add('invalid');
      document.getElementById('userErr').textContent = 'Username is required.';
      valid = false;
    } else {
      document.getElementById('username').classList.remove('invalid');
      document.getElementById('userErr').textContent = '';
    }
    
    if (password === '') {
      document.getElementById('password').classList.add('invalid');
      document.getElementById('passErr').textContent = 'Password is required.';
      valid = false;
    } else {
      document.getElementById('password').classList.remove('invalid');
      document.getElementById('passErr').textContent = '';
    }
    
    if (valid) {
      const loginErr = document.getElementById('loginErr');
      
      // Simulate credential checking
      // Make username check case-insensitive. Accept either 'password' or 'admin' as password.
      if (username.toLowerCase() === 'admin' && (password === 'password' || password === 'admin')) {
        loginErr.textContent = '';
        
        // Save the capitalized username to localStorage
        const displayName = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
        localStorage.setItem('sms_loggedInUser', displayName);
        
        // Show loading state on button
        const btn = loginForm.querySelector('.login-btn');
        btn.innerHTML = 'Signing in... <svg viewBox="0 0 24 24" fill="none"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"/></svg>';
        btn.style.opacity = '0.8';
        btn.style.cursor = 'not-allowed';
        
        // Simulate network delay then redirect
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1000);
      } else {
        // Invalid credentials
        loginErr.textContent = 'Invalid username or password.';
        document.getElementById('username').classList.add('invalid');
        document.getElementById('password').classList.add('invalid');
      }
    }
  });
});
