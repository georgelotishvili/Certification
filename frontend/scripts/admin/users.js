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
    } = context;
    const { onShowResults, onShowStatements } = context;

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
        <div class="block-tile block-card" data-id="${safeId}">
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
      const resultsBtns = card.querySelectorAll('.btn-user-results');
      const certificateBtns = card.querySelectorAll('.btn-user-certificate');
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

  global.AdminModules = global.AdminModules || {};
  global.AdminModules.createUsersModule = createUsersModule;
})(window);


