document.addEventListener('DOMContentLoaded', () => {
  // Prevent zooming with Ctrl/+/-, Ctrl+mousewheel, and mousewheel-only zoom on some browsers
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) { e.preventDefault(); }
  }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
      e.preventDefault();
    }
  }, { passive: false });
  const rootEl = document.documentElement;
  // Minimal DOM helpers
  const byId = (id) => document.getElementById(id);
  const qs = (sel) => document.querySelector(sel);
  const setHidden = (el, val) => { if (el) el.hidden = !!val; };
  const show = (el, display = 'block') => { if (el) el.style.display = display; };
  const hide = (el) => { if (el) el.style.display = 'none'; };
  const getAnswers = (q) => Array.isArray(q?.answers) ? q.answers : (Array.isArray(q?.options) ? q.options : []);
  const gateOverlay = document.getElementById('examGateOverlay');
  const gateForm = document.getElementById('examGateForm');
  const gateInput = document.getElementById('examPassword');
  const gateError = document.getElementById('examGateError');
  const gateClose = document.getElementById('examGateClose');
  // Unique code overlay elements removed
  const examStart = document.getElementById('examStart');
  const examFinish = document.getElementById('examFinish');
  const examConfirm = document.getElementById('examConfirm');
  const examFinal = document.getElementById('examFinal');
  const confirmOverlay = document.getElementById('confirmOverlay');
  const finalOverlay = document.getElementById('finalOverlay');
  const prestartOverlay = document.getElementById('prestartOverlay');
  const resultsOverlay = document.getElementById('resultsOverlay');
  const examResults = document.getElementById('examResults');
  const resultsList = document.getElementById('resultsList');
  const resultsClose = document.getElementById('resultsClose');
  const confirmLeaveYes = document.getElementById('confirmLeaveYes');
  const confirmLeaveNo = document.getElementById('confirmLeaveNo');
  const agreeExit = document.getElementById('agreeExit');
  const returnToExam = document.getElementById('returnToExam');
  const ctTitle = document.querySelector('.ct-section.ct-title');
  const countdownEl = document.getElementById('examCountdown');
  const rightDateTime = document.getElementById('rightDateTime');
  // Disable Finish until exam actually starts
  try { if (examFinish) examFinish.disabled = true; } catch {}
  const cmHeader = document.querySelector('.cm-header');
  const cmContent = document.querySelector('.cm-content');
  const cmDotsWrap = document.querySelector('.cm-dots');
  const prevBtn = document.querySelector('.cm-nav.prev');
  const nextBtn = document.querySelector('.cm-nav.next');
  const qNumEl = document.querySelector('.question-number-num');
  const blockNumEl = document.querySelector('.block-number-num');

  // Backend API wiring
  const API_BASE = 'http://127.0.0.1:8000';
  const EXAM_ID = 1;
  let sessionId = null;
  let sessionToken = null;
  let serverEndsAtMs = null;

  const authHeaders = () => (sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {});
  const asJson = (method, body, extra = {}) => ({
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(extra.headers || {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const getOpts = (extra = {}) => ({ method: 'GET', headers: { ...authHeaders(), ...(extra.headers || {}) } });

  async function apiAuthCode(code) {
    const res = await fetch(`${API_BASE}/auth/code`, asJson('POST', { exam_id: EXAM_ID, code: String(code || '').trim() }));
    if (!res.ok) throw new Error('კოდი არასწორია');
    return await res.json();
  }
  async function apiGetConfig(examId) {
    const res = await fetch(`${API_BASE}/exam/${examId}/config`, getOpts());
    if (!res.ok) throw new Error('კონფიგი ვერ ჩაიტვირთა');
    return await res.json();
  }
  async function apiGetBlockQuestions(blockId) {
    if (!sessionId) throw new Error('სესია არ არის');
    const res = await fetch(`${API_BASE}/exam/${sessionId}/questions?block_id=${encodeURIComponent(blockId)}`, getOpts());
    if (!res.ok) throw new Error('კითხვები ვერ ჩაიტვირთა');
    return await res.json();
  }
  async function apiAnswer(questionId, optionId) {
    if (!sessionId) throw new Error('სესია არ არის');
    const res = await fetch(`${API_BASE}/exam/${sessionId}/answer`, asJson('POST', { question_id: Number(questionId), option_id: Number(optionId) }));
    if (!res.ok) throw new Error('პასუხი ვერ შეინახა');
    return await res.json();
  }
  async function apiFinish() {
    if (!sessionId) return;
    try { await fetch(`${API_BASE}/exam/${sessionId}/finish`, asJson('POST', {})); } catch {}
  }

  const DEFAULT_TITLE_TEXT = '';
  const ADMIN_PWD_KEY = 'adminGatePassword';
  const readAdminPassword = () => {
    try {
      const v = String(localStorage.getItem(ADMIN_PWD_KEY) || '').trim();
      return v || 'cpig';
    } catch { return 'cpig'; }
  };
  const getCurrentUser = () => {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const updateUserHeader = () => {
    if (!ctTitle) return;
    const user = getCurrentUser();
    if (user?.firstName && user?.lastName && user?.code) {
      ctTitle.textContent = `${user.firstName} ${user.lastName} — ${user.code}`;
    } else {
      ctTitle.textContent = DEFAULT_TITLE_TEXT;
    }
  };

  const pad2 = (n) => String(n).padStart(2, '0');
  const formatDate = (d) => {
    const day = pad2(d.getDate());
    const m = pad2(d.getMonth() + 1);
    const y = d.getFullYear();
    return `${day}-${m}-${y}`;
  };
  const formatTime = (d) => {
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${hh}:${mm}`;
  };
  const updateRightDateTime = () => {
    if (!rightDateTime) return;
    const now = new Date();
    rightDateTime.innerHTML = `<div class="rd-date">${formatDate(now)}</div><div class="rd-time">${formatTime(now)}</div>`;
  };

  let trapFocusHandler = null;
  let mustStayFullscreen = true;
  let beforeUnloadHandler = null;

  const lockKeys = async () => { try { await navigator.keyboard?.lock?.(['Escape','F11','F4']); } catch {} };
  const unlockKeys = async () => { try { await navigator.keyboard?.unlock?.(); } catch {} };
  const enableBeforeUnload = () => {
    if (beforeUnloadHandler) return;
    beforeUnloadHandler = (e) => { 
      // Completely prevent native browser alerts/dialogs - they exit fullscreen
      e.preventDefault(); 
      e.returnValue = ''; 
      // Ensure fullscreen stays active even if moron tries to show native dialog
      if (mustStayFullscreen && !document.fullscreenElement) {
        enterFullscreen();
      }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler, { capture: true });
  };
  const disableBeforeUnload = () => {
    if (!beforeUnloadHandler) return;
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  };

  // Navigate out safely without triggering native leave-confirm
  const safeNavigateHome = () => {
    mustStayFullscreen = false;
    disableBeforeUnload();
    focusTrapOff();
    unlockKeys();
    try {
      if (document.fullscreenElement) {
        (document.exitFullscreen||document.webkitExitFullscreen||document.msExitFullscreen)?.call(document);
      }
    } catch {}
    window.location.href = 'index.html';
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

  const showStep1 = () => { 
    setHidden(examFinal, true);
    hide(finalOverlay);
    setHidden(examConfirm, false);
    show(confirmOverlay);
    confirmLeaveYes?.focus(); 
  };
  const showStep2 = () => { 
    setHidden(examConfirm, true);
    hide(confirmOverlay);
    setHidden(examFinal, false);
    show(finalOverlay);
    agreeExit?.focus(); 
  };
  const hideAll = () => { 
    setHidden(examConfirm, true);
    setHidden(examFinal, true);
    hide(confirmOverlay);
    hide(finalOverlay);
    examStart?.focus(); 
  };

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
  // beforeunload disabled to avoid native browser prompt
  updateUserHeader();
  updateRightDateTime();
  setInterval(updateRightDateTime, 1000 * 30);
  // Disable examStart initially until code is correct
  if (examStart) examStart.disabled = true;
  // Gate visible initially
  if (gateInput) gateInput.focus();
  // Before exam start, show blur overlay and keep only Start/Finish usable
  try { show(prestartOverlay); } catch {}

  // Intercept keys
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'F4' && e.altKey)) { e.preventDefault(); showStep1(); return; }
    if (e.key === 'Escape') { e.preventDefault(); showStep1(); return; }
    // Any keyboard interaction should try restoring fullscreen if needed
    ensureFullscreen();
  });
  // Any click/tap interaction should try to enter fullscreen if blocked on load
  document.addEventListener('click', () => { ensureFullscreen(); }, { capture: true });
  document.addEventListener('fullscreenchange', () => {
    // Don't show exit warning if answer-all dialog is open
    if (answerAllDialog && !answerAllDialog.hidden) {
      if (!document.fullscreenElement && mustStayFullscreen) {
        // Immediately restore fullscreen without showing alerts - use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          if (mustStayFullscreen && !document.fullscreenElement) {
            enterFullscreen();
          }
        });
      }
      return;
    }
    if (!document.fullscreenElement && mustStayFullscreen) { showStep1(); enterFullscreen(); }
  });

  // Gate logic (password)
  gateForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = (gateInput?.value || '').trim();
    const expected = readAdminPassword();
    if (value !== expected) {
      if (gateError) gateError.hidden = false;
      gateInput?.focus();
      return;
    }
    if (gateError) gateError.hidden = true;
    // Hide gate and enable starting the exam immediately
    hide(gateOverlay);
    if (examStart) { examStart.disabled = false; examStart.focus(); }
    enterFullscreen();
  });

  // Close button on gate: return to index without entering exam
  gateClose?.addEventListener('click', safeNavigateHome);

  // Dev bypass removed: only official authorization is allowed

  // Code gate removed

  // Actions
  examFinish?.addEventListener('click', showStep1);
  confirmLeaveNo?.addEventListener('click', hideAll);
  confirmLeaveYes?.addEventListener('click', showStep2);
  returnToExam?.addEventListener('click', hideAll);
  agreeExit?.addEventListener('click', () => { exitFullscreen(); safeNavigateHome(); });
  
  // Countdown wiring - uses admin-set duration from localStorage (key: 'examDuration')
  const EXAM_DURATION_KEY = 'examDuration';
  let countdownTimer = null;
  let remainingMs = 0;
  
  const readDurationMinutes = () => {
    try { const v = Number(localStorage.getItem(EXAM_DURATION_KEY) || 0); return v > 0 ? v : 60; } catch { return 60; }
  };
  const formatHMS = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    const p2 = (n) => String(n).padStart(2, '0');
    return `${p2(hh)}:${p2(mm)}:${p2(ss)}`;
  };
  const updateCountdownView = () => {
    if (countdownEl) countdownEl.textContent = formatHMS(remainingMs);
  };
  const stopCountdown = () => { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } };
  const startCountdown = () => {
    stopCountdown();
    if (serverEndsAtMs) {
      remainingMs = Math.max(0, serverEndsAtMs - Date.now());
    } else {
      const minutes = readDurationMinutes();
      remainingMs = minutes * 60 * 1000;
    }
    updateCountdownView();
    countdownTimer = setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs <= 0) {
        remainingMs = 0;
        updateCountdownView();
        stopCountdown();
        // Time is up → show results
        showResults();
        return;
      }
      updateCountdownView();
    }, 1000);
  };

  // ===================== Exam Data Loading & Selection =====================
  const BLOCKS_KEY = 'examBlocks_v1';
  // Runtime state for exam
  let blocks = [];
  let selectedByBlock = []; // array of arrays of question indices chosen (in admin order)
  let flatQuestions = []; // flattened questions with blockIndex, localIndex
  let currentFlatIndex = 0; // global question index X (0-based)
  let currentBlockIndex = 0; // A (0-based)
  let answersState = new Map(); // key: questionId -> { chosenAnswerId, correct }
  // removed autoNextTimer (was unused)
  let examStarted = false;

  const loadBlocks = () => {
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  // Render from localStorage immediately to avoid blank screen while server loads
  const preRenderLocalFirstQuestion = () => {
    try {
      const localBlocks = loadBlocks();
      const b = Array.isArray(localBlocks) ? localBlocks : [];
      if (!b.length) return false;
      blocks = b;
      selectedByBlock = blocks.map((blk) => {
        const allQs = Array.isArray(blk?.questions) ? blk.questions : [];
        const indices = pickPerBlock(blk);
        return indices.map(i => allQs[i]).filter(Boolean);
      });
      flatQuestions = [];
      answersState = new Map();
      rebuildFlat();
      currentFlatIndex = 0;
      currentBlockIndex = flatQuestions.length ? flatQuestions[0].blockIndex : 0;
      renderCurrentQuestion();
      renderDotsForCurrentBlock();
      updateNavButtons();
      updateIndicators();
      return flatQuestions.length > 0;
    } catch { return false; }
  };

  // Pick exactly qty questions per block randomly, but keep admin order among selected
  const pickPerBlock = (b) => {
    const allQs = Array.isArray(b.questions) ? b.questions : [];
    const qty = Math.max(0, Math.min(Number(b.qty) || 0, allQs.length));
    if (qty === 0) return [];
    // random unique indices
    const indices = Array.from({length: allQs.length}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = indices[i]; indices[i] = indices[j]; indices[j] = t;
    }
    const pickedSet = new Set(indices.slice(0, qty));
    // keep admin order among selected
    const ordered = [];
    for (let i = 0; i < allQs.length; i++) {
      if (pickedSet.has(i)) ordered.push(i);
      if (ordered.length === qty) break;
    }
    return ordered;
  };

  const rebuildFlat = () => {
    flatQuestions = [];
    selectedByBlock.forEach((qs, bi) => {
      (Array.isArray(qs) ? qs : []).forEach((q) => {
        if (q) flatQuestions.push({ blockIndex: bi, localIndex: 0, question: q });
      });
    });
  };

  const updateIndicators = () => {
    // Left: question X/Y
    const X = flatQuestions.length ? (currentFlatIndex + 1) : 0;
    const Y = flatQuestions.length;
    if (qNumEl) qNumEl.textContent = `${X}/${Y}`;
    // Right: block A/B (total blocks)
    const visibleBlocks = blocks.length || 0;
    const A = (currentBlockIndex + 1);
    if (blockNumEl) blockNumEl.textContent = `${A}/${visibleBlocks}`;
  };

  const setHeaderText = () => {
    const fq = flatQuestions[currentFlatIndex];
    const bNum = currentBlockIndex + 1;
    const code = fq?.question?.code ? String(fq.question.code) : '';
    if (cmHeader) cmHeader.textContent = '';
    // Build: left block number, center text, right code
    const left = document.createElement('div'); left.textContent = `ბლოკი ${bNum}`;
    const center = document.createElement('div'); center.textContent = 'შეარჩიეთ და მონიშნეთ სწორი პასუხი';
    const right = document.createElement('div'); right.textContent = code;
    left.style.justifySelf = 'start';
    center.style.justifySelf = 'center';
    right.style.justifySelf = 'end';
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = '1fr 1fr 1fr';
    wrap.append(left, center, right);
    if (cmHeader) { cmHeader.innerHTML = ''; cmHeader.appendChild(wrap); }
  };

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // no auto-next; navigation is explicit

  const applyAnswerStateStyles = () => {
    const fq = flatQuestions[currentFlatIndex];
    const q = fq?.question; if (!q) return;
    const state = answersState.get(q.id);
    if (!state) return;
    const isCorrect = state.correct;
    const bullets = Array.from(cmContent?.querySelectorAll?.('.bullet') || []);
    const chosenId = String(state.chosenAnswerId || '');
    const selected = bullets.find(b => b.getAttribute('data-answer-id') === chosenId);
    if (!selected) { return; }
    bullets.forEach(b => { b.style.pointerEvents = 'none'; });
    selected.style.borderColor = isCorrect ? '#16a34a' : '#dc2626';
    selected.style.background = isCorrect ? '#16a34a' : '#dc2626';
    renderDotsForCurrentBlock();
  };

  const selectAnswer = async (answerId, bulletEl = null) => {
    if (!examStarted) return; // block interactions until started
    const fq = flatQuestions[currentFlatIndex];
    const q = fq?.question; if (!q) return;
    // only first selection allowed
    if (answersState.has(q.id)) return;
    // Optimistic UI update for instant feedback
    answersState.set(q.id, { chosenAnswerId: String(answerId || ''), correct: false });
    if (bulletEl) { try { bulletEl.style.pointerEvents = 'none'; } catch {} }
    applyAnswerStateStyles();
    try {
      const resp = await apiAnswer(q.id, Number(answerId));
      const correct = !!resp?.correct;
      answersState.set(q.id, { chosenAnswerId: String(answerId || ''), correct });
      applyAnswerStateStyles();
    } catch {
      // Offline/local fallback: determine correctness from local data
      const correctLocal = String(q?.correctAnswerId || '') === String(answerId || '');
      answersState.set(q.id, { chosenAnswerId: String(answerId || ''), correct: correctLocal });
      applyAnswerStateStyles();
    }
    // Auto move disabled: navigation only via arrows or dots
  };

  const renderCurrentQuestion = () => {
    if (!cmContent) return;
    const fq = flatQuestions[currentFlatIndex];
    cmContent.innerHTML = '';
    if (!fq) return;
    setHeaderText();
    const q = fq.question;
    const answers = getAnswers(q);
    // Question
    const qEl = document.createElement('div');
    qEl.className = 'question';
    qEl.innerHTML = `<div class="question-text">${escapeHtml(String(q.text || ''))}</div>`;
    cmContent.appendChild(qEl);
    // Answers A-D, keep admin order
    const labels = ['A','B','C','D'];
    answers.slice(0,4).forEach((a, idx) => {
      const row = document.createElement('div');
      row.className = ['answerA','answerb','answerc','answerd'][idx] || 'answerA';
      const answerIdStr = String(a.id);
      row.innerHTML = `
        <div class="mark"><div class="bullet" data-answer-id="${answerIdStr}"></div></div>
        <div class="code">${labels[idx] || ''}</div>
        <div class="text">${escapeHtml(String(a.text || ''))}</div>
      `;
      // Click handlers on entire row and specific bullet for better UX
      const bulletEl = row.querySelector('.bullet');
      const wire = (el) => el && el.addEventListener('click', () => { selectAnswer(answerIdStr, bulletEl).catch(()=>{}); });
      wire(row);
      wire(bulletEl);
      wire(row.querySelector('.code'));
      wire(row.querySelector('.text'));
      cmContent.appendChild(row);
    });
    // Event delegation fallback (robust to future DOM changes)
    const delegated = (e) => {
      const rowEl = e.target?.closest?.('.answerA, .answerb, .answerc, .answerd');
      if (!rowEl || !cmContent.contains(rowEl)) return;
      const bullet = rowEl.querySelector('.bullet');
      const id = bullet?.getAttribute('data-answer-id');
      if (id) selectAnswer(id, bullet).catch(()=>{});
    };
    cmContent.addEventListener('click', delegated);
    applyAnswerStateStyles();
    updateIndicators();
  };

  const answerAllOverlay = document.getElementById('answerAllOverlay');
  const answerAllDialog = document.getElementById('answerAllDialog');
  const answerAllClose = document.getElementById('answerAllClose');
  let pendingBlockTransition = null;

  const showAnswerAllDialog = (nextBlockIndex, nextFlatIndex) => {
    if (!answerAllOverlay || !answerAllDialog) return;
    pendingBlockTransition = { nextBlockIndex, nextFlatIndex };
    show(answerAllOverlay);
    setHidden(answerAllDialog, false);
    ensureFullscreen();
    setTimeout(() => { answerAllClose?.focus(); }, 150);
  };

  const hideAnswerAllDialog = () => {
    hide(answerAllOverlay);
    setHidden(answerAllDialog, true);
    pendingBlockTransition = null;
    setTimeout(() => ensureFullscreen(), 50);
  };

  const gotoQuestionIndex = (idx) => {
    if (idx < 0 || idx >= flatQuestions.length) return;
    const nextBlock = flatQuestions[idx].blockIndex;
    if (nextBlock !== currentBlockIndex && !areAllQuestionsAnsweredInBlock(currentBlockIndex)) {
      showAnswerAllDialog(nextBlock, idx);
      return;
    }
    currentFlatIndex = idx;
    currentBlockIndex = nextBlock;
    renderCurrentQuestion();
    renderDotsForCurrentBlock();
    updateNavButtons();
  };

  const gotoPrevQuestion = () => gotoQuestionIndex(currentFlatIndex - 1);
  const gotoNextQuestion = () => {
    if (currentFlatIndex < flatQuestions.length - 1) {
      gotoQuestionIndex(currentFlatIndex + 1);
      return;
    }
    // At the end: finish only if all questions are answered
    const allAnswered = flatQuestions.every(fq => !!answersState.get(fq.question?.id));
    if (allAnswered) {
      showResults();
    }
  };

  const areAllQuestionsAnsweredInBlock = (bi) => {
    const qs = selectedByBlock[bi] || [];
    return qs.every(q => !!answersState.get(q?.id));
  };

  const renderDotsForCurrentBlock = () => {
    if (!cmDotsWrap) return;
    cmDotsWrap.innerHTML = '';
    const bi = currentBlockIndex;
    const qs = selectedByBlock[bi] || [];
    qs.forEach((q) => {
      const span = document.createElement('span');
      span.className = 'cm-dot';
      const globalIdx = flatQuestions.findIndex(f => f.blockIndex === bi && f.question?.id === q?.id);
      if (globalIdx === currentFlatIndex) span.classList.add('active');
      const st = answersState.get(q?.id);
      if (st) {
        if (st.correct) { span.style.background = '#16a34a'; span.style.borderColor = '#15803d'; }
        else { span.style.background = '#dc2626'; span.style.borderColor = '#991b1b'; }
      }
      span.addEventListener('click', () => { gotoQuestionIndex(globalIdx); });
      cmDotsWrap.appendChild(span);
    });
  };

  const updateNavButtons = () => {
    if (prevBtn) prevBtn.disabled = currentFlatIndex <= 0;
    // Keep Next enabled even at the last question to allow finishing via Next
    if (nextBtn) nextBtn.disabled = flatQuestions.length === 0;
  };

  // ===================== Results Rendering =====================
  const showResults = () => {
    try {
      // finalize session on server (fire-and-forget)
      void apiFinish();
      if (!resultsOverlay || !examResults || !resultsList) return;
      resultsList.innerHTML = '';
      selectedByBlock.forEach((qs, bi) => {
        qs = qs || [];
        if (!qs.length) return;
        let correctCount = 0;
        qs.forEach(q => {
          const st = q ? answersState.get(q.id) : null;
          if (st?.correct) correctCount++;
        });
        const total = qs.length || 1;
        const pct = Math.round((correctCount / total) * 100);
        const row = document.createElement('div');
        row.className = 'result-row';
        const label = document.createElement('div');
        label.className = 'result-label';
        label.textContent = `ბლოკი ${bi + 1}`;
        const value = document.createElement('div');
        const colorClass = pct < 70 ? 'pct-red' : (pct <= 75 ? 'pct-yellow' : 'pct-green');
        value.className = `result-value ${colorClass}`;
        value.textContent = `${pct}%`;
        row.append(label, value);
        resultsList.appendChild(row);
      });
      show(resultsOverlay);
      setHidden(examResults, false);
    } catch {}
  };

  const hideResults = () => {
    try {
      hide(resultsOverlay);
      setHidden(examResults, true);
    } catch {}
  };

  const initExamData = async () => {
    // Load config
    try {
      const cfg = await apiGetConfig(EXAM_ID);
      blocks = Array.isArray(cfg?.blocks) ? cfg.blocks : [];
    } catch (err) {
      console.error('Failed to load exam config:', err);
      blocks = [];
    }

    // If no blocks from server → fallback to local immediately (no delay)
    if (!Array.isArray(blocks) || blocks.length === 0) {
      const localBlocks = loadBlocks();
      blocks = Array.isArray(localBlocks) ? localBlocks : [];
      selectedByBlock = blocks.map((b) => {
        const allQs = Array.isArray(b?.questions) ? b.questions : [];
        const indices = pickPerBlock(b);
        return indices.map(i => allQs[i]).filter(Boolean);
      });
      flatQuestions = [];
      answersState = new Map();
      rebuildFlat();
      currentFlatIndex = 0;
      currentBlockIndex = flatQuestions.length ? flatQuestions[0].blockIndex : 0;
      renderCurrentQuestion();
      renderDotsForCurrentBlock();
      updateNavButtons();
      updateIndicators();
      return;
    }

    // Progressive load: fetch first block quickly, render immediately; others in background
    try {
      selectedByBlock = Array.from({ length: blocks.length }, () => []);

      // 1) First block
      if (blocks.length > 0) {
        try {
          const r0 = await apiGetBlockQuestions(blocks[0].id);
          selectedByBlock[0] = Array.isArray(r0?.questions) ? r0.questions : [];
        } catch (err0) {
          console.error('Failed to load first block questions', err0);
        }
      }

      flatQuestions = [];
      answersState = new Map();
      rebuildFlat();
      currentFlatIndex = 0;
      currentBlockIndex = flatQuestions.length ? flatQuestions[0].blockIndex : 0;
      renderCurrentQuestion(); // show first question ASAP (~0.1s depending on first fetch)
      renderDotsForCurrentBlock();
      updateNavButtons();
      updateIndicators();

      // 2) Remaining blocks in background
      const restPromises = blocks.slice(1).map((b, idx) =>
        apiGetBlockQuestions(b.id)
          .then(r => ({ i: idx + 1, qs: Array.isArray(r?.questions) ? r.questions : [] }))
          .catch((err) => { console.error('Failed to load block', b.id, err); return { i: idx + 1, qs: [] }; })
      );
      const rest = await Promise.all(restPromises);
      rest.forEach(({ i, qs }) => { selectedByBlock[i] = qs; });
      rebuildFlat();
      // Keep current selection and UI; just refresh dots/indicators/buttons
      renderDotsForCurrentBlock();
      updateNavButtons();
      updateIndicators();
    } catch (err) {
      console.error('Progressive load failed:', err);
    }
  };

  // Register nav handlers and start exam data
  prevBtn?.addEventListener('click', gotoPrevQuestion);
  nextBtn?.addEventListener('click', gotoNextQuestion);
  examStart?.addEventListener('click', async () => {
    if (examStarted) return;
    examStarted = true;
    if (examStart) examStart.disabled = true;
    if (examFinish) examFinish.disabled = false;
    if (prestartOverlay) hide(prestartOverlay);
    // Show local question immediately (if available), then load server data in background
    preRenderLocalFirstQuestion();
    void initExamData();
    startCountdown();
  });
  // Initialize countdown display from saved duration on load
  (function initCountdown() {
    remainingMs = serverEndsAtMs ? Math.max(0, serverEndsAtMs - Date.now()) : (readDurationMinutes() * 60 * 1000);
    updateCountdownView();
  })();
  resultsClose?.addEventListener('click', () => { hideResults(); exitFullscreen(); safeNavigateHome(); });

  // Handle answer all dialog
  answerAllClose?.addEventListener('click', () => {
    // Simply close warning; stay on the same block/question
    hideAnswerAllDialog();
  });
});


