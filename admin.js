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
      results: document.getElementById('results-section'),
      registrations: document.getElementById('registrations-section'),
    },
    durationInput: document.getElementById('examDuration'),
    saveDurationBtn: document.getElementById('saveExamDuration'),
    durationFlash: document.getElementById('durationFlash'),
    gatePwdInput: document.getElementById('adminGatePassword'),
    gatePwdSaveBtn: document.getElementById('saveAdminGatePassword'),
    blocksGrid: document.querySelector('.exam-blocks-grid'),
    blocksCount: document.getElementById('adminBlocksCount'),
    questionsCount: document.getElementById('adminQuestionsCount'),
    resultsGrid: document.getElementById('resultsGrid'),
    resultsSearch: document.getElementById('resultsSearch'),
    resultsApiKeyInput: document.getElementById('resultsApiKey'),
    saveResultsApiKeyBtn: document.getElementById('saveResultsApiKey'),
    usersGrid: document.getElementById('usersGrid'),
    usersSearch: document.getElementById('usersSearch'),
    usersSort: document.getElementById('usersSort'),
    onlyAdmins: document.getElementById('onlyAdmins'),
  };

  const on = (element, event, handler) => element && element.addEventListener(event, handler);

  ensureAdminAccess();

  const examSettings = createExamSettingsModule();
  const blocksModule = createBlocksModule();
  const resultsModule = createResultsModule();
  const usersModule = createUsersModule();

  wireNavigation({ results: resultsModule, users: usersModule });

  examSettings.init();
  blocksModule.init();
  resultsModule.init();
  usersModule.init();

  showSection('exam');

  function showSection(name) {
    Object.entries(DOM.sections).forEach(([key, el]) => {
      if (!el) return;
      el.style.display = key === name ? 'block' : 'none';
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
    const { results, users } = modules;
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

    const NAV_ACTIONS = {
      'გამოცდა': () => { showSection('exam'); },
      'შედეგები': () => { showSection('results'); results.render(); },
      'რეგისტრაციები': () => { showSection('registrations'); users.render(); },
      'რეგისტრირებული პირები': () => { showSection('registrations'); users.render(); },
    };

    DOM.navLinks.forEach((link) => {
      on(link, 'click', (event) => {
        const label = (link.textContent || '').trim();
        const action = NAV_ACTIONS[label];
        if (!action) return;
        event.preventDefault();
        closeMenu();
        action();
      });
    });
  }

  function createExamSettingsModule() {
    const state = { gatePwdTimer: null };

    function loadInitialValues() {
      try {
        const savedDuration = localStorage.getItem(KEYS.EXAM_DURATION);
        if (savedDuration && DOM.durationInput) DOM.durationInput.value = savedDuration;
      } catch {}
      try {
        const savedPwd = localStorage.getItem(KEYS.ADMIN_PWD) || '';
        if (DOM.gatePwdInput) DOM.gatePwdInput.value = savedPwd;
      } catch {}
    }

    function saveDuration() {
      const value = Number(DOM.durationInput?.value || 0);
      if (!value || value < 1) {
        alert('გთხოვთ შეიყვანოთ სწორი დრო (მინიმუმ 1 წუთი)');
        return;
      }
      try { localStorage.setItem(KEYS.EXAM_DURATION, String(value)); } catch {}
      if (DOM.durationFlash) {
        DOM.durationFlash.textContent = `ხანგრძლივობა შეიცვალა: ${value} წუთი`;
        DOM.durationFlash.style.display = 'block';
        setTimeout(() => {
          if (DOM.durationFlash) DOM.durationFlash.style.display = 'none';
        }, 3000);
      }
    }

    function saveGatePassword() {
      const value = String(DOM.gatePwdInput?.value || '').trim();
      if (!value) {
        showToast('გთხოვთ შეიყვანოთ პაროლი', 'error');
        return;
      }
      try { localStorage.setItem(KEYS.ADMIN_PWD, value); } catch {}
      showToast('ადმინისტრატორის პაროლი შენახულია');
    }

    function handleGatePwdKeydown(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      saveGatePassword();
    }

    function handleGatePwdInput() {
      clearTimeout(state.gatePwdTimer);
      const value = String(DOM.gatePwdInput?.value || '').trim();
      state.gatePwdTimer = setTimeout(() => {
        try { localStorage.setItem(KEYS.ADMIN_PWD, value); } catch {}
      }, 250);
    }

    function init() {
      loadInitialValues();
      on(DOM.saveDurationBtn, 'click', saveDuration);
      on(DOM.gatePwdSaveBtn, 'click', saveGatePassword);
      on(DOM.gatePwdInput, 'keydown', handleGatePwdKeydown);
      on(DOM.gatePwdInput, 'input', handleGatePwdInput);
    }

    return { init };
  }

  function createBlocksModule() {
    const state = { data: [] };

    const generateId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const createDefaultAnswers = () => Array.from({ length: 4 }, () => ({ id: generateId(), text: '' }));
    const generateQuestionCode = () => String(Math.floor(10000 + Math.random() * 90000));

    function load() {
      try {
        const raw = localStorage.getItem(KEYS.BLOCKS);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function migrate(data) {
      return (Array.isArray(data) ? data : []).map((block) => {
        if (!block || typeof block !== 'object') return block;
        const blockId = typeof block.id === 'string' ? block.id : generateId();
        const questions = Array.isArray(block.questions) ? block.questions : [];
        const migratedQuestions = questions.map((question) => {
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
            if (answer && typeof answer === 'object') return answer;
            return { id: generateId(), text: String(answer || '') };
          });
          while (answers.length < 4) answers.push({ id: generateId(), text: '' });
          if (answers.length > 4) answers = answers.slice(0, 4);
          return {
            ...question,
            id: typeof question.id === 'string' ? question.id : generateId(),
            answers,
            correctAnswerId: typeof question.correctAnswerId === 'string' ? question.correctAnswerId : null,
            code: typeof question.code === 'string' ? question.code : generateQuestionCode(),
          };
        });
        return {
          ...block,
          id: blockId,
          questions: migratedQuestions,
        };
      });
    }

    function save() {
      try { localStorage.setItem(KEYS.BLOCKS, JSON.stringify(state.data)); } catch {}
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
      state.data = migrate(load());
      render();
      updateStats();
      on(DOM.blocksGrid, 'click', handleGridClick);
      on(DOM.blocksGrid, 'keydown', handleGridKeydown);
      on(DOM.blocksGrid, 'focusout', handleGridFocusout);
    }

    return {
      init,
      render: () => render(),
    };
  }

  function createResultsModule() {
    const state = { items: [] };

    function loadSavedApiKey() {
      try {
        if (DOM.resultsApiKeyInput) DOM.resultsApiKeyInput.value = localStorage.getItem(KEYS.ADMIN_API_KEY) || '';
      } catch {}
    }

    function saveApiKey() {
      const value = String(DOM.resultsApiKeyInput?.value || '').trim();
      try { localStorage.setItem(KEYS.ADMIN_API_KEY, value); } catch {}
      showToast('Admin API Key შენახულია');
    }

    function groupByCandidate(items) {
      const map = new Map();
      (items || []).forEach((item) => {
        const key = `${item.candidate_first_name || ''}|${item.candidate_last_name || ''}|${item.candidate_code || ''}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            firstName: item.candidate_first_name || '',
            lastName: item.candidate_last_name || '',
            code: item.candidate_code || '',
            sessions: [],
          });
        }
        map.get(key).sessions.push(item);
      });
      return Array.from(map.values());
    }

    async function fetchResults() {
      const response = await fetch(`${API_BASE}/admin/results`, { headers: { ...getAdminHeaders() } });
      if (!response.ok) throw new Error('results failed');
      return await response.json();
    }

    function renderSessionDetails(container, payload, sessionId) {
      const session = payload?.session || {};
      const blockStats = Array.isArray(payload?.block_stats) ? payload.block_stats : [];
      const answers = Array.isArray(payload?.answers) ? payload.answers : [];
      const top = document.createElement('div');
      top.className = 'block-tile';
      top.innerHTML = `
        <div><strong>${(session.candidate_first_name || '').trim()} ${(session.candidate_last_name || '').trim()}</strong> • ${session.candidate_code || ''}</div>
        <div>${formatDateTime(session.started_at)}${session.finished_at ? ' → ' + formatDateTime(session.finished_at) : ''} • ${Math.round(Number(session.score_percent || 0))}%</div>
      `;

      const blocksDiv = document.createElement('div');
      blocksDiv.style.margin = '8px 0';
      blockStats.forEach((block) => {
        const row = document.createElement('div');
        row.className = 'result-row';
        row.innerHTML = `<div class="result-label">ბლოკი ${block.block_id}</div><div class="result-value">${block.percent}%</div>`;
        blocksDiv.appendChild(row);
      });

      const answersList = document.createElement('div');
      answersList.style.display = 'grid';
      answersList.style.gap = '6px';
      answers.forEach((answer) => {
        const item = document.createElement('div');
        item.className = 'question-card open';
        item.innerHTML = `
          <div class="q-head"><div class="q-order"></div><div class="q-actions"><span class="q-code">${answer.question_code}</span></div></div>
          <div class="q-details" aria-hidden="false">
            <div class="q-answers">${answer.question_text}</div>
            <div>${answer.option_text} • ${answer.is_correct ? 'სწორი' : 'არასწორი'}</div>
          </div>
        `;
        answersList.appendChild(item);
      });

      container.innerHTML = '';
      container.dataset.loaded = '1';
      container.appendChild(top);
      container.appendChild(blocksDiv);
      container.appendChild(answersList);
    }

    function draw(items) {
      if (!DOM.resultsGrid) return;
      DOM.resultsGrid.innerHTML = '';
      const query = String(DOM.resultsSearch?.value || '').trim().toLowerCase();
      const groups = groupByCandidate(items).filter((group) => {
        const haystack = `${group.firstName} ${group.lastName} ${group.code}`.toLowerCase();
        return !query || haystack.includes(query);
      });

      if (!groups.length) {
        DOM.resultsGrid.innerHTML = '<div class="block-tile">მონაცემები ვერ მოიძებნა</div>';
        return;
      }

      groups.forEach((group) => {
        const card = document.createElement('div');
        card.className = 'block-tile block-card';
        card.innerHTML = `
          <div class="block-head">
            <div class="block-order"></div>
            <span class="head-label">${(group.firstName || '').trim()} ${(group.lastName || '').trim()}</span>
            <input class="head-name" type="text" value="${(group.code || '').replace(/"/g, '&quot;')}" readonly aria-label="კოდი" />
            <button class="head-toggle" type="button" aria-expanded="false">▾</button>
          </div>
          <div class="block-questions" aria-hidden="true">
            <div class="questions-list"></div>
          </div>
        `;

        const list = card.querySelector('.questions-list');
        const sortedSessions = group.sessions.slice().sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
        sortedSessions.forEach((session) => {
          const row = document.createElement('div');
          row.className = 'question-card';
          row.dataset.sessionId = session.session_id;
          row.innerHTML = `
            <div class="q-head">
              <div class="q-order"></div>
              <div class="q-actions">
                <div class="q-actions-row"></div>
                <button class="q-toggle" type="button" aria-expanded="false">▾</button>
                <span class="q-code">${formatDateTime(session.started_at)}${session.finished_at ? ' → ' + formatDateTime(session.finished_at) : ''} • ${Math.round(Number(session.score_percent || 0))}%</span>
              </div>
            </div>
            <div class="q-details" aria-hidden="true"></div>
          `;
          const toggle = row.querySelector('.q-toggle');
          const details = row.querySelector('.q-details');
          toggle?.addEventListener('click', async () => {
            const isOpen = row.classList.contains('open');
            row.classList.toggle('open', !isOpen);
            details?.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
            if (!isOpen && details && !details.dataset.loaded) {
              details.innerHTML = '<div class="block-tile">იტვირთება...</div>';
              try {
                const response = await fetch(`${API_BASE}/admin/results/${session.session_id}`, { headers: { ...getAdminHeaders() } });
                const data = await response.json();
                renderSessionDetails(details, data, session.session_id);
              } catch {
                details.innerHTML = '<div class="block-tile">ჩატვირთვის შეცდომა</div>';
              }
            }
          });
          list?.appendChild(row);
        });

        const headToggle = card.querySelector('.head-toggle');
        headToggle?.addEventListener('click', () => {
          const isOpen = card.classList.contains('open');
          card.classList.toggle('open', !isOpen);
          card.querySelector('.block-questions')?.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        });

        DOM.resultsGrid.appendChild(card);
      });
    }

    async function render() {
      if (!DOM.resultsGrid) return;
      DOM.resultsGrid.innerHTML = '<div class="block-tile">იტვირთება...</div>';
      try {
        const data = await fetchResults();
        state.items = Array.isArray(data?.items) ? data.items : [];
        draw(state.items);
      } catch {
        DOM.resultsGrid.innerHTML = '<div class="block-tile">ვერ ჩაიტვირთა შედეგები</div>';
      }
    }

    function init() {
      loadSavedApiKey();
      on(DOM.saveResultsApiKeyBtn, 'click', saveApiKey);
      on(DOM.resultsSearch, 'input', () => draw(state.items));
    }

    return {
      init,
      render: () => render(),
    };
  }

  function createUsersModule() {
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
                    <div style="display:flex;flex-direction:column;gap:6px;">
                      <button class="btn-user-announcements" style="padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;" onclick="alert('განცხადებები — მალე დაემატება')">განცხადებები</button>
                      <button class="btn-user-results" style="padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;" onclick="alert('შედეგები — მალე დაემატება')">შედეგები</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    function mountUserCard(card) {
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
    }

    function drawUsers(items) {
      if (!DOM.usersGrid) return;
      DOM.usersGrid.innerHTML = '';
      (items || []).forEach((user) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = userRowHTML(user);
        const card = wrapper.firstElementChild;
        if (card) {
          mountUserCard(card);
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
