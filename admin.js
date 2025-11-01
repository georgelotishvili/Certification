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
    blocksGrid: document.querySelector('.exam-blocks-grid'),
    blocksCount: document.getElementById('adminBlocksCount'),
    questionsCount: document.getElementById('adminQuestionsCount'),
    usersGrid: document.getElementById('usersGrid'),
    usersSearch: document.getElementById('usersSearch'),
    usersSort: document.getElementById('usersSort'),
    onlyAdmins: document.getElementById('onlyAdmins'),
  };

  const NAV_TARGETS = {
    'გამოცდა': 'exam',
    'რეგისტრაციები': 'registrations',
    'რეგისტრირებული პირები': 'registrations',
  };

  const on = (element, event, handler) => element && element.addEventListener(event, handler);

  ensureAdminAccess();

  const examSettings = createExamSettingsModule();
  const blocksModule = createBlocksModule();
  const usersModule = createUsersModule();

  wireNavigation({ users: usersModule });

  examSettings.init();
  blocksModule.init();
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
      resultsBtns?.forEach((btn) => btn.addEventListener('click', () => alert('გამოცდის შედეგები — მალე დაემატება')));
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
