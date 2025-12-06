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

    const state = { data: [], saveTimer: null, pendingNotify: false };

    const generateId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    let DOM_ELEMENTS = {
      grid: null,
      blocksCount: null,
    };

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
            <button class="head-delete" type="button" aria-label="პროექტის წაშლა" title="წაშლა">×</button>
            <button class="head-toggle" type="button" aria-expanded="false">▾</button>
            <span class="head-count" title="პასუხების რაოდენობა">${escapeHtml(Array.isArray(project.answers) ? project.answers.length : 0)}</span>
          </div>
          <div class="block-questions" aria-hidden="true">
            <!-- პროექტის დეტალები შემდეგ დაემატება -->
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
      state.data.push({ id, number: nextNumber(), pdfFile: null, answers: [] });
      save();
      render();
      const card = DOM_ELEMENTS.grid?.querySelector?.(`.block-card[data-project-id="${id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function save(options = {}) {
      state.pendingNotify = state.pendingNotify || !!options.notify;
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => {
        state.saveTimer = null;
        // TODO: შემდეგ დაემატება სერვერზე შენახვა
        if (state.pendingNotify) {
          state.pendingNotify = false;
          showToast('შენახულია', 'success');
        }
      }, 400);
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
          state.data.splice(projectIndex, 1);
          save();
          render();
        }
        return;
      }

      if (target.classList.contains('head-toggle')) {
        const isOpen = card.classList.contains('open');
        setCardOpen(card, !isOpen);
        return;
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
          project.pdfFile = file.name;
          const fileNameSpan = card.querySelector('.head-file-name');
          if (fileNameSpan) fileNameSpan.textContent = file.name;
          save();
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

    }

    function init() {
      DOM_ELEMENTS.grid = document.getElementById('multiApartmentGrid');
      DOM_ELEMENTS.blocksCount = document.getElementById('multiApartmentBlocksCount');
      if (!DOM_ELEMENTS.grid) return;
      on(DOM_ELEMENTS.grid, 'click', handleGridClick);
      on(DOM_ELEMENTS.grid, 'change', handleGridClick);
      on(DOM_ELEMENTS.grid, 'keydown', handleGridKeydown);
      on(DOM_ELEMENTS.grid, 'focusout', handleGridFocusout);
      render();
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

