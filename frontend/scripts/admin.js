document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = 'http://127.0.0.1:8000';
  const KEYS = {
    AUTH: 'authLoggedIn',
    SAVED_EMAIL: 'savedEmail',
    CURRENT_USER: 'currentUser',
    EXAM_DURATION: 'examDuration',
    ADMIN_PWD: 'adminGatePassword',
    BLOCKS: 'examBlocks_v1',
    ADMIN_API_KEY: 'adminApiKey',
  };
  const FOUNDER_EMAIL = 'naormala@gmail.com';

  const DOM = {
    body: document.body,
    burger: document.querySelector('.burger'),
    overlay: document.querySelector('.overlay'),
    drawerClose: document.querySelector('.drawer-close'),
    loginBtn: document.querySelector('.login-btn'),
    drawerLoginBtn: document.querySelector('.drawer-login'),
    drawerLinks: Array.from(document.querySelectorAll('.drawer-nav a')),
    navLinks: Array.from(document.querySelectorAll('.nav a, .drawer-nav a')),
    sections: {
      exam: document.getElementById('exam-settings'),
      registrations: document.getElementById('registrations-section'),
    },
    durationInput: document.getElementById('examDuration'),
    saveDurationBtn: document.getElementById('saveExamDuration'),
    durationFlash: document.getElementById('durationFlash'),
    gatePwdInput: document.getElementById('adminGatePassword'),
    gatePwdSaveBtn: document.getElementById('saveAdminGatePassword'),
    adminApiKeyInput: document.getElementById('adminApiKey'),
    adminApiKeySaveBtn: document.getElementById('saveAdminApiKey'),
    blocksGrid: document.querySelector('.exam-blocks-grid'),
    blocksCount: document.getElementById('adminBlocksCount'),
    questionsCount: document.getElementById('adminQuestionsCount'),
    usersGrid: document.getElementById('usersGrid'),
    usersSearch: document.getElementById('usersSearch'),
    usersSort: document.getElementById('usersSort'),
    onlyAdmins: document.getElementById('onlyAdmins'),
    candidateResultsOverlay: document.getElementById('candidateResultsOverlay'),
    candidateResultsList: document.getElementById('candidateResultsList'),
    candidateResultsFullName: document.getElementById('candidateResultsFullName'),
    candidateResultsCode: document.getElementById('candidateResultsCode'),
    candidateResultsPersonalId: document.getElementById('candidateResultsPersonalId'),
    candidateResultsClose: document.getElementById('candidateResultsClose'),
    resultDetailOverlay: document.getElementById('resultDetailOverlay'),
    resultDetailTitle: document.getElementById('resultDetailTitle'),
    resultDetailExamTitle: document.getElementById('resultDetailExamTitle'),
    resultDetailStatus: document.getElementById('resultDetailStatus'),
    resultDetailCandidate: document.getElementById('resultDetailCandidate'),
    resultDetailPersonalId: document.getElementById('resultDetailPersonalId'),
    resultDetailCode: document.getElementById('resultDetailCode'),
    resultDetailStartedAt: document.getElementById('resultDetailStartedAt'),
    resultDetailFinishedAt: document.getElementById('resultDetailFinishedAt'),
    resultDetailDuration: document.getElementById('resultDetailDuration'),
    resultDetailScore: document.getElementById('resultDetailScore'),
    resultBlockStats: document.getElementById('resultBlockStats'),
    resultDetailSummary: document.getElementById('resultDetailSummary'),
    resultQuestionTable: document.getElementById('resultQuestionTable'),
    resultDetailDownload: document.getElementById('resultDetailDownload'),
    resultDetailClose: document.getElementById('resultDetailClose'),
    resultDetailDangerZone: document.getElementById('resultDetailDangerZone'),
    resultDetailDelete: document.getElementById('resultDetailDelete'),
  };

  const NAV_TARGETS = {
    'გამოცდა': 'exam',
    'რეგისტრაციები': 'registrations',
    'რეგისტრირებული პირები': 'registrations',
  };

  const on = (element, event, handler) => element && element.addEventListener(event, handler);

  const activeOverlays = new Set();

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return window.btoa(binary);
  }

  function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
        } else {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', (error) => reject(error), { once: true });
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.dynamicSrc = src;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', (error) => reject(error), { once: true });
      document.head.appendChild(script);
    });
  }

  function openOverlay(element) {
    if (!element) return;
    activeOverlays.add(element);
    element.classList.add('open');
    element.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeOverlay(element) {
    if (!element) return;
    activeOverlays.delete(element);
    element.classList.remove('open');
    element.setAttribute('aria-hidden', 'true');
    if (!activeOverlays.size) {
      document.body.classList.remove('modal-open');
    }
  }

  ensureAdminAccess();

  const examSettings = createExamSettingsModule();
  const blocksModule = createBlocksModule();
  const resultsModule = createResultsModule();
  const usersModule = createUsersModule({ onShowResults: resultsModule.open });

  wireNavigation({ users: usersModule });

  examSettings.init();
  blocksModule.init();
  resultsModule.init();
  usersModule.init();

  showSection(null);

  function showSection(name) {
    const activeName = typeof name === 'string' ? name : null;
    Object.entries(DOM.sections).forEach(([key, el]) => {
      if (!el) return;
      el.style.display = activeName && key === activeName ? 'block' : 'none';
    });

    DOM.navLinks.forEach((link) => {
      const label = (link.textContent || '').trim();
      const target = NAV_TARGETS[label];
      const isActive = !!activeName && target === activeName;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(KEYS.CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function ensureAdminAccess() {
    const loggedIn = localStorage.getItem(KEYS.AUTH) === 'true';
    const savedEmail = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').toLowerCase();
    const isLocalAdmin = !!getCurrentUser()?.isAdmin;
    if (!loggedIn || !(savedEmail === FOUNDER_EMAIL.toLowerCase() || isLocalAdmin)) {
      alert('ადმინისტრატორის გვერდზე დაშვება აქვს მხოლოდ ადმინს');
      window.location.href = 'index.html';
    }
  }

  function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'success') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' error' : ''}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = String(message || '');
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  function formatDateTime(iso) {
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return String(iso || '');
      const pad = (value) => String(value).padStart(2, '0');
      return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch {
      return String(iso || '');
    }
  }

  function formatDuration(startIso, endIso) {
    if (!startIso || !endIso) return '—';
    try {
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return '—';
      const diffMs = end.getTime() - start.getTime();
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const parts = [];
      if (hours) parts.push(`${hours}სთ`);
      if (minutes || hours) parts.push(`${minutes}წთ`);
      parts.push(`${seconds}წმ`);
      return parts.join(' ');
    } catch (err) {
      console.warn('Failed to format duration', err);
      return '—';
    }
  }

  async function handleAdminErrorResponse(response, fallbackMessage) {
    if (!response) {
      showToast(fallbackMessage, 'error');
      return;
    }
    let status = response.status;
    if (response.status === 401) {
      showToast('ადმინის კოდი არასწორია ან არ არის მითითებული', 'error');
      if (DOM.adminApiKeyInput) {
        DOM.adminApiKeyInput.classList.add('input-error');
        try { DOM.adminApiKeyInput.focus(); } catch {}
        setTimeout(() => DOM.adminApiKeyInput?.classList.remove('input-error'), 1600);
      }
      console.error('Admin API auth error', status);
      return;
    }
    let detail = '';
    try {
      const clone = response.clone();
      const data = await clone.json();
      detail = data?.detail || data?.message || '';
    } catch {
      try {
        const text = await response.clone().text();
        detail = (text || '').trim();
      } catch {}
    }
    console.error('Admin API error', status, detail || fallbackMessage);
    showToast(detail || fallbackMessage, 'error');
  }

  function isFounderActor() {
    return (localStorage.getItem(KEYS.SAVED_EMAIL) || '').toLowerCase() === FOUNDER_EMAIL.toLowerCase();
  }

  function getAdminHeaders() {
    const key = localStorage.getItem(KEYS.ADMIN_API_KEY);
    return key ? { 'x-admin-key': key } : {};
  }

  function getActorHeaders() {
    const actor = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim();
    return actor ? { 'x-actor-email': actor } : {};
  }

  function wireNavigation(modules) {
    const { users } = modules;
    const setMenu = (open) => {
      DOM.body?.classList.toggle('menu-open', open);
      if (DOM.burger) DOM.burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    const closeMenu = () => setMenu(false);
    const openMenu = () => setMenu(true);
    const toggleMenu = () => setMenu(!DOM.body?.classList.contains('menu-open'));

    on(DOM.burger, 'click', toggleMenu);
    on(DOM.overlay, 'click', closeMenu);
    on(DOM.drawerClose, 'click', closeMenu);
    DOM.drawerLinks.forEach((link) => on(link, 'click', closeMenu));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    const goHome = () => { window.location.href = 'index.html'; };
    on(DOM.loginBtn, 'click', goHome);
    on(DOM.drawerLoginBtn, 'click', goHome);

    DOM.navLinks.forEach((link) => {
      on(link, 'click', (event) => {
        const label = (link.textContent || '').trim();
        const targetSection = NAV_TARGETS[label];
        if (!targetSection) return;
        event.preventDefault();
        closeMenu();
        showSection(targetSection);
        if (targetSection === 'registrations') {
          users.render();
        }
      });
    });
  }

  function createExamSettingsModule() {
    const state = {
      gatePwdTimer: null,
      settings: null,
    };

    function populateFields(settings) {
      if (!settings) return;
      if (DOM.durationInput) {
        const value = Number(settings.durationMinutes || 0);
        DOM.durationInput.value = value ? String(value) : '';
      }
      if (DOM.gatePwdInput) DOM.gatePwdInput.value = settings.gatePassword || '';
      populateAdminKeyField();
    }

    function populateAdminKeyField() {
      if (!DOM.adminApiKeyInput) return;
      const stored = localStorage.getItem(KEYS.ADMIN_API_KEY) || '';
      DOM.adminApiKeyInput.value = stored;
    }

    async function fetchSettings() {
      const response = await fetch(`${API_BASE}/admin/exam/settings`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) throw new Error('failed');
      return await response.json();
    }

    async function persistSettings(patch = {}, { notifyDuration = false, notifyPassword = false } = {}) {
      const current = state.settings || {};
      const payload = {
        examId: patch.examId ?? current.examId ?? 1,
        title: patch.title ?? current.title ?? '',
        durationMinutes: patch.durationMinutes ?? current.durationMinutes ?? 60,
        gatePassword: patch.gatePassword ?? current.gatePassword ?? '',
      };
      try {
        const response = await fetch(`${API_BASE}/admin/exam/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders(), ...getActorHeaders() },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('failed');
        const data = await response.json();
        state.settings = data;
        populateFields(state.settings);
        if (notifyDuration && DOM.durationFlash) {
          const value = Number(state.settings.durationMinutes || 0);
          DOM.durationFlash.textContent = `ხანგრძლივობა შეიცვალა: ${value} წუთი`;
          DOM.durationFlash.style.display = 'block';
          setTimeout(() => {
            if (DOM.durationFlash) DOM.durationFlash.style.display = 'none';
          }, 3000);
        }
        if (notifyPassword) {
          showToast('ადმინისტრატორის პაროლი შენახულია');
        }
      } catch (err) {
        console.error('Failed to save settings', err);
        showToast('პარამეტრების შენახვა ვერ მოხერხდა', 'error');
      }
    }

    async function loadSettings() {
      try {
        state.settings = await fetchSettings();
      } catch (err) {
        console.error('Failed to load exam settings', err);
        showToast('პარამეტრების ჩატვირთვა ვერ მოხერხდა', 'error');
        state.settings = { examId: 1, title: '', durationMinutes: 60, gatePassword: '' };
      }
      populateFields(state.settings);
    }

    function saveDuration() {
      const value = Number(DOM.durationInput?.value || 0);
      if (!value || value < 1) {
        alert('გთხოვთ შეიყვანოთ სწორი დრო (მინიმუმ 1 წუთი)');
        return;
      }
      void persistSettings({ durationMinutes: value }, { notifyDuration: true });
    }

    function saveGatePassword() {
      const value = String(DOM.gatePwdInput?.value || '').trim();
      if (!value) {
        showToast('გთხოვთ შეიყვანოთ პაროლი', 'error');
        return;
      }
      void persistSettings({ gatePassword: value }, { notifyPassword: true });
    }

    function saveAdminApiKey() {
      const value = String(DOM.adminApiKeyInput?.value || '').trim();
      if (!value) {
        showToast('გთხოვთ მიუთითოთ ადმინის კოდი', 'error');
        if (DOM.adminApiKeyInput) DOM.adminApiKeyInput.classList.add('input-error');
        setTimeout(() => DOM.adminApiKeyInput?.classList.remove('input-error'), 1600);
        return;
      }
      try {
        localStorage.setItem(KEYS.ADMIN_API_KEY, value);
      } catch (err) {
        console.error('Failed to store admin api key', err);
        showToast('კოდის შენახვა ვერ მოხერხდა', 'error');
        return;
      }
      showToast('ადმინის კოდი შენახულია');
      void loadSettings();
      try { blocksModule?.reload?.(); } catch {}
    }

    function handleGatePwdKeydown(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      saveGatePassword();
    }

    function handleGatePwdInput() {
      clearTimeout(state.gatePwdTimer);
      state.gatePwdTimer = setTimeout(() => {
        const value = String(DOM.gatePwdInput?.value || '').trim();
        if (!value) return;
        void persistSettings({ gatePassword: value });
      }, 600);
    }

    function init() {
      void loadSettings();
      on(DOM.saveDurationBtn, 'click', saveDuration);
      on(DOM.gatePwdSaveBtn, 'click', saveGatePassword);
      on(DOM.gatePwdInput, 'keydown', handleGatePwdKeydown);
      on(DOM.gatePwdInput, 'input', handleGatePwdInput);
      populateAdminKeyField();
      on(DOM.adminApiKeySaveBtn, 'click', saveAdminApiKey);
      on(DOM.adminApiKeyInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveAdminApiKey();
        }
      });
      on(DOM.adminApiKeyInput, 'input', () => DOM.adminApiKeyInput?.classList.remove('input-error'));
    }

    return { init };
  }

  function createBlocksModule() {
    const state = { data: [], examId: 1, saveTimer: null, pendingNotify: false };

    const generateId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const createDefaultAnswers = () => Array.from({ length: 4 }, () => ({ id: generateId(), text: '' }));
    const generateQuestionCode = () => String(Math.floor(10000 + Math.random() * 90000));

    async function fetchBlocksFromServer() {
      const response = await fetch(`${API_BASE}/admin/exam/blocks`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) {
        await handleAdminErrorResponse(response, 'ბლოკების ჩატვირთვა ვერ მოხერხდა');
        throw new Error('handled');
      }
      return await response.json();
    }

    function migrate(data) {
      return (Array.isArray(data) ? data : []).map((block, blockIndex) => {
        if (!block || typeof block !== 'object') return block;
        const blockId = block?.id != null ? String(block.id) : generateId();
        const questions = Array.isArray(block.questions) ? block.questions : [];
        const migratedQuestions = questions.map((question, questionIndex) => {
          if (!question || typeof question !== 'object') {
            return {
              id: generateId(),
              text: String(question || ''),
              answers: createDefaultAnswers(),
              correctAnswerId: null,
              code: generateQuestionCode(),
            };
          }
          let answers = Array.isArray(question.answers) ? question.answers : [];
          answers = answers.map((answer) => {
            if (!answer || typeof answer !== 'object') {
              return { id: generateId(), text: String(answer || '') };
            }
            return {
              ...answer,
              id: answer.id != null ? String(answer.id) : generateId(),
              text: String(answer.text || ''),
            };
          });
          while (answers.length < 4) answers.push({ id: generateId(), text: '' });
          if (answers.length > 4) answers = answers.slice(0, 4);
          const fallback = answers[0] ? answers[0].id : null;
          let correctId = question.correctAnswerId != null ? String(question.correctAnswerId) : fallback;
          if (!answers.some((answer) => answer.id === correctId)) {
            correctId = fallback;
          }
          return {
            ...question,
            id: question.id != null ? String(question.id) : generateId(),
            text: String(question.text || ''),
            answers,
            correctAnswerId: correctId,
            code: question.code ? String(question.code) : generateQuestionCode(),
            enabled: typeof question.enabled === 'boolean' ? question.enabled : true,
          };
        });
        return {
          ...block,
          id: blockId,
          number: Number(block.number) || blockIndex + 1,
          qty: Number(block.qty) || 0,
          name: String(block.name || block.title || `ბლოკი ${blockIndex + 1}`),
          enabled: typeof block.enabled === 'boolean' ? block.enabled : true,
          questions: migratedQuestions,
        };
      });
    }

    function save(options = {}) {
      state.pendingNotify = state.pendingNotify || !!options.notify;
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => {
        state.saveTimer = null;
        void persistBlocks();
      }, 400);
    }

    async function persistBlocks() {
      const payload = {
        examId: state.examId || 1,
        blocks: state.data,
      };
      try {
        const response = await fetch(`${API_BASE}/admin/exam/blocks`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders(), ...getActorHeaders() },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          await handleAdminErrorResponse(response, 'ბლოკების შენახვა ვერ მოხერხდა');
          return;
        }
        const data = await response.json();
        state.examId = data.examId || state.examId || 1;
        state.data = migrate(data.blocks);
        render();
        updateStats();
        if (state.pendingNotify) showToast('ბლოკები შენახულია');
      } catch (err) {
        console.error('Failed to save blocks', err);
        showToast('ბლოკების შენახვა ვერ მოხერხდა', 'error');
      } finally {
        state.pendingNotify = false;
      }
    }

    async function loadInitialBlocks() {
      if (DOM.blocksGrid) {
        DOM.blocksGrid.innerHTML = '<div class="blocks-loading">იტვირთება...</div>';
      }
      try {
        const payload = await fetchBlocksFromServer();
        state.examId = payload.examId || state.examId || 1;
        state.data = migrate(payload.blocks);
      } catch (err) {
        console.error('Failed to load blocks', err);
        if ((err?.message || '') !== 'handled') {
        showToast('ბლოკების ჩატვირთვა ვერ მოხერხდა', 'error');
        state.data = migrate([]);
        }
      }
      render();
      updateStats();
    }

    function nextNumber() {
      if (!state.data.length) return 1;
      const max = Math.max(...state.data.map((block) => Number(block.number) || 0));
      return (Number.isFinite(max) ? max : 0) + 1;
    }

    function updateStats() {
      if (!DOM.blocksCount || !DOM.questionsCount) return;
      const blocksCount = state.data.length;
      const questionsCount = state.data.reduce((sum, block) => {
        const available = Array.isArray(block?.questions) ? block.questions.length : 0;
        const qty = Math.max(0, Number(block?.qty) || 0);
        return sum + Math.min(qty, available);
      }, 0);
      DOM.blocksCount.textContent = String(blocksCount);
      DOM.questionsCount.textContent = String(questionsCount);
    }

    function setCardOpen(card, open) {
      if (!card) return;
      card.classList.toggle('open', !!open);
      const questions = card.querySelector('.block-questions');
      const toggle = card.querySelector('.head-toggle');
      if (questions) {
        questions.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
      if (!open) {
        const textareas = card.querySelectorAll('.q-text, .a-text');
        textareas.forEach((textarea) => {
          try { textarea.style.height = ''; } catch {}
        });
      }
      if (toggle) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = open ? '▴' : '▾';
      }
    }

    function setQuestionOpen(questionCard, open) {
      if (!questionCard) return;
      questionCard.classList.toggle('open', !!open);
      const details = questionCard.querySelector('.q-details');
      const toggle = questionCard.querySelector('.q-toggle');
      if (details) {
        details.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
      if (!open) {
        const textareas = questionCard.querySelectorAll('.q-text, .a-text');
        textareas.forEach((textarea) => {
          try { textarea.style.height = ''; } catch {}
        });
      }
      if (toggle) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = open ? '▴' : '▾';
      }
    }

    function closeAllOpenQuestions(except) {
      const opened = DOM.blocksGrid?.querySelectorAll?.('.question-card.open') || [];
      opened.forEach((card) => {
        if (!except || card !== except) setQuestionOpen(card, false);
      });
    }

    function render() {
      if (!DOM.blocksGrid) return;
      const previouslyOpenBlocks = Array.from(DOM.blocksGrid.querySelectorAll('.block-card.open'))
        .map((card) => card.dataset.blockId)
        .filter(Boolean);
      const previouslyOpenQuestions = Array.from(DOM.blocksGrid.querySelectorAll('.question-card.open'))
        .map((card) => card.dataset.questionId)
        .filter(Boolean);

      DOM.blocksGrid.innerHTML = '';

      state.data.forEach((block, index) => {
        const card = document.createElement('div');
        card.className = 'block-tile block-card';
        card.dataset.blockId = block.id;
        const questions = Array.isArray(block.questions) ? block.questions : [];
        const atTop = index === 0;
        const atBottom = index === state.data.length - 1;
        card.innerHTML = `
          <div class="block-head">
            <div class="block-order">
              <button class="i-btn up" ${atTop ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
              <button class="i-btn down" ${atBottom ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
            </div>
            <span class="head-label">ბლოკი</span>
            <input class="head-number" type="number" inputmode="numeric" min="1" step="1" value="${block.number ?? ''}" aria-label="ბლოკის ნომერი" />
            <input class="head-name" type="text" placeholder="ბლოკის სახელი" value="${(block.name || '').replace(/"/g, '&quot;')}" aria-label="ბლოკის სახელი" />
            <span class="head-qty-label">რაოდენობა</span>
            <input class="head-qty" type="number" inputmode="numeric" min="0" step="1" value="${typeof block.qty === 'number' ? block.qty : ''}" aria-label="რაოდენობა" />
            <button class="head-delete" type="button" aria-label="ბლოკის წაშლა" title="წაშლა">×</button>
            <button class="head-toggle" type="button" aria-expanded="false">▾</button>
            <span class="head-count" title="კითხვების რაოდენობა">${questions.length}</span>
          </div>
          <div class="block-questions" aria-hidden="true">
            <div class="questions-list">
              ${questions.map((question, qIndex, arr) => `
                <div class="question-card" data-question-id="${question.id}">
                  <div class="q-head">
                    <div class="q-order">
                      <button class="i-btn q-up" ${qIndex === 0 ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
                      <button class="i-btn q-down" ${qIndex === arr.length - 1 ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
                    </div>
                    <textarea class="q-text" placeholder="კითხვა" rows="3" aria-label="კითხვა">${String(question.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    <div class="q-actions">
                      <div class="q-actions-row">
                        <button class="q-delete" type="button" aria-label="კითხვის წაშლა" title="წაშლა">×</button>
                        <button class="q-toggle" type="button" aria-expanded="false">▾</button>
                      </div>
                      <span class="q-code" aria-label="კითხვა კოდი">${question.code}</span>
                    </div>
                  </div>
                  <div class="q-details" aria-hidden="true">
                    <div class="q-answers">
                      ${(Array.isArray(question.answers) ? question.answers : []).map((answer, aIndex, answersArr) => `
                        <div class="answer-row" data-answer-id="${answer.id}">
                          <div class="a-order">
                            <button class="i-btn a-up" ${aIndex === 0 ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
                            <button class="i-btn a-down" ${aIndex === answersArr.length - 1 ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
                          </div>
                          <textarea class="a-text" rows="2" placeholder="პასუხი ${aIndex + 1}" aria-label="პასუხი ${aIndex + 1}">${String(answer.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                          <label class="a-correct-wrap" title="სწორი პასუხი">
                            <input class="a-correct" type="radio" name="correct-${question.id}" ${question.correctAnswerId === answer.id ? 'checked' : ''} />
                            <span>სწორია</span>
                          </label>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            <button class="block-tile add-tile q-add-tile" type="button" aria-label="კითხვის დამატება">
              <span class="add-icon" aria-hidden="true">+</span>
              <span class="add-text">კითხვის დამატება</span>
            </button>
          </div>
        `;
        DOM.blocksGrid.appendChild(card);
        if (previouslyOpenBlocks.includes(block.id)) setCardOpen(card, true);
        card.querySelectorAll('.question-card').forEach((questionCard) => {
          if (previouslyOpenQuestions.includes(questionCard.dataset.questionId)) {
            setQuestionOpen(questionCard, true);
          }
        });
      });

      const addTile = document.createElement('button');
      addTile.type = 'button';
      addTile.id = 'addBlockTile';
      addTile.className = 'block-tile add-tile';
      addTile.setAttribute('aria-label', 'ბლოკის დამატება');
      addTile.innerHTML = '<span class="add-icon" aria-hidden="true">+</span><span class="add-text">ბლოკის დამატება</span>';
      DOM.blocksGrid.appendChild(addTile);

      updateStats();
    }

    function addBlock() {
      const id = generateId();
      state.data.push({ id, number: nextNumber(), name: '', qty: 0, questions: [] });
      save();
      render();
      const card = DOM.blocksGrid?.querySelector?.(`.block-card[data-block-id="${id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function handleGridClick(event) {
      const target = event.target;
      if (!target) return;

      if (target.closest?.('#addBlockTile')) {
        addBlock();
        return;
      }

      const card = target.closest?.('.block-card');
      if (!card) return;
      const blockId = card.dataset.blockId;
      const blockIndex = state.data.findIndex((block) => block.id === blockId);
      if (blockIndex === -1) return;
      const block = state.data[blockIndex];
      block.questions = Array.isArray(block.questions) ? block.questions : [];

      if (target.classList.contains('up')) {
        if (blockIndex > 0) {
          [state.data[blockIndex - 1], state.data[blockIndex]] = [state.data[blockIndex], state.data[blockIndex - 1]];
          save();
          render();
        }
        return;
      }

      if (target.classList.contains('down')) {
        if (blockIndex < state.data.length - 1) {
          [state.data[blockIndex + 1], state.data[blockIndex]] = [state.data[blockIndex], state.data[blockIndex + 1]];
          save();
          render();
        }
        return;
      }

      if (target.classList.contains('head-delete')) {
        const confirmDelete = window.confirm('ნამდვილად გსურთ ბლოკის წაშლა? ბლოკის ყველა კითხვა წაიშლება.');
        if (!confirmDelete) return;
        state.data.splice(blockIndex, 1);
        save();
        render();
        return;
      }

      const toggleBtn = target.closest?.('.head-toggle');
      if (toggleBtn) {
        const isOpen = card.classList.contains('open');
        if (!isOpen) closeAllOpenQuestions();
        setCardOpen(card, !isOpen);
        return;
      }

      const head = target.closest?.('.block-head');
      if (head && !target.closest('button') && target.tagName !== 'INPUT') {
        const isOpen = card.classList.contains('open');
        setCardOpen(card, !isOpen);
        return;
      }

      if (target.closest?.('.q-add-tile')) {
        const questionId = generateId();
        block.questions.push({ id: questionId, text: '', answers: createDefaultAnswers(), correctAnswerId: null, code: generateQuestionCode() });
        save();
        render();
        const updatedCard = DOM.blocksGrid?.querySelector?.(`.block-card[data-block-id="${blockId}"]`);
        if (updatedCard) setCardOpen(updatedCard, true);
        return;
      }

      if (target.classList.contains('q-delete')) {
        const questionEl = target.closest?.('.question-card');
        const questionId = questionEl?.dataset.questionId;
        if (!questionId) return;
        const confirmDelete = window.confirm('ნამდვილად გსურთ ამ კითხვის წაშლა? ქმედება შეუქცევადია.');
        if (!confirmDelete) return;
        const questionIndex = block.questions.findIndex((question) => question.id === questionId);
        if (questionIndex !== -1) {
          block.questions.splice(questionIndex, 1);
          save();
          render();
        }
        return;
      }

      const questionCard = target.closest?.('.question-card');
      if (questionCard) {
        const questionId = questionCard.dataset.questionId;
        const questionIndex = block.questions.findIndex((question) => question.id === questionId);
        if (questionIndex === -1) return;
        const answers = Array.isArray(block.questions[questionIndex].answers) ? block.questions[questionIndex].answers : [];

        const answerRow = target.closest?.('.answer-row');
        if (answerRow) {
          const answerId = answerRow.dataset.answerId;
          const answerIndex = answers.findIndex((answer) => answer.id === answerId);
          if (answerIndex !== -1) {
            if (target.closest?.('.a-up')) {
              if (answerIndex > 0) {
                [answers[answerIndex - 1], answers[answerIndex]] = [answers[answerIndex], answers[answerIndex - 1]];
                block.questions[questionIndex].answers = answers;
                save();
                render();
              }
              return;
            }
            if (target.closest?.('.a-down')) {
              if (answerIndex < answers.length - 1) {
                [answers[answerIndex + 1], answers[answerIndex]] = [answers[answerIndex], answers[answerIndex + 1]];
                block.questions[questionIndex].answers = answers;
                save();
                render();
              }
              return;
            }
            if (target.classList.contains('a-correct') || target.closest?.('.a-correct')) {
              block.questions[questionIndex].correctAnswerId = answerId;
              save();
              render();
              return;
            }
          }
        }

        if (target.closest?.('.q-up')) {
          if (questionIndex > 0) {
            [block.questions[questionIndex - 1], block.questions[questionIndex]] = [block.questions[questionIndex], block.questions[questionIndex - 1]];
            save();
            render();
          }
          return;
        }

        if (target.closest?.('.q-down')) {
          if (questionIndex < block.questions.length - 1) {
            [block.questions[questionIndex + 1], block.questions[questionIndex]] = [block.questions[questionIndex], block.questions[questionIndex + 1]];
            save();
            render();
          }
          return;
        }

        if (target.closest?.('.q-toggle')) {
          const isOpen = questionCard.classList.contains('open');
          if (!isOpen) closeAllOpenQuestions(questionCard);
          setQuestionOpen(questionCard, !isOpen);
          return;
        }

        const questionHead = target.closest?.('.q-head');
        if (questionHead && !target.closest('button') && target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
          const isOpen = questionCard.classList.contains('open');
          if (!isOpen) {
            closeAllOpenQuestions(questionCard);
            setQuestionOpen(questionCard, true);
          }
          return;
        }
      }

      const inQuestions = !!target.closest?.('.block-questions');
      const onInteractive = !!target.closest?.('button, input, select, textarea, a, label');
      if (!inQuestions && !onInteractive) {
        const isOpen = card.classList.contains('open');
        if (!isOpen) closeAllOpenQuestions();
        setCardOpen(card, !isOpen);
      }
    }

    function handleGridKeydown(event) {
      if (event.key !== 'Enter') return;
      const target = event.target;
      if (!target) return;
      const card = target.closest?.('.block-card');
      if (!card) return;
      const blockId = card.dataset.blockId;
      const blockIndex = state.data.findIndex((block) => block.id === blockId);
      if (blockIndex === -1) return;
      const block = state.data[blockIndex];
      block.questions = Array.isArray(block.questions) ? block.questions : [];

      if (target.classList.contains('head-number')) {
        const value = parseInt(String(target.value || '').trim(), 10);
        if (!Number.isNaN(value) && value > 0) {
          block.number = value;
          save();
          render();
        }
        return;
      }

      if (target.classList.contains('head-name')) {
        block.name = String(target.value || '').trim();
        save();
        render();
        return;
      }

      if (target.classList.contains('head-qty')) {
        const value = parseInt(String(target.value || '').trim(), 10);
        block.qty = (!Number.isNaN(value) && value >= 0) ? value : 0;
        save();
        render();
      }
    }

    function handleGridFocusout(event) {
      const target = event.target;
      if (!target) return;
      const card = target.closest?.('.block-card');
      if (!card) return;
      const blockId = card.dataset.blockId;
      const blockIndex = state.data.findIndex((block) => block.id === blockId);
      if (blockIndex === -1) return;
      const block = state.data[blockIndex];
      block.questions = Array.isArray(block.questions) ? block.questions : [];

      if (target.classList.contains('head-number')) {
        const value = parseInt(String(target.value || '').trim(), 10);
        if (!Number.isNaN(value) && value > 0) {
          block.number = value;
          save();
          render();
        }
        return;
      }

      if (target.classList.contains('head-name')) {
        block.name = String(target.value || '').trim();
        save();
        return;
      }

      if (target.classList.contains('head-qty')) {
        const value = parseInt(String(target.value || '').trim(), 10);
        block.qty = (!Number.isNaN(value) && value >= 0) ? value : 0;
        save();
        updateStats();
        return;
      }

      if (target.classList.contains('q-text')) {
        const questionCard = target.closest?.('.question-card');
        const questionId = questionCard?.dataset.questionId;
        if (!questionId) return;
        const questionIndex = block.questions.findIndex((question) => question.id === questionId);
        if (questionIndex === -1) return;
        block.questions[questionIndex].text = String(target.value || '').trim();
        save();
        return;
      }

      if (target.classList.contains('a-text')) {
        const questionCard = target.closest?.('.question-card');
        const questionId = questionCard?.dataset.questionId;
        const answerRow = target.closest?.('.answer-row');
        const answerId = answerRow?.dataset.answerId;
        if (!questionId || !answerId) return;
        const questionIndex = block.questions.findIndex((question) => question.id === questionId);
        if (questionIndex === -1) return;
        const answers = Array.isArray(block.questions[questionIndex].answers) ? block.questions[questionIndex].answers : [];
        const answerIndex = answers.findIndex((answer) => answer.id === answerId);
        if (answerIndex === -1) return;
        answers[answerIndex] = { ...answers[answerIndex], text: String(target.value || '').trim() };
        block.questions[questionIndex].answers = answers;
        save();
      }
    }

    function init() {
      void loadInitialBlocks();
      on(DOM.blocksGrid, 'click', handleGridClick);
      on(DOM.blocksGrid, 'keydown', handleGridKeydown);
      on(DOM.blocksGrid, 'focusout', handleGridFocusout);
    }

    return {
      init,
      render: () => render(),
      reload: () => void loadInitialBlocks(),
    };
  }

  function createResultsModule() {
    const state = {
      currentUser: null,
      results: [],
      detail: null,
      loading: false,
      detailLoading: false,
    };

    const STATUS_MAP = {
      completed: { label: 'დასრულებულია', tag: 'success' },
      aborted: { label: 'შეწყვეტილია', tag: 'error' },
      in_progress: { label: 'მიმდინარე', tag: 'neutral' },
    };

    function statusMeta(status) {
      return STATUS_MAP[status] || { label: 'უცნობია', tag: 'neutral' };
    }

    function answerStatusMeta(answer) {
      if (!answer || answer.selected_option_id == null) {
        return { label: 'არ არის პასუხი', tag: 'neutral' };
      }
      return answer.is_correct ? { label: 'სწორია', tag: 'success' } : { label: 'არასწორია', tag: 'error' };
    }

    function setCandidateHeader(user) {
      const first = (user?.first_name || user?.firstName || '').trim();
      const last = (user?.last_name || user?.lastName || '').trim();
      if (DOM.candidateResultsFullName) {
        const fullName = `${first} ${last}`.trim() || 'უცნობი კანდიდატი';
        DOM.candidateResultsFullName.textContent = fullName;
      }
      if (DOM.candidateResultsCode) {
        DOM.candidateResultsCode.textContent = user?.code ? `კოდი: ${user.code}` : '';
      }
      if (DOM.candidateResultsPersonalId) {
        DOM.candidateResultsPersonalId.textContent = user?.personal_id ? `პირადი №: ${user.personal_id}` : '';
      }
    }

    function renderResultsList() {
      if (!DOM.candidateResultsList) return;
      if (state.loading) {
        DOM.candidateResultsList.innerHTML = '<div class="empty-state">იტვირთება...</div>';
        return;
      }
      if (!state.results.length) {
        DOM.candidateResultsList.innerHTML = '<div class="empty-state">შედეგები არ მოიძებნა</div>';
        return;
      }
      const fragment = document.createDocumentFragment();
      state.results.forEach((item) => {
        const card = createAttemptCard(item);
        if (card) fragment.appendChild(card);
      });
      DOM.candidateResultsList.innerHTML = '';
      DOM.candidateResultsList.appendChild(fragment);
    }

    function createAttemptCard(item) {
      if (!item) return null;
      const card = document.createElement('div');
      card.className = 'attempt-card';
      card.setAttribute('role', 'listitem');
      const status = statusMeta(item.status);
      const startedAt = formatDateTime(item.started_at);
      const finishedAt = item.finished_at ? formatDateTime(item.finished_at) : 'არ დასრულებულა';
      const score = typeof item.score_percent === 'number' ? Number(item.score_percent).toFixed(1) : '0.0';

      card.innerHTML = `
        <div class="attempt-info">
          <div class="attempt-date">დაწყება: <strong>${startedAt}</strong></div>
          <div class="attempt-status">
            <span class="result-tag ${status.tag}">${status.label}</span>
            <span>${score}%</span>
          </div>
          <div class="attempt-meta">დასრულება: ${finishedAt}</div>
        </div>
        <div class="attempt-actions">
          <button type="button" class="secondary-btn" data-action="view">შედეგის ნახვა</button>
          ${isFounderActor() ? '<button type="button" class="danger-btn" data-action="delete">წაშლა</button>' : ''}
        </div>
      `;

      const viewBtn = card.querySelector('[data-action="view"]');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => handleView(item.session_id));
      }
      const deleteBtn = card.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDelete(item.session_id));
      }
      return card;
    }

    async function loadResults(user) {
      state.loading = true;
      renderResultsList();
      try {
        const params = new URLSearchParams();
        if (user?.code) params.set('candidate_code', user.code);
        if (user?.personal_id) params.set('personal_id', user.personal_id);
        const response = await fetch(`${API_BASE}/admin/results?${params.toString()}`, {
          headers: { ...getAdminHeaders(), ...getActorHeaders() },
        });
        if (!response.ok) throw new Error('failed');
        const data = await response.json();
        state.results = Array.isArray(data?.items) ? data.items : [];
      } catch (err) {
        console.error('Failed to load candidate results', err);
        state.results = [];
        showToast('შედეგების ჩატვირთვა ვერ მოხერხდა', 'error');
      } finally {
        state.loading = false;
        renderResultsList();
      }
    }

    async function fetchResultDetail(sessionId) {
      const response = await fetch(`${API_BASE}/admin/results/${sessionId}`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) throw new Error('failed');
      return await response.json();
    }

    function renderDetailLoading() {
      if (DOM.resultDetailExamTitle) DOM.resultDetailExamTitle.textContent = 'იტვირთება...';
      if (DOM.resultDetailStatus) DOM.resultDetailStatus.innerHTML = '';
      if (DOM.resultDetailCandidate) DOM.resultDetailCandidate.textContent = '';
      if (DOM.resultDetailPersonalId) DOM.resultDetailPersonalId.textContent = '';
      if (DOM.resultDetailCode) DOM.resultDetailCode.textContent = '';
      if (DOM.resultDetailStartedAt) DOM.resultDetailStartedAt.textContent = '';
      if (DOM.resultDetailFinishedAt) DOM.resultDetailFinishedAt.textContent = '';
      if (DOM.resultDetailDuration) DOM.resultDetailDuration.textContent = '';
      if (DOM.resultDetailScore) DOM.resultDetailScore.textContent = '';
      if (DOM.resultDetailSummary) DOM.resultDetailSummary.textContent = '';
      if (DOM.resultBlockStats) DOM.resultBlockStats.innerHTML = '';
      const tbody = DOM.resultQuestionTable?.querySelector('tbody');
      if (tbody) tbody.innerHTML = '';
    }

    function renderDetail(detail) {
      if (!detail) return;
      const session = detail.session || {};
      const status = statusMeta(session.status);

      if (DOM.resultDetailExamTitle) {
        DOM.resultDetailExamTitle.textContent = detail.exam_title || 'გამოცდა';
      }
      if (DOM.resultDetailStatus) {
        DOM.resultDetailStatus.innerHTML = `<span class="result-tag ${status.tag}">${status.label}</span>`;
      }
      const candidateName = `${(session.candidate_first_name || '').trim()} ${(session.candidate_last_name || '').trim()}`.trim();
      if (DOM.resultDetailCandidate) DOM.resultDetailCandidate.textContent = candidateName || 'უცნობი';
      if (DOM.resultDetailPersonalId) DOM.resultDetailPersonalId.textContent = session.personal_id || '—';
      if (DOM.resultDetailCode) DOM.resultDetailCode.textContent = session.candidate_code || '—';
      if (DOM.resultDetailStartedAt) DOM.resultDetailStartedAt.textContent = formatDateTime(session.started_at);
      const finishedAtText = session.finished_at ? formatDateTime(session.finished_at) : 'არ დასრულებულა';
      if (DOM.resultDetailFinishedAt) DOM.resultDetailFinishedAt.textContent = finishedAtText;
      const durationBase = session.finished_at || session.ends_at;
      if (DOM.resultDetailDuration) DOM.resultDetailDuration.textContent = formatDuration(session.started_at, durationBase);
      if (DOM.resultDetailScore) {
        const score = typeof session.score_percent === 'number' ? Number(session.score_percent).toFixed(2) : '0.00';
        DOM.resultDetailScore.textContent = `${score}%`;
      }
      if (DOM.resultDetailSummary) {
        DOM.resultDetailSummary.textContent = `სულ: ${detail.total_questions} • პასუხი: ${detail.answered_questions} • სწორია: ${detail.correct_answers}`;
      }

      if (DOM.resultBlockStats) {
        const fragment = document.createDocumentFragment();
        (detail.block_stats || []).forEach((stat) => {
          if (!stat) return;
          const card = document.createElement('div');
          card.className = 'block-card-stat';
          const title = stat.block_title || `ბლოკი ${stat.block_id}`;
          card.innerHTML = `
            <div class="block-name">${title}</div>
            <div class="block-progress">
              <span>${stat.correct}/${stat.total}</span>
              <span>${Number(stat.percent || 0).toFixed(2)}%</span>
            </div>
          `;
          fragment.appendChild(card);
        });
        DOM.resultBlockStats.innerHTML = '';
        DOM.resultBlockStats.appendChild(fragment);
      }

      const tbody = DOM.resultQuestionTable?.querySelector('tbody');
      if (tbody) {
        tbody.innerHTML = '';
        (detail.answers || []).forEach((answer, index) => {
          if (!answer) return;
          const statusData = answerStatusMeta(answer);
          const row = document.createElement('tr');

          const codeCell = document.createElement('td');
          codeCell.textContent = answer.question_code || '';

          const blockCell = document.createElement('td');
          blockCell.textContent = answer.block_title || '';

          const questionCell = document.createElement('td');
          questionCell.textContent = answer.question_text || '';

          const selectedCell = document.createElement('td');
          selectedCell.textContent = answer.selected_option_text || '—';

          const correctCell = document.createElement('td');
          correctCell.textContent = answer.correct_option_text || '—';

          const statusCell = document.createElement('td');
          const statusTag = document.createElement('span');
          statusTag.className = `result-tag ${statusData.tag}`;
          statusTag.textContent = statusData.label;
          statusCell.appendChild(statusTag);

          const timeCell = document.createElement('td');
          timeCell.textContent = answer.answered_at ? formatDateTime(answer.answered_at) : '—';

          row.append(codeCell, blockCell, questionCell, selectedCell, correctCell, statusCell, timeCell);
          tbody.appendChild(row);
        });
      }

      if (DOM.resultDetailDangerZone) {
        DOM.resultDetailDangerZone.classList.toggle('hidden', !isFounderActor());
      }
      if (DOM.resultDetailDelete) {
        DOM.resultDetailDelete.disabled = !isFounderActor();
        DOM.resultDetailDelete.dataset.sessionId = String(session.session_id || session.id || '');
      }
    }

    function closeDetail() {
      closeOverlay(DOM.resultDetailOverlay);
      state.detail = null;
    }

    async function handleView(sessionId) {
      if (!sessionId) return;
      state.detailLoading = true;
      renderDetailLoading();
      openOverlay(DOM.resultDetailOverlay);
      try {
        const detail = await fetchResultDetail(sessionId);
        state.detail = detail;
        renderDetail(detail);
      } catch (err) {
        console.error('Failed to load result detail', err);
        showToast('დეტალური შედეგი ვერ ჩაიტვირთა', 'error');
        closeDetail();
      } finally {
        state.detailLoading = false;
      }
    }

    async function deleteResult(sessionId) {
      const response = await fetch(`${API_BASE}/admin/results/${sessionId}`, {
        method: 'DELETE',
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) throw new Error('failed');
    }

    async function handleDelete(sessionId) {
      if (!sessionId || !isFounderActor()) return;
      const confirmed = window.confirm('ნამდვილად გსურთ შედეგის წაშლა? ქმედება შეუქცევადია.');
      if (!confirmed) return;
      try {
        await deleteResult(sessionId);
        state.results = state.results.filter((item) => item.session_id !== sessionId);
        renderResultsList();
        if (state.detail?.session?.session_id === sessionId) {
          closeDetail();
        }
        showToast('შედეგი წაიშალა');
      } catch (err) {
        console.error('Failed to delete result', err);
        showToast('შედეგის წაშლა ვერ მოხერხდა', 'error');
      }
    }

    let jsPdfLoader = null;
    let fontLoader = null;

    async function ensurePdfFont(doc) {
      const fontName = 'DejaVuSansUnicode';
      const hasFont = doc.getFontList?.()?.[fontName];
      if (hasFont) {
        doc.setFont(fontName, 'normal');
        return fontName;
      }

      if (!fontLoader) {
        const fontUrl = new URL('../assets/fonts/dejavu-sans.ttf', window.location.href).toString();
        fontLoader = fetch(fontUrl)
          .then((response) => {
            if (!response.ok) throw new Error('Font download failed');
            return response.arrayBuffer();
          })
          .then((buffer) => arrayBufferToBase64(buffer))
          .catch((error) => {
            fontLoader = null;
            throw error;
          });
      }

      const base64 = await fontLoader;
      doc.addFileToVFS('DejaVuSans.ttf', base64);
      doc.addFont('DejaVuSans.ttf', fontName, 'normal');
      doc.addFont('DejaVuSans.ttf', fontName, 'bold');
      doc.addFont('DejaVuSans.ttf', fontName, 'italic');
      doc.addFont('DejaVuSans.ttf', fontName, 'bolditalic');
      doc.setFont(fontName, 'normal');
      return fontName;
    }

    async function ensureJsPdf() {
      if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
      if (!jsPdfLoader) {
        const CDN_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jsPdfLoader = loadExternalScript(CDN_SRC).catch((error) => {
          jsPdfLoader = null;
          throw error;
        });
      }
      await jsPdfLoader;
      if (!window.jspdf?.jsPDF) {
        throw new Error('jsPDF unavailable after loading');
      }
      return window.jspdf.jsPDF;
    }

    async function downloadCurrentPdf() {
      if (!state.detail) return;
      await downloadPdf(state.detail);
    }

    async function downloadPdf(detail) {
      try {
        const jsPDF = await ensureJsPdf();
        const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
        const fontName = await ensurePdfFont(doc);
        const margin = 48;
        const pageWidth = doc.internal.pageSize.getWidth();
        const usableWidth = pageWidth - margin * 2;
        const pageHeight = doc.internal.pageSize.getHeight();
        const lineHeight = 16;
        let cursorY = margin;

        const session = detail.session || {};
        const status = statusMeta(session.status);
        const durationBase = session.finished_at || session.ends_at;

        doc.setFont(fontName, 'bold');
        doc.setFontSize(18);
        doc.text('გამოცდის შედეგი', margin, cursorY);
        cursorY += lineHeight * 1.5;

        doc.setFontSize(12);
        doc.setFont(fontName, 'normal');

        const infoLines = [
          `კანდიდატი: ${(session.candidate_first_name || '')} ${(session.candidate_last_name || '')}`.trim(),
          `პირადი №: ${session.personal_id || '—'}`,
          `კოდი: ${session.candidate_code || '—'}`,
          `გამოცდა: ${detail.exam_title || '—'}`,
          `სტატუსი: ${status.label}`,
          `დაწყება: ${formatDateTime(session.started_at)}`,
          `დასრულება: ${session.finished_at ? formatDateTime(session.finished_at) : 'არ დასრულებულა'}`,
          `ხანგრძლივობა: ${formatDuration(session.started_at, durationBase)}`,
          `საერთო ქულა: ${typeof session.score_percent === 'number' ? Number(session.score_percent).toFixed(2) : '0.00'}%`,
          `კითხვები: სულ ${detail.total_questions}, პასუხი ${detail.answered_questions}, სწორია ${detail.correct_answers}`,
        ];

        const splitAndWrite = (text) => {
          const lines = doc.splitTextToSize(text, usableWidth);
          lines.forEach((line) => {
            if (cursorY > pageHeight - margin) {
              doc.addPage();
              cursorY = margin;
            }
            doc.text(line, margin, cursorY);
            cursorY += lineHeight;
          });
        };

        infoLines.forEach((line) => splitAndWrite(line));
        cursorY += lineHeight / 2;

        if (detail.block_stats?.length) {
          if (cursorY > pageHeight - margin - lineHeight) {
            doc.addPage();
            cursorY = margin;
          }
          doc.setFont(fontName, 'bold');
          doc.text('ბლოკების შედეგები', margin, cursorY);
          cursorY += lineHeight;
          doc.setFont(fontName, 'normal');
          detail.block_stats.forEach((stat) => {
            const title = stat.block_title || `ბლოკი ${stat.block_id}`;
            splitAndWrite(`${title}: ${stat.correct}/${stat.total} (${Number(stat.percent || 0).toFixed(2)}%)`);
          });
          cursorY += lineHeight / 2;
        }

        if (detail.answers?.length) {
          if (cursorY > pageHeight - margin - lineHeight) {
            doc.addPage();
            cursorY = margin;
          }
          doc.setFont(fontName, 'bold');
          doc.text('კითხვების დეტალური შედეგები', margin, cursorY);
          cursorY += lineHeight;
          doc.setFont(fontName, 'normal');
          detail.answers.forEach((answer, index) => {
            const statusData = answerStatusMeta(answer);
            const header = `${index + 1}. ${answer.question_code || ''} — ${answer.block_title || ''}`.trim();
            splitAndWrite(header);
            if (answer.question_text) splitAndWrite(`კითხვა: ${answer.question_text}`);
            splitAndWrite(`არჩეული: ${answer.selected_option_text || 'არ არის პასუხი'}`);
            splitAndWrite(`სწორი: ${answer.correct_option_text || '—'}`);
            splitAndWrite(`სტატუსი: ${statusData.label}`);
            splitAndWrite(`დრო: ${answer.answered_at ? formatDateTime(answer.answered_at) : '—'}`);
            cursorY += lineHeight / 2;
          });
        }

        const code = session.candidate_code ? session.candidate_code.replace(/\s+/g, '_') : 'result';
        const filename = `result_${code}_${session.session_id || ''}.pdf`;
        doc.save(filename);
      } catch (err) {
        console.error('PDF export failed', err);
        showToast('PDF ფაილის შექმნა ვერ მოხერხდა', 'error');
      }
    }

    function open(user) {
      state.currentUser = user || null;
      state.results = [];
      state.detail = null;
      setCandidateHeader(user);
      renderResultsList();
      openOverlay(DOM.candidateResultsOverlay);
      void loadResults(user || {});
    }

    function closeList() {
      closeDetail();
      closeOverlay(DOM.candidateResultsOverlay);
      state.currentUser = null;
      state.results = [];
      renderResultsList();
    }

    function init() {
      on(DOM.candidateResultsClose, 'click', closeList);
      DOM.candidateResultsOverlay?.addEventListener('click', (event) => {
        if (event.target === DOM.candidateResultsOverlay) closeList();
      });
      on(DOM.resultDetailClose, 'click', () => closeDetail());
      DOM.resultDetailOverlay?.addEventListener('click', (event) => {
        if (event.target === DOM.resultDetailOverlay) closeDetail();
      });
      on(DOM.resultDetailDownload, 'click', () => {
        void downloadCurrentPdf();
      });
      on(DOM.resultDetailDelete, 'click', () => {
        const sessionId = state.detail?.session?.session_id;
        if (sessionId) void handleDelete(sessionId);
      });
    }

    return {
      open,
      close: closeList,
      init,
    };
  }

  function createUsersModule(deps = {}) {
    const { onShowResults } = deps;
    async function fetchUsers() {
      if (!DOM.usersGrid) return { items: [] };
      const params = new URLSearchParams();
      const search = String(DOM.usersSearch?.value || '').trim();
      if (search) params.set('search', search);
      if (DOM.onlyAdmins?.checked) params.set('only_admins', 'true');
      params.set('sort', DOM.usersSort?.value || 'date_desc');
      const response = await fetch(`${API_BASE}/admin/users?${params.toString()}`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) throw new Error('users failed');
      return await response.json();
    }

    function userRowHTML(user) {
      const fullName = `${(user.first_name || '').trim()} ${(user.last_name || '').trim()}`.trim() || '(უსახელო)';
      const founderRow = !!user.is_founder;
      const checked = founderRow ? 'checked' : (user.is_admin ? 'checked' : '');
      const disabled = founderRow ? 'disabled' : (isFounderActor() ? '' : 'disabled');
      return `
        <div class="block-tile block-card" data-id="${user.id}">
        <div class="block-head" style="grid-template-columns:auto 1fr auto auto auto;">
            <div class="block-order"></div>
            <div style="font-size:16px;font-weight:700;color:#0f172a;">${fullName}</div>
            <label title="${founderRow ? 'მუდმივი ადმინი' : 'ადმინი'}" style="display:inline-flex;gap:4px;align-items:center;padding:4px 8px;border-radius:6px;border:2px solid #e5e7eb;background:#fff;user-select:none;">
              <input type="checkbox" class="chk-admin" ${checked} ${disabled} style="width:16px;height:16px;accent-color:#9500FF;" />
              <span style="font-size:12px;color:#0f172a;font-weight:600;">ადმინი</span>
            </label>
            <button class="head-delete" type="button" aria-label="წაშლა" title="წაშლა" ${founderRow || !isFounderActor() ? 'disabled' : ''}>×</button>
            <button class="head-toggle" type="button" aria-expanded="false">▾</button>
          </div>
          <div class="block-questions" aria-hidden="true">
            <div class="questions-list">
              <div class="question-card open">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:12px;">
                  <div>
                    <div style="font-weight:700;color:#065f46;margin-bottom:8px;">კონტაქტი</div>
                    <div style="color:#525252;font-size:13px;line-height:1.8;">
                      <div>პირადი №: <strong>${user.personal_id}</strong></div>
                      <div>ტელეფონი: <strong>${user.phone}</strong></div>
                      <div>კოდი: <strong style="color:#6d28d9;">${user.code || ''}</strong></div>
                      <div>მაილი: <strong style="color:#065f46;">${user.email || ''}</strong></div>
                      <div>რეგისტრაცია: <strong>${formatDateTime(user.created_at)}</strong></div>
                    </div>
                  </div>
                  <div>
                    <div style="font-weight:700;color:#065f46;margin-bottom:8px;">ქმედებები</div>
                    <div class="user-action-buttons" style="margin-top:12px;display:flex;flex-direction:column;gap:6px;width:100%;">
                      <button class="btn-user-announcements" type="button" style="width:100%;padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;">განცხადებები</button>
                      <button class="btn-user-results" type="button" style="width:100%;padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;">გამოცდის შედეგები</button>
                      <button class="btn-user-certificate" type="button" style="width:100%;padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;">სერტიფიკატი</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    function mountUserCard(card, user) {
      const toggle = card.querySelector('.head-toggle');
      toggle?.addEventListener('click', () => {
        const isOpen = card.classList.contains('open');
        card.classList.toggle('open', !isOpen);
        card.querySelector('.block-questions')?.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      });

      const checkbox = card.querySelector('.chk-admin');
      if (checkbox) {
        checkbox.addEventListener('change', async (event) => {
          const id = card.dataset.id;
          const desired = !!event.target.checked;
          if (!confirm('დარწმუნებული ხართ, რომ შეცვალოთ ადმინის სტატუსი?')) {
            event.target.checked = !desired;
            return;
          }
          try {
            const response = await fetch(`${API_BASE}/admin/users/${id}/admin`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...getAdminHeaders(), ...getActorHeaders() },
              body: JSON.stringify({ is_admin: desired }),
            });
            if (!response.ok) throw new Error('failed');
          } catch {
            event.target.checked = !desired;
            alert('ვერ შეინახა სტატუსი');
          }
        });
      }

      const deleteBtn = card.querySelector('.head-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const id = card.dataset.id;
          if (!confirm('დარწმუნებული ხართ, რომ წაშალოთ ჩანაწერი?')) return;
          try {
            const response = await fetch(`${API_BASE}/admin/users/${id}`, {
              method: 'DELETE',
              headers: { ...getAdminHeaders(), ...getActorHeaders() },
            });
            if (!response.ok) throw new Error('failed');
            card.remove();
          } catch {
            alert('წაშლა ვერ შესრულდა');
          }
        });
      }

      const announcementsBtn = card.querySelector('.btn-user-announcements');
      const actionsWrap = card.querySelector('.user-action-buttons');
      if (actionsWrap && !actionsWrap.querySelector('.btn-user-results')) {
        const resultsFallbackBtn = document.createElement('button');
        resultsFallbackBtn.className = 'btn-user-results';
        resultsFallbackBtn.type = 'button';
        resultsFallbackBtn.textContent = 'გამოცდის შედეგები';
        resultsFallbackBtn.style.cssText = 'width:100%;padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;';
        actionsWrap.appendChild(resultsFallbackBtn);
      }
      if (actionsWrap && !actionsWrap.querySelector('.btn-user-certificate')) {
        const certFallbackBtn = document.createElement('button');
        certFallbackBtn.className = 'btn-user-certificate';
        certFallbackBtn.type = 'button';
        certFallbackBtn.textContent = 'სერტიფიკატი';
        certFallbackBtn.style.cssText = 'width:100%;padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;';
        actionsWrap.appendChild(certFallbackBtn);
      }
      const resultsBtns = card.querySelectorAll('.btn-user-results');
      const certificateBtns = card.querySelectorAll('.btn-user-certificate');
      announcementsBtn?.addEventListener('click', () => alert('განცხადებები — მალე დაემატება'));
      resultsBtns?.forEach((btn) => btn.addEventListener('click', () => {
        if (typeof onShowResults === 'function') {
          onShowResults(user);
        } else {
          alert('გამოცდის შედეგები — მალე დაემატება');
        }
      }));
      certificateBtns?.forEach((btn) => btn.addEventListener('click', () => alert('სერტიფიკატი — მალე დაემატება')));
    }

    function drawUsers(items) {
      if (!DOM.usersGrid) return;
      DOM.usersGrid.innerHTML = '';
      (items || []).forEach((user) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = userRowHTML(user);
        const card = wrapper.firstElementChild;
        if (card) {
          mountUserCard(card, user);
          DOM.usersGrid.appendChild(card);
        }
      });
    }

    async function render() {
      if (!DOM.usersGrid) return;
      DOM.usersGrid.innerHTML = '<div class="block-tile">იტვირთება...</div>';
      try {
        const data = await fetchUsers();
        drawUsers(data.items || []);
      } catch {
        DOM.usersGrid.innerHTML = '<div class="block-tile">ჩატვირთვის შეცდომა</div>';
      }
    }

    function init() {
      on(DOM.usersSearch, 'input', render);
      on(DOM.usersSort, 'change', render);
      on(DOM.onlyAdmins, 'change', render);
    }

    return {
      init,
      render: () => render(),
    };
  }
});
