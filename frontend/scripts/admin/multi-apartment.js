(function (global) {
  function createMultiApartmentModule(context) {
    const {
      DOM,
      API_BASE,
      on,
      escapeHtml,
      showToast,
      handleAdminErrorResponse,
      getAdminHeaders,
      getActorHeaders,
    } = context;

    const state = {
      data: [],
      saveTimer: null,
      pendingNotify: false,
      loading: false,
      initialized: false,
      pendingSave: false,
      settings: null,
      settingsTimer: null,
    };

    const generateId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const generateProjectCode = () => String(Math.floor(10000 + Math.random() * 90000));

    async function fetchProjectsFromServer() {
      const response = await fetch(`${API_BASE}/admin/multi-apartment/projects`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) {
        await handleAdminErrorResponse(response, 'პროექტების ჩატვირთვა ვერ მოხერხდა', showToast);
        throw new Error('handled');
      }
      return await response.json();
    }

    async function fetchSettingsFromServer() {
      const response = await fetch(`${API_BASE}/admin/multi-apartment/settings`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) throw new Error('settings failed');
      return await response.json();
    }

    function migrateProjects(data) {
      return (Array.isArray(data?.projects) ? data.projects : []).map((project) => {
        if (!project || typeof project !== 'object') return project;
        const projectId = project?.id != null ? String(project.id) : generateId();
        const answers = Array.isArray(project.answers) ? project.answers : [];
        const migratedAnswers = answers.map((answer) => {
          if (!answer || typeof answer !== 'object') {
            return { id: generateId(), text: String(answer || '') };
          }
          return {
            ...answer,
            id: answer.id != null ? String(answer.id) : generateId(),
            text: String(answer.text || ''),
          };
        });
        const correctIdsFromArray = Array.isArray(project.correctAnswerIds)
          ? project.correctAnswerIds.map((id) => String(id))
          : null;
        const singleCorrectId = project.correctAnswerId != null ? String(project.correctAnswerId) : null;
        const correctAnswerIds =
          correctIdsFromArray && correctIdsFromArray.length
            ? correctIdsFromArray
            : singleCorrectId
              ? [singleCorrectId]
              : [];
        return {
          ...project,
          id: projectId,
          number: Number(project.number) || 1,
          code: String(project.code || generateProjectCode()),
          pdfFile: project.pdfFile || null,
          answers: migratedAnswers,
          correctAnswerIds,
        };
      });
    }

    let DOM_ELEMENTS = {
      grid: null,
      blocksCount: null,
    };

    function populateSettingsFields() {
      if (!state.settings) return;
      const durationValue = Number(state.settings.durationMinutes || 0);
      if (DOM.multiApartmentDurationInput) {
        DOM.multiApartmentDurationInput.value = durationValue ? String(durationValue) : '';
      }
      if (DOM.multiApartmentGatePwdInput) {
        DOM.multiApartmentGatePwdInput.value = state.settings.gatePassword || '';
      }
    }

    function nextNumber() {
      if (state.data.length === 0) return 1;
      const numbers = state.data.map((p) => Number(p.number) || 0).filter((n) => n > 0);
      if (numbers.length === 0) return 1;
      return Math.max(...numbers) + 1;
    }

    function updateStats() {
      if (DOM_ELEMENTS.blocksCount) {
        DOM_ELEMENTS.blocksCount.textContent = String(state.data.length || 0);
      }
    }

    function updateProjectCount(projectId) {
      const card = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"]`);
      if (!card) return;
      const projectIndex = state.data.findIndex((project) => project.id === projectId);
      if (projectIndex === -1) return;
      const project = state.data[projectIndex];
      const headCount = card.querySelector('.head-count');
      if (headCount) {
        headCount.textContent = String(Array.isArray(project.answers) ? project.answers.length : 0);
      }
    }

    function setCardOpen(card, open) {
      if (!card) return;
      card.classList.toggle('open', open);
      const toggle = card.querySelector('.head-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = open ? '▴' : '▾';
      }
      const details = card.querySelector('.block-questions');
      if (details) {
        details.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
    }

    function render() {
      if (!DOM_ELEMENTS.grid) return;
      const previouslyOpenProjects = Array.from(DOM_ELEMENTS.grid.querySelectorAll('.block-card.open'))
        .map((card) => card.dataset.projectId)
        .filter(Boolean);

      DOM_ELEMENTS.grid.innerHTML = '';

      state.data.forEach((project, index) => {
        const card = document.createElement('div');
        card.className = 'block-tile block-card';
        card.dataset.projectId = project.id;
        const atTop = index === 0;
        const atBottom = index === state.data.length - 1;
        card.innerHTML = `
          <div class="block-head multi-apartment-head">
            <div class="block-order">
              <button class="i-btn up" ${atTop ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
              <button class="i-btn down" ${atBottom ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
            </div>
            <span class="head-label">პროექტი</span>
            <input class="head-number" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(project.number ?? '')}" aria-label="პროექტის ნომერი" />
            <div class="head-file-group">
              <button type="button" class="head-file-choose" data-project-id="${escapeHtml(project.id)}">Choose File</button>
              <input class="head-file-input" type="file" accept=".pdf" data-project-id="${escapeHtml(project.id)}" aria-label="PDF ფაილის ატვირთვა" />
              <span class="head-file-name">${escapeHtml(project.pdfFile || 'No file chosen')}</span>
            </div>
            <span class="q-code" aria-label="პროექტის კოდი">${escapeHtml(project.code || '')}</span>
            <button class="head-delete" type="button" aria-label="პროექტის წაშლა" title="წაშლა">×</button>
            <button class="head-toggle" type="button" aria-expanded="false">▾</button>
            <span class="head-count" title="პასუხების რაოდენობა">${escapeHtml(Array.isArray(project.answers) ? project.answers.length : 0)}</span>
          </div>
          <div class="block-questions" aria-hidden="true">
            <div class="answers-list">
              ${(Array.isArray(project.answers) ? project.answers : []).map((answer, aIndex, answersArr) => `
                <div class="answer-card" data-answer-id="${escapeHtml(answer.id)}">
                  <div class="a-head">
                    <div class="a-order">
                      <button class="i-btn a-up" ${aIndex === 0 ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
                      <button class="i-btn a-down" ${aIndex === answersArr.length - 1 ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
                    </div>
                    <textarea class="a-text" rows="3" placeholder="პასუხი ${aIndex + 1}" aria-label="პასუხი ${aIndex + 1}">${escapeHtml(answer.text || '')}</textarea>
                    <div class="a-actions">
                      <div class="a-actions-row">
                        <label class="a-correct-wrap" title="სწორი პასუხი">
                          <input 
                            class="a-correct" 
                            type="checkbox" 
                            ${Array.isArray(project.correctAnswerIds) && project.correctAnswerIds.includes(answer.id) ? 'checked' : ''} 
                          />
                          <span>სწორია</span>
                        </label>
                        <button class="a-delete" type="button" aria-label="პასუხის წაშლა" title="წაშლა">×</button>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            <button class="block-tile add-tile q-add-tile" type="button" aria-label="პასუხის დამატება">
              <span class="add-icon" aria-hidden="true">+</span>
              <span class="add-text">პასუხის დამატება</span>
            </button>
          </div>
        `;
        DOM_ELEMENTS.grid.appendChild(card);
        if (previouslyOpenProjects.includes(project.id)) setCardOpen(card, true);
      });

      const addTile = document.createElement('button');
      addTile.type = 'button';
      addTile.id = 'addMultiApartmentTile';
      addTile.className = 'block-tile add-tile';
      addTile.setAttribute('aria-label', 'პროექტის დამატება');
      addTile.innerHTML = '<span class="add-icon" aria-hidden="true">+</span><span class="add-text">პროექტის დამატება</span>';
      DOM_ELEMENTS.grid.appendChild(addTile);

      updateStats();
    }

    function addProject() {
      const id = generateId();
      const newProject = { 
        id, 
        number: nextNumber(), 
        pdfFile: null, 
        answers: [], // Start with empty answers array - user will add answers manually
        correctAnswerIds: [], // Don't mark any answer as correct by default
        code: generateProjectCode() 
      };
      console.log('addProject: adding project', newProject);
      console.log('addProject: state.data before push:', state.data.length);
      state.data.push(newProject);
      console.log('addProject: state.data after push:', state.data.length, state.data);
      save({ notify: true });
      render();
      const card = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${id}"]`);
      if (card) {
        setCardOpen(card, false); // Add project in closed state
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function save(options = {}) {
      console.log('save() called, state.data length:', state.data.length);
      state.pendingNotify = state.pendingNotify || !!options.notify;
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => {
        state.saveTimer = null;
        console.log('save() timeout fired, calling persistProjects, state.data length:', state.data.length);
        void persistProjects();
      }, 400);
    }

    async function persistSettings(patch = {}, { notifyDuration = false, notifyPassword = false } = {}) {
      const current = state.settings || {};
      const payload = {
        durationMinutes: patch.durationMinutes ?? current.durationMinutes ?? 60,
        gatePassword: patch.gatePassword ?? current.gatePassword ?? '',
      };
      try {
        const response = await fetch(`${API_BASE}/admin/multi-apartment/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders(), ...getActorHeaders() },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('failed');
        const data = await response.json();
        state.settings = data;
        populateSettingsFields();
        if (notifyDuration && DOM.multiApartmentDurationFlash) {
          const value = Number(state.settings.durationMinutes || 0);
          DOM.multiApartmentDurationFlash.textContent = `ხანგრძლივობა შეიცვალა: ${value} წუთი`;
          DOM.multiApartmentDurationFlash.style.display = 'block';
          setTimeout(() => {
            if (DOM.multiApartmentDurationFlash) DOM.multiApartmentDurationFlash.style.display = 'none';
          }, 3000);
        }
        if (notifyPassword) {
          showToast('მრავალბინიანის ადმინისტრატორის პაროლი შენახულია');
        }
      } catch (err) {
        console.error('Failed to save multi-apartment settings', err);
        showToast('მრავალბინიანის პარამეტრების შენახვა ვერ მოხერხდა', 'error');
      }
    }

    async function persistProjects() {
      const payload = {
        projects: state.data.map((p) => {
          const projectPayload = {
            id: String(p.id || generateId()),
            number: Number(p.number) || 1,
            code: String(p.code || generateProjectCode()).trim(),
            answers: (Array.isArray(p.answers) ? p.answers : []).map((a) => ({
              id: String(a.id || generateId()),
              text: String(a.text || '').trim(),
            })),
          };
          const correctIds = Array.isArray(p.correctAnswerIds)
            ? p.correctAnswerIds
                .filter((id) => id != null && String(id).trim() !== '')
                .map((id) => String(id))
            : [];
          if (correctIds.length > 0) {
            projectPayload.correctAnswerIds = correctIds;
            // For backwards compatibility with older backend fields
            projectPayload.correctAnswerId = correctIds[0];
          }
          if (p.pdfFile != null) {
            projectPayload.pdfFile = String(p.pdfFile);
          }
          return projectPayload;
        }),
      };
      
      try {
        const response = await fetch(`${API_BASE}/admin/multi-apartment/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders(), ...getActorHeaders() },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          await handleAdminErrorResponse(response, 'პროექტების შენახვა ვერ მოხერხდა', showToast);
          return;
        }
        const data = await response.json();
        state.data = migrateProjects(data);
        render();
        updateStats();
        if (state.pendingNotify) {
          showToast('შენახულია', 'success');
        }
      } catch (err) {
        console.error('Failed to save projects', err);
        showToast('პროექტების შენახვა ვერ მოხერხდა', 'error');
      } finally {
        state.pendingNotify = false;
      }
    }

    async function loadInitialProjects() {
      if (DOM_ELEMENTS.grid) {
        DOM_ELEMENTS.grid.innerHTML = '<div class="blocks-loading">იტვირთება...</div>';
      }
      try {
        const payload = await fetchProjectsFromServer();
        console.log('loadInitialProjects: received payload', payload);
        state.data = migrateProjects(payload);
        console.log('loadInitialProjects: migrated data', state.data);
      } catch (err) {
        console.error('Failed to load projects', err);
        if ((err?.message || '') !== 'handled') {
          showToast('პროექტების ჩატვირთვა ვერ მოხერხდა', 'error');
          state.data = migrateProjects({ projects: [] });
        }
      }
      state.initialized = true;
      render();
      updateStats();
    }

    async function loadSettings() {
      try {
        state.settings = await fetchSettingsFromServer();
      } catch (err) {
        console.error('Failed to load multi-apartment settings', err);
        showToast('მრავალბინიანის პარამეტრების ჩატვირთვა ვერ მოხერხდა', 'error');
        state.settings = { durationMinutes: 60, gatePassword: '' };
      }
      populateSettingsFields();
    }

    function saveDuration() {
      const value = Number(DOM.multiApartmentDurationInput?.value || 0);
      if (!value || value < 1) {
        alert('გთხოვთ შეიყვანოთ სწორი დრო (მინიმუმ 1 წუთი)');
        return;
      }
      void persistSettings({ durationMinutes: value }, { notifyDuration: true });
    }

    function saveGatePassword() {
      const value = String(DOM.multiApartmentGatePwdInput?.value || '').trim();
      if (!value) {
        showToast('გთხოვთ შეიყვანოთ პაროლი', 'error');
        return;
      }
      void persistSettings({ gatePassword: value }, { notifyPassword: true });
    }

    function handleGatePwdInput() {
      clearTimeout(state.settingsTimer);
      state.settingsTimer = setTimeout(() => {
        const value = String(DOM.multiApartmentGatePwdInput?.value || '').trim();
        if (!value) return;
        void persistSettings({ gatePassword: value });
      }, 600);
    }

    function handleGridClick(event) {
      const target = event.target;
      if (!target) return;

      if (target.closest?.('#addMultiApartmentTile')) {
        addProject();
        return;
      }

      const card = target.closest?.('.block-card');
      if (!card) return;
      const projectId = card.dataset.projectId;
      const projectIndex = state.data.findIndex((project) => project.id === projectId);
      if (projectIndex === -1) return;
      const project = state.data[projectIndex];

      if (target.classList.contains('head-file-choose')) {
        const projectIdForFile = target.dataset.projectId;
        const fileInput = DOM_ELEMENTS.grid?.querySelector?.(`.head-file-input[data-project-id="${projectIdForFile}"]`);
        if (fileInput) {
          fileInput.click();
        }
        return;
      }

      if (target.classList.contains('head-file-input')) {
        if (event.type !== 'change') return;
        const file = target.files?.[0];
        if (file) {
          if (file.type !== 'application/pdf') {
            showToast('მხოლოდ PDF ფაილებია დაშვებული', 'error');
            target.value = '';
            return;
          }
          void uploadPdf(project, file);
        }
        return;
      }

      if (target.classList.contains('up')) {
        if (projectIndex > 0) {
          [state.data[projectIndex - 1], state.data[projectIndex]] = [state.data[projectIndex], state.data[projectIndex - 1]];
          save();
          render();
        }
        return;
      }

      if (target.classList.contains('down')) {
        if (projectIndex < state.data.length - 1) {
          [state.data[projectIndex + 1], state.data[projectIndex]] = [state.data[projectIndex], state.data[projectIndex + 1]];
          save();
          render();
        }
        return;
      }

      if (target.classList.contains('head-delete')) {
        if (confirm('ნამდვილად გსურთ პროექტის წაშლა?')) {
          void deleteProject(project);
        }
        return;
      }

      if (target.classList.contains('head-toggle')) {
        const isOpen = card.classList.contains('open');
        setCardOpen(card, !isOpen);
        return;
      }

      if (target.closest?.('.q-add-tile')) {
        const answerId = generateId();
        if (!Array.isArray(project.answers)) project.answers = [];
        project.answers.push({ id: answerId, text: '' });
        save();
        updateProjectCount(projectId);
        render();
        const updatedCard = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"]`);
        if (updatedCard) setCardOpen(updatedCard, true);
        return;
      }

      const answerCard = target.closest?.('.answer-card');
      if (answerCard) {
        const answerId = answerCard.dataset.answerId;
        if (!answerId) return;
        if (!Array.isArray(project.answers)) project.answers = [];
        const answerIndex = project.answers.findIndex((answer) => answer.id === answerId);
        if (answerIndex === -1) return;

        if (target.classList.contains('a-delete')) {
          if (confirm('ნამდვილად გსურთ პასუხის წაშლა?')) {
            project.answers.splice(answerIndex, 1);
            if (Array.isArray(project.correctAnswerIds)) {
              project.correctAnswerIds = project.correctAnswerIds.filter((id) => id !== answerId);
            }
            save();
            updateProjectCount(projectId);
            render();
            const updatedCard = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"]`);
            if (updatedCard) setCardOpen(updatedCard, true);
          }
          return;
        }

        if (target.closest?.('.a-up')) {
          if (answerIndex > 0) {
            [project.answers[answerIndex - 1], project.answers[answerIndex]] = [project.answers[answerIndex], project.answers[answerIndex - 1]];
            save();
            render();
            const updatedCard = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"]`);
            if (updatedCard) setCardOpen(updatedCard, true);
          }
          return;
        }

        if (target.closest?.('.a-down')) {
          if (answerIndex < project.answers.length - 1) {
            [project.answers[answerIndex + 1], project.answers[answerIndex]] = [project.answers[answerIndex], project.answers[answerIndex + 1]];
            save();
            render();
            const updatedCard = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"]`);
            if (updatedCard) setCardOpen(updatedCard, true);
          }
          return;
        }

        if (target.classList.contains('a-correct') || target.closest?.('.a-correct')) {
          if (event.type !== 'change') return;
          const input = target.classList.contains('a-correct')
            ? target
            : target.closest('.a-correct');
          if (!input) return;
          const isChecked = !!input.checked;
          if (!Array.isArray(project.correctAnswerIds)) {
            project.correctAnswerIds = [];
          }
          if (isChecked) {
            if (!project.correctAnswerIds.includes(answerId)) {
              project.correctAnswerIds.push(answerId);
            }
          } else {
            project.correctAnswerIds = project.correctAnswerIds.filter((id) => id !== answerId);
          }
          save();
          return;
        }
      }
    }

    function handleGridKeydown(event) {
      if (event.key !== 'Enter') return;
      const target = event.target;
      if (!target) return;
      const card = target.closest?.('.block-card');
      if (!card) return;
      const projectId = card.dataset.projectId;
      const projectIndex = state.data.findIndex((project) => project.id === projectId);
      if (projectIndex === -1) return;
      const project = state.data[projectIndex];

      if (target.classList.contains('head-number')) {
        const value = parseInt(String(target.value || '').trim(), 10);
        if (!Number.isNaN(value) && value > 0) {
          project.number = value;
          save();
        }
        return;
      }

      if (target.classList.contains('head-file-choose')) {
        const projectId = target.dataset.projectId;
        const fileInput = DOM_ELEMENTS.grid?.querySelector?.(`.head-file-input[data-project-id="${projectId}"]`);
        if (fileInput) fileInput.click();
        return;
      }

      if (target.classList.contains('head-file-input')) {
        const file = target.files?.[0];
        if (file) {
          if (file.type !== 'application/pdf') {
            showToast('მხოლოდ PDF ფაილებია დაშვებული', 'error');
            target.value = '';
            return;
          }
          void uploadPdf(project, file);
        }
        return;
      }

      const answerCard = target.closest?.('.answer-card');
      if (answerCard) {
        const answerId = answerCard.dataset.answerId;
        if (!answerId) return;
        if (!Array.isArray(project.answers)) project.answers = [];
        const answerIndex = project.answers.findIndex((answer) => answer.id === answerId);
        if (answerIndex === -1) return;

        if (target.classList.contains('a-delete')) {
          if (confirm('ნამდვილად გსურთ პასუხის წაშლა?')) {
            project.answers.splice(answerIndex, 1);
            if (Array.isArray(project.correctAnswerIds)) {
              project.correctAnswerIds = project.correctAnswerIds.filter((id) => id !== answerId);
            }
            save();
            updateProjectCount(projectId);
            render();
            const updatedCard = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"]`);
            if (updatedCard) setCardOpen(updatedCard, true);
          }
          return;
        }

        if (target.classList.contains('a-up')) {
          if (answerIndex > 0) {
            [project.answers[answerIndex - 1], project.answers[answerIndex]] = [project.answers[answerIndex], project.answers[answerIndex - 1]];
            save();
            render();
            const updatedCard = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"]`);
            if (updatedCard) setCardOpen(updatedCard, true);
          }
          return;
        }

        if (target.classList.contains('a-down')) {
          if (answerIndex < project.answers.length - 1) {
            [project.answers[answerIndex + 1], project.answers[answerIndex]] = [project.answers[answerIndex], project.answers[answerIndex + 1]];
            save();
            render();
            const updatedCard = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"]`);
            if (updatedCard) setCardOpen(updatedCard, true);
          }
          return;
        }

        if (target.classList.contains('a-correct') || target.closest?.('.a-correct')) {
          if (!Array.isArray(project.correctAnswerIds)) {
            project.correctAnswerIds = [];
          }
          const alreadySelected = project.correctAnswerIds.includes(answerId);
          if (alreadySelected) {
            project.correctAnswerIds = project.correctAnswerIds.filter((id) => id !== answerId);
          } else {
            project.correctAnswerIds.push(answerId);
          }
          save();
          return;
        }
      }
    }

    function handleGridFocusout(event) {
      const target = event.target;
      if (!target) return;
      const card = target.closest?.('.block-card');
      if (!card) return;
      const projectId = card.dataset.projectId;
      const projectIndex = state.data.findIndex((project) => project.id === projectId);
      if (projectIndex === -1) return;
      const project = state.data[projectIndex];

      if (target.classList.contains('head-number')) {
        const value = parseInt(String(target.value || '').trim(), 10);
        if (!Number.isNaN(value) && value > 0) {
          project.number = value;
          save();
        }
        return;
      }

      if (target.classList.contains('a-text')) {
        const answerCard = target.closest?.('.answer-card');
        const answerId = answerCard?.dataset.answerId;
        if (!answerId) return;
        if (!Array.isArray(project.answers)) project.answers = [];
        const answerIndex = project.answers.findIndex((answer) => answer.id === answerId);
        if (answerIndex === -1) return;
        const newText = String(target.value || '').trim();
        console.log('Saving answer text:', { answerId, answerIndex, newText, length: newText.length });
        project.answers[answerIndex].text = newText;
        console.log('Answer after save:', project.answers[answerIndex]);
        save();
        return;
      }

    }

    async function deleteProject(project) {
      const projectId = project.id;
      try {
        const projectIdInt = parseInt(projectId, 10);
        if (Number.isNaN(projectIdInt)) {
          // Local project, not saved yet
          state.data = state.data.filter((p) => p.id !== projectId);
          save();
          render();
          return;
        }
        const response = await fetch(`${API_BASE}/admin/multi-apartment/projects/${projectIdInt}`, {
          method: 'DELETE',
          headers: { ...getAdminHeaders(), ...getActorHeaders() },
        });
        if (!response.ok) {
          await handleAdminErrorResponse(response, 'პროექტის წაშლა ვერ მოხერხდა', showToast);
          return;
        }
        state.data = state.data.filter((p) => p.id !== projectId);
        render();
        updateStats();
        showToast('პროექტი წაიშალა', 'success');
      } catch (err) {
        console.error('Failed to delete project', err);
        showToast('პროექტის წაშლა ვერ მოხერხდა', 'error');
      }
    }

    async function uploadPdf(project, file) {
      const projectId = project.id;
      try {
        const projectIdInt = parseInt(projectId, 10);
        if (Number.isNaN(projectIdInt)) {
          showToast('ჯერ შეინახეთ პროექტი', 'error');
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_BASE}/admin/multi-apartment/projects/${projectIdInt}/pdf`, {
          method: 'POST',
          headers: { ...getAdminHeaders(), ...getActorHeaders() },
          body: formData,
        });
        if (!response.ok) {
          await handleAdminErrorResponse(response, 'PDF ატვირთვა ვერ მოხერხდა', showToast);
          return;
        }
        project.pdfFile = file.name;
        const fileNameSpan = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${projectId}"] .head-file-name`);
        if (fileNameSpan) fileNameSpan.textContent = file.name;
        showToast('PDF ატვირთულია', 'success');
      } catch (err) {
        console.error('Failed to upload PDF', err);
        showToast('PDF ატვირთვა ვერ მოხერხდა', 'error');
      }
    }

    function init() {
      DOM_ELEMENTS.grid = document.getElementById('multiApartmentGrid');
      DOM_ELEMENTS.blocksCount = document.getElementById('multiApartmentBlocksCount');
      if (!DOM_ELEMENTS.grid) return;

      // Wire settings controls
      on(DOM.multiApartmentDurationSaveBtn, 'click', saveDuration);
      on(DOM.multiApartmentGatePwdSaveBtn, 'click', saveGatePassword);
      on(DOM.multiApartmentGatePwdInput, 'input', handleGatePwdInput);

      on(DOM_ELEMENTS.grid, 'click', handleGridClick);
      on(DOM_ELEMENTS.grid, 'change', handleGridClick);
      on(DOM_ELEMENTS.grid, 'keydown', handleGridKeydown);
      on(DOM_ELEMENTS.grid, 'focusout', handleGridFocusout);
      void loadSettings();
      void loadInitialProjects();
    }

    return {
      init,
      render: () => render(),
    };
  }

  if (typeof global !== 'undefined' && global.AdminModules) {
    global.AdminModules.createMultiApartmentModule = createMultiApartmentModule;
  }
})(typeof window !== 'undefined' ? window : this);

