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
  const authBanner = document.querySelector('.auth-banner');
  const drawerAuthBanner = document.querySelector('.drawer-auth-banner');
  // Fullscreen/isolation helpers
  const rootEl = document.documentElement;
  const appRegions = Array.from(document.querySelectorAll('header, .nav-bar, main, footer, .overlay, .drawer, #loginModal'));
  let previouslyFocused = null;
  const setIsolated = (on) => {
    appRegions.forEach(el => {
      if (!el) return;
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
  };
  let trapFocusHandler = null;
  let mustStayFullscreen = false;
  const lockKeys = async () => {
    try { await navigator.keyboard?.lock?.(['Escape','F11','F4']); } catch {}
  };
  const unlockKeys = async () => {
    try { await navigator.keyboard?.unlock?.(); } catch {}
  };
  const getVisibleFocusable = () => {
    if (!fullscreenBlank) return [];
    const nodes = fullscreenBlank.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    return Array.from(nodes).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null && !el.closest('[hidden]'));
  };
  // Fullscreen blank overlay
  const fullscreenBlank = document.getElementById('fullscreenBlank');
  const blankClose = document.getElementById('blankClose');
  const AUTH_KEY = 'authLoggedIn';
  const CURRENT_USER_KEY = 'currentUser';
  const USED_CODES_KEY = 'usedCodes';
  const DEFAULT_BANNER_TEXT = 'გთხოვთ გაიაროთ ავტორიზაცია';
  const isLoggedIn = () => localStorage.getItem(AUTH_KEY) === 'true';
  const setLoggedIn = (value) => { localStorage.setItem(AUTH_KEY, value ? 'true' : 'false'); };
  const getTrimmed = (fd, name) => (fd.get(name) || '').toString().trim();
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const getUsedCodes = () => new Set(JSON.parse(localStorage.getItem(USED_CODES_KEY) || '[]'));
  const saveUsedCodes = (codesSet) => localStorage.setItem(USED_CODES_KEY, JSON.stringify(Array.from(codesSet)));
  const getCurrentUser = () => {
    try { const raw = localStorage.getItem(CURRENT_USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  const saveCurrentUser = (user) => localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  const generateUniqueCode = () => {
    const used = getUsedCodes();
    for (let i = 0; i < 10000; i++) {
      const code = String(Math.floor(1e9 + Math.random() * 9e9));
      if (!used.has(code)) return code;
    }
    // Fallback (extremely unlikely)
    return String(Date.now()).slice(-10);
  };
  const updateBanner = () => {
    const user = getCurrentUser();
    const text = (isLoggedIn() && user)
      ? `${user.firstName} ${user.lastName} — ${user.code}`
      : DEFAULT_BANNER_TEXT;
    if (authBanner) authBanner.textContent = text;
    if (drawerAuthBanner) drawerAuthBanner.textContent = text;
  };

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
  const openBlank = () => {
    if (!fullscreenBlank) return;
    fullscreenBlank.classList.add('show');
    fullscreenBlank.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // Ensure mobile drawer is closed under the blank screen
    setMenu(false);
    // Isolate rest of the UI
    setIsolated(true);
    previouslyFocused = document.activeElement;
    // Reset any prior confirmation dialogs
    if (typeof hideAllConfirm === 'function') hideAllConfirm();
    mustStayFullscreen = true;
    // Enter browser fullscreen to hide chrome/taskbar
    try {
      const req = rootEl.requestFullscreen || rootEl.webkitRequestFullscreen || rootEl.msRequestFullscreen;
      if (req) {
        const p = req.call(rootEl, { navigationUI: 'hide' });
        if (p && typeof p.then === 'function') {
          p.then(lockKeys).catch(() => {});
        } else {
          lockKeys();
        }
      } else {
        lockKeys();
      }
    } catch {}
    // Enable beforeunload native confirm dialog for hard closes (Alt+F4/tab close)
    enableBeforeUnload();
    // Focus trap across visible controls
    setTimeout(() => { if (blankClose) blankClose.focus(); }, 0);
    trapFocusHandler = (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const items = getVisibleFocusable();
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      let nextIndex = e.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index === items.length - 1 ? 0 : index + 1);
      items[nextIndex].focus();
    };
    fullscreenBlank.addEventListener('keydown', trapFocusHandler);
  };
  const closeBlank = () => {
    if (!fullscreenBlank) return;
    fullscreenBlank.classList.remove('show');
    fullscreenBlank.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Remove focus trap and restore UI
    if (trapFocusHandler) {
      fullscreenBlank.removeEventListener('keydown', trapFocusHandler);
      trapFocusHandler = null;
    }
    setIsolated(false);
    mustStayFullscreen = false;
    // Disable beforeunload prompt
    disableBeforeUnload();
    // Release keyboard lock
    unlockKeys();
    // Exit fullscreen if active
    try {
      if (document.fullscreenElement) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit) exit.call(document);
      }
    } catch {}
    // Restore focus
    try { previouslyFocused && previouslyFocused.focus && previouslyFocused.focus(); } catch {}
  };
  const updateAuthUI = () => {
    const logged = isLoggedIn();
    if (loginBtn) loginBtn.textContent = logged ? 'გასვლა' : 'ავტორიზაცია';
    if (drawerLoginBtn) drawerLoginBtn.textContent = logged ? 'გასვლა' : 'ავტორიზაცია';
  };
  const performLogout = () => {
    if (!isLoggedIn()) return;
    setLoggedIn(false);
    updateAuthUI();
    updateBanner();
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
  // Open exam: navigate to dedicated page
  const examLinks = Array.from(document.querySelectorAll('.nav a, .drawer-nav a'))
    .filter(a => (a.textContent || '').trim() === 'გამოცდა');
  examLinks.forEach(link => on(link, 'click', (e) => {
    const href = link.getAttribute('href');
    if (href && href !== '#') return; // already points to exam.html
    e.preventDefault();
    if (link.closest('.drawer-nav')) closeMenu();
    window.location.href = 'exam.html';
  }));

  // (Removed) inline overlay fullscreen listeners

  // Native beforeunload confirm when trying to close the tab/window (e.g., Alt+F4)
  let beforeUnloadHandler = null;
  const enableBeforeUnload = () => {
    if (beforeUnloadHandler) return;
    beforeUnloadHandler = (e) => {
      if (!(fullscreenBlank && fullscreenBlank.classList.contains('show'))) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
  };
  const disableBeforeUnload = () => {
    if (!beforeUnloadHandler) return;
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  };

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
    const user = getCurrentUser();
    if (!user) {
      updateBanner();
      showRegister();
      try {
        const regEmailInput = registerForm?.querySelector('input[name="email"]');
        if (regEmailInput) regEmailInput.value = email;
      } catch {}
      alert('თქვენ ჯერ არ გაქვთ დასრულებული რეგისტრაცია. გთხოვთ შეავსოთ ველები, რათა გამოჩნდეს თქვენი სახელი/გვარი და უნიკალური კოდი.');
      return;
    }
    updateBanner();
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
    const code = generateUniqueCode();
    const used = getUsedCodes();
    used.add(code);
    saveUsedCodes(used);
    saveCurrentUser({ firstName, lastName, code });
    setLoggedIn(true);
    updateAuthUI();
    updateBanner();
    alert('რეგისტრაცია მიღებულია!');
    closeLoginModal();
    registerForm.reset();
    showOptions();
  });
  // Initialize auth UI state on load
  updateAuthUI();
  updateBanner();
  // (Escape handled above for both menu and modal)

  // Footer form submission
  const footerForm = document.querySelector('.footer-form');
  if (footerForm) {
    on(footerForm, 'submit', (e) => {
      e.preventDefault();
      const formData = new FormData(footerForm);
      const name = (formData.get('name') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();
      
      if (!name) return alert('გთხოვთ შეიყვანოთ სახელი');
      if (!email) return alert('გთხოვთ შეიყვანოთ ელფოსტა');
      if (!isValidEmail(email)) return alert('ელფოსტა არასწორია');
      if (!message) return alert('გთხოვთ შეიყვანოთ შეტყობინება');
      
      alert('თქვენი შეტყობინება გაგზავნილია! ჩვენ მალე დაგიკავშირდებით.');
      footerForm.reset();
    });
  }
});

