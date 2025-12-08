document.addEventListener('DOMContentLoaded', () => {
  const qs = (selector) => document.querySelector(selector);
  
  const API_BASE = (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE === 'string')
    ? window.APP_CONFIG.API_BASE
    : 'http://127.0.0.1:8000';

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getActorHeaders() {
    const user = getCurrentUser();
    const email = user?.email || '';
    return email ? { 'x-actor-email': email } : {};
  }

  const DOM = {
    cameraSlot: qs('.camera-slot'),
    userInfo: qs('.pe-lb-1'),
    rightDateTime: qs('#rightDateTime'),
    projectCode: qs('.pe-lb-3'),
    centerContent: qs('.pe-center-content'),
    rightBottom: qs('.pe-right-bottom'),
    startBtn: qs('#peStart') || qs('.btn.primary'),
    finishBtn: qs('#peFinish') || qs('.btn.finish'),
    // გაფრთხილებებისა და შედეგების დიალოგები
    confirmOverlay: qs('#peConfirmOverlay'),
    confirmDialog: qs('#peConfirmDialog'),
    confirmYes: qs('#peConfirmYes'),
    confirmNo: qs('#peConfirmNo'),
    finalOverlay: qs('#peFinalOverlay'),
    finalDialog: qs('#peFinalDialog'),
    finalAgree: qs('#peFinalAgree'),
    finalBack: qs('#peFinalBack'),
    resultsOverlay: qs('#peResultsOverlay'),
    resultsDialog: qs('#peResultsDialog'),
    resultsList: qs('#peResultsList'),
    resultsClose: qs('#peResultsClose'),
  };

  const state = {
    cameraStream: null,
    cameraVideo: null,
    cameraDevices: [],
    cameraDeviceId: null,
    cameraDeviceLabel: '',
    project: null,
    // For backend compatibility we keep a single selectedAnswerId,
    // but UI მხარეს ვინახავთ ყველა მონიშნულ პასუხს selectedAnswerIds-ში
    selectedAnswerId: null,
    selectedAnswerIds: [],
    started: false,
    finished: false,
  };

  function showOverlay(el) {
    if (!el) return;
    el.style.display = 'block';
  }

  function hideOverlay(el) {
    if (!el) return;
    el.style.display = 'none';
  }

  function showDialog(el) {
    if (!el) return;
    el.hidden = false;
  }

  function hideDialog(el) {
    if (!el) return;
    el.hidden = true;
  }

  function showCameraMessage(message) {
    if (!DOM.cameraSlot) return;
    DOM.cameraSlot.innerHTML = '';

    const placeholder = document.createElement('div');
    placeholder.className = 'camera-placeholder';
    placeholder.style.display = 'flex';
    placeholder.style.flexDirection = 'column';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.textAlign = 'center';
    placeholder.style.padding = '12px';
    placeholder.style.height = '100%';
    placeholder.style.color = '#1d2744';
    placeholder.style.fontWeight = '600';
    placeholder.style.fontSize = '14px';
    placeholder.style.lineHeight = '1.4';
    placeholder.style.background = 'rgba(29, 39, 68, 0.08)';
    placeholder.style.boxSizing = 'border-box';

    const text = document.createElement('div');
    text.textContent = String(message || '');
    placeholder.appendChild(text);

    DOM.cameraSlot.appendChild(placeholder);
  }

  function isStreamActive(stream) {
    if (!stream) return false;
    try {
      return stream.getTracks().some((track) => track.readyState === 'live');
    } catch {
      return false;
    }
  }

  function handleCameraStreamEnded() {
    stopCamera();
    startCamera({ force: true }).catch(() => {});
  }

  function monitorCameraStream(stream) {
    if (!stream) return;
    try {
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', handleCameraStreamEnded, { once: true });
        track.addEventListener('mute', handleCameraStreamEnded, { once: true });
        track.addEventListener('inactive', handleCameraStreamEnded, { once: true });
      });
    } catch {}
  }

  async function refreshCameraDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return state.cameraDevices;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      state.cameraDevices = devices.filter((device) => device.kind === 'videoinput');
    } catch (err) {
      console.debug('[evaluation] enumerateDevices failed', err);
    }
    return state.cameraDevices;
  }

  function getCameraLabelById(deviceId) {
    if (!deviceId) return '';
    const match = state.cameraDevices.find((device) => device.deviceId === deviceId);
    return match?.label || '';
  }

  function getCurrentCameraLabel() {
    return getCameraLabelById(state.cameraDeviceId) || state.cameraDeviceLabel || '';
  }

  function isLikelyVirtualCamera(device) {
    const label = String(device?.label || '').toLowerCase();
    const VIRTUAL_CAMERA_HINTS = [
      'virtual',
      'obs',
      'splitcam',
      'iriun',
      'droidcam',
      'epoccam',
      'manycam',
      'snap camera',
      'snapcamera',
      'camo',
      'webcam utility',
      'loopback',
      'avatar',
    ];
    return VIRTUAL_CAMERA_HINTS.some((hint) => label.includes(hint));
  }

  function buildCameraPreference(devices, requestedDeviceId) {
    const ordered = [];
    const add = (id) => {
      if (!id) return;
      if (!ordered.includes(id)) ordered.push(id);
    };

    if (requestedDeviceId) add(requestedDeviceId);
    if (state.cameraDeviceId) add(state.cameraDeviceId);

    devices.filter((device) => !isLikelyVirtualCamera(device)).forEach((device) => add(device.deviceId));
    devices.forEach((device) => add(device.deviceId));

    return ordered;
  }

  async function acquireCameraStream(deviceId) {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not supported');
    }

    const baseConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    if (deviceId) {
      baseConstraints.video.deviceId = { exact: deviceId };
    } else {
      baseConstraints.video.facingMode = { ideal: 'user' };
    }

    try {
      return await mediaDevices.getUserMedia(baseConstraints);
    } catch (error) {
      if (error?.name === 'OverconstrainedError' || error?.name === 'ConstraintNotSatisfiedError' || error?.name === 'NotReadableError') {
        const relaxedConstraints = deviceId
          ? { video: { deviceId: { exact: deviceId } }, audio: true }
          : { video: true, audio: true };
        return await mediaDevices.getUserMedia(relaxedConstraints);
      }
      throw error;
    }
  }

  function getCameraErrorMessage(error) {
    if (!error) {
      return 'კამერა/მიკროფონი ვერ ჩაირთო. გთხოვთ შეამოწმოთ მოწყობილობა და ბრაუზერის უფლებები.';
    }
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'კამერისა და მიკროფონის ჩართვა მოითხოვს ნებართვას. გთხოვთ დაადასტუროთ მათი გამოყენება ბრაუზერის შეტყობინებაში.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'კამერა ვერ მოიძებნა. შეაერთეთ კამერა და სცადეთ თავიდან.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'კამერა უკვე გამოიყენება სხვა აპლიკაციაში. გათიშეთ სხვა პროგრამა და სცადეთ ხელახლა.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'კამერა არ შეესაბამება მოთხოვნილ პარამეტრებს. სცადეთ სტანდარტული კამერის გამოყენება.';
      case 'SecurityError':
        return 'ბრაუზერმა დაბლოკა კამერის ჩართვა უსაფრთხოების მიზეზით. გთხოვთ გახსნათ გვერდი უსაფრთხო (https) კავშირით.';
      default:
        return 'კამერა/მიკროფონი ვერ ჩაირთო. გთხოვთ შეამოწმოთ მოწყობილობა და ბრაუზერის უფლებები.';
    }
  }

  function attachStreamToCameraSlot(stream) {
    if (!DOM.cameraSlot) return;
    DOM.cameraSlot.innerHTML = '';
    if (!state.cameraVideo) {
      state.cameraVideo = document.createElement('video');
      state.cameraVideo.setAttribute('playsinline', '');
      state.cameraVideo.autoplay = true;
      state.cameraVideo.muted = true;
      state.cameraVideo.controls = false;
      state.cameraVideo.style.width = '100%';
      state.cameraVideo.style.height = '100%';
      state.cameraVideo.style.objectFit = 'contain';
      state.cameraVideo.style.display = 'block';
      state.cameraVideo.addEventListener('error', () => {
        stopCamera();
        startCamera({ force: true }).catch(() => {});
      });
    }
    if (!DOM.cameraSlot.contains(state.cameraVideo)) {
      DOM.cameraSlot.appendChild(state.cameraVideo);
    }
    try {
      state.cameraVideo.srcObject = stream;
      const playPromise = state.cameraVideo.play?.();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    } catch (err) {
      console.debug('[evaluation] camera play failed', err);
    }
  }

  let cameraStartPromise = null;

  async function startCamera({ force = false, requestedDeviceId = null } = {}) {
    if (!DOM.cameraSlot) return null;

    if (state.cameraStream) {
      if (!force && isStreamActive(state.cameraStream)) {
        attachStreamToCameraSlot(state.cameraStream);
        return state.cameraStream;
      }
      stopCamera();
    }

    if (cameraStartPromise) return cameraStartPromise;

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      showCameraMessage('თქვენი ბრაუზერი არ უჭერს მხარს კამერის ჩართვას.');
      return null;
    }

    const hostname = window.location?.hostname || '';
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname);

    await refreshCameraDevices().catch(() => []);

    if (window.isSecureContext === false && !isLocalHost) {
      showCameraMessage('კამერის გამოსაყენებლად გახსენით გვერდი უსაფრთხო (https) კავშირით ან localhost-იდან.');
      return null;
    }

    const preferredIds = buildCameraPreference(state.cameraDevices, requestedDeviceId);

    showCameraMessage('კამერის ჩართვა მიმდინარეობს...');

    cameraStartPromise = (async () => {
      let lastError = null;
      const queue = [...preferredIds, null].filter((value, index, arr) => arr.indexOf(value) === index);
      for (const deviceId of queue) {
        try {
          const stream = await acquireCameraStream(deviceId);
          if (!stream) continue;

          const tracks = typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
          const track = tracks[0];
          if (!track) {
            try { stream.getTracks().forEach((t) => t.stop()); } catch {}
            continue;
          }
          const settings = track.getSettings ? track.getSettings() : null;
          const actualDeviceId = settings?.deviceId || deviceId || null;
          const trackLabel = track.label || '';

          state.cameraStream = stream;
          monitorCameraStream(stream);
          attachStreamToCameraSlot(stream);
          await refreshCameraDevices().catch(() => []);

          let effectiveDeviceId = actualDeviceId;
          if (!effectiveDeviceId && trackLabel) {
            const matched = state.cameraDevices.find((device) => device.label === trackLabel);
            if (matched?.deviceId) {
              effectiveDeviceId = matched.deviceId;
            }
          }
          state.cameraDeviceId = effectiveDeviceId;
          state.cameraDeviceLabel = trackLabel || getCameraLabelById(effectiveDeviceId) || state.cameraDeviceLabel;
          return stream;
        } catch (error) {
          lastError = error;
          console.debug('[evaluation] camera start failed for device', deviceId, error);
        }
      }

      throw lastError || new Error('კამერა ვერ ჩაირთო');
    })();

    try {
      return await cameraStartPromise;
    } catch (err) {
      showCameraMessage(getCameraErrorMessage(err));
      return null;
    } finally {
      cameraStartPromise = null;
    }
  }

  function stopCamera() {
    if (state.cameraStream) {
      try {
        state.cameraStream.getTracks().forEach((track) => {
          try { track.stop(); } catch {}
        });
      } catch {}
    }
    state.cameraStream = null;
    if (state.cameraVideo) {
      try { state.cameraVideo.srcObject = null; } catch {}
      if (state.cameraVideo.parentElement) {
        state.cameraVideo.parentElement.removeChild(state.cameraVideo);
      }
    }
    if (DOM.cameraSlot) {
      DOM.cameraSlot.innerHTML = '';
    }
  }

  function updateUserInfo() {
    if (!DOM.userInfo) return;
    const user = getCurrentUser();
    if (user?.firstName && user?.lastName && user?.code) {
      DOM.userInfo.textContent = `${user.firstName} ${user.lastName} — ${user.code}`;
    } else {
      DOM.userInfo.textContent = '';
    }
  }

  function getProjectCodeFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || params.get('projectCode') || '';
  }

  async function loadProject(code) {
    if (!code) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/public/multi-apartment/projects/${encodeURIComponent(code)}`, {
        headers: { 'Cache-Control': 'no-cache', ...getActorHeaders() },
      });
      if (!response.ok) {
        if (response.status === 404) {
          showError('პროექტი ვერ მოიძებნა');
        } else {
          showError('პროექტის ჩატვირთვა ვერ მოხერხდა');
        }
        return;
      }
      const project = await response.json();
      state.project = project;
      renderProject();
    } catch (err) {
      console.error('Failed to load project', err);
      showError('პროექტის ჩატვირთვა ვერ მოხერხდა');
    }
  }

  async function loadRandomProject() {
    try {
      console.log('Loading random project...');
      const response = await fetch(`${API_BASE}/public/multi-apartment/projects/random`, {
        headers: { 'Cache-Control': 'no-cache', ...getActorHeaders() },
      });
      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        if (response.status === 404) {
          showError('პროექტი ვერ მოიძებნა');
        } else {
          showError('პროექტის ჩატვირთვა ვერ მოხერხდა');
        }
        return;
      }
      const project = await response.json();
      console.log('Project loaded:', project);
      state.project = project;
      renderProject();
    } catch (err) {
      console.error('Failed to load random project', err);
      showError('პროექტის ჩატვირთვა ვერ მოხერხდა');
    }
  }

  function showError(message) {
    if (DOM.centerContent) {
      DOM.centerContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #d32f2f;">${message}</div>`;
    }
  }

  // Update only the visual state of answers (background + checkbox) without re-rendering PDF
  function updateAnswerSelection() {
    if (!DOM.rightBottom) return;

    const selectedIds = Array.isArray(state.selectedAnswerIds) ? state.selectedAnswerIds : [];

    DOM.rightBottom.querySelectorAll('.answer-option').forEach((el) => {
      const answerId = el.dataset.answerId;
      const isSelected = selectedIds.includes(String(answerId || ''));

      // Highlight selected answer container
      el.style.background = isSelected ? '#e3f2fd' : '#fff';

      // Sync checkbox state
      const checkbox = el.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = isSelected;
      }
    });
  }

  // Toggle one answer in the multi-select list and keep selectedAnswerId in sync
  function toggleAnswer(answerId) {
    const id = String(answerId || '');
    if (!id) return;

    if (!Array.isArray(state.selectedAnswerIds)) {
      state.selectedAnswerIds = [];
    }

    const idx = state.selectedAnswerIds.indexOf(id);
    if (idx === -1) {
      state.selectedAnswerIds.push(id);
    } else {
      state.selectedAnswerIds.splice(idx, 1);
    }

    // Backend მაინც ერთ selectedAnswerId-ს იღებს — ავირჩიოთ ბოლო მონიშნული ან null
    state.selectedAnswerId = state.selectedAnswerIds.length
      ? state.selectedAnswerIds[state.selectedAnswerIds.length - 1]
      : null;

    updateAnswerSelection();
  }

  function renderProject() {
    if (!state.project) {
      console.log('renderProject: No project in state');
      return;
    }
    console.log('renderProject: Rendering project', state.project);

    // Update project code display
    if (DOM.projectCode) {
      DOM.projectCode.textContent = `პროექტის კოდი - P ${state.project.code}`;
      console.log('Project code updated:', DOM.projectCode.textContent);
    } else {
      console.warn('DOM.projectCode is null');
    }

    // Render PDF in center
    if (DOM.centerContent && state.project.pdfUrl) {
      const pdfUrl = state.project.pdfUrl.startsWith('http')
        ? state.project.pdfUrl
        : `${API_BASE}${state.project.pdfUrl}`;
      DOM.centerContent.innerHTML = `
        <iframe 
          src="${pdfUrl}" 
          style="width: 100%; height: 100%; border: none;"
          title="პროექტის PDF"
        ></iframe>
      `;
    } else if (DOM.centerContent) {
      DOM.centerContent.innerHTML = '<div style="padding: 20px; text-align: center;">PDF ფაილი არ არის ხელმისაწვდომი</div>';
    }

    // Render answers in right column bottom
    console.log('DOM.rightBottom:', DOM.rightBottom);
    console.log('state.project.answers:', state.project.answers);
    if (DOM.rightBottom && Array.isArray(state.project.answers) && state.project.answers.length > 0) {
      const selectedIds = Array.isArray(state.selectedAnswerIds) ? state.selectedAnswerIds : [];
      const answersHtml = state.project.answers.map((answer, index) => {
        const answerId = String(answer.id);
        const isSelected = selectedIds.includes(answerId);
        return `
        <div class="answer-option" data-answer-id="${answerId}" style="
          padding: 10px;
          margin: 5px 0;
          border: 2px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
          background: ${isSelected ? '#e3f2fd' : '#fff'};
          display: flex;
          align-items: flex-start;
          gap: 10px;
        ">
          <input 
            type="checkbox" 
            data-answer-id="${answerId}"
            ${isSelected ? 'checked' : ''}
            style="
              margin-top: 2px;
              cursor: pointer;
              flex-shrink: 0;
            "
            onclick="event.stopPropagation();"
          />
          <div style="flex: 1;">
            <strong>${index + 1}.</strong> ${escapeHtml(answer.text)}
          </div>
        </div>
      `;
      }).join('');
      DOM.rightBottom.innerHTML = `
        <div style="padding: 10px;">
          <h3 style="margin-top: 0;">პასუხები:</h3>
          ${answersHtml}
        </div>
      `;

      // Add click handlers for answer options
      DOM.rightBottom.querySelectorAll('.answer-option').forEach((el) => {
        el.addEventListener('click', (e) => {
          // Don't trigger if clicking directly on checkbox (it handles itself)
          if (e.target.type === 'checkbox') return;
          const answerId = el.dataset.answerId;
          if (answerId) {
            toggleAnswer(answerId);
          }
        });
      });

      // Add change handlers for checkboxes
      DOM.rightBottom.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener('change', (e) => {
          const answerId = e.target.dataset.answerId;
          if (answerId) {
            // Checkbox-ს პირდაპირ ვამუშავებთ იგივე toggle ლოგიკით
            toggleAnswer(answerId);
          }
        });
      });
      console.log('Answers rendered successfully');
    } else {
      console.warn('Cannot render answers:', {
        rightBottom: !!DOM.rightBottom,
        answers: state.project.answers,
        isArray: Array.isArray(state.project.answers),
        length: state.project.answers?.length
      });
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getPercentColorClass(percent) {
    if (percent < 70) return 'pct-red';
    if (percent < 75) return 'pct-yellow';
    return 'pct-green';
  }

  function getWrongCountColorClass(count) {
    if (count >= 3) return 'pct-red';
    if (count === 2) return 'pct-yellow';
    return 'pct-green';
  }

  async function submitEvaluation() {
    const hasSelections = Array.isArray(state.selectedAnswerIds) && state.selectedAnswerIds.length > 0;

    if (!state.project || !hasSelections) {
      alert('გთხოვთ მონიშნოთ მინიმუმ ერთი პასუხი');
      return false;
    }

    if (state.finished) {
      // უკვე გაგზავნილია – უბრალოდ შედეგები ვაჩვენოთ
      return true;
    }

    try {
      const payload = {
        projectCode: state.project.code,
      };

      if (state.selectedAnswerId) {
        payload.selectedAnswerId = parseInt(state.selectedAnswerId, 10);
      }

      const response = await fetch(`${API_BASE}/public/multi-apartment/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getActorHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Evaluation submission failed', errorText);
        alert('შეფასების გაგზავნა ვერ მოხერხდა');
        return false;
      }

      state.finished = true;
      if (DOM.finishBtn) {
        DOM.finishBtn.disabled = true;
        DOM.finishBtn.textContent = 'გაგზავნილია';
      }

      return true;
    } catch (err) {
      console.error('Failed to submit evaluation', err);
      alert('შეფასების გაგზავნა ვერ მოხერხდა');
      return false;
    }
  }

  function showEvaluationResults() {
    if (!DOM.resultsOverlay || !DOM.resultsDialog || !DOM.resultsList || !state.project) return;

    const selectedIds = Array.isArray(state.selectedAnswerIds)
      ? state.selectedAnswerIds.map((id) => String(id))
      : [];

    const correctIdsRaw = Array.isArray(state.project.correctAnswerIds)
      ? state.project.correctAnswerIds
      : [];
    const correctIds = correctIdsRaw.map((id) => String(id));

    const totalCorrect = correctIds.length;
    let correctSelected = 0;

    correctIds.forEach((id) => {
      if (selectedIds.includes(id)) {
        correctSelected += 1;
      }
    });

    const wrongSelected = selectedIds.filter((id) => !correctIds.includes(id)).length;

    DOM.resultsList.innerHTML = '';

    // სწორი პასუხების პროცენტი (ადმინზე მონიშნული სწორი პასუხებიდან)
    const safeTotal = Number(totalCorrect) || 0;
    const percent = safeTotal > 0 ? Math.round((correctSelected / safeTotal) * 100) : 0;

    const percentRow = document.createElement('div');
    percentRow.className = 'result-row result-row-total';

    const percentLabel = document.createElement('div');
    percentLabel.className = 'result-label';
    percentLabel.textContent = 'სწორი პასუხების პროცენტი';

    const percentValue = document.createElement('div');
    percentValue.className = `result-value ${getPercentColorClass(percent)}`;
    percentValue.textContent = `${correctSelected}/${safeTotal} (${percent}%)`;

    percentRow.append(percentLabel, percentValue);
    DOM.resultsList.appendChild(percentRow);

    // არასწორი პასუხების რაოდენობა
    const wrongRow = document.createElement('div');
    wrongRow.className = 'result-row';

    const wrongLabel = document.createElement('div');
    wrongLabel.className = 'result-label';
    wrongLabel.textContent = 'არასწორი პასუხების რაოდენობა';

    const wrongValue = document.createElement('div');
    wrongValue.className = `result-value ${getWrongCountColorClass(wrongSelected)}`;
    wrongValue.textContent = String(wrongSelected);

    wrongRow.append(wrongLabel, wrongValue);
    DOM.resultsList.appendChild(wrongRow);

    showOverlay(DOM.resultsOverlay);
    showDialog(DOM.resultsDialog);
  }

  function canFinishEvaluation() {
    if (!state.started) {
      alert('გთხოვთ ჯერ დაიწყოთ შეფასება (დააწკაპუნეთ ღილაკზე „დაწყება“).');
      return false;
    }

    if (!state.project) {
      alert('პროექტი ჯერ არ არის ჩატვირთული. გთხოვთ სცადოთ თავიდან.');
      return false;
    }

    if (!Array.isArray(state.selectedAnswerIds) || state.selectedAnswerIds.length === 0) {
      alert('გთხოვთ მონიშნოთ მინიმუმ ერთი პასუხი.');
      return false;
    }

    return true;
  }

  function handleFinishClick() {
    if (!canFinishEvaluation()) return;

    if (state.finished) {
      // უკვე დასრულებულია – პირდაპირ შედეგები
      showEvaluationResults();
      return;
    }

    if (DOM.confirmOverlay && DOM.confirmDialog) {
      showOverlay(DOM.confirmOverlay);
      showDialog(DOM.confirmDialog);
    } else {
      //fallback: თუ რაიმე მიზეზით დიალოგი არ არსებობს
      void (async () => {
        const ok = await submitEvaluation();
        if (ok) {
          showEvaluationResults();
        }
      })();
    }
  }

  const pad2 = (value) => String(value).padStart(2, '0');
  const formatDate = (date) => {
    const day = pad2(date.getDate());
    const month = pad2(date.getMonth() + 1);
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };
  const formatTime = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  function updateRightDateTime() {
    if (!DOM.rightDateTime) return;
    const now = new Date();
    DOM.rightDateTime.innerHTML = `<span>${formatDate(now)}</span><span>${formatTime(now)}</span>`;
  }

  // Initialize camera on page load
  async function initialize() {
    updateUserInfo();
    updateRightDateTime();
    setInterval(updateRightDateTime, 30 * 1000);
    showCameraMessage('კამერის ჩართვა მიმდინარეობს...');
    
    try {
      await startCamera();
    } catch (err) {
      console.debug('[evaluation] camera initialization failed', err);
    }

    // Handle device changes
    const handleDeviceChange = async () => {
      await refreshCameraDevices().catch(() => []);
      if (isStreamActive(state.cameraStream)) return;
      startCamera({ force: true }).catch(() => {});
    };
    
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    } else if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = handleDeviceChange;
    }

    // Button handlers
    if (DOM.startBtn) {
      DOM.startBtn.addEventListener('click', async () => {
        console.log('Start button clicked');
        state.started = true;
        if (DOM.startBtn) DOM.startBtn.disabled = true;
        if (DOM.finishBtn) DOM.finishBtn.disabled = false;
        await loadRandomProject();
      });
    } else {
      console.warn('DOM.startBtn is null');
    }

    if (DOM.finishBtn) {
      DOM.finishBtn.disabled = true;
      DOM.finishBtn.addEventListener('click', handleFinishClick);
    }

    // გაფრთხილების დიალოგები
    if (DOM.confirmYes) {
      DOM.confirmYes.addEventListener('click', () => {
        hideOverlay(DOM.confirmOverlay);
        hideDialog(DOM.confirmDialog);
        showOverlay(DOM.finalOverlay);
        showDialog(DOM.finalDialog);
      });
    }

    if (DOM.confirmNo) {
      DOM.confirmNo.addEventListener('click', () => {
        hideOverlay(DOM.confirmOverlay);
        hideDialog(DOM.confirmDialog);
      });
    }

    if (DOM.finalAgree) {
      DOM.finalAgree.addEventListener('click', async () => {
        hideOverlay(DOM.finalOverlay);
        hideDialog(DOM.finalDialog);
        const ok = await submitEvaluation();
        if (ok) {
          showEvaluationResults();
        }
      });
    }

    if (DOM.finalBack) {
      DOM.finalBack.addEventListener('click', () => {
        hideOverlay(DOM.finalOverlay);
        hideDialog(DOM.finalDialog);
      });
    }

    if (DOM.resultsClose) {
      DOM.resultsClose.addEventListener('click', () => {
        hideOverlay(DOM.resultsOverlay);
        hideDialog(DOM.resultsDialog);
      });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      stopCamera();
    });
  }

  initialize();
});

