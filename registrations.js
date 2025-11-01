document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = 'http://127.0.0.1:8000';
  const ADMIN_API_KEY_LS = 'adminApiKey';
  const SAVED_EMAIL_KEY = 'savedEmail';
  const FOUNDER_EMAIL = 'naormala@gmail.com';

  const usersGrid = document.getElementById('usersGrid');
  const usersSearch = document.getElementById('usersSearch');
  const usersSort = document.getElementById('usersSort');
  const onlyAdmins = document.getElementById('onlyAdmins');
  const btnDeleteAll = document.getElementById('btnDeleteAllUsers');

  const adminHeaders = () => {
    const key = localStorage.getItem(ADMIN_API_KEY_LS);
    const actor = (localStorage.getItem(SAVED_EMAIL_KEY) || '').trim();
    return { ...(key ? { 'x-admin-key': key } : {}), ...(actor ? { 'x-actor-email': actor } : {}) };
  };
  const isFounderActor = () => (localStorage.getItem(SAVED_EMAIL_KEY) || '').toLowerCase() === FOUNDER_EMAIL.toLowerCase();

  const fmtDT = (iso) => {
    try { const d=new Date(iso); const p=n=>String(n).padStart(2,'0'); return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return String(iso||''); }
  };

  function rowHTML(u) {
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
    const params = new URLSearchParams();
    const q = String(usersSearch.value||'').trim();
    if (q) params.set('search', q);
    if (onlyAdmins.checked) params.set('only_admins', 'true');
    params.set('sort', usersSort.value || 'date_desc');
    const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`, { headers: { ...adminHeaders() } });
    if (!res.ok) throw new Error('users failed');
    return await res.json();
  }

  function mountCard(card) {
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
            headers: { 'Content-Type': 'application/json', ...adminHeaders() },
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
          const r = await fetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE', headers: { ...adminHeaders() } });
          if (!r.ok) throw 0;
          card.remove();
        } catch {
          alert('წაშლა ვერ შესრულდა');
        }
      });
    }
  }

  function drawUsers(items) {
    usersGrid.innerHTML = '';
    (items||[]).forEach(u => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = rowHTML(u);
      const card = wrapper.firstElementChild;
      mountCard(card);
      usersGrid.appendChild(card);
    });
  }

  async function render() {
    usersGrid.innerHTML = '<div class="block-tile">იტვირთება...</div>';
    try {
      const data = await fetchUsers();
      drawUsers(data.items || []);
    } catch {
      usersGrid.innerHTML = '<div class="block-tile">ჩატვირთვის შეცდომა</div>';
    }
  }

  usersSearch.addEventListener('input', render);
  usersSort.addEventListener('change', render);
  onlyAdmins.addEventListener('change', render);
  if (btnDeleteAll) {
    if (!isFounderActor()) {
      try { btnDeleteAll.setAttribute('disabled', ''); btnDeleteAll.style.opacity = '.5'; btnDeleteAll.style.cursor = 'not-allowed'; } catch {}
    }
    btnDeleteAll.addEventListener('click', async () => {
      if (!isFounderActor()) return alert('ამ ქმედების შესრულება შეუძლია მხოლოდ დამფუძნებელს');
      if (!confirm('დარწმუნებული ხართ, რომ წაშალოთ ყველა რეგისტრაცია (დამფუძნებლის გარდა)?')) return;
      btnDeleteAll.disabled = true;
      try {
        const r = await fetch(`${API_BASE}/admin/users`, { method: 'DELETE', headers: { ...adminHeaders() } });
        if (!r.ok) throw 0;
        // Clear local auth/profile data so re-registration is possible
        try {
          localStorage.removeItem('currentUser');
          localStorage.setItem('authLoggedIn', 'false');
          localStorage.removeItem('usedCodes');
        } catch {}
        await render();
        alert('ყველა რეგისტრაცია წაიშალა (დამფუძნებლის გარდა).');
      } catch {
        alert('სულად წაშლა ვერ შესრულდა');
      } finally {
        btnDeleteAll.disabled = false;
      }
    });
  }
  render();
});


