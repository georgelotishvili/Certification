document.addEventListener('DOMContentLoaded', () => {
  const rootEl = document.documentElement;
  const gateOverlay = document.getElementById('examGateOverlay');
  const gateForm = document.getElementById('examGateForm');
  const gateInput = document.getElementById('examPassword');
  const gateError = document.getElementById('examGateError');
  const gateClose = document.getElementById('examGateClose');
  const devBypass = document.getElementById('devBypass');
  const codeOverlay = document.getElementById('examCodeOverlay');
  const codeForm = document.getElementById('examCodeForm');
  const codeInput = document.getElementById('examCodeInput');
  const codeError = document.getElementById('examCodeError');
  const devBypassCode = document.getElementById('devBypassCode');
  const codeGateClose = document.getElementById('codeGateClose');
  const examStart = document.getElementById('examStart');
  const examFinish = document.getElementById('examFinish');
  const examConfirm = document.getElementById('examConfirm');
  const examFinal = document.getElementById('examFinal');
  const confirmLeaveYes = document.getElementById('confirmLeaveYes');
  const confirmLeaveNo = document.getElementById('confirmLeaveNo');
  const agreeExit = document.getElementById('agreeExit');
  const returnToExam = document.getElementById('returnToExam');

  let trapFocusHandler = null;
  let mustStayFullscreen = true;
  let beforeUnloadHandler = null;

  const lockKeys = async () => { try { await navigator.keyboard?.lock?.(['Escape','F11','F4']); } catch {} };
  const unlockKeys = async () => { try { await navigator.keyboard?.unlock?.(); } catch {} };
  const enableBeforeUnload = () => {
    if (beforeUnloadHandler) return;
    beforeUnloadHandler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnloadHandler);
  };
  const disableBeforeUnload = () => {
    if (!beforeUnloadHandler) return;
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  };

  const getVisibleFocusable = () => Array.from(document.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null && !el.closest('[hidden]'));
  const focusTrapOn = () => {
    trapFocusHandler = (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const items = getVisibleFocusable();
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      const nextIndex = e.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index === items.length - 1 ? 0 : index + 1);
      items[nextIndex].focus();
    };
    document.addEventListener('keydown', trapFocusHandler);
  };
  const focusTrapOff = () => { if (trapFocusHandler) document.removeEventListener('keydown', trapFocusHandler); trapFocusHandler = null; };

  const showStep1 = () => { examFinal.hidden = true; examConfirm.hidden = false; confirmLeaveYes?.focus(); };
  const showStep2 = () => { examConfirm.hidden = true; examFinal.hidden = false; agreeExit?.focus(); };
  const hideAll = () => { examConfirm.hidden = true; examFinal.hidden = true; examStart?.focus(); };

  const enterFullscreen = () => {
    try {
      const req = rootEl.requestFullscreen || rootEl.webkitRequestFullscreen || rootEl.msRequestFullscreen;
      if (req) {
        const p = req.call(rootEl, { navigationUI: 'hide' });
        if (p?.then) p.then(lockKeys).catch(()=>{}); else lockKeys();
      } else { lockKeys(); }
    } catch {}
  };
  const ensureFullscreen = () => { if (mustStayFullscreen && !document.fullscreenElement) enterFullscreen(); };
  const exitFullscreen = () => {
    mustStayFullscreen = false; disableBeforeUnload(); focusTrapOff(); unlockKeys();
    try { if (document.fullscreenElement) (document.exitFullscreen||document.webkitExitFullscreen||document.msExitFullscreen)?.call(document); } catch {}
  };

  // Initialize exam mode: show gate first; don't enter fullscreen until passed
  hideAll();
  focusTrapOn();
  enableBeforeUnload();
  // Gate visible initially
  if (gateInput) gateInput.focus();

  // Intercept keys
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'F4' && e.altKey)) { e.preventDefault(); showStep1(); return; }
    if (e.key === 'Escape') { e.preventDefault(); showStep1(); return; }
    // Any keyboard interaction should try restoring fullscreen if needed
    ensureFullscreen();
  });
  // Any click/tap interaction should try to enter fullscreen if blocked on load
  document.addEventListener('click', ensureFullscreen, { capture: true });
  document.addEventListener('pointerdown', ensureFullscreen, { capture: true });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && mustStayFullscreen) { showStep1(); enterFullscreen(); }
  });

  // Gate logic (password)
  gateForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = (gateInput?.value || '').trim();
    if (value !== 'cpig') {
      if (gateError) gateError.hidden = false;
      gateInput?.focus();
      return;
    }
    if (gateError) gateError.hidden = true;
    // Hide gate and enter fullscreen
    if (gateOverlay) gateOverlay.style.display = 'none';
    // Show second auth for unique code and disable Start until correct
    if (examStart) examStart.disabled = true;
    if (codeOverlay) codeOverlay.style.display = 'flex';
    (codeInput || examStart)?.focus();
  });

  // Close button on gate: return to index without entering exam
  gateClose?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Dev bypasses
  // 1) Password gate bypass: fill correct password and proceed
  devBypass?.addEventListener('click', () => {
    if (gateInput) gateInput.value = 'cpig';
    gateForm?.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  // Code gate logic
  codeForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const raw = localStorage.getItem('currentUser');
      const current = raw ? JSON.parse(raw) : null;
      const expected = current?.code || '';
      const entered = (codeInput?.value || '').trim();
      if (!entered || entered !== expected) {
        if (codeError) codeError.hidden = false;
        codeInput?.focus();
        return;
      }
      if (codeError) codeError.hidden = true;
      if (codeOverlay) codeOverlay.style.display = 'none';
      enterFullscreen();
      if (examStart) examStart.disabled = false;
      examStart?.focus();
    } catch {
      // If no current user, bounce to home
      window.location.href = 'index.html';
    }
  });

  // 2) Code gate bypass: fill current user's unique code and proceed
  devBypassCode?.addEventListener('click', () => {
    try {
      const raw = localStorage.getItem('currentUser');
      const current = raw ? JSON.parse(raw) : null;
      if (!current?.code) { window.location.href = 'index.html'; return; }
      if (codeInput) codeInput.value = current.code;
      codeForm?.dispatchEvent(new Event('submit', { cancelable: true }));
    } catch { window.location.href = 'index.html'; }
  });

  // Close button on code gate: return to index
  codeGateClose?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Actions
  examStart?.addEventListener('click', hideAll);
  examFinish?.addEventListener('click', showStep1);
  confirmLeaveNo?.addEventListener('click', hideAll);
  confirmLeaveYes?.addEventListener('click', showStep2);
  returnToExam?.addEventListener('click', hideAll);
  agreeExit?.addEventListener('click', () => { exitFullscreen(); window.location.href = 'index.html'; });
});


