(function() {
  'use strict';

  // Detect if we're on the profile page
  const isProfilePage = window.location.pathname.includes('my.html');
  const KEYS = {
    AUTH: 'authLoggedIn',
    CURRENT_USER: 'currentUser',
    SAVED_EMAIL: 'savedEmail',
    SAVED_PASSWORD: 'savedPassword',
  };

  function setLoggedIn(value) {
    try { localStorage.setItem(KEYS.AUTH, value ? 'true' : 'false'); } catch {}
  }
  function isLoggedIn() {
    try { return localStorage.getItem(KEYS.AUTH) === 'true'; } catch { return false; }
  }

  function handleLogout(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    try {
      if (!confirm('ნამდვილად გსურთ გასვლა?')) return;
      setLoggedIn(false);
      localStorage.removeItem(KEYS.CURRENT_USER);
      document.dispatchEvent(new CustomEvent('auth:logout'));
    } catch {}
    window.location.href = 'index.html';
  }

  async function loadHeader() {
    try {
      // Load header HTML
      const response = await fetch('../partials/header.html');
      if (!response.ok) {
        console.error('Failed to load header:', response.status);
        return;
      }
      
      const html = await response.text();
      
      // Insert header at the beginning of body
      document.body.insertAdjacentHTML('afterbegin', html);

      // Customize based on page type
      if (isProfilePage) {
        // Profile page: change last link to "მთავარი გვერდი"
        const navProfile = document.querySelector('.nav-profile[data-page-link]');
        const drawerProfile = document.querySelector('.drawer-profile[data-page-link]');
        
        if (navProfile) {
          navProfile.textContent = 'მთავარი გვერდი';
          navProfile.href = 'index.html';
          navProfile.classList.add('nav-home', 'home-btn');
        }
        if (drawerProfile) {
          drawerProfile.textContent = 'მთავარი გვერდი';
          drawerProfile.href = 'index.html';
          drawerProfile.classList.add('drawer-home');
        }
        // Keep login modal and let auth module wire buttons
      } else {
        // Main page: keep default "ჩემი გვერდი"
        const navProfile = document.querySelector('.nav-profile[data-page-link]');
        const drawerProfile = document.querySelector('.drawer-profile[data-page-link]');
        
        if (navProfile) {
          navProfile.href = 'my.html';
        }
        if (drawerProfile) {
          drawerProfile.href = 'my.html';
        }
      }

      // Dispatch event so other scripts know header is ready
      document.dispatchEvent(new CustomEvent('headerReady', {
        detail: { isProfilePage }
      }));

    } catch (error) {
      console.error('Header loading error:', error);
    }
  }

  // Load header as soon as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHeader);
  } else {
    loadHeader();
  }
})();

