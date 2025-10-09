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

  // Exam settings logic
  const examSection = document.getElementById('exam-settings');
  const durationInput = document.getElementById('examDuration');
  const saveBtn = document.getElementById('saveExamDuration');
  const flash = document.getElementById('durationFlash');
  const EXAM_DURATION_KEY = 'examDuration';

  const navLinks = document.querySelectorAll('.nav a, .drawer-nav a');
  navLinks.forEach(link => {
    on(link, 'click', (e) => {
      const text = (link.textContent || '').trim();
      if (text === 'გამოცდა') {
        e.preventDefault();
        if (examSection) examSection.style.display = 'block';
      }
    });
  });

  // Load saved exam duration
  try {
    const saved = localStorage.getItem(EXAM_DURATION_KEY);
    if (saved && durationInput) durationInput.value = saved;
  } catch {}

  // Save duration
  on(saveBtn, 'click', () => {
    const value = Number(durationInput?.value || 0);
    if (!value || value < 1) {
      alert('გთხოვთ შეიყვანოთ სწორი დრო (მინიმუმ 1 წუთი)');
      return;
    }
    try { localStorage.setItem(EXAM_DURATION_KEY, String(value)); } catch {}
    if (flash) {
      flash.textContent = `ხანგრძლივობა შეიცვალა: ${value} წუთი`;
      flash.style.display = 'block';
      setTimeout(() => { if (flash) flash.style.display = 'none'; }, 3000);
    }
  });
});
