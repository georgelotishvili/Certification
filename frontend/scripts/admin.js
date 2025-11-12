document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE === 'string')
    ? window.APP_CONFIG.API_BASE
    : 'http://127.0.0.1:8000';
  const KEYS = {
    AUTH: 'authLoggedIn',
    SAVED_EMAIL: 'savedEmail',
    CURRENT_USER: 'currentUser',
    EXAM_DURATION: 'examDuration',
    ADMIN_PWD: 'adminGatePassword',
    BLOCKS: 'examBlocks_v1',
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
    candidateResultsOverlay: document.getElementById('candidateResultsOverlay'),
    candidateResultsList: document.getElementById('candidateResultsList'),
    candidateResultsFullName: document.getElementById('candidateResultsFullName'),
    candidateResultsCode: document.getElementById('candidateResultsCode'),
    candidateResultsPersonalId: document.getElementById('candidateResultsPersonalId'),
    candidateResultsClose: document.getElementById('candidateResultsClose'),
    userStatementsOverlay: document.getElementById('userStatementsOverlay'),
    userStatementsList: document.getElementById('userStatementsList'),
    userStatementsMeta: document.getElementById('userStatementsMeta'),
    userStatementsClose: document.getElementById('userStatementsClose'),
    userCertificateOverlay: document.getElementById('userCertificateOverlay'),
    userCertificateClose: document.getElementById('userCertificateClose'),
    userCertificateDownload: document.getElementById('userCertificateDownload'),
    certificateCard: document.getElementById('certificateCard'),
    certificateStatusBadge: document.getElementById('certificateStatusBadge'),
    userCertificateDelete: document.getElementById('userCertificateDelete'),
    certificateEditBtn: document.getElementById('certificateEditBtn'),
    certificateEmptyState: document.getElementById('certificateEmptyState'),
    certificateEmptyCreate: document.getElementById('certificateEmptyCreate'),
    certificateForm: document.getElementById('certificateForm'),
    certificateFormCode: document.getElementById('certificateFormCode'),
    certificateFormCodeDisplay: document.getElementById('certificateFormCodeDisplay'),
    certificateFormLevel: document.getElementById('certificateFormLevel'),
    certificateFormStatus: document.getElementById('certificateFormStatus'),
    certificateFormIssueDate: document.getElementById('certificateFormIssueDate'),
    certificateFormValidityTerm: document.getElementById('certificateFormValidityTerm'),
    certificateFormValidUntil: document.getElementById('certificateFormValidUntil'),
    certificateFormValidUntilDisplay: document.getElementById('certificateFormValidUntilDisplay'),
    certificateFormSubmit: document.getElementById('certificateFormSubmit'),
    certificateFormName: document.getElementById('certificateFormName'),
    certificateFormPhone: document.getElementById('certificateFormPhone'),
    certificateFormEmail: document.getElementById('certificateFormEmail'),
    resultDetailOverlay: document.getElementById('resultDetailOverlay'),
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
    resultQuestionList: document.getElementById('resultQuestionList'),
    resultDetailDownload: document.getElementById('resultDetailDownload'),
    resultDetailMedia: document.getElementById('resultDetailMedia'),
    resultDetailScreenMedia: document.getElementById('resultDetailScreenMedia'),
    resultDetailClose: document.getElementById('resultDetailClose'),
    resultMediaSection: document.getElementById('resultMediaSection'),
    resultMediaPlayer: document.getElementById('resultMediaPlayer'),
    resultMediaDownload: document.getElementById('resultMediaDownload'),
    resultMediaInfo: document.getElementById('resultMediaInfo'),
    userEditOverlay: document.getElementById('userEditOverlay'),
    userEditForm: document.getElementById('userEditForm'),
    userEditClose: document.getElementById('userEditClose'),
    userEditCancel: document.getElementById('userEditCancel'),
    userEditTitle: document.getElementById('userEditTitle'),
    userEditFirstName: document.getElementById('userEditFirstName'),
    userEditLastName: document.getElementById('userEditLastName'),
    userEditPersonalId: document.getElementById('userEditPersonalId'),
    userEditPhone: document.getElementById('userEditPhone'),
    userEditEmail: document.getElementById('userEditEmail'),
    userEditCode: document.getElementById('userEditCode'),
    userEditSave: document.getElementById('userEditSave'),
  };

  const NAV_TARGETS = {
    'გამოცდა': 'exam',
    'რეგისტრაციები': 'registrations',
    'რეგისტრირებული პირები': 'registrations',
    'პროექტი': null,
  };

  const on = (element, event, handler) => element && element.addEventListener(event, handler);
  const activeOverlays = new Set();

  const shared = window.AdminShared || {};
  const modules = window.AdminModules || {};
  const {
    showToast = () => {},
    formatDateTime = (value) => String(value ?? ''),
    formatDuration = () => '—',
    arrayBufferToBase64 = () => '',
    loadExternalScript = () => Promise.resolve(),
    escapeHtml = (value) => String(value ?? ''),
    handleAdminErrorResponse = async () => {},
  } = shared;

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

  function isFounderActor() {
    return (localStorage.getItem(KEYS.SAVED_EMAIL) || '').toLowerCase() === FOUNDER_EMAIL.toLowerCase();
  }

  function getAdminHeaders() {
    return {};
  }

  function getActorEmail() {
    const actor = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim();
    return actor;
  }

  function getActorHeaders() {
    const actor = getActorEmail();
    return actor ? { 'x-actor-email': actor } : {};
  }

  async function ensureAdminAccess() {
    const redirectToHome = () => {
      alert('ადმინისტრატორის გვერდზე დაშვება აქვს მხოლოდ ადმინს');
      window.location.href = 'index.html';
      return false;
    };

    const loggedIn = localStorage.getItem(KEYS.AUTH) === 'true';
    const savedEmail = (localStorage.getItem(KEYS.SAVED_EMAIL) || '').trim().toLowerCase();
    const isLocalAdmin = !!getCurrentUser()?.isAdmin;
    const isFounder = savedEmail === FOUNDER_EMAIL.toLowerCase();

    if (!loggedIn || !savedEmail || (!isFounder && !isLocalAdmin)) {
      return redirectToHome();
    }

    try {
      const response = await fetch(`${API_BASE}/admin/auth/verify`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders(), 'Cache-Control': 'no-cache' },
        credentials: 'include',
      });
      if (response.ok) return true;
    if (response.status === 401) {
        console.warn('Admin verification failed with 401');
        return redirectToHome();
      }
      console.error('Unexpected admin verification response', response.status);
    } catch (error) {
      console.error('Admin verification request failed', error);
    }

    showToast('ადმინის ავტორიზაცია ვერ დადასტურდა', 'error');
    return redirectToHome();
  }

  function wireNavigation({ users }) {
    const setMenu = (open) => {
      DOM.body?.classList.toggle('menu-open', open);
      if (DOM.burger) DOM.burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    const closeMenu = () => setMenu(false);
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
          users?.render?.();
        }
      });
    });
  }

  const statementsEventHandlers = [];
  window.addEventListener('admin:statementsSeen', (event) => {
    statementsEventHandlers.forEach((handler) => {
      try { handler(event); } catch (error) { console.warn('Statements seen handler failed', error); }
    });
  });

  void bootstrapAdmin();

  async function bootstrapAdmin() {
    const moduleContextBase = {
      DOM,
      API_BASE,
      on,
      showToast,
      escapeHtml,
      formatDateTime,
      formatDuration,
      arrayBufferToBase64,
      loadExternalScript,
      handleAdminErrorResponse,
      getAdminHeaders,
      getActorHeaders,
      getActorEmail,
      openOverlay,
      closeOverlay,
      isFounderActor,
    };

    const examSettings = modules.createExamSettingsModule
      ? modules.createExamSettingsModule(moduleContextBase)
      : { init: () => {} };

    const blocksModule = modules.createBlocksModule
      ? modules.createBlocksModule(moduleContextBase)
      : { init: () => {}, render: () => {}, reload: () => {} };

    const resultsModule = modules.createResultsModule
      ? modules.createResultsModule(moduleContextBase)
      : { init: () => {}, open: () => {}, close: () => {} };

    const statementsModule = modules.createStatementsModule
      ? modules.createStatementsModule({ ...moduleContextBase })
      : { init: () => {}, open: () => {}, close: () => {}, downloadStatementPdf: () => {}, markStatementsSeen: () => {} };

    const certificateModule = modules.createCertificateModule
      ? modules.createCertificateModule({ ...moduleContextBase })
      : { init: () => {}, open: () => {}, close: () => {} };

    const usersModule = modules.createUsersModule
      ? modules.createUsersModule({
          ...moduleContextBase,
          onShowResults: resultsModule.open,
          onShowStatements: statementsModule.open,
          onShowCertificate: certificateModule.open,
        })
      : { init: () => {}, render: () => {} };

    const hasAccess = await ensureAdminAccess();
    if (!hasAccess) return;

    wireNavigation({ users: usersModule });

    examSettings.init();
    blocksModule.init();
    resultsModule.init();
    statementsModule.init();
    certificateModule.init();
    usersModule.init();

    usersModule.refreshUnseenSummary?.();

    statementsEventHandlers.push((event) => {
      const detail = event.detail || {};
      if (detail.userId != null) {
        usersModule.updateUserUnseenStatus?.(detail.userId, detail.hasUnseen, detail.remainingCount);
      }
      if (detail.refreshSummary !== false) {
        usersModule.refreshUnseenSummary?.();
      }
    });

    showSection(null);
  }
});


