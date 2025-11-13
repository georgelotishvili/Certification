(function (global) {
  function createCertificateModule(context = {}) {
    const {
      DOM = {},
      API_BASE = 'http://127.0.0.1:8000',
      openOverlay = () => {},
      closeOverlay = () => {},
      showToast = () => {},
      getAdminHeaders = () => ({}),
      getActorHeaders = () => ({}),
      handleAdminErrorResponse = async () => {},
      onUserCertificateUpdated = () => {},
      escapeHtml = (value) => {
        if (value == null) return '';
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },
    } = context;

    const overlay = DOM.userCertificateOverlay;
    const closeBtn = DOM.userCertificateClose;
    const downloadBtn = DOM.userCertificateDownload;
    const deleteBtn = DOM.userCertificateDelete;
    const editBtn = DOM.certificateEditBtn;
    const emptyState = DOM.certificateEmptyState;
    const emptyCreateBtn = DOM.certificateEmptyCreate;
    const card = DOM.certificateCard || overlay?.querySelector('#certificateCard');
    const statusBadge = DOM.certificateStatusBadge || overlay?.querySelector('#certificateStatusBadge');
    const form = DOM.certificateForm;
    const formSubmitBtn = DOM.certificateFormSubmit;
    const validUntilDisplayNode = DOM.certificateFormValidUntilDisplay;

    const formFields = {
      uniqueCode: DOM.certificateFormCode,
      level: DOM.certificateFormLevel,
      status: DOM.certificateFormStatus,
      issueDate: DOM.certificateFormIssueDate,
      validityTerm: DOM.certificateFormValidityTerm,
      validUntil: DOM.certificateFormValidUntil,
    };

    const formSummaryNodes = {
      name: DOM.certificateFormName,
      phone: DOM.certificateFormPhone,
      email: DOM.certificateFormEmail,
      code: DOM.certificateFormCodeDisplay,
    };

    const templateContainer = overlay?.querySelector('#certificateTemplateContainer');
    
    const fieldNodes = {};
    function updateFieldNodes() {
      // Clear existing
      Object.keys(fieldNodes).forEach(key => delete fieldNodes[key]);
      // Bind new template fields
      if (!overlay) return;
      overlay.querySelectorAll('[data-field]').forEach((node) => {
        fieldNodes[node.dataset.field] = node;
      });
    }

    const STATUS_MAP = new Map([
      ['active', { key: 'active', label: 'მოქმედი' }],
      ['მოქმედი', { key: 'active', label: 'მოქმედი' }],
      ['suspended', { key: 'suspended', label: 'შეჩერებული' }],
      ['შეჩერებული', { key: 'suspended', label: 'შეჩერებული' }],
      ['paused', { key: 'suspended', label: 'შეჩერებული' }],
      ['inactive', { key: 'suspended', label: 'შეჩერებული' }],
      ['expired', { key: 'expired', label: 'ვადაგასული' }],
      ['ვადაგასული', { key: 'expired', label: 'ვადაგასული' }],
    ]);

    const LEVEL_MAP = new Map([
      ['architect', { key: 'architect', label: 'შენობა-ნაგებობის არქიტექტორი' }],
      ['architect_expert', { key: 'expert', label: 'არქიტექტურული პროექტის ექსპერტი' }],
      ['expert', { key: 'expert', label: 'არქიტექტურული პროექტის ექსპერტი' }],
      ['არქიტექტორი', { key: 'architect', label: 'შენობა-ნაგებობის არქიტექტორი' }],
      ['არქიტექტორი ექსპერტი', { key: 'expert', label: 'არქიტექტურული პროექტის ექსპერტი' }],
      ['შენობა-ნაგებობის არქიტექტორი', { key: 'architect', label: 'შენობა-ნაგებობის არქიტექტორი' }],
      ['არქიტექტურული პროექტის ექსპერტი', { key: 'expert', label: 'არქიტექტურული პროექტის ექსპერტი' }],
    ]);

    function resolveLevelKey(raw) {
      if (!raw) return 'architect';
      if (typeof raw === 'object') {
        return raw.key === 'expert' ? 'expert' : 'architect';
      }
      const s = String(raw).trim().toLowerCase();
      if (s === 'expert' || s === 'architect_expert' || s === 'არქიტექტორი ექსპერტი' || s === 'არქიტექტურული პროექტის ექსპერტი') {
        return 'expert';
      }
      return 'architect';
    }

    const TIER_CLASSES = {
      architect: 'certificate-card--architect',
      expert: 'certificate-card--expert',
    };

    let activeUserRef = null;
    let activeUser = null;
    let activeData = null;
    let formOpen = false;
    let formMode = 'create';

    function ensureOverlay() {
      if (!overlay || !card) {
        console.warn('Certificate overlay missing required DOM nodes');
        return false;
      }
      return true;
    }

    function parseDate(value) {
      if (!value) return null;
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
      }
      if (typeof value === 'number') {
        const fromNum = new Date(value);
        return Number.isNaN(fromNum.getTime()) ? null : fromNum;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const normalized = trimmed.replace(/\s+/g, ' ');
        const fromString = new Date(normalized);
        if (!Number.isNaN(fromString.getTime())) return fromString;
        const parts = normalized.split(/[./-]/).map((part) => part.trim());
        if (parts.length === 3) {
          const [a, b, c] = parts;
          if (c.length === 4) {
            const iso = `${c.padStart(4, '0')}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
            const fromReversed = new Date(iso);
            if (!Number.isNaN(fromReversed.getTime())) return fromReversed;
          }
        }
      }
      return null;
    }

    function formatDate(date) {
      const parsed = parseDate(date);
      if (!parsed) return '';
      try {
        return new Intl.DateTimeFormat('ka-GE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(parsed);
      } catch (error) {
        console.warn('Failed to format date', date, error);
        return '';
      }
    }

    function formatInputDate(value) {
      const parsed = parseDate(value);
      if (!parsed) return '';
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function parseNumber(value) {
      if (value == null || value === '') return null;
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      let source = String(value).trim();
      if (!source) return null;
      source = source.replace(/[^\d.,-]/g, '');
      source = source.replace(',', '.');
      const normalized = Number(source);
      if (!Number.isFinite(normalized)) return null;
      return normalized;
    }

    function computeValidity({ issueDate, validityTerm, validUntil }) {
      const issued = parseDate(issueDate);
      const expiry = parseDate(validUntil);
      const termNumber = parseNumber(validityTerm);
      let derivedValidUntil = expiry;
      if (!derivedValidUntil && issued && termNumber) {
        const computed = new Date(issued);
        computed.setFullYear(computed.getFullYear() + termNumber);
        derivedValidUntil = computed;
      }
      return derivedValidUntil;
    }

    function normalizeStatus(rawStatus, validUntilDate) {
      const fallback = STATUS_MAP.get('active');
      const rawKey = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
      let normalized = STATUS_MAP.get(rawStatus) || STATUS_MAP.get(rawKey) || fallback;

      const expiration = parseDate(validUntilDate);
      if (expiration) {
        const now = new Date();
        const expirationMoment = new Date(expiration);
        expirationMoment.setHours(23, 59, 59, 999);
        if (expirationMoment.getTime() < now.getTime()) {
          normalized = STATUS_MAP.get('expired');
        }
      }

      return normalized;
    }

    function normalizeLevel(rawLevel) {
      if (!rawLevel) return LEVEL_MAP.get('architect');
      return (
        LEVEL_MAP.get(rawLevel) ||
        LEVEL_MAP.get(String(rawLevel).trim().toLowerCase()) ||
        LEVEL_MAP.get('architect')
      );
    }

    function hasCertificatePayload(certificate = {}) {
      if (!certificate || typeof certificate !== 'object') return false;
      const keys = [
        'unique_code',
        'code',
        'status',
        'state',
        'level',
        'rank',
        'issue_date',
        'issueDate',
        'exam_date',
        'examDate',
        'passed_at',
        'valid_until',
        'validUntil',
        'expires_at',
        'validity_term',
        'validity_years',
        'notes',
        'comment',
        'description',
      ];
      return keys.some((key) => {
        const value = certificate[key];
        if (value == null) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        return true;
      });
    }

    function buildFullName(user) {
      const source = user || {};
      const first = (source.first_name || source.firstName || '').trim();
      const last = (source.last_name || source.lastName || '').trim();
      return `${first} ${last}`.trim();
    }

    function buildCertificateData(user) {
      const certificate = user?.certificate || user?.certificate_info || {};
      const hasCertificate = hasCertificatePayload(certificate);

      const firstName = user?.first_name || user?.firstName || certificate.first_name || '';
      const lastName = user?.last_name || user?.lastName || certificate.last_name || '';
      const phone = user?.phone || certificate.phone || '';
      const email = user?.email || certificate.email || '';
      const rawUniqueCode = certificate.unique_code || certificate.code || '';
      const uniqueCode = rawUniqueCode || user?.code || '';

      const rawLevel =
        certificate.level || certificate.rank || user?.certificate_level || user?.level;
      const level = normalizeLevel(rawLevel);

      const issueDateRaw =
        certificate.issue_date ||
        certificate.issueDate ||
        certificate.exam_date ||
        certificate.examDate ||
        certificate.passed_at ||
        user?.certificate_issue_date ||
        user?.issue_date ||
        user?.exam_passed_at ||
        user?.examDate ||
        '';

      const validityTermRaw =
        certificate.validity_term ??
        certificate.validity_years ??
        certificate.validity ??
        user?.certificate_validity ??
        null;

      const validUntilSource =
        certificate.valid_until ||
        certificate.validUntil ||
        certificate.expires_at ||
        user?.certificate_valid_until ||
        '';

      const computedValidUntil = computeValidity({
        issueDate: issueDateRaw,
        validityTerm: validityTermRaw,
        validUntil: validUntilSource,
      });
      const validUntilDate = computedValidUntil || parseDate(validUntilSource);

      const status = normalizeStatus(
        certificate.status || certificate.state || user?.certificate_status,
        validUntilDate
      );
      const termNumber = parseNumber(validityTermRaw);
      return {
        firstName,
        lastName,
        fullName: buildFullName({ first_name: firstName, last_name: lastName }),
        phone,
        email,
        uniqueCode,
        level,
        status,
        issueDate: formatDate(issueDateRaw),
        issueDateInputValue: formatInputDate(issueDateRaw),
        rawIssueDate: issueDateRaw,
        rawValidityTerm: termNumber,
        validityTerm:
          termNumber == null
            ? ''
            : String(termNumber),
        validUntil: formatDate(validUntilDate),
        validUntilInputValue: formatInputDate(validUntilDate),
        rawValidUntil: validUntilSource,
        isInactive: status.key === 'suspended' || status.key === 'expired',
        hasCertificate,
      };
    }

    function setField(name, value) {
      const node = fieldNodes[name];
      if (!node) return;
      const textValue = value == null || value === '' ? '—' : String(value);
      node.textContent = textValue;
      if (textValue === '—') {
        node.dataset.empty = 'true';
      } else {
        node.removeAttribute('data-empty');
      }
    }

    let themeLinkEl = null;
    function ensureThemeStyles() {
      if (themeLinkEl && document.head.contains(themeLinkEl)) return themeLinkEl;
      themeLinkEl = document.getElementById('certificateThemeStyles');
      if (!themeLinkEl) {
        themeLinkEl = document.createElement('link');
        themeLinkEl.id = 'certificateThemeStyles';
        themeLinkEl.rel = 'stylesheet';
        document.head.appendChild(themeLinkEl);
      } else {
        document.head.appendChild(themeLinkEl);
      }
      return themeLinkEl;
    }

    async function loadCertificateTemplate(level) {
      if (!templateContainer) return;
      
      const levelKey = level === 'expert' ? 'expert' : 'architect';
      const templatePath = `../certificate/${levelKey}.html`;
      const cssPath = `../certificate/${levelKey}.css`;
      const themeVersion = '20251113';
      
      try {
        const response = await fetch(templatePath);
        if (!response.ok) {
          console.error(`[certificate] Failed to load template: ${templatePath}`);
          return;
        }
        const html = await response.text();
        // Wrap template with a scale wrapper so transform scaling preserves layout centering
        templateContainer.innerHTML = `<div class="certificate-scale-wrapper">${html}</div>`;
        
        // Update field nodes after loading template
        updateFieldNodes();

        // Apply corresponding theme stylesheet (last in head to win CSS cascade)
        const link = ensureThemeStyles();
        const versionedCssPath = `${cssPath}?v=${themeVersion}`;
        if (link.getAttribute('href') !== versionedCssPath) {
          link.setAttribute('href', versionedCssPath);
        }

        // Field nodes updated; scaling will be handled by caller
      } catch (error) {
        console.error('[certificate] Error loading certificate template', error);
      }
    }

    function fitCertificateToContainer() {
      if (!templateContainer) return;
      let wrapperEl = templateContainer.querySelector('.certificate-scale-wrapper');
      const certificateEl = templateContainer.querySelector('.certificate-background');
      if (!certificateEl) return;
      if (!wrapperEl) {
        // Create wrapper if missing
        wrapperEl = document.createElement('div');
        wrapperEl.className = 'certificate-scale-wrapper';
        certificateEl.parentElement?.insertBefore(wrapperEl, certificateEl);
        wrapperEl.appendChild(certificateEl);
      }

      // Base certificate size (px) – used for precise scaling
      const BASE_WIDTH = 1123;
      const BASE_HEIGHT = 793;

      // Ensure base size so absolute/percent positions map predictably
      certificateEl.style.width = `${BASE_WIDTH}px`;
      certificateEl.style.height = `${BASE_HEIGHT}px`;
      certificateEl.style.transformOrigin = 'top left';

      // Available space: fit to viewport (with a small margin so header/actions don't overlap)
      const viewportMargin = 24;
      const availableWidth = Math.max(0, window.innerWidth - viewportMargin * 2);
      const availableHeight = Math.max(0, window.innerHeight - viewportMargin * 2);

      // Scale to fit while preserving aspect ratio
      const scale = Math.max(
        0.1,
        Math.min(availableWidth / BASE_WIDTH, availableHeight / BASE_HEIGHT)
      );

      certificateEl.style.transform = `scale(${scale})`;

      // Size the wrapper to the scaled dimensions so Flexbox can center correctly
      const scaledWidth = BASE_WIDTH * scale;
      const scaledHeight = BASE_HEIGHT * scale;
      wrapperEl.style.width = `${scaledWidth}px`;
      wrapperEl.style.height = `${scaledHeight}px`;
      wrapperEl.style.position = 'relative';
      wrapperEl.style.display = 'block';

      // Ensure container does not show anything outside the certificate
      templateContainer.style.display = 'block';
      templateContainer.style.overflow = 'hidden';
    }

    function applyCardStyling(data) {
      if (!card || !data) return;
      Object.values(TIER_CLASSES).forEach((className) => card.classList.remove(className));
      card.classList.remove('certificate-card--inactive');

      const tierKey = resolveLevelKey(data.level || data.level?.key);
      const tierClass = TIER_CLASSES[tierKey] || TIER_CLASSES.architect;
      card.classList.add(tierClass);
      card.dataset.certTier = tierKey;

      if (data.isInactive) {
        card.classList.add('certificate-card--inactive');
      }
    }

    function renderStatus(data) {
      if (!statusBadge) return;
      statusBadge.classList.remove('is-suspended', 'is-expired');

      if (!data || !data.hasCertificate) {
        statusBadge.innerHTML =
          '<span class="status-indicator" aria-hidden="true"></span>—';
        return;
      }

      const indicator = '<span class="status-indicator" aria-hidden="true"></span>';
      statusBadge.innerHTML = `${indicator}${escapeHtml(data.status.label)}`;
      if (data.status.key === 'suspended') {
        statusBadge.classList.add('is-suspended');
      } else if (data.status.key === 'expired') {
        statusBadge.classList.add('is-expired');
      }
    }

    function nextAnimationFrame() {
      return new Promise((resolve) => requestAnimationFrame(resolve));
    }

    async function populateView(data) {
      if (!data) return;
      applyCardStyling(data);
      
      // Load certificate template based on level
      const levelKey = resolveLevelKey(data.level || data.level?.key);
      await loadCertificateTemplate(levelKey);
      
      // Wait next frame for DOM render
      await nextAnimationFrame();
      
      // Fit after DOM update
      fitCertificateToContainer();
      
      setField('uniqueCode', data.uniqueCode || '—');
      setField('fullName', data.fullName || buildFullName(activeUser) || '—');
      setField('personalId', activeUser?.personal_id || '—');
      setField('issueDate', data.hasCertificate ? data.issueDate || '—' : '—');
      setField('validityTerm', data.hasCertificate ? data.validityTerm || '—' : '—');
      setField('validUntil', data.hasCertificate ? data.validUntil || '—' : '—');
      renderStatus(data);
    }

    function setFormSummary(data) {
      const fallbackName = buildFullName(activeUser);
      const name = data?.fullName || fallbackName || '—';
      const phone = data?.phone || activeUser?.phone || '—';
      const email = data?.email || activeUser?.email || '—';
      const code = data?.uniqueCode || activeUser?.code || '—';

      if (formSummaryNodes.name) formSummaryNodes.name.textContent = name || '—';
      if (formSummaryNodes.phone) formSummaryNodes.phone.textContent = phone || '—';
      if (formSummaryNodes.email) formSummaryNodes.email.textContent = email || '—';
      if (formSummaryNodes.code) formSummaryNodes.code.textContent = code || '—';
    }

    function resetForm() {
      form?.reset();
      setFormSummary(null);
      if (formFields.validUntil) {
        formFields.validUntil.value = '';
      }
      if (validUntilDisplayNode) {
        validUntilDisplayNode.textContent = '—';
      }
    }

    function populateFormFields() {
      if (!form || !activeData) return;

      const defaults = {
        uniqueCode: activeData.uniqueCode || activeUser?.code || '',
        level: activeData.level?.key || 'architect',
        status: activeData.status?.key || 'active',
        issueDate: activeData.issueDateInputValue || '',
        validityTerm:
          activeData.rawValidityTerm != null
            ? String(activeData.rawValidityTerm)
            : formFields.validityTerm?.defaultValue || '5',
        validUntil: activeData.validUntilInputValue || '',
        validUntilDisplay: activeData.validUntil || '—',
      };

      if (formFields.uniqueCode) formFields.uniqueCode.value = defaults.uniqueCode;
      if (formSummaryNodes.code) formSummaryNodes.code.textContent = defaults.uniqueCode || '—';
      if (formFields.level) formFields.level.value = defaults.level;
      if (formFields.status) formFields.status.value = defaults.status;
      if (formFields.issueDate) formFields.issueDate.value = defaults.issueDate;
      if (formFields.validityTerm) formFields.validityTerm.value = defaults.validityTerm;
      if (formFields.validUntil) formFields.validUntil.value = defaults.validUntil;
      if (validUntilDisplayNode) validUntilDisplayNode.textContent = defaults.validUntilDisplay || '—';
      setFormSummary(activeData);

      updateAutoValidity();
    }

    function updateAutoValidity() {
      if (!formOpen) return;
      if (!formFields.issueDate || !formFields.validityTerm || !formFields.validUntil) return;

      const issueDateValue = formFields.issueDate.value;
      const termNumber = parseNumber(formFields.validityTerm.value);
      if (!issueDateValue || termNumber == null) {
        formFields.validUntil.value = '';
        if (validUntilDisplayNode) validUntilDisplayNode.textContent = '—';
        return;
      }

      const issueDate = parseDate(issueDateValue);
      if (!issueDate) {
        formFields.validUntil.value = '';
        if (validUntilDisplayNode) validUntilDisplayNode.textContent = '—';
        return;
      }

      const suggestion = new Date(issueDate);
      suggestion.setFullYear(suggestion.getFullYear() + termNumber);
      const formatted = formatInputDate(suggestion);
      formFields.validUntil.value = formatted || '';
      if (validUntilDisplayNode) {
        validUntilDisplayNode.textContent = formatted ? formatDate(suggestion) : '—';
      }
    }

    function updateView() {
      const hasCertificate = !!(activeData && activeData.hasCertificate);
      const showCard = hasCertificate && !formOpen;

      if (card) card.classList.toggle('hidden', !showCard);
      if (deleteBtn) {
        deleteBtn.disabled = !hasCertificate || formOpen;
      }
      if (editBtn) {
        editBtn.classList.toggle('hidden', !hasCertificate);
        editBtn.disabled = formOpen;
        editBtn.textContent = formOpen ? 'ფორმის დახურვა' : 'რედაქტირება';
      }
      if (emptyState) emptyState.classList.toggle('hidden', hasCertificate || formOpen);
      if (form) form.classList.toggle('hidden', !formOpen);

      if (downloadBtn) {
        downloadBtn.disabled = !hasCertificate || formOpen;
      }
      if (emptyCreateBtn && !hasCertificate && !formOpen) {
        emptyCreateBtn.textContent = 'სერტიფიკატის შექმნა';
      }
    }

    function openForm(mode) {
      if (!form) return;
      formMode = mode || (activeData?.hasCertificate ? 'update' : 'create');
      formOpen = true;
      populateFormFields();
      updateView();
      requestAnimationFrame(() => {
        if (formFields.level?.focus) {
          formFields.level.focus();
        }
      });
    }

    function closeForm(options = {}) {
      if (!formOpen && !options.force) return;
      formOpen = false;
      resetForm();
      updateView();
    }

    function handleEmptyCreateClick() {
      if (!ensureOverlay()) return;
      if (!formOpen) {
        openForm('create');
      }
    }

    function handleEditClick() {
      if (!ensureOverlay()) return;
      if (formOpen) {
        closeForm();
      } else {
        openForm('update');
      }
    }

    async function handleFormSubmit(event) {
      event?.preventDefault?.();
      if (!form || !activeUser?.id) return;

      const uniqueCode = formFields.uniqueCode?.value?.trim() || '';
      const levelValue = formFields.level?.value || 'architect';
      const statusValue = formFields.status?.value || 'active';
      const issueDateValue = formFields.issueDate?.value || null;
      const validityTermValue = parseNumber(formFields.validityTerm?.value);
      const validUntilValue = formFields.validUntil?.value || null;

      if (!issueDateValue) {
        showToast('გთხოვ მიუთითო გაცემის თარიღი', 'error');
        return;
      }

      if (validityTermValue == null || validityTermValue <= 0) {
        showToast('მოქმედების ვადა უნდა იყოს დადებითი წელი', 'error');
        return;
      }

      const payload = {
        unique_code: uniqueCode || null,
        level: levelValue,
        status: statusValue,
        issue_date: issueDateValue,
        validity_term: validityTermValue,
        valid_until: validUntilValue,
      };

      try {
        const url = `${API_BASE}/users/${activeUser.id}/certificate`;
        const method = formMode === 'create' ? 'POST' : 'PUT';
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...getAdminHeaders(),
            ...getActorHeaders(),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          await handleAdminErrorResponse(response);
          return;
        }

        const certificateData = await response.json();

        // Trust the selected level in the form for UI consistency
        const normalizedLevel = normalizeLevel(levelValue);
        const normalizedStatus = normalizeStatus(certificateData.status, certificateData.valid_until);

        const formattedIssueDate = formatDate(certificateData.issue_date);
        const formattedValidUntil = formatDate(certificateData.valid_until);
        const validityLabel =
          certificateData.validity_term != null
            ? String(certificateData.validity_term)
            : '';

        activeData = {
          ...(activeData || {}),
          firstName: activeData?.firstName || activeUser?.first_name || '',
          lastName: activeData?.lastName || activeUser?.last_name || '',
          fullName: buildFullName(activeUser),
          phone: activeData?.phone || activeUser?.phone || '',
          email: activeData?.email || activeUser?.email || '',
          uniqueCode: certificateData.unique_code || activeUser?.code || '',
          level: normalizedLevel,
          status: normalizedStatus,
          issueDate: formattedIssueDate,
          issueDateInputValue: formatInputDate(certificateData.issue_date),
          rawIssueDate: certificateData.issue_date,
          rawValidityTerm: certificateData.validity_term,
          validityTerm: validityLabel,
          validUntil: formattedValidUntil,
          validUntilInputValue: certificateData.valid_until,
          rawValidUntil: certificateData.valid_until,
          isInactive: normalizedStatus.key === 'suspended' || normalizedStatus.key === 'expired',
          hasCertificate: true,
        };

        if (activeUserRef) {
          activeUserRef.certificate = { ...certificateData, level: levelValue };
          activeUserRef.certificate_info = {
            unique_code: certificateData.unique_code,
            level: levelValue,
            status: certificateData.status,
            issue_date: certificateData.issue_date,
            validity_term: certificateData.validity_term,
            valid_until: certificateData.valid_until,
          };
          activeUserRef.certificate_status = certificateData.status;
          activeUserRef.certificate_valid_until = certificateData.valid_until;
        }

        closeForm({ force: true });
        await populateView(activeData);
        updateView();
        
        // Update user card color in users list immediately
        if (activeUser?.id && onUserCertificateUpdated) {
          onUserCertificateUpdated(activeUser.id, certificateData);
        }
        
        showToast('სერტიფიკატის მონაცემები შეინახა', 'success');
      } catch (error) {
        console.error('[certificate] Failed to save certificate', error);
        showToast('სერტიფიკატის შენახვა ვერ მოხერხდა', 'error');
      }
    }

    async function handleDelete() {
      if (!activeData?.hasCertificate || !activeUser?.id) {
        showToast('სერტიფიკატი ჯერ არ არის შექმნილი', 'info');
        return;
      }
      if (!global.confirm('დარწმუნებული ხართ, რომ წაშალოთ სერტიფიკატი?')) {
        return;
      }
      if (!global.confirm('დარწმუნებული ხართ, რომ წაშალოთ სერტიფიკატი? ამ ქმედების დაბრუნება ვერ მოხერხდება.')) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/users/${activeUser.id}/certificate`, {
          method: 'DELETE',
          headers: { ...getAdminHeaders(), ...getActorHeaders() },
        });

        if (!response.ok) {
          await handleAdminErrorResponse(response);
          return;
        }

        const userAfterDelete = {
          ...(activeUser || {}),
          certificate: null,
          certificate_info: null,
          certificate_status: null,
          certificate_valid_until: null,
        };

        if (activeUserRef) {
          activeUserRef.certificate = null;
          activeUserRef.certificate_info = null;
          activeUserRef.certificate_status = null;
          activeUserRef.certificate_valid_until = null;
        }

        activeUser = userAfterDelete;
        activeData = buildCertificateData(userAfterDelete);
        closeForm({ force: true });
        await populateView(activeData);
        updateView();
        showToast('სერტიფიკატი წაიშალა', 'success');
      } catch (error) {
        console.error('[certificate] Failed to delete certificate', error);
        showToast('სერტიფიკატის წაშლა ვერ მოხერხდა', 'error');
      }
    }

    function getAdminStylesHref() {
      const link = document.querySelector('link[href*="admin.css"]');
      return link ? link.href : null;
    }

    function handleDownload() {
      if (!activeData?.hasCertificate) {
        showToast('სერტიფიკატი ჯერ არ არის შექმნილი', 'error');
        return;
      }
      if (formOpen) {
        showToast('PDF ექსპორტისთვის დახურეთ სერტიფიკატის ფორმა', 'info');
        return;
      }
      showToast('PDF ფაილის ჩამოტვირთვის ფუნქცია მალე დაემატება', 'info');
    }

    function resetState() {
      activeUserRef = null;
      activeUser = null;
      activeData = null;
      formMode = 'create';
      formOpen = false;
      resetForm();
    }

    function handleClose() {
      if (!overlay) return;
      if (formOpen) {
        const confirmed = global.confirm('დახურვის შემთხვევაში ცვლილებები არ შეინახება. გსურთ გაგრძელება?');
        if (!confirmed) return;
        closeForm({ force: true });
      }
      resetState();
      closeOverlay(overlay);
    }

    function handleBackdrop() {
      // ფონზე დაკლიკვა არაფერს აკეთებს — დახურვა მხოლოდ X-ით ან Escape-ით.
    }

    function handleKeydown(event) {
      if (event.key === 'Escape' && overlay?.classList.contains('open')) {
        if (!formOpen) {
          handleClose();
          return;
        }
        if (global.confirm('დახურვის შემთხვევაში ცვლილებები არ შეინახება. გსურთ გაგრძელება?')) {
          handleClose();
        }
      }
    }

    async function open(user) {
      if (!ensureOverlay()) return;
      activeUserRef = user || null;
      activeUser = user ? { ...user } : null;
      
      // Try to load certificate from backend
      let certificateData = null;
      if (user?.id) {
        try {
          const response = await fetch(`${API_BASE}/users/${user.id}/certificate`, {
            headers: { ...getAdminHeaders(), ...getActorHeaders() },
          });
          if (response.ok) {
            certificateData = await response.json();
          } else if (response.status !== 404) {
            await handleAdminErrorResponse(response);
          }
        } catch (error) {
          console.error('[certificate] Failed to load certificate', error);
          showToast('სერტიფიკატის ჩატვირთვა ვერ მოხერხდა', 'error');
        }
      }
      
      const userWithCert = certificateData
        ? {
            ...user,
            certificate: certificateData,
            certificate_info: {
              unique_code: certificateData.unique_code,
              level: certificateData.level,
              status: certificateData.status,
              issue_date: certificateData.issue_date,
              validity_term: certificateData.validity_term,
              valid_until: certificateData.valid_until,
            },
            certificate_status: certificateData.status,
            certificate_valid_until: certificateData.valid_until,
          }
        : user;
      
      activeData = buildCertificateData(userWithCert || {});
      formOpen = false;
      formMode = activeData?.hasCertificate ? 'update' : 'create';
      resetForm();
      await populateView(activeData);
      updateView();
      openOverlay(overlay);
      // Fit after content is populated by populateView
    }

    function init() {
      if (!ensureOverlay()) return;
      closeBtn?.addEventListener('click', handleClose);
      overlay?.addEventListener('click', handleBackdrop);
      document.addEventListener('keydown', handleKeydown);
      emptyCreateBtn?.addEventListener('click', handleEmptyCreateClick);
      deleteBtn?.addEventListener('click', handleDelete);
      editBtn?.addEventListener('click', handleEditClick);
      formSubmitBtn?.addEventListener('click', handleFormSubmit);
      formFields.issueDate?.addEventListener('change', () => updateAutoValidity());
      formFields.validityTerm?.addEventListener('input', () => updateAutoValidity());
      downloadBtn?.addEventListener('click', handleDownload);
      
      // Load template when level changes in form
      formFields.level?.addEventListener('change', async (event) => {
        const level = event.target.value;
      // Update activeData level and re-render; populateView will load correct template
      if (activeData) {
        const normalized = normalizeLevel(level);
        activeData.level = normalized;
      }
        await populateView(activeData);
      });
      
      // Initial field nodes update
      updateFieldNodes();

      // Refit certificate on resize
      window.addEventListener('resize', () => {
        fitCertificateToContainer();
      });
    }

    function close() {
      handleClose();
    }

    return {
      init,
      open,
      close,
    };
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules.createCertificateModule = createCertificateModule;
})(window);

