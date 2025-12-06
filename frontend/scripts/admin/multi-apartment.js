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
          <div class="block-head">
            <div class="block-order">
              <button class="i-btn up" ${atTop ? 'disabled' : ''} aria-label="ზემოთ">▲</button>
              <button class="i-btn down" ${atBottom ? 'disabled' : ''} aria-label="ქვემოთ">▼</button>
            </div>
            <span class="head-label">პროექტი</span>
            <input class="head-number" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(project.number ?? '')}" aria-label="პროექტის ნომერი" />
            <input class="head-name" type="text" placeholder="პროექტის სახელი" value="${escapeHtml(project.name || '')}" aria-label="პროექტის სახელი" />
            <span class="head-qty-label">რაოდენობა</span>
            <input class="head-qty" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(typeof project.qty === 'number' ? project.qty : '')}" aria-label="რაოდენობა" />
            <button class="head-delete" type="button" aria-label="პროექტის წაშლა" title="წაშლა">×</button>
            <button class="head-toggle" type="button" aria-expanded="false">▾</button>
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
      state.data.push({ id, number: nextNumber(), name: '', qty: 0 });
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

      if (target.classList.contains('head-name')) {
        project.name = String(target.value || '').trim();
        save();
        return;
      }

      if (target.classList.contains('head-qty')) {
        const value = parseInt(String(target.value || '').trim(), 10);
        project.qty = (!Number.isNaN(value) && value >= 0) ? value : 0;
        save();
        updateStats();
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

      if (target.classList.contains('head-name')) {
        project.name = String(target.value || '').trim();
        save();
        return;
      }

      if (target.classList.contains('head-qty')) {
        const value = parseInt(String(target.value || '').trim(), 10);
        project.qty = (!Number.isNaN(value) && value >= 0) ? value : 0;
        save();
        updateStats();
        return;
      }
    }

    function init() {
      DOM_ELEMENTS.grid = document.getElementById('multiApartmentGrid');
      DOM_ELEMENTS.blocksCount = document.getElementById('multiApartmentBlocksCount');
      if (!DOM_ELEMENTS.grid) return;
      on(DOM_ELEMENTS.grid, 'click', handleGridClick);
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

