document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const burger = document.querySelector('.burger');
  const overlay = document.querySelector('.overlay');
  const drawerClose = document.querySelector('.drawer-close');
  const drawerLinks = document.querySelectorAll('.drawer-nav a');
  const on = (el, evt, handler) => el && el.addEventListener(evt, handler);
  const setMenu = (open) => {
    body.classList.toggle('menu-open', open);
    if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const openMenu = () => { setMenu(true); };
  const closeMenu = () => { setMenu(false); };
  const toggleMenu = () => {
    if (body.classList.contains('menu-open')) closeMenu(); else openMenu();
  };

  on(burger, 'click', toggleMenu);
  on(overlay, 'click', closeMenu);
  on(drawerClose, 'click', closeMenu);
  drawerLinks.forEach(link => on(link, 'click', closeMenu));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (loginModal && loginModal.classList.contains('show')) closeLoginModal();
    else closeMenu();
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
  const modalButtons = document.querySelector('.modal-buttons');
  const AUTH_KEY = 'authLoggedIn';
  const isLoggedIn = () => localStorage.getItem(AUTH_KEY) === 'true';
  const setLoggedIn = (value) => { localStorage.setItem(AUTH_KEY, value ? 'true' : 'false'); };
  const getTrimmed = (fd, name) => (fd.get(name) || '').toString().trim();
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
  const handleAuthButtonClick = (fromDrawer) => {
    if (isLoggedIn()) {
      performLogout();
      if (fromDrawer) closeMenu();
    } else {
      if (fromDrawer) closeMenu();
      openLoginModal();
      showOptions();
    }
  };

  on(loginBtn, 'click', () => handleAuthButtonClick(false));
  on(drawerLoginBtn, 'click', () => handleAuthButtonClick(true));
  on(modalClose, 'click', closeLoginModal);
  on(loginModal, 'click', (e) => { if (e.target === loginModal) closeLoginModal(); });
  
  const setView = (view) => {
    if (!modalButtons) return;
    const is = (name) => view === name;
    modalButtons.style.display = is('options') ? 'flex' : 'none';
    if (registerForm) registerForm.style.display = is('register') ? 'block' : 'none';
    if (loginForm) loginForm.style.display = is('login') ? 'block' : 'none';
    if (forgotPasswordForm) forgotPasswordForm.style.display = is('forgot') ? 'block' : 'none';
  };
  const showOptions = () => setView('options');
  const showLogin = () => setView('login');
  const showRegister = () => setView('register');
  const showForgotPassword = () => setView('forgot');

  on(loginOption, 'click', showLogin);
  on(registerOption, 'click', showRegister);
  on(forgotPasswordLink, 'click', (e) => { e.preventDefault(); showForgotPassword(); });

  // Login form submission
  on(loginForm, 'submit', (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const email = getTrimmed(formData, 'email');
    const password = getTrimmed(formData, 'password');
    if (!email) return alert('გთხოვთ შეიყვანოთ ელფოსტა');
    if (!isValidEmail(email)) return alert('ელფოსტა არასწორია');
    if (!password) return alert('გთხოვთ შეიყვანოთ პაროლი');
    alert('შესვლა წარმატებულია!');
    setLoggedIn(true);
    updateAuthUI();
    closeLoginModal();
    loginForm.reset();
    showOptions();
  });

  // Forgot password form submission
  on(forgotPasswordForm, 'submit', (e) => {
    e.preventDefault();
    const formData = new FormData(forgotPasswordForm);
    const email = getTrimmed(formData, 'email');
    if (!email) return alert('გთხოვთ შეიყვანოთ ელფოსტა');
    if (!isValidEmail(email)) return alert('ელფოსტა არასწორია');
    alert('პაროლის აღდგენის ბმული გამოგზავნილია ელფოსტაზე: ' + email);
    closeLoginModal();
    forgotPasswordForm.reset();
    showOptions();
  });

  // Back to login button in forgot password form
  const backToLoginBtn = forgotPasswordForm?.querySelector('.back-to-login');
  on(backToLoginBtn, 'click', showLogin);

  on(registerForm, 'submit', (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const personalId = getTrimmed(formData, 'personalId');
    const firstName = getTrimmed(formData, 'firstName');
    const lastName = getTrimmed(formData, 'lastName');
    const phone = getTrimmed(formData, 'phone');
    const email = getTrimmed(formData, 'email');
    const password = getTrimmed(formData, 'password');
    const confirmPassword = getTrimmed(formData, 'confirmPassword');
    if (personalId.length !== 11 || !/^\d{11}$/.test(personalId)) return alert('პირადი ნომერი უნდა იყოს 11 ციფრი');
    if (!firstName || !lastName) return alert('გთხოვთ შეიყვანოთ სახელი და გვარი');
    if (!/^\d{9}$/.test(phone)) return alert('ტელეფონი უნდა იყოს 9 ციფრი (მაგ: 599123456)');
    if (!isValidEmail(email)) return alert('ელფოსტა არასწორია');
    if (password.length < 6) return alert('პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო');
    if (password !== confirmPassword) return alert('პაროლები არ ემთხვევა');
    alert('რეგისტრაცია მიღებულია!');
    closeLoginModal();
    registerForm.reset();
    showOptions();
  });
  // Initialize auth UI state on load
  updateAuthUI();
  // (Escape handled above for both menu and modal)
});

