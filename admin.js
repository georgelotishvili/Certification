document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const burger = document.querySelector('.burger');
  const overlay = document.querySelector('.overlay');
  const drawerClose = document.querySelector('.drawer-close');
  const drawerLinks = document.querySelectorAll('.drawer-nav a');
  const loginBtn = document.querySelector('.login-btn');
  const drawerLoginBtn = document.querySelector('.drawer-login');
  
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
    if (e.key === 'Escape') closeMenu();
  });

  // "მთავარი გვერდი" ღილაკები
  on(loginBtn, 'click', () => {
    window.location.href = 'index.html';
  });

  on(drawerLoginBtn, 'click', () => {
    window.location.href = 'index.html';
  });
});
