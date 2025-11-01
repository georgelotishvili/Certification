document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const burger = document.querySelector('.burger');
  const overlay = document.querySelector('.overlay');
  const drawerClose = document.querySelector('.drawer-close');
  const drawerLinks = document.querySelectorAll('.drawer-nav a');
  const loginBtn = document.querySelector('.login-btn');
  const drawerLoginBtn = document.querySelector('.drawer-login');
  
  // Admin-only access gate (client-side)
  const AUTH_KEY = 'authLoggedIn';
  const SAVED_EMAIL_KEY = 'savedEmail';
  const CURRENT_USER_KEY = 'currentUser';
  const FOUNDER_EMAIL = 'naormala@gmail.com';
  const isLoggedIn = () => localStorage.getItem(AUTH_KEY) === 'true';
  const emailLower = () => (localStorage.getItem(SAVED_EMAIL_KEY) || '').toLowerCase();
  const getCurrentUser = () => { try { const raw = localStorage.getItem(CURRENT_USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const isLocalAdmin = () => !!(getCurrentUser()?.isAdmin);
  if (!isLoggedIn() || !(emailLower() === FOUNDER_EMAIL.toLowerCase() || isLocalAdmin())) {
    alert('ადმინისტრატორის გვერდზე დაშვება აქვს მხოლოდ ადმინს');
    window.location.href = 'index.html';
    return;
  }
  
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
  const ADMIN_PWD_KEY = 'adminGatePassword';
  const gatePwdInput = document.getElementById('adminGatePassword');
  const gatePwdSave = document.getElementById('saveAdminGatePassword');
  const gatePwdFlash = document.getElementById('gatePwdFlash');

  // Simple toast helper
  const getToastContainer = () => {
    let c = document.getElementById('toastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toastContainer';
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  };
  const showToast = (message, type = 'success') => {
    const c = getToastContainer();
    const t = document.createElement('div');
    t.className = `toast${type === 'error' ? ' error' : ''}`;
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.textContent = String(message || '');
    c.appendChild(t);
    requestAnimationFrame(() => { t.classList.add('show'); });
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 220); }, 2600);
  };

  const navLinks = document.querySelectorAll('.nav a, .drawer-nav a');
  navLinks.forEach(link => {
    on(link, 'click', (e) => {
      const text = (link.textContent || '').trim();
      if (text === 'გამოცდა') {
        e.preventDefault();
        const resultsSection = document.getElementById('results-section');
        const regsSection = document.getElementById('registrations-section');
        if (examSection) examSection.style.display = 'block';
        if (resultsSection) resultsSection.style.display = 'none';
        if (regsSection) regsSection.style.display = 'none';
      }
      if (text === 'შედეგები') {
        e.preventDefault();
        const resultsSection = document.getElementById('results-section');
        const regsSection = document.getElementById('registrations-section');
        if (examSection) examSection.style.display = 'none';
        if (regsSection) regsSection.style.display = 'none';
        if (resultsSection) { resultsSection.style.display = 'block'; renderResults(); }
      }
      if (text === 'რეგისტრაციები' || text === 'რეგისტრირებული პირები') {
        e.preventDefault();
        const resultsSection = document.getElementById('results-section');
        const regsSection = document.getElementById('registrations-section');
        if (examSection) examSection.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'none';
        if (regsSection) { regsSection.style.display = 'block'; renderUsers(); }
      }
    });
  });

  // Load saved exam duration
  try {
    const saved = localStorage.getItem(EXAM_DURATION_KEY);
    if (saved && durationInput) durationInput.value = saved;
  } catch {}

  // Load saved admin gate password
  try {
    const savedPwd = localStorage.getItem(ADMIN_PWD_KEY);
    if (gatePwdInput) gatePwdInput.value = savedPwd || '';
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

  // Save admin gate password
  on(gatePwdSave, 'click', () => {
    const value = String(gatePwdInput?.value || '').trim();
    if (!value) {
      showToast('გთხოვთ შეიყვანოთ პაროლი', 'error');
      return;
    }
    try { localStorage.setItem(ADMIN_PWD_KEY, value); } catch {}
    // Use a toast instead of inline flash to avoid layout jumps
    showToast('ადმინისტრატორის პაროლი შენახულია');
  });

  // UX: Enter-ზე შენახვა + typing-ისას ავტო-შენახვა (debounced)
  on(gatePwdInput, 'keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      gatePwdSave?.click();
    }
  });
  let gatePwdSaveTimer = null;
  on(gatePwdInput, 'input', () => {
    const v = String(gatePwdInput?.value || '').trim();
    clearTimeout(gatePwdSaveTimer);
    gatePwdSaveTimer = setTimeout(() => { try { localStorage.setItem(ADMIN_PWD_KEY, v); } catch {} }, 250);
  });

  // Blocks grid data + rendering
  const blocksGrid = document.querySelector('.exam-blocks-grid');
  const BLOCKS_KEY = 'examBlocks_v1';
  const blocksCountEl = document.getElementById('adminBlocksCount');
  const questionsCountEl = document.getElementById('adminQuestionsCount');
  const generateId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const createDefaultAnswers = () => Array.from({ length: 4 }, () => ({ id: generateId(), text: '' }));
  const generateQuestionCode = () => String(Math.floor(10000 + Math.random() * 90000));

  const loadBlocks = () => {
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  const saveBlocks = (data) => { try { localStorage.setItem(BLOCKS_KEY, JSON.stringify(data)); } catch {} };

  let blocksData = loadBlocks();
  // Migration: ensure each block has a questions array and each question has 4 answers
  blocksData = (Array.isArray(blocksData) ? blocksData : []).map(b => {
    if (b && typeof b === 'object') {
      const qs = Array.isArray(b.questions) ? b.questions : [];
      const migratedQs = qs.map(q => {
        if (q && typeof q === 'object') {
          let answers = Array.isArray(q.answers) ? q.answers : [];
          answers = answers.map(a => (a && typeof a === 'object') ? a : { id: generateId(), text: String(a || '') });
          while (answers.length < 4) answers.push({ id: generateId(), text: '' });
          if (answers.length > 4) answers = answers.slice(0, 4);
          return { ...q, answers, correctAnswerId: typeof q.correctAnswerId === 'string' ? q.correctAnswerId : null, code: typeof q.code === 'string' ? q.code : generateQuestionCode() };
        }
        return { id: generateId(), text: String(q || ''), answers: createDefaultAnswers(), correctAnswerId: null, code: generateQuestionCode() };
      });
      return { ...b, questions: migratedQs };
    }
    return b;
  });

  const nextNumber = () => {
    if (!blocksData.length) return 1;
    const max = Math.max(...blocksData.map(b => Number(b.number) || 0));
    return (isFinite(max) ? max : 0) + 1;
  };

  const updateStats = () => {
    if (!blocksCountEl || !questionsCountEl) return;
    const blocksCount = Array.isArray(blocksData) ? blocksData.length : 0;
    // Sum of questions that will be used in exam: sum(min(qty, availableQuestions)) per block
    const questionsCount = (Array.isArray(blocksData) ? blocksData : []).reduce((sum, b) => {
      const available = Array.isArray(b?.questions) ? b.questions.length : 0;
      const qty = Math.max(0, Number(b?.qty) || 0);
      return sum + Math.min(qty, available);
    }, 0);
    blocksCountEl.textContent = String(blocksCount);
    questionsCountEl.textContent = String(questionsCount);
  };

  const renderBlocks = () => {
    if (!blocksGrid) return;
    // Capture currently open blocks/questions to preserve UI state after re-render
    const prevOpenBlockIds = Array.from(blocksGrid.querySelectorAll('.block-card.open')).map(el => el.dataset.blockId).filter(Boolean);
    const prevOpenQuestionIds = Array.from(blocksGrid.querySelectorAll('.question-card.open')).map(el => el.dataset.questionId).filter(Boolean);
    blocksGrid.innerHTML = '';

    blocksData.forEach((b, idx) => {
      const atTop = idx === 0;
      const atBottom = idx === blocksData.length - 1;
      const card = document.createElement('div');
      card.className = 'block-tile block-card';
      card.dataset.blockId = b.id;
      card.innerHTML = `
        <div class="block-head">
          <div class="block-order">
            <button class="i-btn up" ${atTop ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
            <button class="i-btn down" ${atBottom ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
          </div>
          <span class="head-label">ბლოკი</span>
          <input class="head-number" type="number" inputmode="numeric" min="1" step="1" value="${b.number ?? ''}" aria-label="ბლოკის ნომერი" />
          <input class="head-name" type="text" placeholder="ბლოკის სახელი" value="${(b.name || '').replace(/"/g,'&quot;')}" aria-label="ბლოკის სახელი" />
          <span class="head-qty-label">რაოდენობა</span>
          <input class="head-qty" type="number" inputmode="numeric" min="0" step="1" value="${typeof b.qty === 'number' ? b.qty : ''}" aria-label="რაოდენობა" />
          <button class="head-delete" type="button" aria-label="ბლოკის წაშლა" title="წაშლა">×</button>
          <button class="head-toggle" type="button" aria-expanded="false">▾</button>
          <span class="head-count" title="კითხვების რაოდენობა">${Array.isArray(b.questions) ? b.questions.length : 0}</span>
        </div>
        <div class="block-questions" aria-hidden="true">
          <div class="questions-list">
            ${ (b.questions || []).map((q, qIdx, arr) => `
              <div class="question-card" data-question-id="${q.id}">
                <div class="q-head">
                  <div class="q-order">
                    <button class="i-btn q-up" ${qIdx === 0 ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
                    <button class="i-btn q-down" ${qIdx === arr.length - 1 ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
                  </div>
                  <textarea class="q-text" placeholder="კითხვა" rows="3" aria-label="კითხვა">${String(q.text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
                  <div class="q-actions">
                    <div class="q-actions-row">
                      <button class="q-delete" type="button" aria-label="კითხვის წაშლა" title="წაშლა">×</button>
                      <button class="q-toggle" type="button" aria-expanded="false">▾</button>
                    </div>
                    <span class="q-code" aria-label="კითხვა კოდი">${q.code}</span>
                  </div>
                </div>
                <div class="q-details" aria-hidden="true">
                  <div class="q-answers">
                    ${ (Array.isArray(q.answers) ? q.answers : []).map((a, ai, arrA) => `
                      <div class="answer-row" data-answer-id="${a.id}">
                        <div class="a-order">
                          <button class="i-btn a-up" ${ai === 0 ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
                          <button class="i-btn a-down" ${ai === arrA.length - 1 ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
                        </div>
                        <textarea class="a-text" rows="2" placeholder="პასუხი ${ai+1}" aria-label="პასუხი ${ai+1}">${String(a.text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
                        <label class="a-correct-wrap" title="სწორი პასუხი">
                          <input class="a-correct" type="radio" name="correct-${q.id}" ${q.correctAnswerId === a.id ? 'checked' : ''} />
                          <span>სწორია</span>
                        </label>
                      </div>
                    `).join('') }
                  </div>
                </div>
              </div>
            `).join('') }
          </div>
          <button class="block-tile add-tile q-add-tile" type="button" aria-label="კითხვის დამატება">
            <span class="add-icon" aria-hidden="true">+</span>
            <span class="add-text">კითხვის დამატება</span>
          </button>
        </div>
      `;
      blocksGrid.appendChild(card);
      // Restore previously open blocks only (do not auto-open empty ones)
      if (prevOpenBlockIds.includes(b.id)) setCardOpen(card, true);
      // Restore open questions within this block
      const qCards = card.querySelectorAll('.question-card');
      qCards.forEach(qc => { const qid = qc.dataset.questionId; if (prevOpenQuestionIds.includes(qid)) setQuestionOpen(qc, true); });
    });

    const addTile = document.createElement('button');
    addTile.type = 'button';
    addTile.id = 'addBlockTile';
    addTile.className = 'block-tile add-tile';
    addTile.setAttribute('aria-label', 'ბლოკის დამატება');
    addTile.innerHTML = '<span class="add-icon" aria-hidden="true">+</span><span class="add-text">ბლოკის დამატება</span>';
    blocksGrid.appendChild(addTile);
    updateStats();
  };

  const setCardOpen = (card, open) => {
    if (!card) return;
    card.classList.toggle('open', !!open);
    const q = card.querySelector('.block-questions');
    const btn = card.querySelector('.head-toggle');
    if (q) {
      q.setAttribute('aria-hidden', open ? 'false' : 'true');
      // display სტილს აღარ ვცვლით, CSS transition-ს მივენდობით
    }
    // When closing a block, reset any manually resized textarea heights inside
    if (!open) {
      const textareas = card.querySelectorAll('.q-text, .a-text');
      textareas.forEach(t => { try { t.style.height = ''; } catch {} });
    }
    if (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '▴' : '▾';
    }
  };

  const setQuestionOpen = (qCard, open) => {
    if (!qCard) return;
    qCard.classList.toggle('open', !!open);
    const details = qCard.querySelector('.q-details');
    const btn = qCard.querySelector('.q-toggle');
    if (details) {
      details.setAttribute('aria-hidden', open ? 'false' : 'true');
      // CSS transition მართავს გახსნა/დაკეცვას
    }
    // When closing a question, reset textarea heights back to default (min-height)
    if (!open) {
      const textareas = qCard.querySelectorAll('.q-text, .a-text');
      textareas.forEach(t => { try { t.style.height = ''; } catch {} });
    }
    if (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '▴' : '▾';
    }
  };

  const closeAllOpenQuestions = (except) => {
    const openQs = blocksGrid?.querySelectorAll?.('.question-card.open') || [];
    openQs.forEach(qc => { if (!except || qc !== except) setQuestionOpen(qc, false); });
  };

  const addBlock = () => {
    const id = generateId();
    blocksData.push({ id, number: nextNumber(), name: '', questions: [] });
    saveBlocks(blocksData);
    renderBlocks();
    const card = blocksGrid?.querySelector?.(`.block-card[data-block-id="${id}"]`);
    if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };

  // Delegated events
  on(blocksGrid, 'click', (e) => {
    const target = e.target;
    if (!target) return;
    const addBtn = target.closest?.('#addBlockTile');
    if (addBtn) { addBlock(); return; }

    const card = target.closest?.('.block-card');
    if (!card) return;
    const id = card.dataset.blockId;
    const idx = blocksData.findIndex(b => b.id === id);
    if (idx === -1) return;

    if (target.classList.contains('up')) {
      if (idx > 0) { const t = blocksData[idx-1]; blocksData[idx-1] = blocksData[idx]; blocksData[idx] = t; saveBlocks(blocksData); renderBlocks(); }
      return;
    }
    if (target.classList.contains('down')) {
      if (idx < blocksData.length - 1) { const t = blocksData[idx+1]; blocksData[idx+1] = blocksData[idx]; blocksData[idx] = t; saveBlocks(blocksData); renderBlocks(); }
      return;
    }
    if (target.classList.contains('head-delete')) {
      const ok = window.confirm('ნამდვილად გსურთ ბლოკის წაშლა? ბლოკის ყველა კითხვა წაიშლება.');
      if (!ok) return;
      blocksData.splice(idx, 1);
      saveBlocks(blocksData);
      renderBlocks();
      return;
    }

    // Toggle open/close by clicking the explicit toggle button (robust via closest)
    const toggleBtn = target.closest?.('.head-toggle');
    if (toggleBtn) {
      const isOpen = card.classList.contains('open');
      if (!isOpen) closeAllOpenQuestions(); // opening another block closes any open question
      setCardOpen(card, !isOpen);
      return;
    }

    // Toggle by clicking on head area (but not on buttons/inputs)
    const head = target.closest?.('.block-head');
    if (head && !target.closest('button') && target.tagName !== 'INPUT') {
      const isOpen = card.classList.contains('open');
      setCardOpen(card, !isOpen);
      return;
    }

    // Add question
    const qAdd = target.closest?.('.q-add-tile');
    if (qAdd) {
      const qid = generateId();
      if (!Array.isArray(blocksData[idx].questions)) blocksData[idx].questions = [];
      blocksData[idx].questions.push({ id: qid, text: '', answers: createDefaultAnswers(), correctAnswerId: null, code: generateQuestionCode() });
      saveBlocks(blocksData);
      renderBlocks();
      const newCard = blocksGrid?.querySelector?.(`.block-card[data-block-id="${id}"]`);
      if (newCard) {
        setCardOpen(newCard, true); // keep block open, leave new question collapsed by default
      }
      return;
    }

    // Delete question
    if (target.classList.contains('q-delete')) {
      const qEl = target.closest?.('.question-card');
      const qid = qEl?.dataset.questionId;
      if (qid) {
        const ok = window.confirm('ნამდვილად გსურთ ამ კითხვის წაშლა? ქმედება შეუქცევადია.');
        if (!ok) return;
        const qs = Array.isArray(blocksData[idx].questions) ? blocksData[idx].questions : [];
        const qi = qs.findIndex(q => q.id === qid);
        if (qi !== -1) {
          qs.splice(qi, 1);
          blocksData[idx].questions = qs;
          saveBlocks(blocksData);
          renderBlocks();
        }
      }
      return;
    }

    // Question reordering and toggling
    const qCardEl = target.closest?.('.question-card');
    if (qCardEl) {
      const qid = qCardEl.dataset.questionId;
      const qs = Array.isArray(blocksData[idx].questions) ? blocksData[idx].questions : [];
      const qi = qs.findIndex(q => q.id === qid);
      if (qi !== -1) {
        // Answer row interactions
        const aRow = target.closest?.('.answer-row');
        if (aRow) {
          const aid = aRow.dataset.answerId;
          const answers = Array.isArray(qs[qi].answers) ? qs[qi].answers : [];
          const ai = answers.findIndex(a => a.id === aid);
          if (ai !== -1) {
            if (target.closest?.('.a-up')) {
              if (ai > 0) { const t = answers[ai-1]; answers[ai-1] = answers[ai]; answers[ai] = t; qs[qi].answers = answers; saveBlocks(blocksData); renderBlocks(); }
              return;
            }
            if (target.closest?.('.a-down')) {
              if (ai < answers.length - 1) { const t = answers[ai+1]; answers[ai+1] = answers[ai]; answers[ai] = t; qs[qi].answers = answers; saveBlocks(blocksData); renderBlocks(); }
              return;
            }
            if (target.classList.contains('a-correct') || target.closest?.('.a-correct')) {
              qs[qi].correctAnswerId = aid;
              saveBlocks(blocksData);
              renderBlocks();
              return;
            }
          }
        }
        if (target.closest?.('.q-up')) {
          if (qi > 0) { const t = qs[qi-1]; qs[qi-1] = qs[qi]; qs[qi] = t; blocksData[idx].questions = qs; saveBlocks(blocksData); renderBlocks(); }
          return;
        }
        if (target.closest?.('.q-down')) {
          if (qi < qs.length - 1) { const t = qs[qi+1]; qs[qi+1] = qs[qi]; qs[qi] = t; blocksData[idx].questions = qs; saveBlocks(blocksData); renderBlocks(); }
          return;
        }
        if (target.closest?.('.q-toggle')) {
          const isOpen = qCardEl.classList.contains('open');
          if (!isOpen) closeAllOpenQuestions(qCardEl);
          setQuestionOpen(qCardEl, !isOpen);
          return;
        }

        const qHead = target.closest?.('.q-head');
        if (qHead && !target.closest('button') && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          const isOpen = qCardEl.classList.contains('open');
          if (!isOpen) { closeAllOpenQuestions(qCardEl); setQuestionOpen(qCardEl, true); }
          return;
        }
      }
    }

    // Fallback: toggle by clicking anywhere on card (except interactive elements or inside questions)
    const inQuestions = !!target.closest?.('.block-questions');
    const onInteractive = !!target.closest?.('button, input, select, textarea, a, label');
    if (!inQuestions && !onInteractive) {
      const isOpen = card.classList.contains('open');
      if (!isOpen) closeAllOpenQuestions();
      setCardOpen(card, !isOpen);
      return;
    }
  });

  on(blocksGrid, 'keydown', (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!target) return;
    const card = target.closest?.('.block-card');
    if (!card) return;
    const id = card.dataset.blockId;
    const idx = blocksData.findIndex(b => b.id === id);
    if (idx === -1) return;

    if (target.classList.contains('head-number')) {
      const val = parseInt(String(target.value || '').trim(), 10);
      if (!isNaN(val) && val > 0) {
        blocksData[idx].number = val;
        saveBlocks(blocksData);
        renderBlocks();
      }
      return;
    }
    if (target.classList.contains('head-name')) {
      const val = String(target.value || '').trim();
      blocksData[idx].name = val;
      saveBlocks(blocksData);
      renderBlocks();
      return;
    }

    if (target.classList.contains('head-qty')) {
      const val = parseInt(String(target.value || '').trim(), 10);
      blocksData[idx].qty = (!isNaN(val) && val >= 0) ? val : 0;
      saveBlocks(blocksData);
      renderBlocks();
      return;
    }

    if (target.classList.contains('q-text') && target.tagName !== 'TEXTAREA') {
      const qEl = target.closest?.('.question-card');
      const qid = qEl?.dataset.questionId;
      if (qid) {
        blocksData[idx].questions = (blocksData[idx].questions || []).map(q => q.id === qid ? { ...q, text: String(target.value || '').trim() } : q);
        saveBlocks(blocksData);
        renderBlocks();
      }
      return;
    }

    if (target.classList.contains('a-text') && target.tagName !== 'TEXTAREA') {
      const qEl = target.closest?.('.question-card');
      const qid = qEl?.dataset.questionId;
      const aEl = target.closest?.('.answer-row');
      const aid = aEl?.dataset.answerId;
      if (qid && aid) {
        const qs = Array.isArray(blocksData[idx].questions) ? blocksData[idx].questions : [];
        const qi = qs.findIndex(q => q.id === qid);
        if (qi !== -1) {
          const answers = Array.isArray(qs[qi].answers) ? qs[qi].answers : [];
          qs[qi].answers = answers.map(a => a.id === aid ? { ...a, text: String(target.value || '').trim() } : a);
          saveBlocks(blocksData);
          renderBlocks();
        }
      }
      return;
    }
  });

  // Persist question text on blur as well
  on(blocksGrid, 'focusout', (e) => {
    const target = e.target;
    if (!target) return;
    const card = target.closest?.('.block-card');
    if (!card) return;
    const id = card.dataset.blockId;
    const idx = blocksData.findIndex(b => b.id === id);
    if (idx === -1) return;
    if (target.classList.contains('head-number')) {
      const val = parseInt(String(target.value || '').trim(), 10);
      if (!isNaN(val) && val > 0) {
        blocksData[idx].number = val;
        saveBlocks(blocksData);
        renderBlocks();
      }
    }
    if (target.classList.contains('head-name')) {
      const val = String(target.value || '').trim();
      blocksData[idx].name = val;
      saveBlocks(blocksData);
      // name change doesn't affect stats, no rerender required
    }
    if (target.classList.contains('head-qty')) {
      const val = parseInt(String(target.value || '').trim(), 10);
      blocksData[idx].qty = (!isNaN(val) && val >= 0) ? val : 0;
      saveBlocks(blocksData);
      // Update header counters immediately
      updateStats();
    }
    if (target.classList.contains('q-text')) {
      const qEl = target.closest?.('.question-card');
      const qid = qEl?.dataset.questionId;
      if (qid) {
        blocksData[idx].questions = (blocksData[idx].questions || []).map(q => q.id === qid ? { ...q, text: String(target.value || '').trim() } : q);
        saveBlocks(blocksData);
      }
    }
    if (target.classList.contains('a-text')) {
      const qEl = target.closest?.('.question-card');
      const qid = qEl?.dataset.questionId;
      const aEl = target.closest?.('.answer-row');
      const aid = aEl?.dataset.answerId;
      if (qid && aid) {
        const qs = Array.isArray(blocksData[idx].questions) ? blocksData[idx].questions : [];
        const qi = qs.findIndex(q => q.id === qid);
        if (qi !== -1) {
          const answers = Array.isArray(qs[qi].answers) ? qs[qi].answers : [];
          qs[qi].answers = answers.map(a => a.id === aid ? { ...a, text: String(target.value || '').trim() } : a);
          saveBlocks(blocksData);
        }
      }
    }
  });

  // Initial render
  renderBlocks();

  // ================= Results rendering =================
  const API_BASE = 'http://127.0.0.1:8000';
  const resultsGrid = document.getElementById('resultsGrid');
  const resultsSearch = document.getElementById('resultsSearch');
  const resultsApiKeyInput = document.getElementById('resultsApiKey');
  const saveResultsApiKeyBtn = document.getElementById('saveResultsApiKey');
  const ADMIN_API_KEY_LS = 'adminApiKey';
  try { if (resultsApiKeyInput) resultsApiKeyInput.value = localStorage.getItem(ADMIN_API_KEY_LS) || ''; } catch {}
  on(saveResultsApiKeyBtn, 'click', () => {
    const v = String(resultsApiKeyInput?.value || '').trim();
    try { localStorage.setItem(ADMIN_API_KEY_LS, v); } catch {}
    showToast('Admin API Key შენახულია');
  });
  let lastResults = [];

  const fmtDT = (iso) => {
    try { const d = new Date(iso); const p = (n)=>String(n).padStart(2,'0'); return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return String(iso||''); }
  };

  const adminHeaders = () => {
    const key = localStorage.getItem(ADMIN_API_KEY_LS);
    return key ? { 'x-admin-key': key } : {};
  };

  const actorHeaders = () => {
    const actor = (localStorage.getItem(SAVED_EMAIL_KEY) || '').trim();
    return actor ? { 'x-actor-email': actor } : {};
  };

  async function fetchResults() {
    const res = await fetch(`${API_BASE}/admin/results`, { headers: { ...adminHeaders() } });
    if (!res.ok) throw new Error('results failed');
    return await res.json();
  }

  function groupByCandidate(items) {
    const map = new Map();
    items.forEach(it => {
      const key = `${it.candidate_first_name||''}|${it.candidate_last_name||''}|${it.candidate_code||''}`;
      if (!map.has(key)) map.set(key, { key, firstName: it.candidate_first_name||'', lastName: it.candidate_last_name||'', code: it.candidate_code||'', sessions: [] });
      map.get(key).sessions.push(it);
    });
    return Array.from(map.values());
  }

  async function renderResults() {
    if (!resultsGrid) return;
    resultsGrid.innerHTML = '';
    try {
      const data = await fetchResults();
      lastResults = Array.isArray(data?.items) ? data.items : [];
      drawResults(lastResults);
    } catch {
      resultsGrid.innerHTML = '<div class="block-tile">ვერ ჩაიტვირთა შედეგები</div>';
    }
  }

  function drawResults(items) {
    const groups = groupByCandidate(items);
    const q = String(resultsSearch?.value || '').trim().toLowerCase();
    const filtered = groups.filter(g => {
      const s = `${g.firstName} ${g.lastName} ${g.code}`.toLowerCase();
      return !q || s.includes(q);
    });
    filtered.forEach(g => {
      const card = document.createElement('div');
      card.className = 'block-tile block-card';
      card.innerHTML = `
        <div class="block-head">
          <div class="block-order"></div>
          <span class="head-label">${(g.firstName||'').trim()} ${(g.lastName||'').trim()}</span>
          <input class="head-name" type="text" value="${(g.code||'').replace(/"/g,'&quot;')}" readonly aria-label="კოდი" />
          <button class="head-toggle" type="button" aria-expanded="false">▾</button>
        </div>
        <div class="block-questions" aria-hidden="true">
          <div class="questions-list"></div>
        </div>`;
      const list = card.querySelector('.questions-list');
      // sort sessions by started_at desc
      const sess = g.sessions.slice().sort((a,b)=> new Date(b.started_at)-new Date(a.started_at));
      sess.forEach(s => {
        const row = document.createElement('div');
        row.className = 'question-card';
        row.dataset.sessionId = s.session_id;
        row.innerHTML = `
          <div class="q-head">
            <div class="q-order"></div>
            <div class="q-actions">
              <div class="q-actions-row"></div>
              <button class="q-toggle" type="button" aria-expanded="false">▾</button>
              <span class="q-code">${fmtDT(s.started_at)}${s.finished_at ? ' → '+fmtDT(s.finished_at) : ''} • ${Math.round(Number(s.score_percent||0))}%</span>
            </div>
          </div>
          <div class="q-details" aria-hidden="true"></div>`;
        // Load details on demand
        const btn = row.querySelector('.q-toggle');
        btn.addEventListener('click', async () => {
          const isOpen = row.classList.contains('open');
          row.classList.toggle('open', !isOpen);
          const details = row.querySelector('.q-details');
          if (details) details.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
          if (!isOpen && details && !details.dataset.loaded) {
            details.innerHTML = '<div class="block-tile">იტვირთება...</div>';
            try {
              const resp = await fetch(`${API_BASE}/admin/results/${s.session_id}`, { headers: { ...adminHeaders() } });
              const data = await resp.json();
              renderSessionDetails(details, data);
              details.dataset.loaded = '1';
            } catch {
              details.innerHTML = '<div class="block-tile">ჩატვირთვის შეცდომა</div>';
            }
          }
        });
        list.appendChild(row);
      });
      // toggle behaviour
      const toggle = card.querySelector('.head-toggle');
      toggle.addEventListener('click', () => {
        const isOpen = card.classList.contains('open');
        card.classList.toggle('open', !isOpen);
        const q = card.querySelector('.block-questions');
        if (q) q.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      });
      resultsGrid.appendChild(card);
    });
  }

  function renderSessionDetails(container, data) {
    const sess = data?.session || {};
    const blocks = Array.isArray(data?.block_stats) ? data.block_stats : [];
    const answers = Array.isArray(data?.answers) ? data.answers : [];
    const top = document.createElement('div');
    top.className = 'block-tile';
    top.innerHTML = `<div><strong>${(sess.candidate_first_name||'')} ${(sess.candidate_last_name||'')}</strong> • ${sess.candidate_code||''}</div>
    <div>${fmtDT(sess.started_at)}${sess.finished_at ? ' → '+fmtDT(sess.finished_at) : ''} • ${Math.round(Number(sess.score_percent||0))}%</div>`;
    const blocksDiv = document.createElement('div');
    blocksDiv.style.margin = '8px 0';
    blocks.forEach(b => {
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `<div class="result-label">ბლოკი ${b.block_id}</div><div class="result-value">${b.percent}%</div>`;
      blocksDiv.appendChild(row);
    });
    const list = document.createElement('div');
    list.style.display = 'grid'; list.style.gap = '6px';
    answers.forEach(a => {
      const r = document.createElement('div');
      r.className = 'question-card open';
      r.innerHTML = `<div class="q-head"><div class="q-order"></div><div class="q-actions"><span class="q-code">${a.question_code}</span></div></div>
      <div class="q-details" aria-hidden="false"><div class="q-answers">${a.question_text}</div><div>${a.option_text} • ${a.is_correct ? 'სწორი' : 'არასწორი'}</div></div>`;
      list.appendChild(r);
    });
    container.innerHTML = '';
    container.appendChild(top);
    container.appendChild(blocksDiv);
    container.appendChild(list);
  }

  on(resultsSearch, 'input', () => drawResults(lastResults));

  // ================= Registrations (users) =================
  const usersGrid = document.getElementById('usersGrid');
  const usersSearch = document.getElementById('usersSearch');
  const usersSort = document.getElementById('usersSort');
  const onlyAdmins = document.getElementById('onlyAdmins');

  const isFounderActor = () => (localStorage.getItem(SAVED_EMAIL_KEY) || '').toLowerCase() === FOUNDER_EMAIL.toLowerCase();

  function userRowHTML(u) {
    const full = `${(u.first_name||'').trim()} ${(u.last_name||'').trim()}`.trim();
    const founderRow = !!u.is_founder;
    const checked = founderRow ? 'checked' : (u.is_admin ? 'checked' : '');
    const disabled = founderRow ? 'disabled' : (isFounderActor() ? '' : 'disabled');
    return `
      <div class="block-tile block-card" data-id="${u.id}">
        <div class="block-head" style="grid-template-columns:auto 1fr auto auto auto;">
          <div class="block-order"></div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="font-size:16px;font-weight:700;color:#0f172a;">${full || '(უსახელო)'}</div>
            <div style="font-size:13px;color:#525252;">
              <span style="color:#6d28d9;font-weight:600;">კოდი: ${(u.code||'')}</span> •
              <span style="color:#065f46;">${(u.email||'')}</span>
            </div>
          </div>
          <button class="head-toggle" type="button" aria-expanded="false">▾</button>
        </div>
        <div class="block-questions" aria-hidden="true">
          <div class="questions-list">
            <div class="question-card open">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:12px;">
                <div>
                  <div style="font-weight:700;color:#065f46;margin-bottom:8px;">კონტაქტი</div>
                  <div style="color:#525252;font-size:13px;line-height:1.8;">
                    <div>პირადი №: <strong>${u.personal_id}</strong></div>
                    <div>ტელეფონი: <strong>${u.phone}</strong></div>
                    <div>რეგისტრაცია: <strong>${fmtDT(u.created_at)}</strong></div>
                  </div>
                </div>
                <div>
                  <div style="font-weight:700;color:#065f46;margin-bottom:8px;">ქმედებები</div>
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    <label class="a-correct-wrap" title="${founderRow ? 'მუდმივი ადმინი' : 'ადმინი'}" style="width:fit-content;">
                      <input type="checkbox" class="chk-admin" ${checked} ${disabled} />
                      <span>ადმინი</span>
                    </label>
                    <button class="btn-delete" ${founderRow || !isFounderActor() ? 'disabled' : ''} style="width:fit-content;padding:6px 12px;">წაშლა</button>
                  </div>
                  <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
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

  async function fetchUsers() {
    if (!usersGrid) return { items: [] };
    const params = new URLSearchParams();
    const q = String(usersSearch?.value||'').trim();
    if (q) params.set('search', q);
    if (onlyAdmins?.checked) params.set('only_admins', 'true');
    params.set('sort', usersSort?.value || 'date_desc');
    const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`, { headers: { ...adminHeaders(), ...actorHeaders() } });
    if (!res.ok) throw new Error('users failed');
    return await res.json();
  }

  function mountUserCard(card) {
    const toggle = card.querySelector('.head-toggle');
    toggle?.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      card.classList.toggle('open', !isOpen);
      card.querySelector('.block-questions')?.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    });

    const chk = card.querySelector('.chk-admin');
    if (chk) {
      chk.addEventListener('change', async (e) => {
        const id = card.dataset.id;
        const want = !!e.target.checked;
        if (!confirm('დარწმუნებული ხართ, რომ შეცვალოთ ადმინის სტატუსი?')) { e.target.checked = !want; return; }
        try {
          const r = await fetch(`${API_BASE}/admin/users/${id}/admin`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...adminHeaders(), ...actorHeaders() },
            body: JSON.stringify({ is_admin: want }),
          });
          if (!r.ok) throw 0;
        } catch {
          e.target.checked = !want;
          alert('ვერ შეინახა სტატუსი');
        }
      });
    }

    const del = card.querySelector('.btn-delete');
    if (del) {
      del.addEventListener('click', async () => {
        const id = card.dataset.id;
        if (!confirm('დარწმუნებული ხართ, რომ წაშალოთ ჩანაწერი?')) return;
        try {
          const r = await fetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE', headers: { ...adminHeaders(), ...actorHeaders() } });
          if (!r.ok) throw 0;
          card.remove();
        } catch {
          alert('წაშლა ვერ შესრულდა');
        }
      });
    }
  }

  function drawUsers(items) {
    if (!usersGrid) return;
    usersGrid.innerHTML = '';
    (items||[]).forEach(u => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = userRowHTML(u);
      const card = wrapper.firstElementChild;
      mountUserCard(card);
      usersGrid.appendChild(card);
    });
  }

  async function renderUsers() {
    if (!usersGrid) return;
    usersGrid.innerHTML = '<div class="block-tile">იტვირთება...</div>';
    try {
      const data = await fetchUsers();
      drawUsers(data.items || []);
    } catch {
      usersGrid.innerHTML = '<div class="block-tილe">ჩატვირთვის შეცდომა</div>';
    }
  }

  on(usersSearch, 'input', renderUsers);
  on(usersSort, 'change', renderUsers);
  on(onlyAdmins, 'change', renderUsers);

});
