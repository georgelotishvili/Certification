document.addEventListener('DOMContentLoaded', () => {
  preventZooming();

  const byId = (id) => document.getElementById(id);
  const qs = (selector) => document.querySelector(selector);
  const setHidden = (el, value) => { if (el) el.hidden = !!value; };
  const show = (el, display = 'block') => { if (el) el.style.display = display; };
  const hide = (el) => { if (el) el.style.display = 'none'; };
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const getAnswers = (question) => Array.isArray(question?.answers)
    ? question.answers
    : (Array.isArray(question?.options) ? question.options : []);

  const DOM = {
    root: document.documentElement,
    gateOverlay: byId('examGateOverlay'),
    gateForm: byId('examGateForm'),
    gateInput: byId('examPassword'),
    gateError: byId('examGateError'),
    gateClose: byId('examGateClose'),
    examStart: byId('examStart'),
    examFinish: byId('examFinish'),
    examConfirm: byId('examConfirm'),
    examFinal: byId('examFinal'),
    confirmOverlay: byId('confirmOverlay'),
    finalOverlay: byId('finalOverlay'),
    prestartOverlay: byId('prestartOverlay'),
    resultsOverlay: byId('resultsOverlay'),
    examResults: byId('examResults'),
    resultsList: byId('resultsList'),
    resultsClose: byId('resultsClose'),
    confirmLeaveYes: byId('confirmLeaveYes'),
    confirmLeaveNo: byId('confirmLeaveNo'),
    agreeExit: byId('agreeExit'),
    returnToExam: byId('returnToExam'),
    ctTitle: qs('.ct-section.ct-title'),
    countdownEl: byId('examCountdown'),
    rightDateTime: byId('rightDateTime'),
    cmHeader: qs('.cm-header'),
    cmContent: qs('.cm-content'),
    cmDotsWrap: qs('.cm-dots'),
    prevBtn: qs('.cm-nav.prev'),
    nextBtn: qs('.cm-nav.next'),
    qNumEl: qs('.question-number-num'),
    blockNumEl: qs('.block-number-num'),
    answerAllOverlay: byId('answerAllOverlay'),
    answerAllDialog: byId('answerAllDialog'),
    answerAllClose: byId('answerAllClose'),
  };

  if (DOM.examFinish) {
    try { DOM.examFinish.disabled = true; } catch {}
  }

  const state = {
    sessionId: null,
    sessionToken: null,
    serverEndsAtMs: null,
    isStartingSession: false,
    gatePassed: false,
    examStarted: false,
    mustStayFullscreen: true,
    blocks: [],
    selectedByBlock: [],
    flatQuestions: [],
    flatIndexByQuestionId: new Map(),
    answers: new Map(),
    currentFlatIndex: 0,
    currentBlockIndex: 0,
    pendingBlockTransition: null,
    trapFocusHandler: null,
  };

  const timers = { countdown: null };
  let remainingMs = 0;

  const API_BASE = 'http://127.0.0.1:8000';
  const EXAM_ID = 1;
  const BLOCKS_KEY = 'examBlocks_v1';
  const EXAM_DURATION_KEY = 'examDuration';
  const ADMIN_PWD_KEY = 'adminGatePassword';
  const DEFAULT_TITLE_TEXT = '';
  const KEYBOARD_LOCKS = ['Escape', 'F11', 'F4'];

  const dlog = (...args) => {
    try { console.debug('[exam]', ...args); } catch {}
  };

  const authHeaders = () => (state.sessionToken ? { 'Authorization': `Bearer ${state.sessionToken}` } : {});
  const asJson = (method, body, extra = {}) => ({
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(extra.headers || {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const getOpts = (extra = {}) => ({
    method: 'GET',
    headers: { ...authHeaders(), ...(extra.headers || {}) },
  });

  async function beginSession() {
    if (state.isStartingSession || (state.sessionId && state.sessionToken)) return;
    state.isStartingSession = true;
    try {
      const user = getCurrentUser() || {};
      const resp = await apiStartSession(user.firstName, user.lastName, user.code);
      state.sessionId = resp.session_id;
      state.sessionToken = resp.token;
      state.serverEndsAtMs = resp.ends_at ? new Date(resp.ends_at).getTime() : null;
      updateUserHeader();
      dlog('session started', { sessionId: state.sessionId, hasToken: !!state.sessionToken });
    } catch (err) {
      dlog('session start failed', err);
    } finally {
      state.isStartingSession = false;
      if (DOM.examStart) {
        DOM.examStart.disabled = false;
        if (!state.examStarted) {
          try { DOM.examStart.focus(); } catch {}
        }
      }
    }
  }

  async function apiGetConfig(examId) {
    dlog('GET config');
    const res = await fetch(`${API_BASE}/exam/${examId}/config`, getOpts());
    if (!res.ok) throw new Error('კონფიგი ვერ ჩაიტვირთა');
    const json = await res.json();
    dlog('config ok', json);
    return json;
  }

  async function apiStartSession(firstName, lastName, code) {
    const res = await fetch(`${API_BASE}/exam/session/start`, asJson('POST', {
      exam_id: EXAM_ID,
      candidate_first_name: String(firstName || ''),
      candidate_last_name: String(lastName || ''),
      candidate_code: String(code || ''),
    }));
    if (!res.ok) throw new Error('სესია ვერ დაიწყო');
    return await res.json();
  }

  async function apiGetBlockQuestions(blockId) {
    if (!state.sessionId) throw new Error('სესია არ არის');
    dlog('GET questions', { sessionId: state.sessionId, hasToken: !!state.sessionToken, blockId });
    const res = await fetch(`${API_BASE}/exam/${state.sessionId}/questions?block_id=${encodeURIComponent(blockId)}`, getOpts());
    if (!res.ok) throw new Error('კითხვები ვერ ჩაიტვირთა');
    const json = await res.json();
    dlog('questions ok', json);
    return json;
  }

  async function apiAnswer(questionId, optionId) {
    if (!state.sessionId) throw new Error('სესია არ არის');
    const res = await fetch(`${API_BASE}/exam/${state.sessionId}/answer`, asJson('POST', {
      question_id: Number(questionId),
      option_id: Number(optionId),
    }));
    if (!res.ok) throw new Error('პასუხი ვერ შეინახა');
    return await res.json();
  }

  async function apiFinish() {
    if (!state.sessionId) return;
    try { await fetch(`${API_BASE}/exam/${state.sessionId}/finish`, asJson('POST', {})); } catch {}
  }

  function readAdminPassword() {
    try {
      const value = String(localStorage.getItem(ADMIN_PWD_KEY) || '').trim();
      return value || 'cpig';
    } catch {
      return 'cpig';
    }
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function updateUserHeader() {
    if (!DOM.ctTitle) return;
    const user = getCurrentUser();
    if (user?.firstName && user?.lastName && user?.code) {
      DOM.ctTitle.textContent = `${user.firstName} ${user.lastName} — ${user.code}`;
    } else {
      DOM.ctTitle.textContent = DEFAULT_TITLE_TEXT;
    }
  }

  const pad2 = (value) => String(value).padStart(2, '0');
  const formatDate = (date) => `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
  const formatTime = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  function updateRightDateTime() {
    if (!DOM.rightDateTime) return;
    const now = new Date();
    DOM.rightDateTime.innerHTML = `<div class="rd-date">${formatDate(now)}</div><div class="rd-time">${formatTime(now)}</div>`;
  }

  const focusTrap = {
    enable() {
      if (state.trapFocusHandler) return;
      state.trapFocusHandler = (event) => {
        if (event.key !== 'Tab') return;
        const items = getVisibleFocusable();
        if (!items.length) return;
        event.preventDefault();
        const currentIndex = items.indexOf(document.activeElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? items.length - 1 : currentIndex - 1)
          : (currentIndex === items.length - 1 ? 0 : currentIndex + 1);
        items[nextIndex].focus();
      };
      document.addEventListener('keydown', state.trapFocusHandler);
    },
    disable() {
      if (!state.trapFocusHandler) return;
      document.removeEventListener('keydown', state.trapFocusHandler);
      state.trapFocusHandler = null;
    },
  };

  async function lockKeys() {
    try { await navigator.keyboard?.lock?.(KEYBOARD_LOCKS); } catch {}
  }

  async function unlockKeys() {
    try { await navigator.keyboard?.unlock?.(); } catch {}
  }

  function safeNavigateHome() {
    state.mustStayFullscreen = false;
    focusTrap.disable();
    unlockKeys();
    try {
      if (document.fullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
      }
    } catch {}
    window.location.href = 'index.html';
  }

  function getVisibleFocusable() {
    return Array.from(document.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null && !el.closest('[hidden]'));
  }

  function showStep1() {
    if (!DOM.examConfirm || !DOM.confirmOverlay) return;
    setHidden(DOM.examFinal, true);
    hide(DOM.finalOverlay);
    setHidden(DOM.examConfirm, false);
    show(DOM.confirmOverlay);
    DOM.confirmLeaveYes?.focus();
  }

  function showStep2() {
    if (!DOM.examFinal || !DOM.finalOverlay || !DOM.confirmOverlay) return;
    setHidden(DOM.examConfirm, true);
    hide(DOM.confirmOverlay);
    setHidden(DOM.examFinal, false);
    show(DOM.finalOverlay);
    DOM.agreeExit?.focus();
  }

  function hideAll() {
    setHidden(DOM.examConfirm, true);
    setHidden(DOM.examFinal, true);
    hide(DOM.confirmOverlay);
    hide(DOM.finalOverlay);
    DOM.examStart?.focus();
  }

  function enterFullscreen() {
    try {
      const request = DOM.root.requestFullscreen || DOM.root.webkitRequestFullscreen || DOM.root.msRequestFullscreen;
      if (request) {
        const result = request.call(DOM.root, { navigationUI: 'hide' });
        if (result?.then) {
          result.then(lockKeys).catch(() => {});
        } else {
          lockKeys();
        }
      } else {
        lockKeys();
      }
    } catch {}
  }

  function ensureFullscreen() {
    if (state.mustStayFullscreen && !document.fullscreenElement) {
      enterFullscreen();
    }
  }

  function exitFullscreen() {
    state.mustStayFullscreen = false;
    focusTrap.disable();
    unlockKeys();
    try {
      if (document.fullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
      }
    } catch {}
  }

  function loadBlocks() {
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function pickPerBlock(block) {
    const questions = Array.isArray(block?.questions) ? block.questions : [];
    const qty = Math.max(0, Math.min(Number(block?.qty) || 0, questions.length));
    if (!qty) return [];
    const indices = Array.from({ length: questions.length }, (_, index) => index);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const picked = new Set(indices.slice(0, qty));
    const ordered = [];
    for (let i = 0; i < questions.length && ordered.length < qty; i++) {
      if (picked.has(i)) ordered.push(i);
    }
    return ordered;
  }

  function resetAnswers() {
    state.answers = new Map();
  }

  function hydrateSelectedQuestions(blocks, selected, { resetPosition = true, resetAnswersFlag = false } = {}) {
    state.blocks = Array.isArray(blocks) ? blocks : [];
    const normalized = Array.isArray(selected) ? selected : [];
    state.selectedByBlock = state.blocks.map((_, index) => {
      const blockQuestions = normalized[index];
      return Array.isArray(blockQuestions) ? blockQuestions.filter(Boolean) : [];
    });
    if (resetAnswersFlag) {
      resetAnswers();
    }
    rebuildFlat({ resetPosition });
  }

  function rebuildFlat({ resetPosition = false } = {}) {
    state.flatQuestions = [];
    state.flatIndexByQuestionId = new Map();

    state.selectedByBlock.forEach((questions, blockIndex) => {
      (questions || []).forEach((question, localIndex) => {
        if (!question) return;
        const entry = { blockIndex, localIndex, question };
        const key = String(question.id);
        state.flatIndexByQuestionId.set(key, state.flatQuestions.length);
        state.flatQuestions.push(entry);
      });
    });

    if (resetPosition || state.flatQuestions.length === 0) {
      state.currentFlatIndex = 0;
    } else if (state.currentFlatIndex >= state.flatQuestions.length) {
      state.currentFlatIndex = state.flatQuestions.length - 1;
    }

    const currentEntry = state.flatQuestions[state.currentFlatIndex];
    state.currentBlockIndex = currentEntry ? currentEntry.blockIndex : 0;
  }

  function getCurrentEntry() {
    return state.flatQuestions[state.currentFlatIndex] || null;
  }

  function setCurrentFlatIndex(nextIndex) {
    if (nextIndex < 0 || nextIndex >= state.flatQuestions.length) return;
    state.currentFlatIndex = nextIndex;
    const entry = state.flatQuestions[nextIndex];
    state.currentBlockIndex = entry ? entry.blockIndex : 0;
    renderExamView();
  }

  function renderHeader(entry) {
    if (!DOM.cmHeader) return;
    DOM.cmHeader.innerHTML = '';
    if (!entry) return;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '1fr 1fr 1fr';

    const left = document.createElement('div');
    left.textContent = `ბლოკი ${entry.blockIndex + 1}`;
    left.style.justifySelf = 'start';

    const center = document.createElement('div');
    center.textContent = 'შეარჩიეთ და მონიშნეთ სწორი პასუხი';
    center.style.justifySelf = 'center';

    const right = document.createElement('div');
    right.textContent = entry.question?.code ? String(entry.question.code) : '';
    right.style.justifySelf = 'end';

    wrapper.append(left, center, right);
    DOM.cmHeader.appendChild(wrapper);
  }

  function renderQuestion() {
    if (!DOM.cmContent) return;
    DOM.cmContent.innerHTML = '';

    const entry = getCurrentEntry();
    renderHeader(entry);

    if (!entry) {
      if (state.examStarted) {
        DOM.cmContent.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;color:#7f1d1d;font-weight:700;">კითხვები ვერ ჩაიტვირთა</div>';
      }
      return;
    }

    const question = entry.question;
    const answers = getAnswers(question);
    const fragment = document.createDocumentFragment();

    const questionWrap = document.createElement('div');
    questionWrap.className = 'question';
    questionWrap.innerHTML = `<div class="question-text">${escapeHtml(question.text || '')}</div>`;
    fragment.appendChild(questionWrap);

    const classes = ['answerA', 'answerb', 'answerc', 'answerd'];
    const labels = ['A', 'B', 'C', 'D'];

    answers.slice(0, 4).forEach((answer, index) => {
      if (!answer) return;
      const answerId = String(answer.id);
      const row = document.createElement('div');
      row.className = `${classes[index] || 'answerA'} cm-answer`;
      row.dataset.answerId = answerId;
      row.innerHTML = `
        <div class="mark"><div class="bullet" data-answer-id="${answerId}"></div></div>
        <div class="code">${labels[index] || ''}</div>
        <div class="text">${escapeHtml(answer.text || '')}</div>
      `;
      fragment.appendChild(row);
    });

    DOM.cmContent.appendChild(fragment);
    applyAnswerStateStyles();
  }

  function renderDots() {
    if (!DOM.cmDotsWrap) return;
    DOM.cmDotsWrap.innerHTML = '';

    const blockIndex = state.currentBlockIndex;
    const questions = state.selectedByBlock[blockIndex] || [];
    if (!questions.length) return;

    const fragment = document.createDocumentFragment();

    questions.forEach((question) => {
      if (!question) return;
      const key = String(question.id);
      const dot = document.createElement('span');
      dot.className = 'cm-dot';
      dot.dataset.questionId = key;

      const flatIndex = state.flatIndexByQuestionId.get(key);
      if (flatIndex === state.currentFlatIndex) {
        dot.classList.add('active');
      }

      const answerState = state.answers.get(key);
      if (answerState) {
        if (answerState.correct) {
          dot.style.background = '#16a34a';
          dot.style.borderColor = '#15803d';
        } else {
          dot.style.background = '#dc2626';
          dot.style.borderColor = '#991b1b';
        }
      } else {
        dot.style.background = '';
        dot.style.borderColor = '';
      }

      fragment.appendChild(dot);
    });

    DOM.cmDotsWrap.appendChild(fragment);
  }

  function updateIndicators() {
    const totalQuestions = state.flatQuestions.length;
    const currentQuestionNumber = totalQuestions ? state.currentFlatIndex + 1 : 0;
    if (DOM.qNumEl) {
      DOM.qNumEl.textContent = `${currentQuestionNumber}/${totalQuestions}`;
    }

    const totalBlocks = state.blocks.length || 0;
    const currentBlockNumber = totalQuestions ? state.currentBlockIndex + 1 : 0;
    if (DOM.blockNumEl) {
      DOM.blockNumEl.textContent = `${currentBlockNumber}/${totalBlocks}`;
    }
  }

  function updateNavButtons() {
    if (DOM.prevBtn) {
      DOM.prevBtn.disabled = state.currentFlatIndex <= 0;
    }
    if (DOM.nextBtn) {
      DOM.nextBtn.disabled = state.flatQuestions.length === 0;
    }
  }

  function renderExamView() {
    renderQuestion();
    renderDots();
    updateIndicators();
    updateNavButtons();
  }

  function applyAnswerStateStyles() {
    if (!DOM.cmContent) return;
    const entry = getCurrentEntry();
    if (!entry) return;

    const key = String(entry.question?.id ?? '');
    const answerState = state.answers.get(key);
    const rows = Array.from(DOM.cmContent.querySelectorAll('.cm-answer'));
    if (!rows.length) return;

    if (!answerState) {
      rows.forEach((row) => {
        row.style.pointerEvents = '';
        const bullet = row.querySelector('.bullet');
        if (bullet) {
          bullet.style.background = '';
          bullet.style.borderColor = '';
        }
      });
      return;
    }

    rows.forEach((row) => {
      row.style.pointerEvents = 'none';
      const bullet = row.querySelector('.bullet');
      if (!bullet) return;
      bullet.style.background = '';
      bullet.style.borderColor = '';
      if (row.dataset.answerId === String(answerState.chosenAnswerId || '')) {
        const color = answerState.correct ? '#16a34a' : '#dc2626';
        bullet.style.background = color;
        bullet.style.borderColor = color;
      }
    });
  }

  async function selectAnswer(answerId) {
    if (!state.examStarted) return;
    const entry = getCurrentEntry();
    if (!entry) return;
    const key = String(entry.question?.id ?? '');
    if (!key || state.answers.has(key)) return;

    state.answers.set(key, { chosenAnswerId: String(answerId || ''), correct: false });
    applyAnswerStateStyles();
    renderDots();

    try {
      const response = await apiAnswer(entry.question.id, Number(answerId));
      const isCorrect = !!response?.correct;
      state.answers.set(key, { chosenAnswerId: String(answerId || ''), correct: isCorrect });
    } catch {
      const fallbackCorrect = String(entry.question?.correctAnswerId || '') === String(answerId || '');
      state.answers.set(key, { chosenAnswerId: String(answerId || ''), correct: fallbackCorrect });
    }

    applyAnswerStateStyles();
    renderDots();
  }

  function areAllQuestionsAnsweredInBlock(blockIndex) {
    const questions = state.selectedByBlock[blockIndex] || [];
    return questions.every((question) => {
      const key = String(question?.id ?? '');
      return !!state.answers.get(key);
    });
  }

  function gotoQuestionIndex(index) {
    if (index < 0 || index >= state.flatQuestions.length) return;
    const target = state.flatQuestions[index];
    if (!target) return;

    if (target.blockIndex !== state.currentBlockIndex && !areAllQuestionsAnsweredInBlock(state.currentBlockIndex)) {
      showAnswerAllDialog(target.blockIndex, index);
      return;
    }

    setCurrentFlatIndex(index);
  }

  function gotoPrevQuestion() {
    gotoQuestionIndex(state.currentFlatIndex - 1);
  }

  function gotoNextQuestion() {
    if (state.currentFlatIndex < state.flatQuestions.length - 1) {
      gotoQuestionIndex(state.currentFlatIndex + 1);
      return;
    }
    if (allQuestionsAnswered()) {
      showResults();
    }
  }

  function allQuestionsAnswered() {
    return state.flatQuestions.length > 0 && state.flatQuestions.every(({ question }) => {
      const key = String(question?.id ?? '');
      return !!state.answers.get(key);
    });
  }

  function showAnswerAllDialog(nextBlockIndex, nextFlatIndex) {
    if (!DOM.answerAllOverlay || !DOM.answerAllDialog) return;
    state.pendingBlockTransition = { nextBlockIndex, nextFlatIndex };
    show(DOM.answerAllOverlay);
    setHidden(DOM.answerAllDialog, false);
    ensureFullscreen();
    setTimeout(() => DOM.answerAllClose?.focus(), 150);
  }

  function hideAnswerAllDialog() {
    hide(DOM.answerAllOverlay);
    setHidden(DOM.answerAllDialog, true);
    state.pendingBlockTransition = null;
    setTimeout(() => ensureFullscreen(), 50);
  }

  function showResults() {
    try {
      stopCountdown();
      void apiFinish();
      if (!DOM.resultsOverlay || !DOM.examResults || !DOM.resultsList) return;

      DOM.resultsList.innerHTML = '';
      state.selectedByBlock.forEach((questions, blockIndex) => {
        const items = questions || [];
        if (!items.length) return;
        let correctCount = 0;
        items.forEach((question) => {
          const key = String(question?.id ?? '');
          if (state.answers.get(key)?.correct) correctCount += 1;
        });
        const total = items.length || 1;
        const percent = Math.round((correctCount / total) * 100);

        const row = document.createElement('div');
        row.className = 'result-row';

        const label = document.createElement('div');
        label.className = 'result-label';
        label.textContent = `ბლოკი ${blockIndex + 1}`;

        const value = document.createElement('div');
        const colorClass = percent < 70 ? 'pct-red' : (percent <= 75 ? 'pct-yellow' : 'pct-green');
        value.className = `result-value ${colorClass}`;
        value.textContent = `${percent}%`;

        row.append(label, value);
        DOM.resultsList.appendChild(row);
      });

      show(DOM.resultsOverlay);
      setHidden(DOM.examResults, false);
    } catch {}
  }

  function hideResults() {
    hide(DOM.resultsOverlay);
    setHidden(DOM.examResults, true);
  }

  function readDurationMinutes() {
    try {
      const value = Number(localStorage.getItem(EXAM_DURATION_KEY) || 0);
      return value > 0 ? value : 60;
    } catch {
      return 60;
    }
  }

  function formatHMS(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  function updateCountdownView() {
    if (DOM.countdownEl) {
      DOM.countdownEl.textContent = formatHMS(remainingMs);
    }
  }

  function stopCountdown() {
    if (timers.countdown) {
      clearInterval(timers.countdown);
      timers.countdown = null;
    }
  }

  function startCountdown() {
    stopCountdown();
    if (state.serverEndsAtMs) {
      remainingMs = Math.max(0, state.serverEndsAtMs - Date.now());
    } else {
      remainingMs = readDurationMinutes() * 60 * 1000;
    }
    updateCountdownView();
    timers.countdown = setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs <= 0) {
        remainingMs = 0;
        updateCountdownView();
        stopCountdown();
        showResults();
        return;
      }
      updateCountdownView();
    }, 1000);
  }

  function hydrateFromLocalStorage() {
    const blocks = loadBlocks();
    const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
    const selected = normalizedBlocks.map((block) => {
      const questions = Array.isArray(block?.questions) ? block.questions : [];
      const picks = pickPerBlock(block);
      return picks.map((index) => questions[index]).filter(Boolean);
    });
    hydrateSelectedQuestions(normalizedBlocks, selected, { resetPosition: true, resetAnswersFlag: true });
    renderExamView();
    return state.flatQuestions.length > 0;
  }

  async function initExamData() {
    if (!state.sessionId || !state.sessionToken) {
      if (!state.flatQuestions.length) {
        hydrateFromLocalStorage();
      }
      return;
    }

    try {
      const config = await apiGetConfig(EXAM_ID);
      state.blocks = Array.isArray(config?.blocks) ? config.blocks : [];
    } catch (err) {
      console.error('Failed to load exam config:', err);
      state.blocks = [];
    }

    if (!Array.isArray(state.blocks) || !state.blocks.length) {
      if (!state.flatQuestions.length) {
        hydrateFromLocalStorage();
      }
      return;
    }

    state.selectedByBlock = Array.from({ length: state.blocks.length }, () => []);

    try {
      const first = await apiGetBlockQuestions(state.blocks[0].id);
      state.selectedByBlock[0] = Array.isArray(first?.questions) ? first.questions : [];
    } catch (err) {
      console.error('Failed to load first block questions', err);
      if (!state.flatQuestions.length) {
        hydrateFromLocalStorage();
      }
      return;
    }

    if (!Array.isArray(state.selectedByBlock[0]) || !state.selectedByBlock[0].length) {
      if (!state.flatQuestions.length) {
        hydrateFromLocalStorage();
      }
      return;
    }

    resetAnswers();
    rebuildFlat({ resetPosition: true });
    renderExamView();

    const restPromises = state.blocks.slice(1).map((block, index) =>
      apiGetBlockQuestions(block.id)
        .then((payload) => ({
          index: index + 1,
          questions: Array.isArray(payload?.questions) ? payload.questions : [],
        }))
        .catch((err) => {
          console.error('Failed to load block', block.id, err);
          return { index: index + 1, questions: [] };
        })
    );

    const rest = await Promise.all(restPromises);
    rest.forEach(({ index, questions }) => {
      state.selectedByBlock[index] = questions;
    });

    rebuildFlat({ resetPosition: false });
    renderDots();
    updateNavButtons();
    updateIndicators();
  }

  function handleGateSubmit(event) {
    event.preventDefault();
    const value = (DOM.gateInput?.value || '').trim();
    const expected = readAdminPassword();
    if (value !== expected) {
      setHidden(DOM.gateError, false);
      DOM.gateInput?.focus();
      return;
    }
    setHidden(DOM.gateError, true);
    state.gatePassed = true;
    state.mustStayFullscreen = true;
    hide(DOM.gateOverlay);
    enterFullscreen();
    if (DOM.examStart) DOM.examStart.disabled = false;
    void beginSession();
  }

  function activateExamUi() {
    state.examStarted = true;
    if (DOM.examStart) DOM.examStart.disabled = true;
    if (DOM.examFinish) DOM.examFinish.disabled = false;
    hide(DOM.prestartOverlay);
  }

  function handleExamStart() {
    if (state.examStarted) return;

    if (!state.sessionId || !state.sessionToken) {
      if (!state.gatePassed) {
        show(DOM.gateOverlay);
        DOM.gateInput?.focus();
        return;
      }
      activateExamUi();
      hydrateFromLocalStorage();
      startCountdown();
      void initExamData();
      void beginSession();
      return;
    }

    activateExamUi();
    hydrateFromLocalStorage();
    startCountdown();
    void initExamData();
  }

  function handleAnswerClick(event) {
    const row = event.target?.closest?.('.cm-answer');
    if (!row || !DOM.cmContent?.contains(row)) return;
    const answerId = row.dataset.answerId || event.target?.getAttribute?.('data-answer-id');
    if (!answerId) return;
    selectAnswer(answerId).catch(() => {});
  }

  function handleDotClick(event) {
    const dot = event.target?.closest?.('.cm-dot');
    if (!dot || !DOM.cmDotsWrap?.contains(dot)) return;
    const key = dot.dataset.questionId;
    if (!key) return;
    const index = state.flatIndexByQuestionId.get(key);
    if (typeof index === 'number') {
      gotoQuestionIndex(index);
    }
  }

  function handleGlobalKey(event) {
    if (event.key === 'F4' && event.altKey) {
      event.preventDefault();
      showStep1();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      showStep1();
      return;
    }
    ensureFullscreen();
  }

  function handleFullscreenChange() {
    if (document.fullscreenElement || !state.mustStayFullscreen) return;

    if (DOM.answerAllDialog && !DOM.answerAllDialog.hidden) {
      requestAnimationFrame(() => {
        if (state.mustStayFullscreen && !document.fullscreenElement) {
          enterFullscreen();
        }
      });
      return;
    }

    showStep1();
    enterFullscreen();
  }

  function wireUI() {
    DOM.gateForm?.addEventListener('submit', handleGateSubmit);
    DOM.gateClose?.addEventListener('click', safeNavigateHome);
    DOM.gateInput?.addEventListener('input', () => setHidden(DOM.gateError, true));

    DOM.examStart?.addEventListener('click', handleExamStart);
    DOM.examFinish?.addEventListener('click', showStep1);

    DOM.confirmLeaveNo?.addEventListener('click', hideAll);
    DOM.confirmLeaveYes?.addEventListener('click', showStep2);
    DOM.returnToExam?.addEventListener('click', hideAll);
    DOM.agreeExit?.addEventListener('click', () => {
      exitFullscreen();
      safeNavigateHome();
    });

    DOM.resultsClose?.addEventListener('click', () => {
      hideResults();
      exitFullscreen();
      safeNavigateHome();
    });

    DOM.answerAllClose?.addEventListener('click', hideAnswerAllDialog);

    DOM.prevBtn?.addEventListener('click', gotoPrevQuestion);
    DOM.nextBtn?.addEventListener('click', gotoNextQuestion);

    DOM.cmContent?.addEventListener('click', handleAnswerClick);
    DOM.cmDotsWrap?.addEventListener('click', handleDotClick);

    if (DOM.prestartOverlay) {
      show(DOM.prestartOverlay);
    }
  }

  function wireGlobalGuards() {
    document.addEventListener('keydown', handleGlobalKey);
    document.addEventListener('click', () => ensureFullscreen(), { capture: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  }

  function initializeCountdownDisplay() {
    remainingMs = state.serverEndsAtMs
      ? Math.max(0, state.serverEndsAtMs - Date.now())
      : readDurationMinutes() * 60 * 1000;
    updateCountdownView();
  }

  function initialize() {
    hideAll();
    focusTrap.enable();
    updateUserHeader();
    updateRightDateTime();
    setInterval(updateRightDateTime, 30 * 1000);
    initializeCountdownDisplay();
    if (DOM.gateInput) DOM.gateInput.focus();
  }

  function preventZooming() {
    document.addEventListener('wheel', (event) => {
      if (event.ctrlKey) event.preventDefault();
    }, { passive: false });

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '-' || event.key === '=')) {
        event.preventDefault();
      }
    }, { passive: false });
  }

  wireUI();
  wireGlobalGuards();
  initialize();
});
