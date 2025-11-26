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

  // Page cover crossfade (0.3s)
  function mountPageCover(opaque) {
    try {
      let el = document.getElementById('pageCover');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pageCover';
        el.className = 'page-cover';
        document.documentElement.appendChild(el);
      } else {
        el.classList.add('page-cover');
      }
      el.style.opacity = opaque ? '1' : '0';
      return el;
    } catch { return null; }
  }

  function setupPageCoverOnLoad() {
    try {
      if (sessionStorage.getItem('pageCover') === '1') {
        const el = mountPageCover(true);
        requestAnimationFrame(() => {
          if (!el) return;
          el.style.transition = 'opacity 0.3s ease';
          el.style.opacity = '0';
          setTimeout(() => { try { el.remove(); } catch {}; sessionStorage.removeItem('pageCover'); }, 300);
        });
      }
    } catch {}
  }

  function transitionTo(url) {
    try {
      const el = mountPageCover(false);
      if (!el) { window.location.href = url; return; }
      void el.offsetWidth; // reflow to ensure transition applies
      el.style.transition = 'opacity 0.3s ease';
      el.style.opacity = '1';
      sessionStorage.setItem('pageCover', '1');
      setTimeout(() => { window.location.href = url; }, 300);
    } catch {
      window.location.href = url;
    }
  }

  // Initialize cover fade on page load if requested
  setupPageCoverOnLoad();

  // Site Info Modal helpers (About / Terms)
  function getSiteInfoElements() {
    try {
      const modal = document.getElementById('siteInfoModal');
      if (!modal) return null;
      return {
        modal,
        title: modal.querySelector('#siteInfoTitle'),
        body: modal.querySelector('#siteInfoBody'),
        closeBtn: modal.querySelector('.modal-close'),
      };
    } catch {
      return null;
    }
  }

  function getSiteInfoPath(type) {
    switch (type) {
      case 'about':
      case 'terms':
      case 'process':
      case 'contract':
        return `../partials/site-info/${type}.html`;
      default:
        return `../partials/site-info/about.html`;
    }
  }

  async function openSiteInfo(type) {
    try {
      const els = getSiteInfoElements();
      if (!els) return;
      const titles = {
        about: 'ჩვენს შესახებ',
        terms: 'წესები და პირობები',
        process: 'საგამოცდო პროცესი',
        contract: 'ხელშეკრულების შაბლონი'
      };
      if (els.title) els.title.textContent = titles[type] || 'ინფორმაცია';

      if (els.body) els.body.innerHTML = '<p style="opacity:.7">იტვირთება...</p>';
      els.modal.classList.add('show');
      els.modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      if (els.closeBtn && typeof els.closeBtn.focus === 'function') {
        setTimeout(() => { try { els.closeBtn.focus(); } catch {} }, 0);
      }

      const res = await fetch(getSiteInfoPath(type), { cache: 'no-cache' });
      if (!res.ok) throw new Error('load failed');
      const html = await res.text();
      if (els.body) els.body.innerHTML = html;
    } catch {
      const els = getSiteInfoElements();
      if (els?.body) els.body.innerHTML = '<p style="color:#b91c1c">ვერ ჩაიტვირთა შიგთავსი. სცადეთ მოგვიანებით.</p>';
    }
  }

  function closeSiteInfo() {
    try {
      const els = getSiteInfoElements();
      if (!els) return;
      els.modal.classList.remove('show');
      els.modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      if (els.body) els.body.innerHTML = '';
    } catch {}
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
      drawerAboutTrigger: document.querySelector('.drawer-about-trigger'),
      drawerAboutSubmenu: document.querySelector('.drawer-about-submenu'),
      loginBtn: document.querySelector('.login-btn'),
      drawerLoginBtn: document.querySelector('.drawer-login'),
      navLogo: document.querySelector('.nav-bar .logo'),
      navExamTrigger: document.querySelector('.nav .exam-trigger'),
      navDropdown: document.querySelector('.nav .nav-exam .dropdown'),
      aboutTrigger: document.querySelector('.nav .about-trigger'),
      aboutDropdown: document.querySelector('.nav .about-dropdown'),
    };

    function setMenu(open) {
      DOM.body?.classList.toggle('menu-open', !!open);
      if (DOM.burger) DOM.burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) {
        closeDrawerSubmenu();
        closeDrawerAboutSubmenu();
      }
    }
    function openMenu() { setMenu(true); }
    function closeMenu() { setMenu(false); }
    function toggleMenu() { setMenu(!DOM.body?.classList.contains('menu-open')); }

    function closeDrawerSubmenu() {
      if (!DOM.drawerSubmenu) return;
      DOM.drawerSubmenu.setAttribute('hidden', '');
      DOM.drawerExamTrigger?.setAttribute('aria-expanded', 'false');
    }
    function closeDrawerAboutSubmenu() {
      if (!DOM.drawerAboutSubmenu) return;
      DOM.drawerAboutSubmenu.setAttribute('hidden', '');
      DOM.drawerAboutTrigger?.setAttribute('aria-expanded', 'false');
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
    function toggleDrawerAboutSubmenu(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!DOM.drawerAboutSubmenu) return;
      const hidden = DOM.drawerAboutSubmenu.hasAttribute('hidden');
      if (hidden) {
        DOM.drawerAboutSubmenu.removeAttribute('hidden');
        DOM.drawerAboutTrigger?.setAttribute('aria-expanded', 'true');
      } else {
        closeDrawerAboutSubmenu();
      }
    }

    // Basic bindings for header UI
    on(DOM.burger, 'click', toggleMenu);
    on(DOM.overlay, 'click', closeMenu);
    on(DOM.drawerClose, 'click', closeMenu);
    DOM.drawerLinks.forEach((link) => on(link, 'click', closeMenu));
    on(DOM.drawerExamTrigger, 'click', toggleDrawerSubmenu);
    on(DOM.drawerAboutTrigger, 'click', toggleDrawerAboutSubmenu);

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
    function closeAboutDropdown() {
      if (!DOM.aboutDropdown) return;
      DOM.aboutDropdown.classList.remove('show');
      DOM.aboutDropdown.setAttribute('aria-hidden', 'true');
      DOM.aboutTrigger?.setAttribute('aria-expanded', 'false');
    }
    function openNavDropdown() {
      if (!DOM.navDropdown) return;
      DOM.navDropdown.classList.add('show');
      DOM.navDropdown.setAttribute('aria-hidden', 'false');
      DOM.navExamTrigger?.setAttribute('aria-expanded', 'true');
      setTimeout(() => document.addEventListener('click', handleDocClickCloseNav), 0);
    }
    function openAboutDropdown() {
      if (!DOM.aboutDropdown) return;
      DOM.aboutDropdown.classList.add('show');
      DOM.aboutDropdown.setAttribute('aria-hidden', 'false');
      DOM.aboutTrigger?.setAttribute('aria-expanded', 'true');
      setTimeout(() => document.addEventListener('click', handleDocClickCloseAbout), 0);
    }
    function handleDocClickCloseNav(event) {
      if (event.target && closest(event.target, '.nav-exam')) return;
      closeNavDropdown();
      document.removeEventListener('click', handleDocClickCloseNav);
    }
    function handleDocClickCloseAbout(event) {
      if (event.target && closest(event.target, '.nav-about')) return;
      closeAboutDropdown();
      document.removeEventListener('click', handleDocClickCloseAbout);
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

    function handleAboutTrigger(event) {
      event.preventDefault();
      if (!DOM.aboutDropdown) return;
      if (DOM.aboutDropdown.classList.contains('show')) {
        closeAboutDropdown();
      } else {
        openAboutDropdown();
      }
    }
    on(DOM.aboutTrigger, 'click', handleAboutTrigger);

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
      // About / Terms open in modal (desktop + mobile)
      if (closest(el, '.dropdown-item.about-us, .drawer-submenu-item.about-us')) {
        event.preventDefault();
        closeAboutDropdown();
        closeDrawerAboutSubmenu();
        if (DOM.body.classList.contains('menu-open')) closeMenu();
        openSiteInfo('about');
        return;
      }
      if (closest(el, '.dropdown-item.terms, .drawer-submenu-item.terms')) {
        event.preventDefault();
        closeAboutDropdown();
        closeDrawerAboutSubmenu();
        if (DOM.body.classList.contains('menu-open')) closeMenu();
        openSiteInfo('terms');
        return;
      }
      if (closest(el, '.dropdown-item.process, .drawer-submenu-item.process')) {
        event.preventDefault();
        closeAboutDropdown();
        closeDrawerAboutSubmenu();
        if (DOM.body.classList.contains('menu-open')) closeMenu();
        openSiteInfo('process');
        return;
      }
      if (closest(el, '.dropdown-item.contract, .drawer-submenu-item.contract')) {
        event.preventDefault();
        closeAboutDropdown();
        closeDrawerAboutSubmenu();
        if (DOM.body.classList.contains('menu-open')) closeMenu();
        openSiteInfo('contract');
        return;
      }
      // About panel items (desktop + mobile)
      if (closest(el, '.about-dropdown .dropdown-item, .drawer-about-submenu .drawer-submenu-item')) {
        event.preventDefault();
        closeAboutDropdown();
        closeDrawerAboutSubmenu();
        return;
      }
    }, { capture: true });

    // Close menu with Escape
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (DOM.body?.classList.contains('menu-open')) closeMenu();
      closeNavDropdown();
      closeAboutDropdown();
      closeDrawerSubmenu();
      closeDrawerAboutSubmenu();
      closeSiteInfo();
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
          if (window.location.hash !== '#statements') {
            window.location.hash = 'statements';
          } else {
            try {
              window.dispatchEvent(new CustomEvent('openStatements'));
            } catch {}
          }
        } else {
          transitionTo('my.html#statements');
        }
        return;
      }

      // Profile/main navigation with fade
      const profile = closest(el, '.nav-profile[data-page-link], .drawer-profile[data-page-link]');
      if (profile) {
        const href = (profile.getAttribute('href') || '').trim();
        const fromDrawer = !!closest(el, '.drawer');
        const targetIsMy = href.includes('my.html');
        const targetIsIndex = href.includes('index.html');

        if (targetIsMy && !isLoggedIn()) {
          event.preventDefault();
          if (fromDrawer) closeMenu();
          alert('გთხოვთ გაიაროთ ავტორიზაცია');
          openAuthModal();
          return;
        }

        if (targetIsMy || targetIsIndex) {
          event.preventDefault();
          if (fromDrawer) closeMenu();
          transitionTo(href || (isMyPage() ? 'index.html' : 'my.html'));
          return;
        }
      }
    }, { capture: true });

    // Site Info Modal close bindings
    try {
      const els = getSiteInfoElements();
      if (els?.closeBtn) on(els.closeBtn, 'click', closeSiteInfo);
      if (els?.modal) {
        on(els.modal, 'click', (e) => {
          if (e && e.target === els.modal) closeSiteInfo();
        });
      }
    } catch {}
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


