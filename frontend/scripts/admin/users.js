(function (global) {
  function createUsersModule(context = {}) {
    const {
      DOM,
      API_BASE,
      on,
      formatDateTime,
      escapeHtml,
      isFounderActor,
      getAdminHeaders,
      getActorHeaders,
      showToast = () => {},
      handleAdminErrorResponse = () => {},
      openOverlay = () => {},
      closeOverlay = () => {},
    } = context;
    const { onShowResults, onShowStatements } = context;
    const navLinks = DOM.navLinks || [];

    let cachedItems = [];
    let editActiveUser = null;
    let editInitialValues = null;
    let editInitialCode = '';
    let editSubmitting = false;

    const editOverlay = DOM.userEditOverlay;
    const editForm = DOM.userEditForm;
    const editTitle = DOM.userEditTitle;
    const editCloseBtn = DOM.userEditClose;
    const editCancelBtn = DOM.userEditCancel;
    const editSaveBtn = DOM.userEditSave;
    const editCodeField = DOM.userEditCode;

    const editFields = {
      personal_id: DOM.userEditPersonalId,
      first_name: DOM.userEditFirstName,
      last_name: DOM.userEditLastName,
      phone: DOM.userEditPhone,
      email: DOM.userEditEmail,
    };

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
      const fullNameRaw = `${(user.first_name || '').trim()} ${(user.last_name || '').trim()}`.trim() || '(უსახელო)';
      const founderRow = !!user.is_founder;
      const canEdit = isFounderActor();
      const checked = founderRow ? 'checked' : (user.is_admin ? 'checked' : '');
      const disabled = founderRow ? 'disabled' : (isFounderActor() ? '' : 'disabled');
      const safeId = escapeHtml(user.id);
      const safeFullName = escapeHtml(fullNameRaw);
      const safePersonalId = escapeHtml(user.personal_id || '');
      const safePhone = escapeHtml(user.phone || '');
      const safeCode = escapeHtml(user.code || '');
      const safeEmail = escapeHtml(user.email || '');
      const safeRegistered = escapeHtml(formatDateTime(user.created_at));
      return `
        <div class="block-tile block-card${user.has_unseen_statements ? ' has-new-statements' : ''}" data-id="${safeId}">
        <div class="block-head" style="grid-template-columns:auto 1fr auto auto auto;">
            <div class="block-order"></div>
            <div style="font-size:16px;font-weight:700;color:#0f172a;">${safeFullName}</div>
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
                      <div>პირადი №: <strong>${safePersonalId}</strong></div>
                      <div>ტელეფონი: <strong>${safePhone}</strong></div>
                      <div>კოდი: <strong style="color:#6d28d9;">${safeCode}</strong></div>
                      <div>მაილი: <strong style="color:#065f46;">${safeEmail}</strong></div>
                      <div>რეგისტრაცია: <strong>${safeRegistered}</strong></div>
                    </div>
                  </div>
                  <div>
                    <div style="font-weight:700;color:#065f46;margin-bottom:8px;">ქმედებები</div>
                    <div class="user-action-buttons" style="margin-top:12px;display:flex;flex-direction:column;gap:6px;width:100%;">
                      <button class="btn-user-announcements" type="button" style="width:100%;padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;">განცხადებები</button>
                      <button class="btn-user-results" type="button" style="width:100%;padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;">გამოცდის შედეგები</button>
                      <button class="btn-user-certificate" type="button" style="width:100%;padding:6px 12px;border:2px solid #c7d2fe;border-radius:6px;background:#eef2ff;cursor:pointer;font-size:13px;">სერტიფიკატი</button>
                      <button class="btn-user-edit"${canEdit ? '' : ' disabled'} type="button" style="width:100%;padding:6px 12px;border:2px solid #86efac;border-radius:6px;background:#dcfce7;cursor:pointer;font-size:13px;font-weight:600;color:#166534;${canEdit ? '' : 'opacity:0.6;cursor:not-allowed;'}">რედაქტირება</button>
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
          if (!global.confirm('დარწმუნებული ხართ, რომ შეცვალოთ ადმინის სტატუსი?')) {
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
          if (!global.confirm('დარწმუნებული ხართ, რომ წაშალოთ ჩანაწერი?')) return;
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
      if (actionsWrap && !actionsWrap.querySelector('.btn-user-edit')) {
        const editFallbackBtn = document.createElement('button');
        editFallbackBtn.className = 'btn-user-edit';
        editFallbackBtn.type = 'button';
        editFallbackBtn.textContent = 'რედაქტირება';
        editFallbackBtn.disabled = !isFounderActor();
        editFallbackBtn.style.cssText = `width:100%;padding:6px 12px;border:2px solid #86efac;border-radius:6px;background:#dcfce7;cursor:${isFounderActor() ? 'pointer' : 'not-allowed'};font-size:13px;font-weight:600;color:#166534;${isFounderActor() ? '' : 'opacity:0.6;'}`;
        actionsWrap.appendChild(editFallbackBtn);
      }
      const resultsBtns = card.querySelectorAll('.btn-user-results');
      const certificateBtns = card.querySelectorAll('.btn-user-certificate');
      const editBtns = card.querySelectorAll('.btn-user-edit');
      announcementsBtn?.addEventListener('click', () => {
        if (typeof onShowStatements === 'function') {
          onShowStatements(user);
        } else {
          alert('განცხადებები — მალე დაემატება');
        }
      });
      resultsBtns?.forEach((btn) => btn.addEventListener('click', () => {
        if (typeof onShowResults === 'function') {
          onShowResults(user);
        } else {
          alert('გამოცდის შედეგები — მალე დაემატება');
        }
      }));
      certificateBtns?.forEach((btn) => btn.addEventListener('click', () => alert('სერტიფიკატი — მალე დაემატება')));
      editBtns?.forEach((btn) => btn.addEventListener('click', () => openEditModal(user)));
    }

    function setCardUnseenState(card, hasUnseen) {
      if (!card) return;
      card.classList.toggle('has-new-statements', !!hasUnseen);
      const announcementsButton = card.querySelector('.btn-user-announcements');
      if (announcementsButton) {
        announcementsButton.classList.toggle('has-new-statements', !!hasUnseen);
      }
    }

    function drawUsers(items) {
      if (!DOM.usersGrid) return;
      DOM.usersGrid.innerHTML = '';
      cachedItems = items || [];
      (items || []).forEach((user) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = userRowHTML(user);
        const card = wrapper.firstElementChild;
        if (card) {
          card.dataset.unseenCount = String(user.unseen_statement_count || 0);
          setCardUnseenState(card, user.has_unseen_statements);
          mountUserCard(card, user);
          DOM.usersGrid.appendChild(card);
        }
      });
      updateNavBadge(cachedItems.some((user) => user.has_unseen_statements));
    }

    function normalizeUserValue(value) {
      return (value == null ? '' : String(value)).trim();
    }

    function collectEditValues() {
      const nextValues = {};
      Object.entries(editFields).forEach(([key, input]) => {
        if (!input) return;
        nextValues[key] = normalizeUserValue(input.value);
      });
      return nextValues;
    }

    function validateEditValues(values) {
      if (!values) return 'მონაცემები ვერ მოიძებნა';
      if (!values.first_name) return 'სახელი აუცილებელია';
      if (!values.last_name) return 'გვარი აუცილებელია';
      if (!values.personal_id) return 'პირადი ნომერი აუცილებელია';
      if (!/^\d{11}$/.test(values.personal_id)) return 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან';
      if (!values.phone) return 'ტელეფონის ნომერი აუცილებელია';
      if (!values.email) return 'ელფოსტა აუცილებელია';
      return null;
    }

    function diffEditValues(values, base) {
      const payload = {};
      Object.keys(editFields).forEach((key) => {
        const current = values[key] ?? '';
        const previous = base?.[key] ?? '';
        if (current !== previous) {
          payload[key] = current;
        }
      });
      return payload;
    }

    function setEditSubmitting(state) {
      editSubmitting = state;
      if (editSaveBtn) {
        editSaveBtn.disabled = !!state;
        editSaveBtn.textContent = state ? 'ინახება...' : 'შენახვა';
      }
      Object.values(editFields).forEach((input) => {
        if (!input) return;
        input.disabled = !!state;
      });
    }

    async function handleEditSubmit(event) {
      event?.preventDefault?.();
      if (editSubmitting) return;
      if (!editActiveUser || !editInitialValues) return;
      const values = collectEditValues();
      const validationError = validateEditValues(values);
      if (validationError) {
        showToast(validationError, 'error');
        return;
      }
      const payload = diffEditValues(values, editInitialValues);
      if (!Object.keys(payload).length) {
        showToast('ცვლილებები არ არის დასამახსოვრებლად');
        return;
      }

      setEditSubmitting(true);
      try {
        const response = await fetch(`${API_BASE}/admin/users/${editActiveUser.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAdminHeaders(),
            ...getActorHeaders(),
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          await handleAdminErrorResponse(response, 'მონაცემების განახლება ვერ შესრულდა', showToast);
          return;
        }
        const data = await response.json();
        const nextItems = cachedItems.map((item) => (String(item.id) === String(data.id) ? { ...item, ...data } : item));
        drawUsers(nextItems);
        showToast('მონაცემები წარმატებით განახლდა');
        closeEditModal();
      } catch (error) {
        console.error('Failed to update user', error);
        showToast('მონაცემების განახლება ვერ შესრულდა', 'error');
      } finally {
        setEditSubmitting(false);
      }
    }

    function handleEditBackdrop(event) {
      if (event.target === editOverlay) {
        closeEditModal();
      }
    }

    function handleEditKeydown(event) {
      if (event.key === 'Escape' && editOverlay?.classList.contains('open')) {
        closeEditModal();
      }
    }

    function setupEditModal() {
      if (!editOverlay || !editForm) return;
      on(editForm, 'submit', handleEditSubmit);
      on(editCloseBtn, 'click', closeEditModal);
      on(editCancelBtn, 'click', (event) => {
        event.preventDefault();
        closeEditModal();
      });
      on(editOverlay, 'click', handleEditBackdrop);
      on(document, 'keydown', handleEditKeydown);
    }

    function openEditModal(user) {
      if (!isFounderActor()) {
        showToast('მხოლოდ მთავარ ადმინს შეუძლია მონაცემების რედაქტირება', 'error');
        return;
      }
      if (!editOverlay || !editForm || !user) return;
      editActiveUser = { ...user };
      editInitialValues = {
        personal_id: normalizeUserValue(user.personal_id),
        first_name: normalizeUserValue(user.first_name),
        last_name: normalizeUserValue(user.last_name),
        phone: normalizeUserValue(user.phone),
        email: normalizeUserValue(user.email),
      };
      editInitialCode = normalizeUserValue(user.code);

      if (editTitle) {
        editTitle.textContent = 'მონაცემების რედაქტირება';
      }

      Object.entries(editFields).forEach(([key, input]) => {
        if (!input) return;
        input.value = editInitialValues[key] || '';
        input.disabled = false;
      });
      if (editCodeField) {
        editCodeField.value = editInitialCode;
        editCodeField.readOnly = true;
      }
      if (editSaveBtn) {
        editSaveBtn.disabled = false;
        editSaveBtn.textContent = 'შენახვა';
      }
      editSubmitting = false;
      openOverlay(editOverlay);
      requestAnimationFrame(() => {
        editFields.first_name?.focus();
        if (editFields.first_name) {
          editFields.first_name.selectionStart = editFields.first_name.value.length;
          editFields.first_name.selectionEnd = editFields.first_name.value.length;
        }
      });
    }

    function closeEditModal() {
      if (!editOverlay) return;
      closeOverlay(editOverlay);
      editActiveUser = null;
      editInitialValues = null;
      editInitialCode = '';
      editSubmitting = false;
      if (editForm) {
        editForm.reset();
      }
      if (editCodeField) {
        editCodeField.value = '';
        editCodeField.readOnly = true;
      }
    }

    async function render() {
      if (!DOM.usersGrid) return;
      DOM.usersGrid.innerHTML = '<div class="block-tile">იტვირთება...</div>';
      try {
        const data = await fetchUsers();
        cachedItems = Array.isArray(data?.items) ? data.items : [];
        drawUsers(cachedItems);
      } catch {
        DOM.usersGrid.innerHTML = '<div class="block-tile">ჩატვირთვის შეცდომა</div>';
      }
    }

    function init() {
      on(DOM.usersSearch, 'input', render);
      on(DOM.usersSort, 'change', render);
      on(DOM.onlyAdmins, 'change', render);
      setupEditModal();
    }

    function updateUserUnseenStatus(userId, hasUnseen, count) {
      const card = DOM.usersGrid?.querySelector(`.block-card[data-id="${userId}"]`);
      if (!card) return;
      setCardUnseenState(card, hasUnseen);
      card.dataset.unseenCount = String(count || 0);
      const index = cachedItems.findIndex((item) => String(item.id) === String(userId));
      if (index !== -1) {
        cachedItems[index] = {
          ...cachedItems[index],
          has_unseen_statements: !!hasUnseen,
          unseen_statement_count: count || 0,
        };
      }
      updateNavBadge(cachedItems.some((item) => item.has_unseen_statements));
    }

    function updateNavBadge(hasAny) {
      navLinks.forEach((link) => {
        const label = (link.textContent || '').trim();
        if (label === 'რეგისტრაციები' || label === 'რეგისტრირებული პირები') {
          link.classList.toggle('has-new-statements', !!hasAny);
        }
      });
    }

    async function refreshUnseenSummary() {
      try {
        const response = await fetch(`${API_BASE}/admin/statements/summary`, {
          headers: { ...getAdminHeaders(), ...getActorHeaders() },
        });
        if (!response.ok) throw new Error('summary failed');
        const data = await response.json();
        updateNavBadge(!!data?.has_unseen);
      } catch (error) {
        console.warn('Failed to refresh statement summary', error);
      }
    }

    return {
      init,
      render: () => render(),
      updateUserUnseenStatus,
      refreshUnseenSummary,
    };
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules.createUsersModule = createUsersModule;
})(window);


