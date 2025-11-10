(function (global) {
  function createResultsModule(context) {
    const {
      DOM,
      API_BASE,
      on,
      showToast,
      formatDateTime,
      formatDuration,
      arrayBufferToBase64,
      loadExternalScript,
      isFounderActor,
      getAdminHeaders,
      getActorEmail,
      getActorHeaders,
      openOverlay,
      closeOverlay,
      escapeHtml,
    } = context;

    const state = {
      currentUser: null,
      results: [],
      detail: null,
      loading: false,
      detailLoading: false,
      mediaMeta: {},
      mediaMetaSessionId: null,
      mediaLoading: false,
      mediaLoadingType: null,
      activeMediaType: null,
    };

    const STATUS_MAP = {
      completed: { label: 'დასრულებულია', tag: 'success' },
      aborted: { label: 'შეწყვეტილია', tag: 'error' },
      in_progress: { label: 'მიმდინარე', tag: 'neutral' },
    };

    const MEDIA_TYPES = {
      CAMERA: 'camera',
      SCREEN: 'screen',
    };

    const MEDIA_LABELS = {
      [MEDIA_TYPES.CAMERA]: 'ვიდეოთვალი',
      [MEDIA_TYPES.SCREEN]: 'სკრინი',
    };

    function statusMeta(status) {
      return STATUS_MAP[status] || { label: 'უცნობია', tag: 'neutral' };
    }

    function formatBytesValue(size) {
      const value = Number(size);
      if (!value || Number.isNaN(value) || value <= 0) return 'ზომა უცნობია';
      const units = ['ბაიტ', 'კბ', 'მბ', 'გბ', 'ტბ'];
      let unitIndex = 0;
      let current = value;
      while (current >= 1024 && unitIndex < units.length - 1) {
        current /= 1024;
        unitIndex += 1;
      }
      const digits = unitIndex === 0 ? 0 : current >= 100 ? 0 : current >= 10 ? 1 : 2;
      return `${current.toFixed(digits)} ${units[unitIndex]}`;
    }

    function formatSecondsValue(seconds) {
      const total = Number(seconds);
      if (!total || Number.isNaN(total) || total <= 0) return 'ხანგრძლივობა უცნობია';
      const hrs = Math.floor(total / 3600);
      const mins = Math.floor((total % 3600) / 60);
      const secs = Math.floor(total % 60);
      const parts = [];
      if (hrs) parts.push(`${hrs}სთ`);
      if (hrs || mins) parts.push(`${mins}წთ`);
      parts.push(`${secs}წმ`);
      return parts.join(' ');
    }

    function answerStatusMeta(answer) {
      if (!answer || answer.selected_option_id == null) {
        return { label: 'არ არის პასუხი', tag: 'neutral' };
      }
      return answer.is_correct ? { label: 'სწორია', tag: 'success' } : { label: 'არასწორია', tag: 'error' };
    }

    function setCandidateHeader(user) {
      const first = (user?.first_name || user?.firstName || '').trim();
      const last = (user?.last_name || user?.lastName || '').trim();
      if (DOM.candidateResultsFullName) {
        const fullName = `${first} ${last}`.trim() || 'უცნობი კანდიდატი';
        DOM.candidateResultsFullName.textContent = fullName;
      }
      if (DOM.candidateResultsCode) {
        DOM.candidateResultsCode.textContent = user?.code ? `კოდი: ${user.code}` : '';
      }
      if (DOM.candidateResultsPersonalId) {
        DOM.candidateResultsPersonalId.textContent = user?.personal_id ? `პირადი №: ${user.personal_id}` : '';
      }
    }

    function renderResultsList() {
      if (!DOM.candidateResultsList) return;
      if (state.loading) {
        DOM.candidateResultsList.innerHTML = '<div class="empty-state">იტვირთება...</div>';
        return;
      }
      if (!state.results.length) {
        DOM.candidateResultsList.innerHTML = '<div class="empty-state">შედეგები არ მოიძებნა</div>';
        return;
      }
      const fragment = document.createDocumentFragment();
      state.results.forEach((item) => {
        const card = createAttemptCard(item);
        if (card) fragment.appendChild(card);
      });
      DOM.candidateResultsList.innerHTML = '';
      DOM.candidateResultsList.appendChild(fragment);
    }

    function setMediaButtonState(button, enabled) {
      if (!button) return;
      button.disabled = !enabled;
      button.classList.toggle('disabled', !enabled);
      button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }

    function updateMediaButtons() {
      const allowMedia = state.detail?.session?.status === 'completed';
      const cameraMeta = state.mediaMeta?.[MEDIA_TYPES.CAMERA];
      const screenMeta = state.mediaMeta?.[MEDIA_TYPES.SCREEN];
      setMediaButtonState(DOM.resultDetailMedia, allowMedia && !!cameraMeta?.available);
      setMediaButtonState(DOM.resultDetailScreenMedia, allowMedia && !!screenMeta?.available);
    }

    function setActiveMediaButton(mediaType) {
      const buttons = {
        [MEDIA_TYPES.CAMERA]: DOM.resultDetailMedia,
        [MEDIA_TYPES.SCREEN]: DOM.resultDetailScreenMedia,
      };
      Object.entries(buttons).forEach(([type, button]) => {
        if (!button) return;
        button.classList.toggle('active', mediaType && type === mediaType);
      });
    }

    function resetMediaSection() {
      state.mediaMeta = {};
      state.mediaMetaSessionId = null;
      state.activeMediaType = null;
      state.mediaLoading = false;
      state.mediaLoadingType = null;
      if (DOM.resultMediaSection) DOM.resultMediaSection.hidden = true;
      if (DOM.resultMediaPlayer) {
        try {
          DOM.resultMediaPlayer.pause();
        } catch {}
        DOM.resultMediaPlayer.removeAttribute('src');
        DOM.resultMediaPlayer.load?.();
      }
      if (DOM.resultMediaDownload) {
        DOM.resultMediaDownload.href = '#';
        DOM.resultMediaDownload.setAttribute('aria-disabled', 'true');
        DOM.resultMediaDownload.classList.add('disabled');
        DOM.resultMediaDownload.removeAttribute('download');
        DOM.resultMediaDownload.removeAttribute('target');
      }
      if (DOM.resultMediaInfo) DOM.resultMediaInfo.textContent = '';
      updateMediaButtons();
      setActiveMediaButton(null);
    }

    function createAttemptCard(item) {
      if (!item) return null;
      const card = document.createElement('div');
      card.className = 'attempt-card';
      card.setAttribute('role', 'listitem');
      const status = statusMeta(item.status);
      const startedAt = formatDateTime(item.started_at);
      const finishedAt = item.finished_at ? formatDateTime(item.finished_at) : 'არ დასრულებულა';
      const score = typeof item.score_percent === 'number' ? Number(item.score_percent).toFixed(1) : '0.0';

      const safeStartedAt = escapeHtml(startedAt);
      const safeFinishedAt = escapeHtml(finishedAt);
      const safeScore = escapeHtml(score);
      card.innerHTML = `
        <div class="attempt-info">
          <div class="attempt-date">დაწყება: <strong>${safeStartedAt}</strong></div>
          <div class="attempt-status">
            <span class="result-tag ${status.tag}">${status.label}</span>
            <span>${safeScore}%</span>
          </div>
          <div class="attempt-meta">დასრულება: ${safeFinishedAt}</div>
        </div>
        <div class="attempt-actions">
          <button type="button" class="secondary-btn" data-action="view">შედეგის ნახვა</button>
          ${isFounderActor() ? '<button type="button" class="danger-btn" data-action="delete">წაშლა</button>' : ''}
        </div>
      `;

      const viewBtn = card.querySelector('[data-action="view"]');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => handleView(item.session_id));
      }
      const deleteBtn = card.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDelete(item.session_id));
      }
      return card;
    }

    async function loadResults(user) {
      state.loading = true;
      renderResultsList();
      try {
        const params = new URLSearchParams();
        if (user?.code) params.set('candidate_code', user.code);
        if (user?.personal_id) params.set('personal_id', user.personal_id);
        const response = await fetch(`${API_BASE}/admin/results?${params.toString()}`, {
          headers: { ...getAdminHeaders(), ...getActorHeaders() },
        });
        if (!response.ok) throw new Error('failed');
        const data = await response.json();
        state.results = Array.isArray(data?.items) ? data.items : [];
      } catch (err) {
        console.error('Failed to load candidate results', err);
        state.results = [];
        showToast('შედეგების ჩატვირთვა ვერ მოხერხდა', 'error');
      } finally {
        state.loading = false;
        renderResultsList();
      }
    }

    async function fetchResultDetail(sessionId) {
      const response = await fetch(`${API_BASE}/admin/results/${sessionId}`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) throw new Error('failed');
      return await response.json();
    }

    async function fetchResultMediaMeta(sessionId) {
      const response = await fetch(`${API_BASE}/admin/results/${sessionId}/media`, {
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) throw new Error('failed');
      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const map = {};
      items.forEach((item) => {
        const type = (item?.media_type || '').trim().toLowerCase();
        if (type) {
          map[type] = item;
        }
      });
      return map;
    }

    async function ensureMediaMeta(sessionId, { force = false } = {}) {
      if (!sessionId) return;
      const allowMedia = state.detail?.session?.status === 'completed';
      if (!allowMedia) {
        state.mediaMeta = {};
        state.mediaMetaSessionId = sessionId;
        updateMediaButtons();
        return;
      }
      if (!force && state.mediaMetaSessionId === sessionId && Object.keys(state.mediaMeta || {}).length) {
        updateMediaButtons();
        return;
      }
      state.mediaLoading = true;
      state.mediaLoadingType = 'all';
      try {
        const metaMap = await fetchResultMediaMeta(sessionId);
        state.mediaMeta = metaMap;
        state.mediaMetaSessionId = sessionId;
      } catch (error) {
        console.error('Failed to load media metadata', error);
        state.mediaMeta = {};
        state.mediaMetaSessionId = sessionId;
      } finally {
        state.mediaLoading = false;
        state.mediaLoadingType = null;
        updateMediaButtons();
      }
    }

    function renderDetailLoading() {
      resetMediaSection();
      if (DOM.resultDetailExamTitle) DOM.resultDetailExamTitle.textContent = 'იტვირთება...';
      if (DOM.resultDetailStatus) DOM.resultDetailStatus.innerHTML = '';
      if (DOM.resultDetailCandidate) DOM.resultDetailCandidate.textContent = '';
      if (DOM.resultDetailPersonalId) DOM.resultDetailPersonalId.textContent = '';
      if (DOM.resultDetailCode) DOM.resultDetailCode.textContent = '';
      if (DOM.resultDetailStartedAt) DOM.resultDetailStartedAt.textContent = '';
      if (DOM.resultDetailFinishedAt) DOM.resultDetailFinishedAt.textContent = '';
      if (DOM.resultDetailDuration) DOM.resultDetailDuration.textContent = '';
      if (DOM.resultDetailScore) DOM.resultDetailScore.textContent = '';
      if (DOM.resultDetailSummary) DOM.resultDetailSummary.textContent = '';
      if (DOM.resultBlockStats) DOM.resultBlockStats.innerHTML = '';
      const tbody = DOM.resultQuestionTable?.querySelector('tbody');
      if (tbody) tbody.innerHTML = '';
    }

    function renderDetail(detail) {
      if (!detail) return;
      resetMediaSection();
      const session = detail.session || {};
      const status = statusMeta(session.status);

      if (DOM.resultDetailExamTitle) {
        DOM.resultDetailExamTitle.textContent = detail.exam_title || 'გამოცდა';
      }
      if (DOM.resultDetailStatus) {
        DOM.resultDetailStatus.innerHTML = `<span class="result-tag ${status.tag}">${status.label}</span>`;
      }
      const candidateName = `${(session.candidate_first_name || '').trim()} ${(session.candidate_last_name || '').trim()}`.trim();
      if (DOM.resultDetailCandidate) DOM.resultDetailCandidate.textContent = candidateName || 'უცნობი';
      if (DOM.resultDetailPersonalId) DOM.resultDetailPersonalId.textContent = session.personal_id || '—';
      if (DOM.resultDetailCode) DOM.resultDetailCode.textContent = session.candidate_code || '—';
      if (DOM.resultDetailStartedAt) DOM.resultDetailStartedAt.textContent = formatDateTime(session.started_at);
      const finishedAtText = session.finished_at ? formatDateTime(session.finished_at) : 'არ დასრულებულა';
      if (DOM.resultDetailFinishedAt) DOM.resultDetailFinishedAt.textContent = finishedAtText;
      const durationBase = session.finished_at || session.ends_at;
      if (DOM.resultDetailDuration) DOM.resultDetailDuration.textContent = formatDuration(session.started_at, durationBase);
      if (DOM.resultDetailScore) {
        const score = typeof session.score_percent === 'number' ? Number(session.score_percent).toFixed(2) : '0.00';
        DOM.resultDetailScore.textContent = `${score}%`;
      }
      if (DOM.resultDetailSummary) {
        DOM.resultDetailSummary.textContent = `სულ: ${detail.total_questions} • პასუხი: ${detail.answered_questions} • სწორია: ${detail.correct_answers}`;
      }

      if (session.status !== 'completed') {
        setMediaButtonState(DOM.resultDetailMedia, false);
        setMediaButtonState(DOM.resultDetailScreenMedia, false);
      }

      if (DOM.resultBlockStats) {
        const fragment = document.createDocumentFragment();
        (detail.block_stats || []).forEach((stat) => {
          if (!stat) return;
          const card = document.createElement('div');
          card.className = 'block-card-stat';
          const title = stat.block_title || `ბლოკი ${stat.block_id}`;
          const safeTitle = escapeHtml(title);
          const safeCorrect = escapeHtml(stat.correct ?? 0);
          const safeTotal = escapeHtml(stat.total ?? 0);
          const safePercent = escapeHtml(Number(stat.percent || 0).toFixed(2));
          card.innerHTML = `
            <div class="block-name">${safeTitle}</div>
            <div class="block-progress">
              <span>${safeCorrect}/${safeTotal}</span>
              <span>${safePercent}%</span>
            </div>
          `;
          fragment.appendChild(card);
        });
        DOM.resultBlockStats.innerHTML = '';
        DOM.resultBlockStats.appendChild(fragment);
      }

      const tbody = DOM.resultQuestionTable?.querySelector('tbody');
      if (tbody) {
        tbody.innerHTML = '';
        (detail.answers || []).forEach((answer) => {
          if (!answer) return;
          const statusData = answerStatusMeta(answer);
          const row = document.createElement('tr');

          const codeCell = document.createElement('td');
          codeCell.textContent = answer.question_code || '';

          const blockCell = document.createElement('td');
          blockCell.textContent = answer.block_title || '';

          const questionCell = document.createElement('td');
          questionCell.textContent = answer.question_text || '';

          const selectedCell = document.createElement('td');
          selectedCell.textContent = answer.selected_option_text || '—';

          const correctCell = document.createElement('td');
          correctCell.textContent = answer.correct_option_text || '—';

          const statusCell = document.createElement('td');
          const statusTag = document.createElement('span');
          statusTag.className = `result-tag ${statusData.tag}`;
          statusTag.textContent = statusData.label;
          statusCell.appendChild(statusTag);

          const timeCell = document.createElement('td');
          timeCell.textContent = answer.answered_at ? formatDateTime(answer.answered_at) : '—';

          row.append(codeCell, blockCell, questionCell, selectedCell, correctCell, statusCell, timeCell);
          tbody.appendChild(row);
        });
      }

      if (DOM.resultDetailDangerZone) {
        DOM.resultDetailDangerZone.classList.toggle('hidden', !isFounderActor());
      }
      if (DOM.resultDetailDelete) {
        DOM.resultDetailDelete.disabled = !isFounderActor();
        DOM.resultDetailDelete.dataset.sessionId = String(session.session_id || session.id || '');
      }
      updateMediaButtons();
    }

    function renderMedia(meta, sessionId, mediaType) {
      if (!meta?.available || !sessionId) {
        showToast('ვიდეო ჩანაწერი არ არის ხელმისაწვდომი', 'warning');
        return;
      }
      if (!DOM.resultMediaSection) return;

      const downloadPath = meta.download_url || '';
      if (!downloadPath) {
        showToast('ვიდეო ჩანაწერი ვერ ჩაიტვირთა', 'error');
        return;
      }

      const actorEmail = typeof getActorEmail === 'function' ? (getActorEmail() || '') : '';
      const baseUrl = new URL(downloadPath, API_BASE);
      if (actorEmail) baseUrl.searchParams.set('actor', actorEmail);

      const playerUrl = new URL(baseUrl.toString());
      playerUrl.searchParams.set('t', String(Date.now()));

      DOM.resultMediaSection.hidden = false;

      if (DOM.resultMediaPlayer) {
        DOM.resultMediaPlayer.src = playerUrl.toString();
        DOM.resultMediaPlayer.load?.();
      }

      if (DOM.resultMediaDownload) {
        DOM.resultMediaDownload.href = baseUrl.toString();
        DOM.resultMediaDownload.setAttribute('aria-disabled', 'false');
        DOM.resultMediaDownload.classList.remove('disabled');
        DOM.resultMediaDownload.setAttribute('target', '_blank');
        const fallbackName = `session-${sessionId}-${mediaType}.webm`;
        DOM.resultMediaDownload.setAttribute('download', meta.filename || fallbackName);
      }

      const label = MEDIA_LABELS[mediaType] || 'ჩანაწერი';
      if (DOM.resultMediaInfo) {
        const infoParts = [
          `ტიპი: ${label}`,
          `ზომა: ${formatBytesValue(meta.size_bytes)}`,
          `ხანგრძლივობა: ${formatSecondsValue(meta.duration_seconds)}`,
        ];
        if (meta.updated_at) {
          infoParts.push(`განახლებული: ${formatDateTime(meta.updated_at)}`);
        }
        DOM.resultMediaInfo.textContent = infoParts.join(' • ');
      }

      state.activeMediaType = mediaType;
      setActiveMediaButton(mediaType);
    }

    function closeDetail() {
      closeOverlay(DOM.resultDetailOverlay);
      state.detail = null;
      state.mediaLoading = false;
      resetMediaSection();
    }

    async function handleView(sessionId) {
      if (!sessionId) return;
      state.detailLoading = true;
      renderDetailLoading();
      openOverlay(DOM.resultDetailOverlay);
      try {
        const detail = await fetchResultDetail(sessionId);
        state.detail = detail;
        renderDetail(detail);
        await ensureMediaMeta(sessionId, { force: true });
      } catch (err) {
        console.error('Failed to load result detail', err);
        showToast('დეტალური შედეგი ვერ ჩაიტვირთა', 'error');
        closeDetail();
      } finally {
        state.detailLoading = false;
      }
    }

    async function deleteResult(sessionId) {
      const response = await fetch(`${API_BASE}/admin/results/${sessionId}`, {
        method: 'DELETE',
        headers: { ...getAdminHeaders(), ...getActorHeaders() },
      });
      if (!response.ok) throw new Error('failed');
    }

    async function handleDelete(sessionId) {
      if (!sessionId || !isFounderActor()) return;
      const confirmed = global.confirm('ნამდვილად გსურთ შედეგის წაშლა? ქმედება შეუქცევადია.');
      if (!confirmed) return;
      try {
        await deleteResult(sessionId);
        state.results = state.results.filter((item) => item.session_id !== sessionId);
        renderResultsList();
        if (state.detail?.session?.session_id === sessionId) {
          closeDetail();
        }
        showToast('შედეგი წაიშალა');
      } catch (err) {
        console.error('Failed to delete result', err);
        showToast('შედეგის წაშლა ვერ მოხერხდა', 'error');
      }
    }

    async function handleMediaClick(mediaType) {
      const sessionId = state.detail?.session?.session_id;
      const sessionStatus = state.detail?.session?.status;
      if (!sessionId || sessionStatus !== 'completed') {
        showToast('ვიდეო ჩანაწერი ხელმისაწვდომია მხოლოდ დასრულებული გამოცდისთვის', 'warning');
        return;
      }
      if (state.mediaLoading) return;

      if (state.mediaMetaSessionId !== sessionId || !state.mediaMeta?.[mediaType]) {
        await ensureMediaMeta(sessionId, { force: true });
      }

      let meta = state.mediaMeta?.[mediaType];
      if (!meta?.available) {
        await ensureMediaMeta(sessionId, { force: true });
        meta = state.mediaMeta?.[mediaType];
      }

      if (!meta?.available) {
        showToast('ვიდეო ჩანაწერი არ არის ხელმისაწვდომი', 'warning');
        return;
      }

      renderMedia(meta, sessionId, mediaType);
    }

    let jsPdfLoader = null;
    let fontLoader = null;

    async function ensurePdfFont(doc) {
      const fontName = 'DejaVuSansUnicode';
      const hasFont = doc.getFontList?.()?.[fontName];
      if (hasFont) {
        doc.setFont(fontName, 'normal');
        return fontName;
      }

      if (!fontLoader) {
        const fontUrl = new URL('../assets/fonts/dejavu-sans.ttf', global.location.href).toString();
        fontLoader = fetch(fontUrl)
          .then((response) => {
            if (!response.ok) throw new Error('Font download failed');
            return response.arrayBuffer();
          })
          .then((buffer) => arrayBufferToBase64(buffer))
          .catch((error) => {
            fontLoader = null;
            throw error;
          });
      }

      const base64 = await fontLoader;
      doc.addFileToVFS('DejaVuSans.ttf', base64);
      doc.addFont('DejaVuSans.ttf', fontName, 'normal');
      doc.addFont('DejaVuSans.ttf', fontName, 'bold');
      doc.addFont('DejaVuSans.ttf', fontName, 'italic');
      doc.addFont('DejaVuSans.ttf', fontName, 'bolditalic');
      doc.setFont(fontName, 'normal');
      return fontName;
    }

    async function ensureJsPdf() {
      if (global.jspdf?.jsPDF) return global.jspdf.jsPDF;
      if (!jsPdfLoader) {
        const CDN_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jsPdfLoader = loadExternalScript(CDN_SRC).catch((error) => {
          jsPdfLoader = null;
          throw error;
        });
      }
      await jsPdfLoader;
      if (!global.jspdf?.jsPDF) {
        throw new Error('jsPDF unavailable after loading');
      }
      return global.jspdf.jsPDF;
    }

    async function downloadCurrentPdf() {
      if (!state.detail) return;
      await downloadPdf(state.detail);
    }

    async function downloadPdf(detail) {
      try {
        const jsPDF = await ensureJsPdf();
        const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
        const fontName = await ensurePdfFont(doc);
        const margin = 48;
        const pageWidth = doc.internal.pageSize.getWidth();
        const usableWidth = pageWidth - margin * 2;
        const pageHeight = doc.internal.pageSize.getHeight();
        const lineHeight = 16;
        let cursorY = margin;

        const session = detail.session || {};
        const status = statusMeta(session.status);
        const durationBase = session.finished_at || session.ends_at;

        doc.setFont(fontName, 'bold');
        doc.setFontSize(18);
        doc.text('გამოცდის შედეგი', margin, cursorY);
        cursorY += lineHeight * 1.5;

        doc.setFontSize(12);
        doc.setFont(fontName, 'normal');

        const infoLines = [
          `კანდიდატი: ${(session.candidate_first_name || '')} ${(session.candidate_last_name || '')}`.trim(),
          `პირადი №: ${session.personal_id || '—'}`,
          `კოდი: ${session.candidate_code || '—'}`,
          `გამოცდა: ${detail.exam_title || '—'}`,
          `სტატუსი: ${status.label}`,
          `დაწყება: ${formatDateTime(session.started_at)}`,
          `დასრულება: ${session.finished_at ? formatDateTime(session.finished_at) : 'არ დასრულებულა'}`,
          `ხანგრძლივობა: ${formatDuration(session.started_at, durationBase)}`,
          `საერთო ქულა: ${typeof session.score_percent === 'number' ? Number(session.score_percent).toFixed(2) : '0.00'}%`,
          `კითხვები: სულ ${detail.total_questions}, პასუხი ${detail.answered_questions}, სწორია ${detail.correct_answers}`,
        ];

        const splitAndWrite = (text) => {
          const lines = doc.splitTextToSize(text, usableWidth);
          lines.forEach((line) => {
            if (cursorY > pageHeight - margin) {
              doc.addPage();
              cursorY = margin;
            }
            doc.text(line, margin, cursorY);
            cursorY += lineHeight;
          });
        };

        infoLines.forEach((line) => splitAndWrite(line));
        cursorY += lineHeight / 2;

        if (detail.block_stats?.length) {
          if (cursorY > pageHeight - margin - lineHeight) {
            doc.addPage();
            cursorY = margin;
          }
          doc.setFont(fontName, 'bold');
          doc.text('ბლოკების შედეგები', margin, cursorY);
          cursorY += lineHeight;
          doc.setFont(fontName, 'normal');
          detail.block_stats.forEach((stat) => {
            const title = stat.block_title || `ბლოკი ${stat.block_id}`;
            splitAndWrite(`${title}: ${stat.correct}/${stat.total} (${Number(stat.percent || 0).toFixed(2)}%)`);
          });
          cursorY += lineHeight / 2;
        }

        if (detail.answers?.length) {
          if (cursorY > pageHeight - margin - lineHeight) {
            doc.addPage();
            cursorY = margin;
          }
          doc.setFont(fontName, 'bold');
          doc.text('კითხვების დეტალური შედეგები', margin, cursorY);
          cursorY += lineHeight;
          doc.setFont(fontName, 'normal');
          detail.answers.forEach((answer, index) => {
            const statusData = answerStatusMeta(answer);
            const header = `${index + 1}. ${answer.question_code || ''} — ${answer.block_title || ''}`.trim();
            splitAndWrite(header);
            if (answer.question_text) splitAndWrite(`კითხვა: ${answer.question_text}`);
            splitAndWrite(`არჩეული: ${answer.selected_option_text || 'არ არის პასუხი'}`);
            splitAndWrite(`სწორი: ${answer.correct_option_text || '—'}`);
            splitAndWrite(`სტატუსი: ${statusData.label}`);
            splitAndWrite(`დრო: ${answer.answered_at ? formatDateTime(answer.answered_at) : '—'}`);
            cursorY += lineHeight / 2;
          });
        }

        const code = session.candidate_code ? session.candidate_code.replace(/\s+/g, '_') : 'result';
        const filename = `result_${code}_${session.session_id || ''}.pdf`;
        doc.save(filename);
      } catch (err) {
        console.error('PDF export failed', err);
        showToast('PDF ფაილის შექმნა ვერ მოხერხდა', 'error');
      }
    }

    function open(user) {
      state.currentUser = user || null;
      state.results = [];
      state.detail = null;
      setCandidateHeader(user);
      renderResultsList();
      openOverlay(DOM.candidateResultsOverlay);
      void loadResults(user || {});
    }

    function closeList() {
      closeDetail();
      closeOverlay(DOM.candidateResultsOverlay);
      state.currentUser = null;
      state.results = [];
      renderResultsList();
    }

    function init() {
      on(DOM.candidateResultsClose, 'click', closeList);
      DOM.candidateResultsOverlay?.addEventListener('click', (event) => {
        if (event.target === DOM.candidateResultsOverlay) closeList();
      });
      on(DOM.resultDetailClose, 'click', () => closeDetail());
      DOM.resultDetailOverlay?.addEventListener('click', (event) => {
        if (event.target === DOM.resultDetailOverlay) closeDetail();
      });
      on(DOM.resultDetailDownload, 'click', () => {
        void downloadCurrentPdf();
      });
      on(DOM.resultDetailMedia, 'click', () => {
        void handleMediaClick(MEDIA_TYPES.CAMERA);
      });
      on(DOM.resultDetailScreenMedia, 'click', () => {
        void handleMediaClick(MEDIA_TYPES.SCREEN);
      });
      on(DOM.resultMediaDownload, 'click', (event) => {
        if (DOM.resultMediaDownload?.getAttribute('aria-disabled') === 'true') {
          event.preventDefault();
        }
      });
      on(DOM.resultDetailDelete, 'click', () => {
        const sessionId = state.detail?.session?.session_id;
        if (sessionId) void handleDelete(sessionId);
      });
    }

    return {
      open,
      close: closeList,
      init,
    };
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules.createResultsModule = createResultsModule;
})(window);


