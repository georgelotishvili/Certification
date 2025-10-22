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

  const DEFAULT_TITLE_TEXT = '';
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
    beforeUnloadHandler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnloadHandler);
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
    examFinal.hidden = true; 
    if (finalOverlay) finalOverlay.style.display = 'none';
    examConfirm.hidden = false;
    if (confirmOverlay) confirmOverlay.style.display = 'block';
    confirmLeaveYes?.focus(); 
  };
  const showStep2 = () => { 
    examConfirm.hidden = true;
    if (confirmOverlay) confirmOverlay.style.display = 'none';
    examFinal.hidden = false;
    if (finalOverlay) finalOverlay.style.display = 'block';
    agreeExit?.focus(); 
  };
  const hideAll = () => { 
    examConfirm.hidden = true;
    examFinal.hidden = true;
    if (confirmOverlay) confirmOverlay.style.display = 'none';
    if (finalOverlay) finalOverlay.style.display = 'none';
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
  enableBeforeUnload();
  updateUserHeader();
  updateRightDateTime();
  setInterval(updateRightDateTime, 1000 * 30);
  // Gate visible initially
  if (gateInput) gateInput.focus();
  // Before exam start, show blur overlay and keep only Start/Finish usable
  try { if (prestartOverlay) prestartOverlay.style.display = 'block'; } catch {}

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
  gateClose?.addEventListener('click', safeNavigateHome);

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
      // Manual start required: do not auto-click Start
      examStart?.focus();
      updateUserHeader();
    } catch {
      // Stay on the code gate and show error instead of navigating away
      if (codeError) codeError.hidden = false;
      codeInput?.focus();
    }
  });

  // 2) Code gate bypass: fill current user's unique code and proceed
  devBypassCode?.addEventListener('click', () => {
    try {
      const raw = localStorage.getItem('currentUser');
      const current = raw ? JSON.parse(raw) : null;
      if (!current?.code) { safeNavigateHome(); return; }
      if (codeInput) codeInput.value = current.code;
      codeForm?.dispatchEvent(new Event('submit', { cancelable: true }));
    } catch { safeNavigateHome(); }
  });

  // Close button on code gate: return to index
  codeGateClose?.addEventListener('click', safeNavigateHome);

  // Actions
  examStart?.addEventListener('click', hideAll);
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
    const minutes = readDurationMinutes();
    remainingMs = minutes * 60 * 1000;
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
  let autoNextTimer = null;
  let examStarted = false;

  const loadBlocks = () => {
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
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
    selectedByBlock.forEach((idxs, bi) => {
      const b = blocks[bi];
      const allQs = Array.isArray(b.questions) ? b.questions : [];
      idxs.forEach((qi) => {
        const q = allQs[qi];
        if (q) flatQuestions.push({ blockIndex: bi, localIndex: qi, question: q });
      });
    });
  };

  const updateIndicators = () => {
    // Left: question X/Y
    const X = flatQuestions.length ? (currentFlatIndex + 1) : 0;
    const Y = flatQuestions.length;
    if (qNumEl) qNumEl.textContent = `${X}/${Y}`;
    // Right: block A/B (visible blocks = all blocks with at least 1 selected question)
    const visibleBlocks = selectedByBlock.filter(arr => (arr||[]).length > 0).length || 0;
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

  const clearAutoNext = () => { if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; } };

  const applyAnswerStateStyles = () => {
    const fq = flatQuestions[currentFlatIndex];
    const q = fq?.question; if (!q) return;
    const state = answersState.get(q.id);
    if (!state) return;
    const isCorrect = state.correct;
    cmContent?.querySelectorAll('.bullet').forEach(b => {
      b.style.pointerEvents = 'none';
      const id = b.getAttribute('data-answer-id');
      if (id === state.chosenAnswerId) {
        b.style.borderColor = isCorrect ? '#16a34a' : '#dc2626';
        b.style.background = isCorrect ? '#16a34a' : '#dc2626';
      }
    });
    renderDotsForCurrentBlock();
  };

  const selectAnswer = (answerId) => {
    if (!examStarted) return; // block interactions until started
    clearAutoNext();
    const fq = flatQuestions[currentFlatIndex];
    const q = fq?.question; if (!q) return;
    // only first selection allowed
    if (answersState.has(q.id)) return;
    const correct = String(q.correctAnswerId || '') === String(answerId || '');
    answersState.set(q.id, { chosenAnswerId: String(answerId || ''), correct });
    applyAnswerStateStyles();
    // Auto move disabled: navigation only via arrows or dots
  };

  const renderCurrentQuestion = () => {
    if (!cmContent) return;
    const fq = flatQuestions[currentFlatIndex];
    cmContent.innerHTML = '';
    if (!fq) return;
    setHeaderText();
    const q = fq.question;
    const answers = Array.isArray(q.answers) ? q.answers : [];
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
      row.innerHTML = `
        <div class="mark"><div class="bullet" data-answer-id="${String(a.id)}"></div></div>
        <div class="code">${labels[idx] || ''}</div>
        <div class="text">${escapeHtml(String(a.text || ''))}</div>
      `;
      cmContent.appendChild(row);
    });
    // Wire clicks
    cmContent.querySelectorAll('.bullet').forEach(b => {
      b.addEventListener('click', () => {
        const answerId = b.getAttribute('data-answer-id');
        selectAnswer(answerId);
      });
    });
    applyAnswerStateStyles();
    updateIndicators();
  };

  const gotoQuestionIndex = (idx) => {
    clearAutoNext();
    if (idx < 0 || idx >= flatQuestions.length) return;
    const nextBlock = flatQuestions[idx].blockIndex;
    if (nextBlock !== currentBlockIndex && !areAllQuestionsAnsweredInBlock(currentBlockIndex)) {
      alert('გთხოვთ უპასუხოთ ყველა კითხვას');
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
    const idxs = selectedByBlock[bi] || [];
    const b = blocks[bi];
    const allQs = Array.isArray(b?.questions) ? b.questions : [];
    return idxs.every(qi => !!answersState.get(allQs[qi]?.id));
  };

  const renderDotsForCurrentBlock = () => {
    if (!cmDotsWrap) return;
    cmDotsWrap.innerHTML = '';
    const bi = currentBlockIndex;
    const idxs = selectedByBlock[bi] || [];
    const b = blocks[bi];
    const allQs = Array.isArray(b?.questions) ? b.questions : [];
    idxs.forEach((qi) => {
      const span = document.createElement('span');
      span.className = 'cm-dot';
      const globalIdx = flatQuestions.findIndex(f => f.blockIndex === bi && f.localIndex === qi);
      if (globalIdx === currentFlatIndex) span.classList.add('active');
      const st = answersState.get(allQs[qi]?.id);
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
      if (!resultsOverlay || !examResults || !resultsList) return;
      resultsList.innerHTML = '';
      selectedByBlock.forEach((idxs, bi) => {
        if (!idxs.length) return;
        const b = blocks[bi];
        const allQs = Array.isArray(b?.questions) ? b.questions : [];
        let correctCount = 0;
        idxs.forEach(qi => {
          const q = allQs[qi];
          const st = q ? answersState.get(q.id) : null;
          if (st?.correct) correctCount++;
        });
        const total = idxs.length || 1;
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
      resultsOverlay.style.display = 'block';
      examResults.hidden = false;
    } catch {}
  };

  const hideResults = () => {
    try {
      if (resultsOverlay) resultsOverlay.style.display = 'none';
      if (examResults) examResults.hidden = true;
    } catch {}
  };

  const initExamData = () => {
    blocks = loadBlocks();
    selectedByBlock = blocks.map(pickPerBlock);
    flatQuestions = [];
    answersState = new Map();
    rebuildFlat();
    currentFlatIndex = 0;
    currentBlockIndex = flatQuestions.length ? flatQuestions[0].blockIndex : 0;
    renderCurrentQuestion();
    renderDotsForCurrentBlock();
    updateNavButtons();
    updateIndicators();
  };

  // Register nav handlers and start exam data
  prevBtn?.addEventListener('click', gotoPrevQuestion);
  nextBtn?.addEventListener('click', gotoNextQuestion);
  examStart?.addEventListener('click', () => {
    if (examStarted) return;
    examStarted = true;
    if (examStart) examStart.disabled = true;
    if (examFinish) examFinish.disabled = false;
    if (prestartOverlay) prestartOverlay.style.display = 'none';
    initExamData();
  });
  // Initialize countdown display from saved duration on load
  (function initCountdown() {
    remainingMs = readDurationMinutes() * 60 * 1000;
    updateCountdownView();
  })();
  // Start countdown when exam actually starts (after overlays hidden)
  examStart?.addEventListener('click', () => { if (examStarted) startCountdown(); });
  resultsClose?.addEventListener('click', () => { hideResults(); exitFullscreen(); safeNavigateHome(); });
});


