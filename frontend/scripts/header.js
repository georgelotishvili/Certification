(function () {
  'use strict';

  // Signal that header-specific bindings are handled here
  window.HEADER_JS_ACTIVE = true;

  function on(el, type, handler) {
    if (!el || !type || !handler) return;
    try { el.addEventListener(type, handler, false); } catch {}
  }
  function closest(target, selector) {
    try { return target && typeof target.closest === 'function' ? target.closest(selector) : null; } catch { return null; }
  }
  function isMyPage() {
    try { return window.location.pathname.includes('my.html'); } catch { return false; }
  }
  function isLoggedIn() {
    try { return window.Auth?.isLoggedIn?.() === true; } catch { return false; }
  }
  function openAuthModal() {
    try { return window.Auth?.openModal?.(); } catch {}
  }

  function bindHeader() {
    const DOM = {
      body: document.body,
      burger: document.querySelector('.burger'),
      overlay: document.querySelector('.overlay'),
      drawer: document.querySelector('.drawer'),
      drawerClose: document.querySelector('.drawer-close'),
      drawerLinks: Array.from(document.querySelectorAll('.drawer-nav a')).filter((a) => !a.classList.contains('drawer-exam-trigger')),
      drawerExamTrigger: document.querySelector('.drawer-exam-trigger'),
      drawerSubmenu: document.querySelector('.drawer-submenu'),
      loginBtn: document.querySelector('.login-btn'),
      drawerLoginBtn: document.querySelector('.drawer-login'),
      navLogo: document.querySelector('.nav-bar .logo'),
      navExamTrigger: document.querySelector('.nav .exam-trigger'),
      navDropdown: document.querySelector('.nav .dropdown'),
    };

    function setMenu(open) {
      DOM.body?.classList.toggle('menu-open', !!open);
      if (DOM.burger) DOM.burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) closeDrawerSubmenu();
    }
    function openMenu() { setMenu(true); }
    function closeMenu() { setMenu(false); }
    function toggleMenu() { setMenu(!DOM.body?.classList.contains('menu-open')); }

    function closeDrawerSubmenu() {
      if (!DOM.drawerSubmenu) return;
      DOM.drawerSubmenu.setAttribute('hidden', '');
      DOM.drawerExamTrigger?.setAttribute('aria-expanded', 'false');
    }

    function toggleDrawerSubmenu(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!isLoggedIn()) {
        alert('გთხოვთ გაიაროთ ავტორიზაცია');
        openAuthModal();
        return;
      }
      if (!DOM.drawerSubmenu) return;
      const hidden = DOM.drawerSubmenu.hasAttribute('hidden');
      if (hidden) {
        DOM.drawerSubmenu.removeAttribute('hidden');
        DOM.drawerExamTrigger?.setAttribute('aria-expanded', 'true');
      } else {
        closeDrawerSubmenu();
      }
    }

    // Basic bindings for header UI
    on(DOM.burger, 'click', toggleMenu);
    on(DOM.overlay, 'click', closeMenu);
    on(DOM.drawerClose, 'click', closeMenu);
    DOM.drawerLinks.forEach((link) => on(link, 'click', closeMenu));
    on(DOM.drawerExamTrigger, 'click', toggleDrawerSubmenu);

    on(DOM.loginBtn, 'click', () => openAuthModal());
    on(DOM.drawerLoginBtn, 'click', () => { closeMenu(); openAuthModal(); });
    on(DOM.navLogo, 'click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Exam dropdown (desktop)
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
      if (event.target && closest(event.target, '.nav-exam')) return;
      closeNavDropdown();
      document.removeEventListener('click', handleDocClickCloseNav);
    }
    function goToExam() {
      closeNavDropdown();
      closeDrawerSubmenu();
      if (DOM.body.classList.contains('menu-open')) closeMenu();
      if (!isLoggedIn()) {
        alert('გთხოვთ გაიაროთ ავტორიზაცია');
        openAuthModal();
        return;
      }
      window.location.href = 'exam.html';
    }
    function goToReview() {
      closeNavDropdown();
      closeDrawerSubmenu();
      alert('პროექტის განხილვა — მალე დაემატება');
    }
    function handleNavTrigger(event) {
      event.preventDefault();
      if (!isLoggedIn()) {
        alert('გთხოვთ გაიაროთ ავტორიზაცია');
        openAuthModal();
        return;
      }
      if (!DOM.navDropdown) return;
      if (DOM.navDropdown.classList.contains('show')) {
        closeNavDropdown();
      } else {
        openNavDropdown();
      }
    }
    on(DOM.navExamTrigger, 'click', handleNavTrigger);

    // Delegated for dropdown items (desktop) and drawer submenu (mobile)
    document.addEventListener('click', (event) => {
      const el = event.target;
      if (!el) return;
      if (closest(el, '.dropdown-item.theoretical, .drawer-submenu-item.theoretical')) {
        event.preventDefault();
        goToExam();
        return;
      }
      if (closest(el, '.dropdown-item.review, .drawer-submenu-item.review')) {
        event.preventDefault();
        goToReview();
      }
    }, { capture: true });

    // Close menu with Escape
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (DOM.body?.classList.contains('menu-open')) closeMenu();
      closeNavDropdown();
      closeDrawerSubmenu();
    });

    // Delegated gating for statements and profile
    document.addEventListener('click', (event) => {
      const el = event.target;
      if (!el) return;

      // Statements (both pages)
      const statements = closest(el, '.nav-statements, .drawer-statements');
      if (statements) {
        event.preventDefault();
        const fromDrawer = !!closest(el, '.drawer');
        if (!isLoggedIn()) {
          if (fromDrawer) closeMenu();
          alert('გთხოვთ გაიაროთ ავტორიზაცია');
          openAuthModal();
          return;
        }
        if (fromDrawer) closeMenu();
        if (isMyPage()) {
          if (window.location.hash !== '#statements') window.location.hash = 'statements';
        } else {
          window.location.href = 'my.html#statements';
        }
        return;
      }

      // Profile gating only on main page
      const profile = closest(el, '.nav-profile[data-page-link], .drawer-profile[data-page-link]');
      if (profile) {
        if (isMyPage()) return; // allow native navigation on my.html
        if (!isLoggedIn()) {
          event.preventDefault();
          const fromDrawer = !!closest(el, '.drawer');
          if (fromDrawer) closeMenu();
          alert('გთხოვთ გაიაროთ ავტორიზაცია');
          openAuthModal();
          return;
        }
        const fromDrawer = !!closest(el, '.drawer');
        if (fromDrawer) closeMenu();
      }
    }, { capture: true });
  }

  async function loadHeader() {
    try {
      const response = await fetch('../partials/header.html');
      if (!response.ok) return;
      const html = await response.text();
      document.body.insertAdjacentHTML('afterbegin', html);

      // Adjust profile link text/target based on page
      const profilePage = isMyPage();
      const navProfile = document.querySelector('.nav-profile[data-page-link]');
      const drawerProfile = document.querySelector('.drawer-profile[data-page-link]');
      if (profilePage) {
        if (navProfile) { navProfile.textContent = 'მთავარი გვერდი'; navProfile.href = 'index.html'; }
        if (drawerProfile) { drawerProfile.textContent = 'მთავარი გვერდი'; drawerProfile.href = 'index.html'; }
      } else {
        if (navProfile) navProfile.href = 'my.html';
        if (drawerProfile) drawerProfile.href = 'my.html';
      }

      // Back-compat: notify others header is ready
      document.dispatchEvent(new CustomEvent('headerReady', { detail: { isProfilePage: profilePage } }));

      // Bind behaviors
      bindHeader();
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHeader);
  } else {
    loadHeader();
  }
})();


