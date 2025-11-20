document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE === 'string')
    ? window.APP_CONFIG.API_BASE
    : 'http://127.0.0.1:8000';
  const KEYS = {
    AUTH: 'authLoggedIn',
    CURRENT_USER: 'currentUser',
    SAVED_EMAIL: 'savedEmail',
  };
  const FOUNDER_EMAIL = 'naormala@gmail.com';
  const VIEW_USER_ID = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('userId');
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  })();

  const DOM = {
    body: document.body,
    header: document.querySelector('header'),
    navLogo: document.querySelector('.nav-bar .logo'),
    authBanner: document.querySelector('.auth-banner'),
    drawerAuthBanner: document.querySelector('.drawer-auth-banner'),
    pageTitle: document.getElementById('pageTitle'),
    burger: document.querySelector('.burger'),
    overlay: document.querySelector('.overlay'),
    drawer: document.querySelector('.drawer'),
    drawerClose: document.querySelector('.drawer-close'),
    drawerExamTrigger: document.querySelector('.drawer-exam-trigger'),
    drawerSubmenu: document.querySelector('.drawer-submenu'),
    homeBtn: document.querySelector('.home-btn') || document.querySelector('.login-btn'),
    drawerHomeBtn: document.querySelector('.drawer-login'),
    navRegistry: document.querySelector('.nav-registry'),
    drawerRegistry: document.querySelector('.drawer-registry'),
    navStatements: document.querySelector('.nav-statements'),
    drawerStatements: document.querySelector('.drawer-statements'),
    examTrigger: document.querySelector('.nav .exam-trigger'),
    dropdown: document.querySelector('.nav .dropdown'),
    adminLink: document.querySelector('.admin-link'),
    statementsOverlay: document.getElementById('userStatementsOverlay'),
    statementsClose: document.getElementById('userStatementsClose'),
    statementsList: document.getElementById('userStatementsList'),
    statementsMeta: document.getElementById('userStatementsMeta'),
    statementsForm: document.getElementById('userStatementForm'),
    statementsTextarea: document.querySelector('#userStatementForm textarea[name="message"]'),
    pfFirstName: document.getElementById('myFirstName'),
    pfLastName: document.getElementById('myLastName'),
    pfPersonalId: document.getElementById('myPersonalId'),
    pfPhone: document.getElementById('myPhone'),
    pfEmail: document.getElementById('myEmail'),
    pfCode: document.getElementById('myCode'),
    pfCreatedAt: document.getElementById('myCreatedAt'),
    certCard: document.getElementById('certCard'),
    certCode: document.getElementById('myCertCode'),
    certLevel: document.getElementById('myCertLevel'),
    certStatus: document.getElementById('myCertStatus'),
    certIssueDate: document.getElementById('myCertIssueDate'),
    certValidityTerm: document.getElementById('myCertValidityTerm'),
    certValidUntil: document.getElementById('myCertValidUntil'),
    certExamScore: document.getElementById('myCertExamScore'),
    certDownloadBtn: document.getElementById('certDownloadBtn'),
    reviewsCard: document.getElementById('reviewsCard'),
    reviewsAverage: document.getElementById('reviewsAverage'),
    reviewStars: document.getElementById('reviewStars'),
    reviewCommentForm: document.getElementById('reviewCommentForm'),
    reviewCommentMessage: document.getElementById('reviewCommentMessage'),
    reviewsComments: document.getElementById('reviewsComments'),
    expertCard: document.getElementById('expertCard'),
    expertFunction: document.getElementById('expertFunction'),
    expertCadastral: document.getElementById('expertCadastral'),
    expertFileExpertise: document.getElementById('expertFileExpertise'),
    expertExpertiseDownload: document.getElementById('expertExpertiseDownload'),
    expertExpertiseDelete: document.getElementById('expertExpertiseDelete'),
    expertProjectDownload: document.getElementById('expertProjectDownload'),
    expertProjectDelete: document.getElementById('expertProjectDelete'),
    expertSaveBtn: document.getElementById('expertSaveBtn'),
    expertSubmitBtn: document.getElementById('expertSubmitBtn'),
    expertList: document.getElementById('expertList'),
    expertCurrentCode: document.getElementById('expertCurrentCode'),
  };

  const GEORGIA_TIME_ZONE = 'Asia/Tbilisi';
  const ISO_NO_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
  const ISO_WITH_SPACE_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
  let tbilisiFormatter = null;
  function getTbilisiFormatter() {
    if (!tbilisiFormatter) {
      tbilisiFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: GEORGIA_TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
    }
    return tbilisiFormatter;
  }
  function normalizeIsoString(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (trimmed.endsWith('Z')) return trimmed;
    if (/[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
    if (ISO_NO_TZ_REGEX.test(trimmed)) return `${trimmed}Z`;
    if (ISO_WITH_SPACE_REGEX.test(trimmed)) return `${trimmed.replace(' ', 'T')}Z`;
    return trimmed;
  }
  function parseUtcDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    try {
      const normalized = normalizeIsoString(String(value));
      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }
  const utils = {
    on: (element, event, handler) => element && element.addEventListener(event, handler),
    isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    getTrimmed: (formData, name) => (formData.get(name) || '').toString().trim(),
    formatDateTime: (value) => {
      const date = parseUtcDate(value);
      if (!date) return String(value || '');
      try {
        const formatter = getTbilisiFormatter();
        const parts = formatter.formatToParts(date);
        const mapped = parts.reduce((acc, part) => {
          if (part.type !== 'literal') acc[part.type] = part.value;
          return acc;
        }, {});
        const day = mapped.day || '00';
        const month = mapped.month || '00';
        const year = mapped.year || '0000';
        const hour = mapped.hour || '00';
        const minute = mapped.minute || '00';
        return `${day}-${month}-${year} ${hour}:${minute}`;
      } catch {
        return String(value || '');
      }
    },
  };

  function isLoggedIn() {
    return localStorage.getItem(KEYS.AUTH) === 'true';
  }
  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.CURRENT_USER) || 'null');
    } catch {
      return null;
    }
  }
  const authModule = { isLoggedIn, getCurrentUser };

  function guard() {
    const user = getCurrentUser();
    if (!isLoggedIn() || !user) {
      alert('გთხოვთ გაიაროთ ავტორიზაცია');
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
  if (!VIEW_USER_ID && !guard()) return;

  function setBodyOffset() {
    if (!DOM.header) return;
    const headerH = DOM.header.offsetHeight || 0;
    const navBarH = 40; // matches .nav-bar height
    DOM.body.style.paddingTop = `${headerH + navBarH}px`;
  }
  setBodyOffset();
  window.addEventListener('load', setBodyOffset);
  window.addEventListener('resize', setBodyOffset);

  function updateBanners() {
    const user = getCurrentUser();
    const text = user ? `${user.firstName || ''} ${user.lastName || ''} — ${user.code || ''}`.trim() : 'გთხოვთ შეხვიდეთ სისტემაში';
    if (DOM.authBanner) DOM.authBanner.textContent = text;
    if (DOM.drawerAuthBanner) DOM.drawerAuthBanner.textContent = text;

    if (DOM.adminLink) {
      const savedEmail = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').toLowerCase();
      const visible = (!!user && !!user.isAdmin) || savedEmail === FOUNDER_EMAIL.toLowerCase();
      DOM.adminLink.style.display = visible ? '' : 'none';
    }
  }
  updateBanners();

  function updatePageTitleFrom(source) {
    if (!DOM.pageTitle) return;
    try {
      const first = (source?.firstName || source?.first_name || '').trim();
      const last = (source?.lastName || source?.last_name || '').trim();
      const full = `${first} ${last}`.trim();
      DOM.pageTitle.textContent = full || 'ჩემი გვერდი';
    } catch {
      /* no-op */
    }
  }
  // Initial title from local user, fallback to default
  updatePageTitleFrom(getCurrentUser());

  // Load read-only profile info (self or viewing other)
  async function loadProfile() {
    const user = getCurrentUser();
    const savedEmail = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim();

    if (VIEW_USER_ID) {
      // Populate full public info by user id (requires authenticated actor)
      const actorEmail = (localStorage.getItem(KEYS.SAVED_EMAIL) || (user?.email || '')).trim();
      try {
        const res = await fetch(`${API_BASE}/users/${encodeURIComponent(VIEW_USER_ID)}/public`, {
          headers: { 'Cache-Control': 'no-cache', ...(actorEmail ? { 'x-actor-email': actorEmail } : {}) },
        });
        if (res.ok) {
          const data = await res.json();
          if (DOM.pfFirstName) DOM.pfFirstName.textContent = data.first_name || '—';
          if (DOM.pfLastName) DOM.pfLastName.textContent = data.last_name || '—';
          if (DOM.pfPersonalId) DOM.pfPersonalId.textContent = data.personal_id || '—';
          if (DOM.pfPhone) DOM.pfPhone.textContent = data.phone || '—';
          if (DOM.pfEmail) DOM.pfEmail.textContent = data.email || '—';
          if (DOM.pfCode) DOM.pfCode.textContent = data.code || '—';
          if (DOM.pfCreatedAt) DOM.pfCreatedAt.textContent = utils.formatDateTime(data.created_at);
          updatePageTitleFrom({ firstName: data.first_name || '', lastName: data.last_name || '' });
          return;
        }
      } catch {}
      // Fallback to registry (limited info)
      try {
        const res = await fetch(`${API_BASE}/certified-persons/registry?limit=500`, { headers: { 'Cache-Control': 'no-cache' } });
        if (res.ok) {
          const list = await res.json();
          const item = Array.isArray(list) ? list.find((x) => Number(x?.id) === Number(VIEW_USER_ID)) : null;
          if (item) {
            const parts = String(item.full_name || '').trim().split(/\s+/);
            if (DOM.pfFirstName) DOM.pfFirstName.textContent = parts[0] || '—';
            if (DOM.pfLastName) DOM.pfLastName.textContent = parts.slice(1).join(' ') || '—';
            if (DOM.pfEmail) DOM.pfEmail.textContent = '—';
            if (DOM.pfCode) DOM.pfCode.textContent = item.unique_code || '—';
            if (DOM.pfCreatedAt) DOM.pfCreatedAt.textContent = utils.formatDateTime(item.registration_date);
            updatePageTitleFrom({ firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' });
          }
        }
      } catch {}
      return;
    }

    // Self: prefill from local user object
    if (user) {
      if (DOM.pfFirstName) DOM.pfFirstName.textContent = user.firstName || '—';
      if (DOM.pfLastName) DOM.pfLastName.textContent = user.lastName || '—';
      if (DOM.pfEmail) DOM.pfEmail.textContent = user.email || savedEmail || '—';
      if (DOM.pfCode) DOM.pfCode.textContent = user.code || '—';
      updatePageTitleFrom(user);
    }
    if (!savedEmail) return;
    try {
      const res = await fetch(`${API_BASE}/users/profile?email=${encodeURIComponent(savedEmail)}`, { headers: { 'Cache-Control': 'no-cache', ...(savedEmail ? { 'x-actor-email': savedEmail } : {}) } });
      if (!res.ok) return;
      const data = await res.json();
      if (DOM.pfFirstName) DOM.pfFirstName.textContent = data.first_name || '—';
      if (DOM.pfLastName) DOM.pfLastName.textContent = data.last_name || '—';
      if (DOM.pfPersonalId) DOM.pfPersonalId.textContent = data.personal_id || '—';
      if (DOM.pfPhone) DOM.pfPhone.textContent = data.phone || '—';
      if (DOM.pfEmail) DOM.pfEmail.textContent = data.email || '—';
      if (DOM.pfCode) DOM.pfCode.textContent = data.code || '—';
      if (DOM.pfCreatedAt) DOM.pfCreatedAt.textContent = utils.formatDateTime(data.created_at);
      updatePageTitleFrom(data);
    } catch {}
  }
  loadProfile();

  // Certificate
  let certData = null;
  async function loadCertificate() {
    const user = getCurrentUser();
    const card = DOM.certCard;
    const targetId = VIEW_USER_ID || (user && user.id);
    if (!targetId || !card) return;
    try {
      const savedEmail = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim();
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(targetId)}/certificate`, { headers: { 'Cache-Control': 'no-cache', ...(savedEmail ? { 'x-actor-email': savedEmail } : {}) } });
      if (!res.ok) {
        if (res.status === 404) {
          card.classList.add('is-empty');
          if (DOM.certDownloadBtn) DOM.certDownloadBtn.setAttribute('disabled', 'true');
          document.dispatchEvent(new CustomEvent('certificate:loaded', { detail: { certData: null } }));
          return;
        }
        return;
      }
      const data = await res.json();
      certData = data;
      card.classList.remove('is-empty');
      try {
        card.dataset.status = String(data.status || '').toLowerCase();
        card.dataset.level = String(data.level || '').toLowerCase();
      } catch {}
      // Disable download if inactive (suspended/expired) or expired by date
      const isExpired = (() => {
        try {
          const dt = parseUtcDate(data.valid_until);
          if (!dt) return false;
          const end = new Date(dt);
          end.setHours(23, 59, 59, 999);
          return end.getTime() < Date.now();
        } catch { return false; }
      })();
      const statusKey = String(data.status || '').trim().toLowerCase();
      const inactive = statusKey === 'suspended' || statusKey === 'expired' || isExpired;
      if (DOM.certDownloadBtn) {
        if (inactive) {
          DOM.certDownloadBtn.setAttribute('disabled', 'true');
        } else {
          DOM.certDownloadBtn.removeAttribute('disabled');
        }
      }
      if (DOM.certCode) DOM.certCode.textContent = data.unique_code || '—';
      if (DOM.certLevel) DOM.certLevel.textContent = formatCertificateLevel(data.level);
      if (DOM.certStatus) DOM.certStatus.textContent = formatCertificateStatus(statusKey, isExpired);
      if (DOM.certIssueDate) DOM.certIssueDate.textContent = utils.formatDateTime(data.issue_date);
      if (DOM.certValidityTerm) DOM.certValidityTerm.textContent = (data.validity_term != null ? String(data.validity_term) : '—');
      if (DOM.certValidUntil) DOM.certValidUntil.textContent = utils.formatDateTime(data.valid_until);
      if (DOM.certExamScore) DOM.certExamScore.textContent = (data.exam_score != null ? `${Math.round(Number(data.exam_score))}%` : '—');
      document.dispatchEvent(new CustomEvent('certificate:loaded', { detail: { certData: data } }));
    } catch {}
  }
  loadCertificate();

  function getJsPdf() {
    try { return window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null; } catch { return null; }
  }

  // Convert certificate level to full Georgian label as printed on the certificate
  function formatCertificateLevel(rawLevel) {
    if (!rawLevel) return '—';
    const value = typeof rawLevel === 'object' ? (rawLevel.key || rawLevel.label || rawLevel) : rawLevel;
    const s = String(value).trim().toLowerCase();
    if (s === 'expert' || s === 'architect_expert' || s === 'არქიტექტორი ექსპერტი' || s === 'არქიტექტურული პროექტის ექსპერტი') {
      return 'არქიტექტურული პროექტის ექსპერტი';
    }
    if (s === 'architect' || s === 'არქიტექტორი' || s === 'შენობა-ნაგებობის არქიტექტორი') {
      return 'შენობა-ნაგებობის არქიტექტორი';
    }
    return String(rawLevel);
  }

  // Convert certificate status to Georgian label
  function formatCertificateStatus(rawStatus, isExpiredFlag) {
    if (isExpiredFlag) return 'ვადაგასული';
    const s = String(rawStatus || '').trim().toLowerCase();
    if (s === 'expired') return 'ვადაგასული';
    if (s === 'suspended' || s === 'paused' || s === 'inactive') return 'შეჩერებული';
    return 'მოქმედი';
  }

  async function handleCertDownload() {
    const user = getCurrentUser();
    const targetId = VIEW_USER_ID || (user && user.id);
    if (!targetId) return;
    if (!certData) {
      alert('სერტიფიკატი არ არის შექმნილი');
      return;
    }
    const url = new URL(`${API_BASE}/users/${encodeURIComponent(targetId)}/certificate/file`);
    url.searchParams.set('t', String(Date.now()));
    window.location.href = url.toString();
  }
  if (DOM.certDownloadBtn) DOM.certDownloadBtn.addEventListener('click', handleCertDownload);

  // Reviews module
  function createReviewsModule() {
    const state = {
      targetUserId: VIEW_USER_ID || (isLoggedIn() ? (getCurrentUser()?.id || null) : null),
      actor: isLoggedIn() ? getCurrentUser() : null,
      actorEmail: (isLoggedIn() && getCurrentUser()?.email) ? String(getCurrentUser().email).trim() : '',
      average: 0,
      ratingsCount: 0,
      actorCriteria: null,
      canRate: false,
      isCertified: false,
    };

    // overlay refs
    const board = {
      overlay: document.getElementById('ratingsOverlay'),
      close: document.getElementById('ratingsClose'),
      form: document.getElementById('criteriaForm'),
      inputs: {
        integrity: document.getElementById('critIntegrity'),
        responsibility: document.getElementById('critResponsibility'),
        knowledge_experience: document.getElementById('critKnowledge'),
        professional_skills: document.getElementById('critSkills'),
        price_quality: document.getElementById('critPrice'),
      },
      values: {
        integrity: document.getElementById('valIntegrity'),
        responsibility: document.getElementById('valResponsibility'),
        knowledge_experience: document.getElementById('valKnowledge'),
        professional_skills: document.getElementById('valSkills'),
        price_quality: document.getElementById('valPrice'),
      },
    };

    function setCertified(value) {
      state.isCertified = !!value;
      if (DOM.reviewsCard) DOM.reviewsCard.classList.toggle('disabled', !state.isCertified);
    }

    function setCanRate(value) {
      state.canRate = !!value;
      if (DOM.reviewStars) {
        DOM.reviewStars.querySelectorAll('.star').forEach((btn) => {
          // Never use the native disabled flag, so we can show login prompt on click
          btn.removeAttribute('disabled');
          btn.setAttribute('aria-disabled', state.canRate ? 'false' : 'true');
        });
      }
    }

    function renderStars(avgValue) {
      if (!DOM.reviewStars) return;
      const n = Math.round(Number(avgValue) || 0);
      DOM.reviewStars.querySelectorAll('.star').forEach((btn) => {
        const val = Number(btn.dataset.value || '0');
        btn.classList.toggle('active', val <= n);
      });
      try {
        const out = document.getElementById('reviewStarsScore');
        if (out && Number.isFinite(Number(state.average))) {
          out.textContent = `${Number(state.average).toFixed(2)}`;
        }
      } catch {}
    }

    function scrollCommentsToBottom() {
      if (!DOM.reviewsComments) return;
      DOM.reviewsComments.scrollTop = DOM.reviewsComments.scrollHeight;
    }

    function renderComments(items) {
      if (!DOM.reviewsComments) return;
      const list = Array.isArray(items) ? items : [];
      const frag = document.createDocumentFragment();
      list.forEach((c) => {
        const el = document.createElement('div');
        el.className = 'comment-item';
        const meta = document.createElement('div');
        meta.className = 'comment-meta';
        const date = utils.formatDateTime(c.created_at);
        const author = `${c.author_first_name || ''} ${c.author_last_name || ''}`.trim() || '—';
        meta.textContent = `${date} · ${author}`;
        const text = document.createElement('div');
        text.className = 'comment-text';
        text.textContent = c.message || '';
        el.appendChild(meta); el.appendChild(text);

        const canDelete = !!(state.actor && (state.actor.isAdmin || Number(state.actor.id) === Number(c.author_user_id)));
        if (canDelete) {
          const del = document.createElement('button');
          del.className = 'comment-delete';
          del.type = 'button';
          del.title = 'კომენტარის წაშლა';
          del.setAttribute('aria-label', 'კომენტარის წაშლა');
          del.textContent = '×';
          del.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!confirm('წავშალო კომენტარი?')) return;
            try {
              const res = await fetch(`${API_BASE}/reviews/${encodeURIComponent(state.targetUserId)}/comments/${encodeURIComponent(c.id)}`, {
                method: 'DELETE',
                headers: { ...(state.actorEmail ? { 'x-actor-email': state.actorEmail } : {}) },
              });
              if (!res.ok) {
                alert('წაშლა ვერ შესრულდა');
                return;
              }
              await loadSummary();
              scrollCommentsToBottom();
            } catch {
              alert('წაშლა ვერ შესრულდა');
            }
          });
          el.appendChild(del);
        }

        frag.appendChild(el);
      });
      DOM.reviewsComments.innerHTML = '';
      DOM.reviewsComments.appendChild(frag);
      scrollCommentsToBottom();
    }

    async function loadSummary() {
      if (!state.targetUserId || !DOM.reviewsCard) return;
      try {
        const res = await fetch(`${API_BASE}/reviews/${encodeURIComponent(state.targetUserId)}/summary`, {
          headers: { 'Cache-Control': 'no-cache', ...(state.actorEmail ? { 'x-actor-email': state.actorEmail } : {}) },
        });
        if (!res.ok) return;
        const data = await res.json();
        state.average = Number(data.average || 0);
        state.ratingsCount = Number(data.ratings_count || 0);
        state.actorCriteria = data.actor_criteria || null;
        if (DOM.reviewsAverage) DOM.reviewsAverage.textContent = state.average.toFixed(2);
        const myAvg = state.actorCriteria ? (Object.values(state.actorCriteria).reduce((a,b)=>a+Number(b||0),0)/5) : state.average;
        renderStars(myAvg);
        renderComments(Array.isArray(data.comments) ? data.comments : []);
      } catch {}
    }

    function openBoard() {
      if (!board.overlay || !state.canRate) return;
      board.overlay.classList.add('open');
      board.overlay.setAttribute('aria-hidden', 'false');
      const init = state.actorCriteria || { integrity: 0, responsibility: 0, knowledge_experience: 0, professional_skills: 0, price_quality: 0 };
      Object.keys(board.inputs).forEach((k) => {
        const input = board.inputs[k];
        const val = Number(init[k] ?? 0);
        input.value = String(val.toFixed(2));
        const out = board.values[k]; if (out) out.textContent = val.toFixed(2);
      });
    }
    function closeBoard() {
      if (!board.overlay) return;
      board.overlay.classList.remove('open');
      board.overlay.setAttribute('aria-hidden', 'true');
    }

    async function submitRating(criteria) {
      if (!state.canRate || !state.targetUserId) return;
      try {
        const res = await fetch(`${API_BASE}/reviews/${encodeURIComponent(state.targetUserId)}/rating`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(state.actorEmail ? { 'x-actor-email': state.actorEmail } : {}) },
          body: JSON.stringify({ criteria }),
        });
        if (!res.ok) {
          let detail = ''; try { const j = await res.clone().json(); detail = j?.detail || ''; } catch {}
          alert(detail || 'შეფასების შენახვა ვერ მოხერხდა'); return;
        }
        const data = await res.json();
        state.average = Number(data.average || 0);
        state.actorCriteria = data.actor_criteria || null;
        if (DOM.reviewsAverage) DOM.reviewsAverage.textContent = state.average.toFixed(2);
        const myAvg = state.actorCriteria ? (Object.values(state.actorCriteria).reduce((a,b)=>a+Number(b||0),0)/5) : state.average;
        renderStars(myAvg);
      } catch { alert('ქულა ვერ შეინახა'); }
    }

    function bindEvents() {
      // open board on click
      if (DOM.reviewsAverage) DOM.reviewsAverage.addEventListener('click', () => { if (!state.canRate) { alert('გთხოვთ შეხვიდეთ სისტემაში'); return; } openBoard(); });
      if (DOM.reviewStars) DOM.reviewStars.addEventListener('click', () => { if (!state.canRate) { alert('გთხოვთ შეხვიდეთ სისტემაში'); return; } openBoard(); });
      if (board.close) board.close.addEventListener('click', closeBoard);
      if (board.overlay) board.overlay.addEventListener('click', (e) => { if (e.target === board.overlay) closeBoard(); });

      if (board.form) {
        Object.entries(board.inputs).forEach(([k, input]) => {
          input.addEventListener('input', () => {
            const out = board.values[k]; if (out) out.textContent = Number(input.value || 0).toFixed(2);
          });
        });
        board.form.addEventListener('submit', (e) => {
          e.preventDefault();
          const c = {}; Object.keys(board.inputs).forEach((k) => { c[k] = Number(board.inputs[k].value || 0).toFixed(2); });
          submitRating(c).then(closeBoard);
        });
      }

      if (DOM.reviewCommentForm) {
        DOM.reviewCommentForm.addEventListener('submit', (e) => {
          e.preventDefault();
          if (!state.actorEmail) { alert('გთხოვთ შეხვიდეთ სისტემაში'); return; }
          if (!state.isCertified) return;
          const msg = (DOM.reviewCommentMessage?.value || '').trim();
          if (!msg) return;
          submitComment(msg).then(() => {
            if (DOM.reviewCommentMessage) DOM.reviewCommentMessage.value = '';
          });
        });
      }
    }

    async function submitComment(message) {
      if (!state.isCertified || !state.targetUserId) return;
      try {
        const res = await fetch(`${API_BASE}/reviews/${encodeURIComponent(state.targetUserId)}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(state.actorEmail ? { 'x-actor-email': state.actorEmail } : {}) },
          body: JSON.stringify({ message }),
        });
        if (!res.ok) {
          let detail = ''; try { const j = await res.clone().json(); detail = j?.detail || ''; } catch {}
          alert(detail || 'კომენტარი ვერ დაემატა'); return;
        }
        await loadSummary(); scrollCommentsToBottom();
      } catch { alert('კომენტარი ვერ დაემატა'); }
    }

    function init() {
      // Determine certification (based on previously loaded certData)
      setCertified(!!certData);
      // Self rating disabled
      const isSelf = !!(state.actor && state.targetUserId && state.actor.id === state.targetUserId);
      setCanRate(state.isCertified && !isSelf && !!state.actorEmail);
      // React to certificate loading later
      document.addEventListener('certificate:loaded', (ev) => {
        const cd = ev?.detail?.certData || null;
        setCertified(!!cd);
        setCanRate(!!cd && !isSelf && !!state.actorEmail);
      });
      bindEvents();
      loadSummary();
    }

    return { init, loadSummary };
  }

  // Hide statements triggers when viewing other user's page
  if (VIEW_USER_ID) {
    try { document.querySelector('.drawer-statements')?.setAttribute('hidden', ''); } catch {}
  }

  const reviewsModule = createReviewsModule();
  reviewsModule.init();

  // Expert upload module
  function createExpertModule() {
    const state = {
      enabled: false,
      actorEmail: (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim(),
      user: getCurrentUser(),
      draftId: null,
      list: [],
    };

    function setEnabled(value) {
      state.enabled = !!value;
      if (DOM.expertCard) DOM.expertCard.classList.toggle('disabled', !state.enabled);
      if (!state.enabled) return;
      loadList();
    }

    function setCurrent(code) {
      if (DOM.expertCurrentCode) DOM.expertCurrentCode.textContent = code || '—';
    }

    function buildHeaders() {
      return state.actorEmail ? { 'x-actor-email': state.actorEmail } : {};
    }

    async function loadList() {
      if (!state.enabled || !DOM.expertList) return;
      try {
        const res = await fetch(`${API_BASE}/expert-uploads/mine`, { headers: { 'Cache-Control': 'no-cache', ...buildHeaders() } });
        if (!res.ok) return;
        const items = await res.json();
        state.list = Array.isArray(items) ? items : [];
        renderList();
        const draft = state.list.find((x) => x.status === 'draft');
        state.draftId = draft ? draft.id : null;
        setCurrent(draft?.unique_code || '—');
        updateDraftUI(draft || null);
      } catch {}
    }

    function renderList() {
      const wrap = DOM.expertList;
      if (!wrap) return;
      if (!state.list.length) { wrap.innerHTML = ''; return; }
      const frag = document.createDocumentFragment();
      state.list.forEach((item) => {
        const el = document.createElement('div');
        el.className = 'expert-item';
        const meta = document.createElement('div');
        meta.className = 'meta';
        const created = utils.formatDateTime(item.created_at);
        meta.textContent = `${item.unique_code} · ${created} · ${item.cadastral_code || '—'} · ${item.building_function || '—'}`;
        const files = document.createElement('div');
        files.className = 'files';
        if (item.expertise_filename) {
          const a = document.createElement('a');
          a.textContent = `ექსპერტიზა (${item.expertise_filename})`;
          a.href = `${API_BASE}/expert-uploads/${encodeURIComponent(item.id)}/download?file_type=expertise`;
          if (state.actorEmail) a.href += `&actor=${encodeURIComponent(state.actorEmail)}`;
          a.target = '_blank';
          files.appendChild(a);
        }
        if (item.project_filename) {
          const a = document.createElement('a');
          a.textContent = `პროექტი (${item.project_filename})`;
          a.href = `${API_BASE}/expert-uploads/${encodeURIComponent(item.id)}/download?file_type=project`;
          if (state.actorEmail) a.href += `&actor=${encodeURIComponent(state.actorEmail)}`;
          a.target = '_blank';
          files.appendChild(a);
        }
        el.appendChild(meta);
        el.appendChild(files);
        frag.appendChild(el);
      });
      wrap.innerHTML = '';
      wrap.appendChild(frag);
    }

    function setFileControls(draft) {
      const expDl = DOM.expertExpertiseDownload;
      const expDel = DOM.expertExpertiseDelete;
      const prjDl = DOM.expertProjectDownload;
      const prjDel = DOM.expertProjectDelete;
      const submitted = draft && draft.status === 'submitted';
      if (draft && draft.expertise_filename) {
        if (expDl) { expDl.style.display = ''; expDl.href = `${API_BASE}/expert-uploads/${draft.id}/download?file_type=expertise`; }
        if (expDel) { expDel.style.display = submitted ? 'none' : ''; expDel.disabled = submitted; }
      } else {
        if (expDl) expDl.style.display = 'none';
        if (expDel) expDel.style.display = 'none';
      }
      if (draft && draft.project_filename) {
        if (prjDl) { prjDl.style.display = ''; prjDl.href = `${API_BASE}/expert-uploads/${draft.id}/download?file_type=project`; }
        if (prjDel) { prjDel.style.display = submitted ? 'none' : ''; prjDel.disabled = submitted; }
      } else {
        if (prjDl) prjDl.style.display = 'none';
        if (prjDel) prjDel.style.display = 'none';
      }
    }

    function updateDraftUI(draft) {
      const submitted = !!(draft && draft.status === 'submitted');
      if (DOM.expertFunction) DOM.expertFunction.value = draft?.building_function || '';
      if (DOM.expertCadastral) DOM.expertCadastral.value = draft?.cadastral_code || '';
      if (DOM.expertSaveBtn) DOM.expertSaveBtn.disabled = submitted;
      if (DOM.expertSubmitBtn) DOM.expertSubmitBtn.disabled = submitted || !(draft && draft.expertise_filename && draft.project_filename);
      setFileControls(draft);
    }

    function bindEvents() {
      if (DOM.expertSaveBtn) DOM.expertSaveBtn.addEventListener('click', async () => {
        if (!state.enabled) return;
        const fn = (DOM.expertFunction?.value || '').trim();
        const cad = (DOM.expertCadastral?.value || '').trim();
        const form = new FormData();
        form.set('building_function', fn);
        form.set('cadastral_code', cad);
        const expFile = DOM.expertFileExpertise?.files?.[0] || null;
        const prjFile = DOM.expertFileProject?.files?.[0] || null;
        if (expFile) form.set('expertise', expFile);
        if (prjFile) form.set('project', prjFile);
        try {
          const url = state.draftId ? `${API_BASE}/expert-uploads/${state.draftId}` : `${API_BASE}/expert-uploads`;
          const method = state.draftId ? 'PUT' : 'POST';
          const res = await fetch(url, { method, headers: { ...buildHeaders() }, body: form });
          if (!res.ok) {
            let detail = '';
            try { const j = await res.clone().json(); detail = j?.detail || ''; } catch {}
            alert(detail || 'შენახვა ვერ მოხერხდა');
            return;
          }
          const data = await res.json();
          state.draftId = data.id;
          setCurrent(data.unique_code);
          await loadList();
        } catch {
          alert('შენახვა ვერ მოხერხდა');
        }
      });

      if (DOM.expertExpertiseDelete) DOM.expertExpertiseDelete.addEventListener('click', async () => {
        if (!state.draftId) return;
        try {
          const res = await fetch(`${API_BASE}/expert-uploads/${state.draftId}/file?file_type=expertise`, { method: 'DELETE', headers: { ...buildHeaders() } });
          if (!res.ok) return alert('წაშლა ვერ მოხერხდა');
          await loadList();
        } catch { alert('წაშლა ვერ მოხერხდა'); }
      });
      if (DOM.expertProjectDelete) DOM.expertProjectDelete.addEventListener('click', async () => {
        if (!state.draftId) return;
        try {
          const res = await fetch(`${API_BASE}/expert-uploads/${state.draftId}/file?file_type=project`, { method: 'DELETE', headers: { ...buildHeaders() } });
          if (!res.ok) return alert('წაშლა ვერ მოხერხდა');
          await loadList();
        } catch { alert('წაშლა ვერ მოხერხდა'); }
      });

      if (DOM.expertSubmitBtn) DOM.expertSubmitBtn.addEventListener('click', async () => {
        if (!state.draftId) return;
        try {
          const res = await fetch(`${API_BASE}/expert-uploads/${state.draftId}/submit`, { method: 'POST', headers: { ...buildHeaders() } });
          if (!res.ok) {
            let detail = '';
            try { const j = await res.clone().json(); detail = j?.detail || ''; } catch {}
            alert(detail || 'გაგზავნა ვერ მოხერხდა');
            return;
          }
          await loadList();
        } catch { alert('გაგზავნა ვერ მოხერხდა'); }
      });
    }

    function init() {
      // Public view: show submitted uploads list for that user, hide editing UI
      if (VIEW_USER_ID) {
        const form = document.getElementById('expertForm');
        const actions = document.querySelector('.expert-actions');
        if (form) form.style.display = 'none';
        if (actions) actions.style.display = 'none';
        if (DOM.expertCard) DOM.expertCard.classList.remove('disabled');
        (async () => {
          try {
            const res = await fetch(`${API_BASE}/expert-uploads/of/${encodeURIComponent(VIEW_USER_ID)}`, {
              headers: { 'Cache-Control': 'no-cache' },
            });
            if (!res.ok) return;
            const items = await res.json();
            const wrap = DOM.expertList;
            if (!wrap) return;
            if (!Array.isArray(items) || !items.length) { wrap.innerHTML = ''; return; }
            const frag = document.createDocumentFragment();
            items.forEach((item) => {
              const el = document.createElement('div');
              el.className = 'expert-item';
              const meta = document.createElement('div');
              meta.className = 'meta';
              const created = utils.formatDateTime(item.created_at);
              meta.textContent = `${item.unique_code} · ${created} · ${item.cadastral_code || '—'} · ${item.building_function || '—'}`;
              const files = document.createElement('div');
              files.className = 'files';
              if (item.expertise_filename) {
                const a = document.createElement('a');
                a.textContent = `ექსპერტიზა (${item.expertise_filename})`;
                a.href = `${API_BASE}/expert-uploads/public/${encodeURIComponent(item.id)}/download?file_type=expertise`;
                a.target = '_blank';
                files.appendChild(a);
              }
              if (item.project_filename) {
                const a = document.createElement('a');
                a.textContent = `პროექტი (${item.project_filename})`;
                a.href = `${API_BASE}/expert-uploads/public/${encodeURIComponent(item.id)}/download?file_type=project`;
                a.target = '_blank';
                files.appendChild(a);
              }
              el.appendChild(meta);
              el.appendChild(files);
              frag.appendChild(el);
            });
            wrap.innerHTML = '';
            wrap.appendChild(frag);
          } catch {}
        })();
        return;
      }

      // Owner view
      bindEvents();
      // Enabled only if certificate level == expert
      setEnabled(!VIEW_USER_ID && !!(certData && (String(certData.level || '').toLowerCase() === 'expert')));
      document.addEventListener('certificate:loaded', (ev) => {
        const cd = ev?.detail?.certData || null;
        setEnabled(!VIEW_USER_ID && !!(cd && (String(cd.level || '').toLowerCase() === 'expert')));
      });
    }

    return { init, setEnabled };
  }

  const expertModule = createExpertModule();
  expertModule.init();

  if (DOM.navLogo) {
    DOM.navLogo.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const goHome = (e) => {
    if (e) e.preventDefault();
    window.location.href = 'index.html';
  };
  if (DOM.homeBtn) DOM.homeBtn.addEventListener('click', goHome);
  if (DOM.drawerHomeBtn) DOM.drawerHomeBtn.addEventListener('click', goHome);

  const goIndex = (e) => {
    e.preventDefault();
    window.location.href = 'index.html';
  };
  if (DOM.navRegistry) DOM.navRegistry.addEventListener('click', goIndex);
  if (DOM.drawerRegistry) DOM.drawerRegistry.addEventListener('click', goIndex);
  // statements click handled by statementsModule (no redirect)

  function closeDropdown() {
    if (!DOM.dropdown) return;
    DOM.dropdown.classList.remove('show');
    DOM.dropdown.setAttribute('aria-hidden', 'true');
    DOM.examTrigger?.setAttribute('aria-expanded', 'false');
  }
  function toggleDropdown(e) {
    e.preventDefault();
    if (!DOM.dropdown) return;
    const open = !DOM.dropdown.classList.contains('show');
    if (open) {
      DOM.dropdown.classList.add('show');
      DOM.dropdown.setAttribute('aria-hidden', 'false');
      DOM.examTrigger?.setAttribute('aria-expanded', 'true');
      setTimeout(() => document.addEventListener('click', handleDocClickClose), 0);
    } else {
      closeDropdown();
    }
  }
  function handleDocClickClose(event) {
    if (event.target.closest('.nav-exam')) return;
    closeDropdown();
    document.removeEventListener('click', handleDocClickClose);
  }
  if (DOM.examTrigger) DOM.examTrigger.addEventListener('click', toggleDropdown);
  document.querySelectorAll('.dropdown-item.theoretical').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closeDropdown();
      window.location.href = 'exam.html';
    });
  });
  document.querySelectorAll('.dropdown-item.review').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closeDropdown();
      alert('პროექტის განხილვა — მალე დაემატება');
    });
  });

  function toggleDrawerSubmenu(e) {
    e.preventDefault();
    if (!DOM.drawerSubmenu) return;
    const hidden = DOM.drawerSubmenu.hasAttribute('hidden');
    if (hidden) {
      DOM.drawerSubmenu.removeAttribute('hidden');
      DOM.drawerExamTrigger?.setAttribute('aria-expanded', 'true');
    } else {
      DOM.drawerSubmenu.setAttribute('hidden', '');
      DOM.drawerExamTrigger?.setAttribute('aria-expanded', 'false');
    }
  }
  if (DOM.drawerExamTrigger) DOM.drawerExamTrigger.addEventListener('click', toggleDrawerSubmenu);
  document.querySelectorAll('.drawer-submenu-item.theoretical').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      DOM.body.classList.remove('menu-open');
      window.location.href = 'exam.html';
    });
  });
  document.querySelectorAll('.drawer-submenu-item.review').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      alert('პროექტის განხილვა — მალე დაემატება');
    });
  });

  const openMenu = () => {
    DOM.body.classList.add('menu-open');
    if (DOM.burger) DOM.burger.setAttribute('aria-expanded', 'true');
  };
  const closeMenu = () => {
    DOM.body.classList.remove('menu-open');
    if (DOM.burger) DOM.burger.setAttribute('aria-expanded', 'false');
    if (DOM.drawerSubmenu) {
      DOM.drawerSubmenu.setAttribute('hidden', '');
      DOM.drawerExamTrigger?.setAttribute('aria-expanded', 'false');
    }
  };
  if (DOM.burger) DOM.burger.addEventListener('click', () => (DOM.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
  if (DOM.overlay) DOM.overlay.addEventListener('click', closeMenu);
  if (DOM.drawerClose) DOM.drawerClose.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDropdown();
      closeMenu();
    }
  });

  const menuModule = { close: closeMenu };

  function createStatementsModule() {
    let overlayOpen = false;
    let isLoading = false;
    let cache = [];

    function ensureAuthForCompose(event) {
      if (authModule.isLoggedIn()) return true;
      if (event?.cancelable) event.preventDefault();
      alert('გთხოვთ გაიაროთ ავტორიზაცია');
      return false;
    }

    function getActorEmail() {
      return (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim();
    }

    function setMetaFromUser() {
      if (!DOM.statementsMeta) return;
      const user = authModule.getCurrentUser?.();
      const actorEmail = getActorEmail();
      const parts = [];
      if (user) {
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        if (name) parts.push(name);
        if (user.code) parts.push(`კოდი: ${user.code}`);
        if (user.email) parts.push(user.email);
      } else if (actorEmail) {
        parts.push(actorEmail);
      }
      DOM.statementsMeta.textContent = parts.join(' · ');
    }

    function openOverlay() {
      if (!DOM.statementsOverlay) return;
      overlayOpen = true;
      DOM.statementsOverlay.classList.add('open');
      DOM.statementsOverlay.setAttribute('aria-hidden', 'false');
      DOM.body.classList.add('modal-open');
    }

    function closeOverlay() {
      if (!DOM.statementsOverlay) return;
      overlayOpen = false;
      DOM.statementsOverlay.classList.remove('open');
      DOM.statementsOverlay.setAttribute('aria-hidden', 'true');
      DOM.body.classList.remove('modal-open');
    }

    function isOpen() { return overlayOpen; }

    function renderPlaceholder(text, modifier) {
      if (!DOM.statementsList) return;
      const placeholder = document.createElement('div');
      placeholder.className = `statements-placeholder${modifier ? ` ${modifier}` : ''}`;
      placeholder.textContent = text;
      DOM.statementsList.innerHTML = '';
      DOM.statementsList.appendChild(placeholder);
    }

    function renderList(items) {
      if (!DOM.statementsList) return;
      if (!items.length) {
        renderPlaceholder('განცხადებები ჯერ არ გაქვთ.', 'statements-empty');
        return;
      }
      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        const details = document.createElement('details');
        details.className = 'statement-item';
        details.setAttribute('role', 'listitem');
        const summary = document.createElement('summary');
        summary.className = 'statement-summary';
        const dateSpan = document.createElement('span');
        dateSpan.className = 'statement-date';
        dateSpan.textContent = utils.formatDateTime(item.created_at);
        summary.appendChild(dateSpan);
        details.appendChild(summary);
        const message = document.createElement('div');
        message.className = 'statement-message';
        message.textContent = item.message || '';
        details.appendChild(message);
        fragment.appendChild(details);
      });
      DOM.statementsList.innerHTML = '';
      DOM.statementsList.appendChild(fragment);
    }

    async function fetchStatements() {
      if (!DOM.statementsList || isLoading) return;
      const actorEmail = getActorEmail();
      if (!actorEmail) {
        renderPlaceholder('ავტორიზაცია ვერ დადასტურდა', 'statements-error');
        return;
      }
      isLoading = true;
      try {
        const response = await fetch(`${API_BASE}/statements/me`, {
          headers: {
            'x-actor-email': actorEmail,
            'Cache-Control': 'no-cache',
          },
          credentials: 'include',
        });
        if (!response.ok) {
          if (response.status === 401) {
            renderPlaceholder('გთხოვთ გაიაროთ ავტორიზაცია', 'statements-error');
            alert('გთხოვთ გაიაროთ ავტორიზაცია');
            closeOverlay();
            return;
          }
          let detail = '';
          try {
            const json = await response.clone().json();
            detail = json?.detail || '';
          } catch {
            try { detail = (await response.clone().text()).trim(); } catch {}
          }
          throw new Error(detail || 'ჩატვირთვის შეცდომა');
        }
        const data = await response.json();
        cache = Array.isArray(data) ? data : [];
        renderList(cache);
      } catch (error) {
        console.error('Failed to load statements', error);
        renderPlaceholder('ჩატვირთვის შეცდომა', 'statements-error');
      } finally {
        isLoading = false;
      }
    }

    function handleOpenRequest(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (!authModule.isLoggedIn()) {
        alert('გთხოვთ გაიაროთ ავტორიზაცია');
        return;
      }
      const actorEmail = getActorEmail();
      if (!actorEmail) {
        alert('ავტორიზაცია ვერ დადასტურდა');
        return;
      }
      menuModule.close();
      setMetaFromUser();
      openOverlay();
      renderPlaceholder('იტვირთება...', 'statements-loading');
      fetchStatements();
    }

    function handleBackdropClick(event) {
      if (event.target === DOM.statementsOverlay) {
        closeOverlay();
      }
    }

    async function handleComposeSubmit(event) {
      event.preventDefault();
      if (!DOM.statementsForm) return;
      if (!authModule.isLoggedIn()) {
        alert('გთხოვთ გაიაროთ ავტორიზაცია');
        return;
      }
      const formData = new FormData(DOM.statementsForm);
      const message = utils.getTrimmed(formData, 'message');
      if (!message) return alert('გთხოვთ შეიყვანოთ შეტყობინება');
      const actorEmail = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim();
      if (!actorEmail) {
        alert('ავტორიზაცია ვერ დადასტურდა');
        return;
      }
      const submitBtn = DOM.statementsForm.querySelector('button[type="submit"]');
      submitBtn?.setAttribute('disabled', 'true');
      try {
        const response = await fetch(`${API_BASE}/statements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-email': actorEmail,
          },
          body: JSON.stringify({ message }),
          credentials: 'include',
        });
        if (!response.ok) {
          let detail = '';
          try {
            const json = await response.clone().json();
            detail = json?.detail || '';
          } catch {
            try { detail = (await response.clone().text()).trim(); } catch {}
          }
          throw new Error(detail || 'გაგზავნა ვერ შესრულდა');
        }
        const data = await response.json();
        alert('თქვენი განცხადება მიღებულია!');
        DOM.statementsForm.reset();
        handleNewStatement(data);
      } catch (error) {
        console.error('Failed to submit statement', error);
        alert(error.message || 'გაგზავნა ვერ შესრულდა');
      } finally {
        submitBtn?.removeAttribute('disabled');
      }
    }

    function handleNewStatement(statement) {
      if (!statement || typeof statement !== 'object') return;
      cache = [statement, ...cache.filter((item) => item.id !== statement.id)];
      if (overlayOpen) {
        renderList(cache);
      }
    }

    function reset() {
      cache = [];
      if (overlayOpen) {
        closeOverlay();
      }
      if (DOM.statementsList) DOM.statementsList.innerHTML = '';
      if (DOM.statementsMeta) DOM.statementsMeta.textContent = '';
    }

    function init() {
      utils.on(DOM.navStatements, 'click', handleOpenRequest);
      utils.on(DOM.drawerStatements, 'click', handleOpenRequest);
      utils.on(DOM.statementsClose, 'click', closeOverlay);
      utils.on(DOM.statementsOverlay, 'click', handleBackdropClick);
      utils.on(DOM.statementsForm, 'submit', handleComposeSubmit);
      utils.on(DOM.statementsTextarea, 'mousedown', ensureAuthForCompose);
      utils.on(DOM.statementsTextarea, 'focus', ensureAuthForCompose);
      document.addEventListener('auth:logout', reset);
      document.addEventListener('auth:login', setMetaFromUser);
      setMetaFromUser();
    }

    return { init, isOpen, close: closeOverlay, refresh: fetchStatements, handleNewStatement, reset };
  }

  if (!VIEW_USER_ID) {
    const statementsModule = createStatementsModule();
    statementsModule.init();
  }
});


