document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE === 'string')
    ? window.APP_CONFIG.API_BASE
    : 'http://127.0.0.1:8000';
  const FOUNDER_EMAIL = 'naormala@gmail.com';
  const KEYS = {
    AUTH: 'authLoggedIn',
    CURRENT_USER: 'currentUser',
    USED_CODES: 'usedCodes',
    SAVED_EMAIL: 'savedEmail',
    SAVED_PASSWORD: 'savedPassword',
  };

  const DOM = {
    body: document.body,
    root: document.documentElement,
    header: document.querySelector('header'),
    navLogo: document.querySelector('.nav-bar .logo'),
    burger: document.querySelector('.burger'),
    overlay: document.querySelector('.overlay'),
    drawer: document.querySelector('.drawer'),
    drawerClose: document.querySelector('.drawer-close'),
    drawerLinks: Array.from(document.querySelectorAll('.drawer-nav a')).filter((a) => !a.classList.contains('drawer-exam-trigger')),
    drawerExamTrigger: document.querySelector('.drawer-exam-trigger'),
    drawerSubmenu: document.querySelector('.drawer-submenu'),
    drawerAuthBanner: document.querySelector('.drawer-auth-banner'),
    loginBtn: document.querySelector('.login-btn'),
    drawerLoginBtn: document.querySelector('.drawer-login'),
    loginModal: document.getElementById('loginModal'),
    modalClose: document.getElementById('modalClose'),
    modalButtons: document.querySelector('.modal-buttons'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    forgotPasswordForm: document.getElementById('forgotPasswordForm'),
    loginOption: document.querySelector('.login-option'),
    registerOption: document.querySelector('.register-option'),
    forgotPasswordLink: document.getElementById('forgotPasswordLink'),
    fullscreenBlank: document.getElementById('fullscreenBlank'),
    blankClose: document.getElementById('blankClose'),
    authBanner: document.querySelector('.auth-banner'),
    adminLink: document.querySelector('.admin-link'),
    navExam: document.querySelector('.nav-exam'),
    navExamTrigger: document.querySelector('.nav .exam-trigger'),
    navDropdown: document.querySelector('.nav .dropdown'),
    footerForm: document.querySelector('.footer-form'),
    navContact: document.querySelector('.nav-contact'),
    drawerContact: document.querySelector('.drawer-contact'),
    navRegistry: document.querySelector('.nav-registry'),
    drawerRegistry: document.querySelector('.drawer-registry'),
    registryTriggers: Array.from(document.querySelectorAll('.nav-registry, .drawer-registry')),
    registryOverlay: document.getElementById('registryOverlay'),
    registryClose: document.getElementById('registryClose'),
    registryList: document.getElementById('registryList'),
    registrySearch: document.getElementById('registrySearch'),
    registryFilterArchitect: document.getElementById('registryFilterArchitect'),
    registryFilterExpert: document.getElementById('registryFilterExpert'),
    registrySort: document.getElementById('registrySort'),
  };

  const regionsForIsolation = Array.from(document.querySelectorAll('header, .nav-bar, main, footer, .overlay, .drawer, #loginModal'));

  const GEORGIA_TIME_ZONE = 'Asia/Tbilisi';
  const ISO_NO_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
  const ISO_WITH_SPACE_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
  let tbilisiFormatter = null;

  function getTbilisiFormatter() {
    if (!tbilisiFormatter) {
      tbilisiFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: GEORGIA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return tbilisiFormatter;
  }

  function normalizeIsoString(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (trimmed.endsWith('Z')) return trimmed;
    if (/[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
    if (ISO_NO_TZ_REGEX.test(trimmed)) return `${trimmed}Z`;
    if (ISO_WITH_SPACE_REGEX.test(trimmed)) return `${trimmed.replace(' ', 'T')}Z`;
    return trimmed;
  }

  function parseUtcDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    try {
      const normalized = normalizeIsoString(String(value));
      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  const utils = {
    on: (element, event, handler) => element && element.addEventListener(event, handler),
    isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    getTrimmed: (formData, name) => (formData.get(name) || '').toString().trim(),
    formatDateTime: (value) => {
      const date = parseUtcDate(value);
      if (!date) return String(value || '');
      try {
        const formatter = getTbilisiFormatter();
        const parts = formatter.formatToParts(date);
        const mapped = parts.reduce((acc, part) => {
          if (part.type !== 'literal') acc[part.type] = part.value;
          return acc;
        }, {});
        const day = mapped.day || '00';
        const month = mapped.month || '00';
        const year = mapped.year || '0000';
        const hour = mapped.hour || '00';
        const minute = mapped.minute || '00';
        return `${day}-${month}-${year} ${hour}:${minute}`;
      } catch {
        return String(value || '');
      }
    },
  };

  const layoutModule = createLayoutModule();
  const menuModule = createMenuModule();
  const fullscreenModule = createFullscreenModule();
  const authModule = createAuthModule();
  const registryModule = window.Registry.init({
    api: API_BASE,
    triggers: ['.nav-registry', '.drawer-registry'],
    beforeOpen: (el) => {
      try {
        if (el?.classList?.contains('drawer-registry')) {
          menuModule.close();
        }
      } catch {}
    },
    refreshRating: true,
  });
  const examNavigationModule = createExamNavigationModule();
  const footerFormModule = createFooterFormModule();

  layoutModule.init();
  menuModule.init();
  fullscreenModule.init();
  authModule.init();
  examNavigationModule.init();
  footerFormModule.init();
  setupContactScroll();
  setupProfileNavigation();

  // Global escape handling (modal first, then menu)
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (authModule.isModalOpen()) {
      authModule.closeModal();
      return;
    }
    if (registryModule.isOpen()) {
      registryModule.close();
      return;
    }
    if (menuModule.isOpen()) {
      menuModule.close();
    }
  });

  // Expose fullscreen helpers if other scripts need them
  window.fullscreenOverlay = {
    open: fullscreenModule.open,
    close: fullscreenModule.close,
  };

  function setupContactScroll() {
    const footer = document.querySelector('footer');
    if (!footer) return;

    const scrollToFooter = (event, shouldCloseMenu = false) => {
      event.preventDefault();
      footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (shouldCloseMenu) {
        menuModule.close();
      }
    };

    utils.on(DOM.navContact, 'click', (event) => scrollToFooter(event));
    utils.on(DOM.drawerContact, 'click', (event) => scrollToFooter(event, true));
  }

  // header-video support removed (no longer used)

  function setupProfileNavigation() {
    const navProfile = document.querySelector('.nav-profile');
    const drawerProfile = document.querySelector('.drawer-profile');

    const goMy = (event, shouldCloseMenu = false) => {
      event.preventDefault();
      if (shouldCloseMenu) menuModule.close();
      window.location.href = 'my.html';
    };

    utils.on(navProfile, 'click', (event) => goMy(event, false));
    utils.on(drawerProfile, 'click', (event) => goMy(event, true));
  }

  function createLayoutModule() {
    function setBodyOffset() {
      // No offset: main content should go under the fixed header
      if (!DOM.body) return;
      DOM.body.style.paddingTop = '0px';
    }

    function init() {
      setBodyOffset();
      utils.on(window, 'load', setBodyOffset);
      utils.on(window, 'resize', setBodyOffset);
      // Click logo to scroll to top
      utils.on(DOM.navLogo, 'click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    return { init };
  }

  function createMenuModule() {
    let isOpen = false;

    const media = {
      drawerExamTrigger: DOM.drawerExamTrigger,
      drawerSubmenu: DOM.drawerSubmenu,
    };

    function setMenu(open) {
      isOpen = !!open;
      DOM.body?.classList.toggle('menu-open', !!open);
      if (DOM.burger) DOM.burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) closeDrawerSubmenu();
    }

    function open() { setMenu(true); }
    function close() { setMenu(false); }
    function toggle() { setMenu(!isOpen); }

    function isMenuOpen() { return isOpen; }

    function closeDrawerSubmenu() {
      if (!media.drawerSubmenu) return;
      media.drawerSubmenu.setAttribute('hidden', '');
      media.drawerExamTrigger?.setAttribute('aria-expanded', 'false');
    }

    function toggleDrawerSubmenu(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!media.drawerSubmenu) return;
      const hidden = media.drawerSubmenu.hasAttribute('hidden');
      if (hidden) {
        media.drawerSubmenu.removeAttribute('hidden');
        media.drawerExamTrigger?.setAttribute('aria-expanded', 'true');
      } else {
        closeDrawerSubmenu();
      }
    }

    function init() {
      utils.on(DOM.burger, 'click', toggle);
      utils.on(DOM.overlay, 'click', close);
      utils.on(DOM.drawerClose, 'click', close);
      DOM.drawerLinks.forEach((link) => utils.on(link, 'click', close));
      utils.on(DOM.drawerExamTrigger, 'click', toggleDrawerSubmenu);
    }

    return { init, open, close, toggle, isOpen: isMenuOpen, closeDrawerSubmenu };
  }

  function createFullscreenModule() {
    let trapFocusHandler = null;
    let mustStayFullscreen = false;
    let previouslyFocused = null;
    let beforeUnloadHandler = null;

    const keyboardLocks = ['Escape', 'F11', 'F4'];

    function lockKeys() {
      try { navigator.keyboard?.lock?.(keyboardLocks); } catch {}
    }

    function unlockKeys() {
      try { navigator.keyboard?.unlock?.(); } catch {}
    }

    function enableBeforeUnload() {
      if (beforeUnloadHandler) return;
      beforeUnloadHandler = (event) => {
        if (!(DOM.fullscreenBlank && DOM.fullscreenBlank.classList.contains('show'))) return;
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', beforeUnloadHandler);
    }

    function disableBeforeUnload() {
      if (!beforeUnloadHandler) return;
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      beforeUnloadHandler = null;
    }

    function setIsolated(value) {
      regionsForIsolation.forEach((element) => {
        if (!element) return;
        if (value) {
          element.setAttribute('inert', '');
          element.setAttribute('aria-hidden', 'true');
        } else {
          element.removeAttribute('inert');
          element.removeAttribute('aria-hidden');
        }
      });
    }

    function getVisibleFocusable() {
      if (!DOM.fullscreenBlank) return [];
      const nodes = DOM.fullscreenBlank.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      return Array.from(nodes).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null && !element.closest('[hidden]'));
    }

    function open() {
      if (!DOM.fullscreenBlank) return;
      DOM.fullscreenBlank.classList.add('show');
      DOM.fullscreenBlank.setAttribute('aria-hidden', 'false');
      DOM.body.style.overflow = 'hidden';
      menuModule.close();
      setIsolated(true);
      previouslyFocused = document.activeElement;
      if (typeof window.hideAllConfirm === 'function') window.hideAllConfirm();
      mustStayFullscreen = true;
      try {
        const request = DOM.root.requestFullscreen || DOM.root.webkitRequestFullscreen || DOM.root.msRequestFullscreen;
        if (request) {
          const result = request.call(DOM.root, { navigationUI: 'hide' });
          if (result && typeof result.then === 'function') {
            result.then(lockKeys).catch(() => {});
          } else {
            lockKeys();
          }
        } else {
          lockKeys();
        }
      } catch {}
      enableBeforeUnload();
      setTimeout(() => DOM.blankClose?.focus(), 0);
      trapFocusHandler = (event) => {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        const items = getVisibleFocusable();
        if (!items.length) return;
        const index = items.indexOf(document.activeElement);
        const nextIndex = event.shiftKey
          ? (index <= 0 ? items.length - 1 : index - 1)
          : (index === items.length - 1 ? 0 : index + 1);
        items[nextIndex].focus();
      };
      DOM.fullscreenBlank.addEventListener('keydown', trapFocusHandler);
    }

    function close() {
      if (!DOM.fullscreenBlank) return;
      DOM.fullscreenBlank.classList.remove('show');
      DOM.fullscreenBlank.setAttribute('aria-hidden', 'true');
      DOM.body.style.overflow = '';
      if (trapFocusHandler) {
        DOM.fullscreenBlank.removeEventListener('keydown', trapFocusHandler);
        trapFocusHandler = null;
      }
      setIsolated(false);
      mustStayFullscreen = false;
      disableBeforeUnload();
      unlockKeys();
      try {
        if (document.fullscreenElement) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
          if (exit) exit.call(document);
        }
      } catch {}
      try {
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
      } catch {}
    }

    function init() {
      utils.on(DOM.blankClose, 'click', close);
      utils.on(DOM.fullscreenBlank, 'click', (event) => {
        if (event.target === DOM.fullscreenBlank) close();
      });
    }

    return { init, open, close, mustStayFullscreen: () => mustStayFullscreen };
  }

  function createAuthModule() {
    const DEFAULT_BANNER_TEXT = 'გთხოვთ შეხვიდეთ სისტემაში';
    const NEED_REGISTER_TEXT = 'გთხოვთ შეხვიდეთ სისტემაში';

    let activeView = 'options';

    function isLoggedIn() {
      return localStorage.getItem(KEYS.AUTH) === 'true';
    }

    function setLoggedIn(value) {
      localStorage.setItem(KEYS.AUTH, value ? 'true' : 'false');
    }

    function getCurrentUser() {
      try {
        const raw = localStorage.getItem(KEYS.CURRENT_USER);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }

    function saveCurrentUser(user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    }

    function getUsedCodes() {
      try {
        return new Set(JSON.parse(localStorage.getItem(KEYS.USED_CODES) || '[]'));
      } catch {
        return new Set();
      }
    }

    function saveUsedCodes(set) {
      localStorage.setItem(KEYS.USED_CODES, JSON.stringify(Array.from(set)));
    }

    function ensureProfileConsistency() {
      if (!isLoggedIn()) return;
      const savedEmailLower = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').toLowerCase();
      const user = getCurrentUser();
      if (user && String(user.email || '').toLowerCase() !== savedEmailLower) {
        try { localStorage.removeItem(KEYS.CURRENT_USER); } catch {}
      }
    }

    function normalizeAuthState() {
      const logged = isLoggedIn();
      const user = getCurrentUser();
      if (logged && !user) {
        setLoggedIn(false);
      }
      if (!logged && user) {
        try { localStorage.removeItem(KEYS.CURRENT_USER); } catch {}
      }
    }

    function updateAdminLinkVisibility() {
      if (!DOM.adminLink) return;
      const user = getCurrentUser();
      const visible = isLoggedIn() && ((user && !!user.isAdmin) || isFounder());
      DOM.adminLink.style.display = visible ? '' : 'none';
    }

    function isFounder() {
      return (localStorage.getItem(KEYS.SAVED_EMAIL) || '').toLowerCase() === FOUNDER_EMAIL.toLowerCase();
    }

    function updateBanner() {
      const user = getCurrentUser();
      let text = DEFAULT_BANNER_TEXT;
      if (isLoggedIn()) text = user ? `${user.firstName} ${user.lastName} — ${user.code}` : NEED_REGISTER_TEXT;
      if (DOM.authBanner) DOM.authBanner.textContent = text;
      if (DOM.drawerAuthBanner) DOM.drawerAuthBanner.textContent = text;
    }

    function updateAuthUI() {
      const logged = isLoggedIn();
      if (DOM.loginBtn) DOM.loginBtn.textContent = logged ? 'გასვლა' : 'შესვლა';
      if (DOM.drawerLoginBtn) DOM.drawerLoginBtn.textContent = logged ? 'გასვლა' : 'შესვლა';
    }

    function setView(view) {
      activeView = view;
      if (!DOM.modalButtons) return;
      const is = (name) => activeView === name;
      DOM.modalButtons.style.display = is('options') ? 'flex' : 'none';
      if (DOM.registerForm) DOM.registerForm.style.display = is('register') ? 'block' : 'none';
      if (DOM.loginForm) DOM.loginForm.style.display = is('login') ? 'block' : 'none';
      if (DOM.forgotPasswordForm) DOM.forgotPasswordForm.style.display = is('forgot') ? 'block' : 'none';
    }

    function showOptions() { setView('options'); }
    function showLogin() { setView('login'); }
    function showRegister() { setView('register'); }
    function showForgot() { setView('forgot'); }

    function openModal() {
      if (!DOM.loginModal) return;
      DOM.loginModal.classList.add('show');
      DOM.body.style.overflow = 'hidden';
      const savedEmail = localStorage.getItem(KEYS.SAVED_EMAIL);
      const savedPassword = localStorage.getItem(KEYS.SAVED_PASSWORD);
      if (DOM.loginForm) {
        const emailInput = DOM.loginForm.querySelector('input[name="email"]');
        const passwordInput = DOM.loginForm.querySelector('input[name="password"]');
        if (emailInput && savedEmail) emailInput.value = savedEmail;
        if (passwordInput && savedPassword) passwordInput.value = savedPassword;
      }
    }

    function closeModal() {
      if (!DOM.loginModal) return;
      DOM.loginModal.classList.remove('show');
      DOM.body.style.overflow = '';
      DOM.loginForm?.reset?.();
      DOM.registerForm?.reset?.();
      DOM.forgotPasswordForm?.reset?.();
      showOptions();
    }

    function isModalOpen() {
      return DOM.loginModal?.classList.contains('show');
    }

    function handleAuthButtonClick(fromDrawer) {
      normalizeAuthState();
      const logged = isLoggedIn();
      if (!logged) {
        if (fromDrawer) menuModule.close();
        openModal();
        showOptions();
        return;
      }
      performLogout();
      if (fromDrawer) menuModule.close();
    }

    function performLogout() {
      if (!isLoggedIn()) return;
      if (!confirm('ნამდვილად გსურთ გასვლა?')) return;
      setLoggedIn(false);
      try {
        localStorage.removeItem(KEYS.CURRENT_USER);
      } catch {}
      updateAuthUI();
      updateBanner();
      updateAdminLinkVisibility();
      document.dispatchEvent(new CustomEvent('auth:logout'));
      alert('გასვლა შესრულებულია');
      closeModal();
    }

    function generateUniqueCode() {
      const used = getUsedCodes();
      for (let i = 0; i < 10000; i += 1) {
        const code = String(Math.floor(1e9 + Math.random() * 9e9));
        if (!used.has(code)) return code;
      }
      return String(Date.now()).slice(-10);
    }

    function handleLoginSubmit(event) {
      event.preventDefault();
      if (!DOM.loginForm) return;
      const formData = new FormData(DOM.loginForm);
      const email = utils.getTrimmed(formData, 'email');
      const password = utils.getTrimmed(formData, 'password');
      if (!email) return alert('გთხოვთ შეიყვანოთ ელფოსტა');
      if (!utils.isValidEmail(email)) return alert('ელფოსტა არასწორია');
      if (!password) return alert('გთხოვთ შეიყვანოთ პაროლი');
      localStorage.setItem(KEYS.SAVED_EMAIL, email);
      localStorage.setItem(KEYS.SAVED_PASSWORD, password);
      setLoggedIn(true);
      updateAuthUI();
      const user = getCurrentUser();
      const loginEmailLower = email.toLowerCase();
      if (user && String(user.email || '').toLowerCase() !== loginEmailLower) {
        try { localStorage.removeItem(KEYS.CURRENT_USER); } catch {}
      }

      (async () => {
        try {
          const response = await fetch(`${API_BASE}/users/profile?email=${encodeURIComponent(email)}`, {
            headers: {
              'Cache-Control': 'no-cache',
              'x-actor-email': email,
            },
          });
          if (response.ok) {
            const data = await response.json();
            const normalizedUser = {
              id: data.id,
              firstName: data.first_name,
              lastName: data.last_name,
              code: data.code,
              isAdmin: !!data.is_admin,
              email: data.email,
            };
            saveCurrentUser(normalizedUser);
            updateAuthUI();
            updateBanner();
            updateAdminLinkVisibility();
            document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: normalizedUser } }));
            closeModal();
            DOM.loginForm?.reset?.();
            showOptions();
            return;
          }
        } catch {}
        updateBanner();
        updateAdminLinkVisibility();
        alert('ელფოსტა/პაროლი ვერ გადამოწმდა. შეგიძლიათ გამოიყენოთ გვერდი შეზღუდული ფუნქციონალით ან გაიაროთ რეგისტრაცია.');
        // Allow limited login flow even if profile not found
        closeModal();
        DOM.loginForm?.reset?.();
        showOptions();
      })();
    }

    function handleForgotSubmit(event) {
      event.preventDefault();
      if (!DOM.forgotPasswordForm) return;
      const formData = new FormData(DOM.forgotPasswordForm);
      const email = utils.getTrimmed(formData, 'email');
      if (!email) return alert('გთხოვთ შეიყვანოთ ელფოსტა');
      if (!utils.isValidEmail(email)) return alert('ელფოსტა არასწორია');
      alert(`პაროლის აღდგენის ბმული გამოგზავნილია ელფოსტაზე: ${email}`);
      closeModal();
      DOM.forgotPasswordForm?.reset?.();
      showOptions();
    }

    function handleRegisterSubmit(event) {
      event.preventDefault();
      if (!DOM.registerForm) return;
      const formData = new FormData(DOM.registerForm);
      const personalId = utils.getTrimmed(formData, 'personalId');
      const firstName = utils.getTrimmed(formData, 'firstName');
      const lastName = utils.getTrimmed(formData, 'lastName');
      const phone = utils.getTrimmed(formData, 'phone');
      const email = utils.getTrimmed(formData, 'email');
      const password = utils.getTrimmed(formData, 'password');
      const confirmPassword = utils.getTrimmed(formData, 'confirmPassword');
      if (personalId.length !== 11 || !/^[0-9]{11}$/.test(personalId)) return alert('პირადი ნომერი უნდა იყოს 11 ციფრი');
      if (!firstName || !lastName) return alert('გთხოვთ შეიყვანოთ სახელი და გვარი');
      if (!/^[0-9]{9}$/.test(phone)) return alert('ტელეფონი უნდა იყოს 9 ციფრი (მაგ: 599123456)');
      if (!utils.isValidEmail(email)) return alert('ელფოსტა არასწორია');
      if (password.length < 6) return alert('პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო');
      if (password !== confirmPassword) return alert('პაროლები არ ემთხვევა');

      (async () => {
        try {
          const response = await fetch(`${API_BASE}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personal_id: personalId,
              first_name: firstName,
              last_name: lastName,
              phone,
              email,
              password,
            }),
          });
          if (!response.ok) {
            let detail = '';
            try {
              const json = await response.json();
              detail = json?.detail || '';
            } catch {}
            if (response.status === 409) {
              alert(detail || 'ეს მონაცემები სისტემაში უკვე რეგისტრირებულია');
              return;
            }
            alert(detail || 'რეგისტრაცია ვერ შესრულდა');
            return;
          }
          const data = await response.json();
          const normalizedUser = {
            id: data.id,
            firstName: data.first_name || firstName,
            lastName: data.last_name || lastName,
            code: data.code,
            isAdmin: !!data.is_admin,
            email: data.email,
          };
          saveCurrentUser(normalizedUser);
          localStorage.setItem(KEYS.SAVED_EMAIL, email);
          localStorage.setItem(KEYS.SAVED_PASSWORD, password);
          setLoggedIn(true);
          updateAuthUI();
          updateBanner();
          updateAdminLinkVisibility();
          document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: normalizedUser } }));
          alert('რეგისტრაცია მიღებულია!');
          closeModal();
          DOM.registerForm?.reset?.();
          showOptions();
        } catch {
          alert('ქსელური პრობლემა - სცადეთ მოგვიანებით');
        }
      })();
    }

    function init() {
      utils.on(DOM.loginBtn, 'click', () => handleAuthButtonClick(false));
      utils.on(DOM.drawerLoginBtn, 'click', () => handleAuthButtonClick(true));
      utils.on(DOM.modalClose, 'click', closeModal);
      utils.on(DOM.loginModal, 'click', (event) => { if (event.target === DOM.loginModal) closeModal(); });
      utils.on(DOM.loginOption, 'click', showLogin);
      utils.on(DOM.registerOption, 'click', showRegister);
      utils.on(DOM.forgotPasswordLink, 'click', (event) => { event.preventDefault(); showForgot(); });
      utils.on(DOM.loginForm, 'submit', handleLoginSubmit);
      utils.on(DOM.forgotPasswordForm, 'submit', handleForgotSubmit);
      const backToLoginBtn = DOM.forgotPasswordForm?.querySelector('.back-to-login');
      utils.on(backToLoginBtn, 'click', showLogin);
      utils.on(DOM.registerForm, 'submit', handleRegisterSubmit);

      normalizeAuthState();
      updateAuthUI();
      ensureProfileConsistency();
      updateBanner();
      updateAdminLinkVisibility();
    }

    return {
      init,
      openModal,
      closeModal,
      showRegister,
      isModalOpen,
      updateBanner,
      updateAdminLinkVisibility,
      getCurrentUser,
      saveCurrentUser,
      setLoggedIn,
      isLoggedIn,
      generateUniqueCode,
      getUsedCodes,
      saveUsedCodes,
    };
  }

  /* Registry module moved to window.Registry (registry.mini.js) */

  function createExamNavigationModule() {
    function closeNavDropdown() {
      if (!DOM.navDropdown) return;
      DOM.navDropdown.classList.remove('show');
      DOM.navDropdown.setAttribute('aria-hidden', 'true');
      DOM.navExamTrigger?.setAttribute('aria-expanded', 'false');
    }

    function openNavDropdown() {
      if (!DOM.navDropdown) return;
      DOM.navDropdown.classList.add('show');
      DOM.navDropdown.setAttribute('aria-hidden', 'false');
      DOM.navExamTrigger?.setAttribute('aria-expanded', 'true');
      setTimeout(() => document.addEventListener('click', handleDocClickCloseNav), 0);
    }

    function handleDocClickCloseNav(event) {
      if (DOM.navExam && DOM.navExam.contains(event.target)) return;
      closeNavDropdown();
      document.removeEventListener('click', handleDocClickCloseNav);
    }

    function goToExam() {
      closeNavDropdown();
      menuModule.closeDrawerSubmenu();
      if (DOM.body.classList.contains('menu-open')) menuModule.close();
      try {
        if (!authModule.isLoggedIn || !authModule.isLoggedIn()) {
          alert('გთხოვთ გაიაროთ ავტორიზაცია');
          authModule.openModal?.();
          return;
        }
      } catch {}
      window.location.href = 'exam.html';
    }

    function goToReview() {
      closeNavDropdown();
      menuModule.closeDrawerSubmenu();
      alert('პროექტის განხილვა — მალე დაემატება');
    }

    function handleNavTrigger(event) {
      event.preventDefault();
      if (!DOM.navDropdown) return;
      if (DOM.navDropdown.classList.contains('show')) {
        closeNavDropdown();
      } else {
        openNavDropdown();
      }
    }

    function handleKeydown(event) {
      if (event.key !== 'Escape') return;
      closeNavDropdown();
      if (DOM.drawerSubmenu && !DOM.drawerSubmenu.hasAttribute('hidden')) {
        DOM.drawerSubmenu.setAttribute('hidden', '');
        DOM.drawerExamTrigger?.setAttribute('aria-expanded', 'false');
      }
    }

    function init() {
      utils.on(DOM.navExamTrigger, 'click', handleNavTrigger);
      document.addEventListener('keydown', handleKeydown);
      document
        .querySelectorAll('.dropdown-item.theoretical, .drawer-submenu-item.theoretical')
        .forEach((element) => utils.on(element, 'click', goToExam));
      document
        .querySelectorAll('.dropdown-item.review, .drawer-submenu-item.review')
        .forEach((element) => utils.on(element, 'click', goToReview));
    }

    return { init };
  }

  function createFooterFormModule(deps = {}) {
    const { statementsModule } = deps;
    let messageField = null;

    function ensureAuth(event) {
      if (authModule.isLoggedIn()) return;
      if (event?.cancelable) event.preventDefault();
      alert('გთხოვთ გაიაროთ ავტორიზაცია');
      messageField?.blur?.();
    }

    async function handleSubmit(event) {
      event.preventDefault();
      if (!DOM.footerForm) return;
      if (!authModule.isLoggedIn()) {
        alert('გთხოვთ გაიაროთ ავტორიზაცია');
        return;
      }
      const formData = new FormData(DOM.footerForm);
      const message = utils.getTrimmed(formData, 'message');
      if (!message) return alert('გთხოვთ შეიყვანოთ შეტყობინება');
      const actorEmail = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim();
      if (!actorEmail) {
        alert('ავტორიზაცია ვერ დადასტურდა');
        return;
      }
      const submitBtn = DOM.footerForm.querySelector('button[type="submit"]');
      submitBtn?.setAttribute('disabled', 'true');
      try {
        const response = await fetch(`${API_BASE}/statements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-email': actorEmail,
          },
          body: JSON.stringify({ message }),
          credentials: 'include',
        });
        if (!response.ok) {
          let detail = '';
          try {
            const json = await response.clone().json();
            detail = json?.detail || '';
          } catch {
            try {
              detail = (await response.clone().text()).trim();
            } catch {}
          }
          throw new Error(detail || 'გაგზავნა ვერ შესრულდა');
        }
        const data = await response.json();
        alert('თქვენი განცხადება მიღებულია!');
        DOM.footerForm.reset();
        statementsModule?.handleNewStatement?.(data);
      } catch (error) {
        console.error('Failed to submit statement', error);
        alert(error.message || 'გაგზავნა ვერ შესრულდა');
      } finally {
        submitBtn?.removeAttribute('disabled');
      }
    }

    function init() {
      if (!DOM.footerForm) return;
      messageField = DOM.footerForm.querySelector('textarea[name="message"]');
      utils.on(DOM.footerForm, 'submit', handleSubmit);
      utils.on(messageField, 'mousedown', ensureAuth);
      utils.on(messageField, 'focus', ensureAuth);
    }

    return { init };
  }
});

