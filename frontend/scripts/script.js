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
    headerVideo: document.querySelector('.header-video'),
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
  const registryModule = createRegistryModule();
  const examNavigationModule = createExamNavigationModule();
  const footerFormModule = createFooterFormModule();

  layoutModule.init();
  menuModule.init();
  fullscreenModule.init();
  authModule.init();
  examNavigationModule.init();
  registryModule.init();
  footerFormModule.init();
  setupContactScroll();
  setupHeaderVideoLoopCrossfade();
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

  function setupHeaderVideoLoopCrossfade() {
    const videos = Array.from(document.querySelectorAll('.header-video'));
    if (!videos.length) return;

    const rate = (() => {
      const raw = parseFloat(videos[0].dataset.speed || '0.6');
      return Number.isFinite(raw) ? Math.max(0.1, Math.min(raw, 4)) : 0.6;
    })();

    // Expect two layers; support one as fallback
    let a = videos[0] || null;
    let b = videos[1] || null;
    const CROSSFADE = 1.2;  // seconds
    const SAFETY = 0.15;

    videos.forEach(v => {
      v.muted = true;
      v.loop = false;
      try { v.playbackRate = rate; } catch {}
      v.classList.remove('is-visible');
    });

    function show(v){ v.classList.add('is-visible'); }
    function hide(v){ v.classList.remove('is-visible'); }

    function watchActive() {
      if (!a) return;
      const onTimeUpdate = () => {
        const d = a.duration;
        if (!Number.isFinite(d) || d <= 0) return;
        const remaining = d - a.currentTime;
        if (remaining <= (CROSSFADE + SAFETY)) {
          a.removeEventListener('timeupdate', onTimeUpdate);
          if (b) {
            try { b.currentTime = 0; } catch {}
            b.play().catch(() => {});
            show(b);
            setTimeout(() => {
              hide(a);
              try { a.pause(); } catch {}
              const tmp = a; a = b; b = tmp;
              watchActive();
            }, CROSSFADE * 1000);
          } else {
            a.loop = true;
          }
        }
      };
      a.addEventListener('timeupdate', onTimeUpdate);
    }

    function start() {
      if (a) {
        try { a.currentTime = 0; } catch {}
        a.play().catch(() => {});
        show(a);
        if (b) {
          try { b.pause(); b.currentTime = 0; } catch {}
          hide(b);
        }
        watchActive();
      }
    }

    let pending = videos.length;
    videos.forEach(v => v.addEventListener('loadedmetadata', () => {
      try { v.playbackRate = rate; } catch {}
      if (--pending <= 0) start();
    }));
    setTimeout(() => { if (pending > 0) start(); }, 1500);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      // Re-apply playbackRate upon returning
      videos.forEach(v => { try { v.playbackRate = rate; } catch {} });
    });
  }

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
      if (!DOM.header) return;
      DOM.body.style.paddingTop = `${DOM.header.offsetHeight || 0}px`;
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

  function createRegistryModule() {
    const DEFAULT_PHOTO = 'https://placehold.co/96x96?text=CP';
    const PROFILE_PAGE_BASE = 'my.html?userId=';
    const collator = new Intl.Collator('ka', { sensitivity: 'base', ignorePunctuation: true, usage: 'sort' });

    const state = {
      open: false,
      loading: false,
      loaded: false,
      items: [],
      error: null,
      filtered: [],
    };

    function init() {
      if (!DOM.registryOverlay) return;
      (DOM.registryTriggers || []).forEach((trigger) => {
        utils.on(trigger, 'click', (event) => {
          event.preventDefault();
          openModal();
          if (trigger.classList.contains('drawer-registry')) {
            menuModule.close();
          }
        });
      });
      utils.on(DOM.registryClose, 'click', (event) => {
        event.preventDefault();
        closeModal();
      });
      utils.on(DOM.registryOverlay, 'click', (event) => {
        if (event.target === DOM.registryOverlay) {
          closeModal();
        }
      });
      utils.on(DOM.registrySearch, 'input', applyFilters);
      utils.on(DOM.registryFilterArchitect, 'change', applyFilters);
      utils.on(DOM.registryFilterExpert, 'change', applyFilters);
      utils.on(DOM.registrySort, 'change', applyFilters);
    }

    function openModal() {
      if (!DOM.registryOverlay) return;
      if (state.open) return;
      setOpen(true);
      ensureData();
    }

    function closeModal() {
      if (!DOM.registryOverlay) return;
      if (!state.open) return;
      setOpen(false);
    }

    function setOpen(value) {
      state.open = !!value;
      DOM.registryOverlay.classList.toggle('is-open', state.open);
      DOM.registryOverlay.setAttribute('aria-hidden', state.open ? 'false' : 'true');
      DOM.body?.classList.toggle('registry-open', state.open);
    }

    async function ensureData(force = false) {
      if (!DOM.registryList) return;
      if (state.loading) return;
      if (state.loaded && !force) {
        applyFilters();
        return;
      }
      state.loading = true;
      state.error = null;
      renderLoading();
      try {
        const params = new URLSearchParams({ limit: '500' });
        const response = await fetch(`${API_BASE}/certified-persons/registry?${params.toString()}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) {
          throw new Error('registry failed');
        }
        const data = await response.json();
        state.items = Array.isArray(data) ? data.map(normalizePerson) : [];
        state.loaded = true;
        applyFilters();
      } catch (error) {
        console.error('Failed to load registry', error);
        state.error = 'რეესტრი ვერ ჩაიტვირთა';
        renderError(state.error);
      } finally {
        state.loading = false;
      }
    }

    function normalizePerson(person) {
      return {
        id: person?.id,
        full_name: (person?.full_name || '').trim(),
        photo_url: (person?.photo_url || '').trim() || DEFAULT_PHOTO,
        unique_code: (person?.unique_code || '').trim(),
        qualification: (person?.qualification || '').trim().toLowerCase(),
        certificate_status: (person?.certificate_status || '').trim().toLowerCase(),
        rating: toNumber(person?.rating),
        exam_score: toNumber(person?.exam_score),
        registration_date: person?.registration_date || person?.created_at || null,
      };
    }

    function toNumber(value) {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    }

    function applyFilters() {
      if (!DOM.registryList) return;
      if (!state.loaded) {
        if (!state.loading && !state.items.length) {
          renderEmpty();
        }
        return;
      }
      let next = state.items.slice();
      const query = normalizeText(DOM.registrySearch?.value);
      if (query) {
        next = next.filter((person) => matchesQuery(person, query));
      }
      const architectChecked = !!DOM.registryFilterArchitect?.checked;
      const expertChecked = !!DOM.registryFilterExpert?.checked;
      if ((architectChecked && !expertChecked) || (!architectChecked && expertChecked)) {
        const target = architectChecked ? 'architect' : 'expert';
        next = next.filter((person) => person.qualification === target);
      }
      const sortKey = DOM.registrySort?.value || 'date_desc';
      next.sort(getSorter(sortKey));
      state.filtered = next;
      renderList(next);
    }

    function getSorter(key) {
      const map = {
        name_asc: (a, b) => collator.compare(a.full_name || '', b.full_name || ''),
        name_desc: (a, b) => collator.compare(b.full_name || '', a.full_name || ''),
        date_asc: (a, b) => getDateValue(a.registration_date) - getDateValue(b.registration_date),
        date_desc: (a, b) => getDateValue(b.registration_date) - getDateValue(a.registration_date),
        score_asc: (a, b) => (a.exam_score ?? -Infinity) - (b.exam_score ?? -Infinity),
        score_desc: (a, b) => (b.exam_score ?? -Infinity) - (a.exam_score ?? -Infinity),
      };
      return map[key] || map.date_desc;
    }

    function getDateValue(value) {
      const date = parseUtcDate(value);
      return date ? date.getTime() : 0;
    }

    function matchesQuery(person, query) {
      if (!query) return true;
      const fullName = normalizeText(person.full_name);
      const code = normalizeText(person.unique_code);
      const split = splitName(person.full_name);
      const tokens = [
        fullName,
        code,
        normalizeText(split.first),
        normalizeText(split.last),
      ];
      return tokens.some((token) => token && token.includes(query));
    }

    function splitName(value) {
      const parts = (value || '').split(/\s+/).filter(Boolean);
      return {
        first: parts[0] || '',
        last: parts.slice(1).join(' ') || '',
      };
    }

    function normalizeText(value) {
      if (value == null) return '';
      return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function renderLoading() {
      if (!DOM.registryList) return;
      DOM.registryList.innerHTML = '<div class="registry-empty">იტვირთება...</div>';
    }

    function renderEmpty() {
      if (!DOM.registryList) return;
      DOM.registryList.innerHTML = '<div class="registry-empty">ჩანაწერები ვერ მოიძებნა</div>';
    }

    function renderError(message) {
      if (!DOM.registryList) return;
      DOM.registryList.innerHTML = `
        <div class="registry-empty">
          <div>${escapeHtml(message)}</div>
          <button type="button" class="registry-retry">კიდევ სცადე</button>
        </div>
      `;
      const retryBtn = DOM.registryList.querySelector('.registry-retry');
      utils.on(retryBtn, 'click', (event) => {
        event.preventDefault();
        ensureData(true);
      });
    }

    function renderList(items) {
      if (!DOM.registryList) return;
      if (!items.length) {
        renderEmpty();
        return;
      }
      const fragment = document.createDocumentFragment();
      items.forEach((person) => {
        fragment.appendChild(createCard(person));
      });
      DOM.registryList.innerHTML = '';
      DOM.registryList.appendChild(fragment);
    }

    function createCard(person) {
      const card = document.createElement('article');
      card.className = 'registry-card';
      card.dataset.qualification = person.qualification || '';
      card.dataset.status = person.certificate_status || '';
      card.setAttribute('role', 'listitem');
      card.innerHTML = `
        <div class="registry-avatar">
          <img src="${escapeHtml(person.photo_url)}" alt="${escapeHtml(person.full_name || 'სერტიფიცირებული პირი')}" />
        </div>
        <div class="registry-info">
          <div class="registry-name">${escapeHtml(person.full_name || '—')}</div>
          <div class="registry-meta">
            <span class="registry-rating" aria-label="რეიტინგი">⭐ ${formatRating(person.rating)}</span>
            <span class="registry-score" aria-label="გამოცდის ქულა">${formatExamScore(person.exam_score)}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => handleCardClick(person));
      return card;
    }

    function formatRating(value) {
      if (value == null) return '0.0';
      const num = Number(value);
      if (!Number.isFinite(num)) return '0.0';
      return num.toFixed(1);
    }

    function formatExamScore(value) {
      if (value == null) return '0%';
      const num = Number(value);
      if (!Number.isFinite(num)) return '0%';
      return `${Math.round(num)}%`;
    }

    function handleCardClick(person) {
      const url = buildProfileUrl(person);
      if (url) {
        window.location.href = url;
      }
    }

    function buildProfileUrl(person) {
      const id = person?.id;
      if (!id) return 'my.html';
      // Open personal profile view for the selected certified person
      return `my.html?userId=${encodeURIComponent(id)}`;
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function isOpen() {
      return state.open;
    }

    return {
      init,
      open: openModal,
      close: closeModal,
      isOpen,
      refresh: ensureData,
    };
  }

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

