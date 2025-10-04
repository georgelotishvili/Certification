document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const burger = document.querySelector('.burger');
  const overlay = document.querySelector('.overlay');
  const drawer = document.querySelector('.drawer');
  const drawerClose = document.querySelector('.drawer-close');
  const drawerLinks = document.querySelectorAll('.drawer-nav a');

  const openMenu = () => {
    body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
  };
  const closeMenu = () => {
    body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
  };
  const toggleMenu = () => {
    if (body.classList.contains('menu-open')) closeMenu(); else openMenu();
  };

  if (burger) burger.addEventListener('click', toggleMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);
  if (drawerClose) drawerClose.addEventListener('click', closeMenu);
  drawerLinks.forEach(link => link.addEventListener('click', closeMenu));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Login Modal functionality
  const loginBtn = document.querySelector('.login-btn');
  const drawerLoginBtn = document.querySelector('.drawer-login');
  const loginModal = document.getElementById('loginModal');
  const modalClose = document.getElementById('modalClose');
  const loginOption = document.querySelector('.login-option');
  const registerOption = document.querySelector('.register-option');
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const AUTH_KEY = 'authLoggedIn';
  const isLoggedIn = () => localStorage.getItem(AUTH_KEY) === 'true';
  const setLoggedIn = (value) => { localStorage.setItem(AUTH_KEY, value ? 'true' : 'false'); };

  const openLoginModal = () => {
    if (!loginModal) return;
    loginModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  };
  const closeLoginModal = () => {
    if (!loginModal) return;
    loginModal.classList.remove('show');
    document.body.style.overflow = '';
    // Reset forms when closing modal
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (forgotPasswordForm) forgotPasswordForm.reset();
    showOptions(); // Show options when closing
  };
  const updateAuthUI = () => {
    const logged = isLoggedIn();
    if (loginBtn) loginBtn.textContent = logged ? 'გასვლა' : 'შესვლა';
    if (drawerLoginBtn) drawerLoginBtn.textContent = logged ? 'გასვლა' : 'შესვლა';
  };
  const performLogout = () => {
    if (!isLoggedIn()) return;
    setLoggedIn(false);
    updateAuthUI();
    alert('გასვლა შესრულებულია');
    closeLoginModal();
  };

  if (loginBtn) loginBtn.addEventListener('click', () => {
    if (isLoggedIn()) {
      performLogout();
    } else {
      openLoginModal();
      showOptions();
    }
  });
  if (drawerLoginBtn) drawerLoginBtn.addEventListener('click', () => {
    if (isLoggedIn()) {
      performLogout();
      closeMenu();
    } else {
      closeMenu();
      openLoginModal();
      showOptions();
    }
  });
  if (modalClose) modalClose.addEventListener('click', closeLoginModal);
  if (loginModal) loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeLoginModal(); });
  
  const showOptions = () => {
    const modalButtons = document.querySelector('.modal-buttons');
    if (!modalButtons) return;
    modalButtons.style.display = 'flex';
    if (registerForm) registerForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'none';
    if (forgotPasswordForm) forgotPasswordForm.style.display = 'none';
  };
  
  const showLogin = () => {
    const modalButtons = document.querySelector('.modal-buttons');
    if (!modalButtons) return;
    modalButtons.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
    if (forgotPasswordForm) forgotPasswordForm.style.display = 'none';
  };
  
  const showRegister = () => {
    const modalButtons = document.querySelector('.modal-buttons');
    if (!modalButtons) return;
    modalButtons.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (loginForm) loginForm.style.display = 'none';
    if (forgotPasswordForm) forgotPasswordForm.style.display = 'none';
  };
  
  const showForgotPassword = () => {
    const modalButtons = document.querySelector('.modal-buttons');
    if (!modalButtons) return;
    modalButtons.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'none';
    if (forgotPasswordForm) forgotPasswordForm.style.display = 'block';
  };

  if (loginOption) loginOption.addEventListener('click', showLogin);
  if (registerOption) registerOption.addEventListener('click', showRegister);
  if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); showForgotPassword(); });

  // Login form submission
  if (loginForm) loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const email = (formData.get('email') || '').toString().trim();
    const password = (formData.get('password') || '').toString().trim();
    
    if (!email) { alert('გთხოვთ შეიყვანოთ ელფოსტა'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('ელფოსტა არასწორია'); return; }
    if (!password) { alert('გთხოვთ შეიყვანოთ პაროლი'); return; }
    
    // Simulate login process
    alert('შესვლა წარმატებულია!');
    setLoggedIn(true);
    updateAuthUI();
    closeLoginModal();
    loginForm.reset();
    showOptions();
  });

  // Forgot password form submission
  if (forgotPasswordForm) forgotPasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(forgotPasswordForm);
    const email = (formData.get('email') || '').toString().trim();
    
    if (!email) { alert('გთხოვთ შეიყვანოთ ელფოსტა'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('ელფოსტა არასწორია'); return; }
    
    // Simulate password reset process
    alert('პაროლის აღდგენის ბმული გამოგზავნილია ელფოსტაზე: ' + email);
    closeLoginModal();
    forgotPasswordForm.reset();
    showOptions();
  });

  // Back to login button in forgot password form
  const backToLoginBtn = forgotPasswordForm?.querySelector('.back-to-login');
  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', showLogin);
  }

  if (registerForm) registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const personalId = (formData.get('personalId') || '').toString().trim();
    const firstName = (formData.get('firstName') || '').toString().trim();
    const lastName = (formData.get('lastName') || '').toString().trim();
    const phone = (formData.get('phone') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const password = (formData.get('password') || '').toString().trim();
    const confirmPassword = (formData.get('confirmPassword') || '').toString().trim();
    if (personalId.length !== 11 || !/^\d{11}$/.test(personalId)) { alert('პირადი ნომერი უნდა იყოს 11 ციფრი'); return; }
    if (!firstName || !lastName) { alert('გთხოვთ შეიყვანოთ სახელი და გვარი'); return; }
    if (!/^\d{9}$/.test(phone)) { alert('ტელეფონი უნდა იყოს 9 ციფრი (მაგ: 599123456)'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('ელფოსტა არასწორია'); return; }
    if (password.length < 6) { alert('პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო'); return; }
    if (password !== confirmPassword) { alert('პაროლები არ ემთხვევა'); return; }
    alert('რეგისტრაცია მიღებულია!');
    closeLoginModal();
    registerForm.reset();
    showOptions();
  });
  // Initialize auth UI state on load
  updateAuthUI();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && loginModal && loginModal.classList.contains('show')) closeLoginModal(); });
});

