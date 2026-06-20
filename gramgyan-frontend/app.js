// GramGyan Frontend Engine
document.addEventListener('DOMContentLoaded', () => {
  // Portal Switching Elements
  const portalNavBtns = document.querySelectorAll('.portal-nav-btn');
  const portalViews = document.querySelectorAll('.portal-view');

  // DOM Elements - Student Portal
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatMessages = document.getElementById('chat-messages');
  const modelSelectors = document.querySelectorAll('.model-selector');
  const shortcutTags = document.querySelectorAll('.shortcut-tag');
  const chatLangSelect = document.getElementById('chat-lang-select');
  
  // Attachments
  const btnVoiceStub = document.getElementById('btn-voice-stub');
  const btnOcrUpload = document.getElementById('btn-ocr-upload');
  const ocrFileInput = document.getElementById('ocr-file-input');

  // Network adaptive views
  const netBtns = document.querySelectorAll('.net-btn');
  const netSpeedIndicator = document.getElementById('net-speed-indicator');
  const mediaRichLayout = document.getElementById('media-rich-layout');
  const mediaAudioLayout = document.getElementById('media-audio-layout');

  // Offline syncing
  const toggleNetworkBtn = document.getElementById('toggle-network-status');
  const triggerSyncBtn = document.getElementById('trigger-sync-btn');
  const journalCountEl = document.getElementById('journal-count');
  const journalListEl = document.getElementById('journal-list');

  // Streak details
  const simulateStreakBreakBtn = document.getElementById('simulate-streak-break');
  const streakRepairToast = document.getElementById('streak-repair-toast');
  const repairStreakBtn = document.getElementById('repair-streak-btn');
  const streakNumEl = document.getElementById('streak-num');

  // Teacher Hub
  const lessonTopicInput = document.getElementById('lesson-topic');
  const lessonGradeSelect = document.getElementById('lesson-grade');
  const btnGenerateLesson = document.getElementById('btn-generate-lesson');
  const lessonResponseBox = document.getElementById('lesson-response-box');
  const lessonResponseContent = document.getElementById('lesson-response-content');
  const lessonTelemetry = document.getElementById('lesson-telemetry');

  // Company Portal
  const kybGstinInput = document.getElementById('kyb-gstin');
  const kybDomainInput = document.getElementById('kyb-domain');
  const kybEmailInput = document.getElementById('kyb-email');
  const btnKybRegister = document.getElementById('btn-kyb-register');
  const kybStatusBanner = document.getElementById('kyb-status-banner');
  const jobTitleInput = document.getElementById('job-title');
  const jobDescriptionText = document.getElementById('job-description');
  const btnAuditJob = document.getElementById('btn-audit-job');
  const jobAuditResponse = document.getElementById('job-audit-response');
  const auditTitle = document.getElementById('audit-title');
  const auditFeedback = document.getElementById('audit-feedback');
  const auditFlags = document.getElementById('audit-flags');

  // NGO Hub
  const btnNgoCushionPriya = document.getElementById('btn-ngo-cushion-priya');
  const btnNgoCushionAmit = document.getElementById('btn-ngo-cushion-amit');

  // Gateway Security & Sanitizer Panels
  const statRedactedEl = document.getElementById('stat-redacted');
  const statEmailsEl = document.getElementById('stat-emails');
  const sanitizerLogsEl = document.getElementById('sanitizer-logs');

  // Telemetry Health Controls
  const btnViewHealth = document.getElementById('btn-view-health');
  const healthModal = document.getElementById('health-modal');
  const closeHealthModal = document.getElementById('close-health-modal');
  const healthDot = document.getElementById('health-dot');
  const healthText = document.getElementById('health-text');
  const telemetryLatency = document.getElementById('telemetry-latency');
  const telemetryDb = document.getElementById('telemetry-db');
  
  const modalStatusText = document.getElementById('modal-status-text');
  const modalMemory = document.getElementById('modal-memory');
  const modalLatency = document.getElementById('modal-latency');
  
  const btnCrashDb = document.getElementById('btn-crash-db');
  const btnSpikeMemory = document.getElementById('btn-spike-memory');
  const btnRestoreSystem = document.getElementById('btn-restore-system');

  // Config Constants
  const API_BASE = ''; // Relative path requests served by server.js

  // Application States
  let activePortal = 'student';
  let currentModel = 'standard_dialogue';
  let isOffline = false;
  let clientJournal = [];
  let databaseStreak = 7;
  let activeNetworkProfile = 'WiFi';
  let isSystemHealthy = true;
  let isRecording = false;
  let sanitizedCount = 0;
  let emailBlockCount = 0;
  let chatHistory = [];

  // Initialize preferred language from localStorage
  const savedLang = localStorage.getItem('gramgyan_lang');
  if (savedLang) {
    chatLangSelect.value = savedLang;
  }

  chatLangSelect.addEventListener('change', () => {
    localStorage.setItem('gramgyan_lang', chatLangSelect.value);
    addSanitizerLog(`Language preference changed to: ${chatLangSelect.value.toUpperCase()}`, 'system');
  });

  // 1. Portal Navigation Switcher
  portalNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      portalNavBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const portal = btn.getAttribute('data-portal');
      activePortal = portal;

      portalViews.forEach(view => {
        if (view.id === `${portal}-portal-view`) {
          view.classList.remove('hidden');
        } else {
          view.classList.add('hidden');
        }
      });

      addSanitizerLog(`Swapped active screen view to: ${portal.toUpperCase()}`, 'system');
    });
  });

  // 2. Active Model Ribbon Selection
  modelSelectors.forEach(selector => {
    selector.addEventListener('click', () => {
      modelSelectors.forEach(s => s.classList.remove('active'));
      selector.classList.add('active');
      currentModel = selector.getAttribute('data-model');
    });
  });

  // 3. Network adaptive profiler connection
  netBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      netBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const speed = btn.getAttribute('data-net');
      activeNetworkProfile = speed;
      fetchNetworkAdaptation(speed);
    });
  });

  async function fetchNetworkAdaptation(profile) {
    addSanitizerLog(`Network Profile swapped to: ${profile} (Appended X-Network-Profile)`, 'system');
    
    try {
      const res = await fetch(`${API_BASE}/api/ai/network-config`, {
        headers: { 'X-Network-Profile': profile }
      });
      const envelope = await res.json();
      
      if (envelope.success) {
        const config = envelope.data;
        if (config.audioOnly) {
          netSpeedIndicator.textContent = `2G mode enforced: Serving compressed audio format capped at ${config.audioBitrate_kbps}kbps.`;
          mediaRichLayout.classList.add('hidden');
          mediaAudioLayout.classList.remove('hidden');
        } else {
          netSpeedIndicator.textContent = `Optimal speed detected. Resolving rich formats via ${profile} (${config.resolution} Video).`;
          mediaRichLayout.classList.remove('hidden');
          mediaAudioLayout.classList.add('hidden');
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 4. Anti-Phishing Chat Sanitizer Rules
  function sanitizeInputText(text) {
    let sanitizedText = text;
    let detections = 0;

    const phoneRegex = /(\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/g;
    if (phoneRegex.test(sanitizedText)) {
      sanitizedText = sanitizedText.replace(phoneRegex, '[⚠️ CONTACT NUMBER REDACTED — share details only through GramGyan]');
      detections++;
      emailBlockCount++;
      addSanitizerLog('Intercepted and masked a phone number pattern.', 'redacted');
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    if (emailRegex.test(sanitizedText)) {
      sanitizedText = sanitizedText.replace(emailRegex, '[⚠️ EMAIL ADDRESS REDACTED — use official platform inbox]');
      detections++;
      emailBlockCount++;
      addSanitizerLog('Intercepted and masked a personal email pattern.', 'redacted');
    }

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    if (urlRegex.test(sanitizedText)) {
      sanitizedText = sanitizedText.replace(urlRegex, '[🚫 SECURE TRANSACTION GATEWAY DETECTED]');
      detections++;
      sanitizedCount++;
      addSanitizerLog('Blocked external transactional link. Directing payload to security sandbox.', 'redacted');
    }

    statRedactedEl.textContent = sanitizedCount;
    statEmailsEl.textContent = emailBlockCount;

    return { sanitizedText, detections };
  }

  function addSanitizerLog(message, type) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    sanitizerLogsEl.appendChild(entry);
    sanitizerLogsEl.scrollTop = sanitizerLogsEl.scrollHeight;
  }

  // Send Chat Message Action
  chatSendBtn.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Short cut buttons for templates
  shortcutTags.forEach(tag => {
    tag.addEventListener('click', () => {
      const type = tag.getAttribute('data-trigger');
      if (type === 'conversation') {
        currentModel = 'standard_dialogue';
        chatInput.value = 'Explain soil rotation';
      } else if (type === 'project') {
        currentModel = 'project_guidance';
        chatInput.value = 'Create organic garden plan';
      } else if (type === 'math') {
        currentModel = 'stem_reasoning';
        chatInput.value = 'Solve `x^2 - 5x + 6 = 0`';
      }
      modelSelectors.forEach(s => s.classList.remove('active'));
      const activeTab = document.querySelector(`.model-selector[data-model="${currentModel}"]`);
      if (activeTab) activeTab.classList.add('active');
    });
  });

  async function handleSendMessage() {
    const query = chatInput.value.trim();
    if (!query) return;

    if (!isSystemHealthy) {
      addSystemMessage('CRITICAL: 503 Server Unavailable. System Health Diagnostics failing.');
      return;
    }

    chatInput.value = '';

    const { sanitizedText, detections } = sanitizeInputText(query);

    if (isOffline) {
      const opId = Math.random().toString(36).substring(7);
      const offlineOp = {
        id: opId,
        type: 'CREATE',
        table: 'competency_ledger',
        payload: { query: sanitizedText, model: currentModel },
        timestamp: Date.now()
      };
      clientJournal.push(offlineOp);
      updateJournalDisplay();
      
      addUserBubble(sanitizedText);
      addSystemMessage('⚠️ Offline Mode: Operation saved into local Sync Journal delta queue.');
      return;
    }

    addUserBubble(sanitizedText);

    // Auto-detect STEM mode
    let targetModel = currentModel;
    const stemKeywords = ["solve", "prove", "integrate", "algorithm", "write code", "equation", "velocity", "slope"];
    const isCode = sanitizedText.includes('```') || sanitizedText.includes('`');
    const hasStemKeyword = stemKeywords.some(keyword => sanitizedText.toLowerCase().includes(keyword));
    if (isCode || hasStemKeyword) {
      targetModel = 'stem_reasoning';
      modelSelectors.forEach(s => s.classList.remove('active'));
      const activeTab = document.querySelector('.model-selector[data-model="stem_reasoning"]');
      if (activeTab) activeTab.classList.add('active');
      addSanitizerLog('STEM pattern auto-detected. Re-routed query to STEM Reasoning model.', 'system');
    }

    chatHistory.push({ role: 'user', content: sanitizedText });
    await fetchModelResponse(sanitizedText, targetModel);
  }

  function addUserBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.innerHTML = `
      <span class="sender-label">You</span>
      <div class="content"><p>${text}</p></div>
    `;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addSystemMessage(text) {
    const announcement = document.createElement('div');
    announcement.className = 'system-announcement';
    announcement.textContent = text;
    chatMessages.appendChild(announcement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 5. Connect to real Nebius Completion proxy
  async function fetchModelResponse(query, modelMode) {
    const responseBubble = document.createElement('div');
    responseBubble.className = `chat-bubble bot ${modelMode}`;
    
    let senderName = 'Nebius Routing Engine';
    if (modelMode === 'standard_dialogue') senderName = 'AI Mentor Dialogue';
    else if (modelMode === 'project_guidance') senderName = 'Project Guidance Agent';
    else if (modelMode === 'stem_reasoning') senderName = 'Qwen STEM Reasoner';
    else if (modelMode === 'vision_ocr') senderName = 'Qwen Vision OCR';

    responseBubble.innerHTML = `
      <span class="sender-label">${senderName}</span>
      <div class="content" id="streaming-content-target">
        <span class="loading-dots">Thinking...</span>
      </div>
    `;
    
    chatMessages.appendChild(responseBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const contentTarget = responseBubble.querySelector('#streaming-content-target');

    try {
      const res = await fetch(`${API_BASE}/api/ai/query`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Network-Profile': activeNetworkProfile
        },
        body: JSON.stringify({
          mode: modelMode,
          messages: chatHistory,
          language: chatLangSelect.value
        })
      });

      const envelope = await res.json();
      contentTarget.innerHTML = '';

      if (envelope.success) {
        const payload = envelope.data;
        chatHistory.push({ role: 'assistant', content: payload.content });

        // Show chain_of_thought if available (STEM reasoning mode)
        if (payload.chain_of_thought) {
          const accordion = document.createElement('div');
          accordion.className = 'thinking-accordion';
          accordion.innerHTML = `
            <div class="thinking-header">
              <span>🧠 View Mentor's Thinking Process (${payload.latency_ms}ms)</span>
              <span>▼</span>
            </div>
            <div class="thinking-body">${payload.chain_of_thought}</div>
          `;
          contentTarget.appendChild(accordion);
          accordion.querySelector('.thinking-header').addEventListener('click', () => {
            accordion.querySelector('.thinking-body').classList.toggle('hidden');
          });
        }

        // Stream answer characters simulating Tok/s rates
        const p = document.createElement('p');
        contentTarget.appendChild(p);
        
        let charIdx = 0;
        const text = payload.content;
        const streamSpeed = modelMode === 'standard_dialogue' ? 10 : 25;

        function stream() {
          if (charIdx < text.length) {
            p.textContent += text.charAt(charIdx);
            charIdx++;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            setTimeout(stream, streamSpeed);
          } else {
            addSanitizerLog(`Model complete. Tokens used: ${payload.tokens_used.total} | Latency: ${payload.latency_ms}ms`, 'clean');
          }
        }
        stream();
      } else {
        contentTarget.innerHTML = `<p class="text-danger">Error: ${envelope.message || 'Failed to process query'}</p>`;
      }
    } catch (err) {
      contentTarget.innerHTML = `<p class="text-danger">Failed to connect to backend proxy.</p>`;
    }
  }

  // 6. Image/OCR Attachment handling
  btnOcrUpload.addEventListener('click', () => {
    ocrFileInput.click();
  });

  ocrFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    addUserBubble(`[Attached Homework Image: ${file.name}]`);

    modelSelectors.forEach(s => s.classList.remove('active'));
    const visionTab = document.querySelector('.model-selector[data-model="vision_ocr"]');
    if (visionTab) visionTab.classList.add('active');
    currentModel = 'vision_ocr';

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target.result.split(',')[1];
      chatHistory.push({
        role: 'user',
        content: `Read this homework image and solve the transcription.`
      });
      
      await fetchOCRResponse(base64String);
    };
    reader.readAsDataURL(file);
  });

  async function fetchOCRResponse(base64Image) {
    const responseBubble = document.createElement('div');
    responseBubble.className = 'chat-bubble bot vision_ocr';
    responseBubble.innerHTML = `
      <span class="sender-label">Qwen Vision OCR</span>
      <div class="content" id="ocr-target">
        <p>Scanning document structures and handwritten matrices...</p>
        <div class="skeleton-box"></div>
      </div>
    `;
    chatMessages.appendChild(responseBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const res = await fetch(`${API_BASE}/api/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vision_ocr',
          messages: chatHistory,
          image_base64: base64Image
        })
      });

      const envelope = await res.json();
      const target = responseBubble.querySelector('#ocr-target');
      target.innerHTML = '';

      if (envelope.success) {
        target.innerHTML = `<p><strong>✅ OCR Document Extraction complete:</strong></p><p>${envelope.data.content}</p>`;
      } else {
        target.innerHTML = `<p class="text-danger">OCR processing failed.</p>`;
      }
    } catch (e) {
      responseBubble.querySelector('#ocr-target').innerHTML = '<p class="text-danger">Failed to connect to backend.</p>';
    }
  }

  // 7. Voice Stub Recording Simulation
  btnVoiceStub.addEventListener('click', () => {
    if (!isRecording) {
      isRecording = true;
      btnVoiceStub.textContent = '🔴 Recording...';
      btnVoiceStub.style.borderColor = 'var(--color-danger)';
      addSanitizerLog('Started 12-language voice stub input streaming buffer.', 'system');
    } else {
      isRecording = false;
      btnVoiceStub.textContent = '🎤 Voice Input';
      btnVoiceStub.style.borderColor = 'var(--border-color)';
      addSanitizerLog('Saved voice stub. Tracing speech delta arrays.', 'clean');
      
      addUserBubble(`🎤 Audio Input (Resolved preference: ${chatLangSelect.value.toUpperCase()})`);
      chatHistory.push({ role: 'user', content: 'Explain traditional water harvesting structures' });
      fetchModelResponse('Explain traditional water harvesting structures', 'standard_dialogue');
    }
  });

  // 8. Offline Sync Engine
  toggleNetworkBtn.addEventListener('click', () => {
    isOffline = !isOffline;
    if (isOffline) {
      toggleNetworkBtn.textContent = 'Reconnect Network Link';
      toggleNetworkBtn.classList.remove('btn-danger');
      toggleNetworkBtn.classList.add('btn-success');
      addSanitizerLog('Simulated network link drop. Sync Journal active.', 'redacted');
      addSystemMessage('⚠️ Connection severed. Operations will queue inside the Offline Journal.');
    } else {
      toggleNetworkBtn.textContent = 'Simulate Network Outage';
      toggleNetworkBtn.classList.remove('btn-success');
      toggleNetworkBtn.classList.add('btn-danger');
      addSanitizerLog('Link established. Ready for Sync Delta merge.', 'clean');
      addSystemMessage('📶 Connection restored. Click "Sync Delta" to merge client queues.');
    }
  });

  triggerSyncBtn.addEventListener('click', async () => {
    if (isOffline) {
      alert('Cannot sync while connection is severed. Please go online first.');
      return;
    }
    if (clientJournal.length === 0) {
      alert('No mutations inside client sync queue.');
      return;
    }

    addSanitizerLog(`Flushing ${clientJournal.length} operations via POST /api/sync/delta...`, 'system');

    try {
      const res = await fetch(`${API_BASE}/api/sync/delta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: clientJournal })
      });
      const envelope = await res.json();
      if (envelope.success) {
        addSanitizerLog('Server resolve: Last-Write-Wins (LWW) conflict strategy resolved cleanly.', 'clean');
        alert(`Synchronized successfully! Merged ${clientJournal.length} client mutations into global ledger.`);
        clientJournal = [];
        updateJournalDisplay();
      }
    } catch (e) {
      alert('Sync failed.');
    }
  });

  function updateJournalDisplay() {
    journalCountEl.textContent = clientJournal.length;
    if (clientJournal.length === 0) {
      journalListEl.innerHTML = '<div class="empty-list-placeholder">Offline journal is empty. Set network to offline to queue actions.</div>';
      return;
    }

    journalListEl.innerHTML = '';
    clientJournal.forEach(op => {
      const item = document.createElement('div');
      item.className = 'journal-entry';
      item.innerHTML = `
        <span><strong class="op-type">${op.type}</strong>: ${op.table}</span>
        <span class="op-time">clock #${op.id}</span>
      `;
      journalListEl.appendChild(item);
    });
  }

  // 9. Streak details & cushions (Simulate Breaks / Repair)
  simulateStreakBreakBtn.addEventListener('click', () => {
    streakRepairToast.classList.remove('hidden');
    addSanitizerLog('Triggered telemetry check: study streak inactivity grace-period alert.', 'system');
  });

  repairStreakBtn.addEventListener('click', () => {
    streakRepairToast.classList.add('hidden');
    databaseStreak = 7;
    streakNumEl.textContent = `${databaseStreak} Days`;
    addSanitizerLog('Grace cushion used. Restored user streak analytics state.', 'clean');
    alert('Streak repaired successfully using Grace Cushion!');
  });

  // 10. Teacher Portal AI Lesson Generator
  btnGenerateLesson.addEventListener('click', async () => {
    const topic = lessonTopicInput.value.trim();
    if (!topic) return;

    btnGenerateLesson.textContent = 'Generating Lesson Plan...';
    lessonResponseBox.classList.remove('hidden');
    lessonResponseContent.textContent = 'Calling Nebius API. Formatting structure...';
    lessonTelemetry.textContent = 'Loading...';

    try {
      const res = await fetch(`${API_BASE}/api/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'project_guidance',
          messages: [
            {
              role: 'user',
              content: `Generate a brief course lesson plan for Class ${lessonGradeSelect.value} students on this topic: ${topic}. Structure it with key concepts, localized rural examples, and 3 review questions.`
            }
          ]
        })
      });

      const envelope = await res.json();
      btnGenerateLesson.textContent = 'Generate Lesson Plan Structure';

      if (envelope.success) {
        lessonResponseContent.textContent = envelope.data.content;
        lessonTelemetry.textContent = `${envelope.data.latency_ms}ms | ${envelope.data.tokens_used.total} tokens`;
        addSanitizerLog(`Teacher Hub: Created lesson plan structure on topic "${topic}"`, 'clean');
      } else {
        lessonResponseContent.textContent = 'Failed to generate structure: ' + envelope.message;
      }
    } catch (e) {
      btnGenerateLesson.textContent = 'Generate Lesson Plan Structure';
      lessonResponseContent.textContent = 'Error contacting server.';
    }
  });

  // 11. Company Portal Onboarding & Scam audit
  btnKybRegister.addEventListener('click', async () => {
    const gstin = kybGstinInput.value.trim();
    const domain = kybDomainInput.value.trim();
    const email = kybEmailInput.value.trim();

    try {
      const res = await fetch(`${API_BASE}/api/kyb/register`, {
        method: 'POST',
        headers: {
          'X-Corporate-GSTIN': gstin,
          'X-Corporate-Domain': domain,
          'X-Corporate-Email': email
        }
      });

      if (res.status === 403) {
        const envelope = await res.json();
        kybStatusBanner.className = 'kyb-status-banner warning';
        kybStatusBanner.innerHTML = `<span>🔒 Access Denied: <ul>${envelope.details.map(d => `<li>${d}</li>`).join('')}</ul></span>`;
        addSanitizerLog('Company KYB Verification failed.', 'redacted');
      } else {
        const envelope = await res.json();
        kybStatusBanner.className = 'kyb-status-banner success';
        kybStatusBanner.innerHTML = `<span>✅ Verification Approved: Business GSTIN verified. Corporate roster portal unlocked.</span>`;
        addSanitizerLog('Company KYB Registration approved.', 'clean');
      }
    } catch (e) {
      alert('Verification failed.');
    }
  });

  btnAuditJob.addEventListener('click', async () => {
    const description = jobDescriptionText.value.trim();
    if (!description) return;

    btnAuditJob.textContent = 'Screening vacancy description...';
    jobAuditResponse.classList.add('hidden');
    auditFlags.innerHTML = '';

    try {
      const res = await fetch(`${API_BASE}/api/ai/scan-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: description })
      });
      const envelope = await res.json();

      if (envelope.success) {
        const logId = envelope.data.log_id;
        pollAuditResult(logId);
      }
    } catch (e) {
      btnAuditJob.textContent = 'Assess Job For Scam Risk';
      alert('Failed to connect to auditing daemon.');
    }
  });

  async function pollAuditResult(logId) {
    try {
      const res = await fetch(`${API_BASE}/api/ai/scan-result/${logId}`);
      const envelope = await res.json();

      if (envelope.success && envelope.data.status === 'done') {
        btnAuditJob.textContent = 'Assess Job For Scam Risk';
        jobAuditResponse.classList.remove('hidden');

        const data = envelope.data;
        if (data.is_scam) {
          jobAuditResponse.style.borderColor = '#ffccd5';
          jobAuditResponse.style.backgroundColor = '#fff0f3';
          auditTitle.textContent = `❌ WARNING: SCAM DETECTED (${Math.round(data.confidence_score * 100)}%)`;
          auditTitle.style.color = '#ff4757';
          auditFeedback.textContent = 'This vacancy posting has been blocked. The description contains high scam indicators like security fees or unrealistic payouts.';
          auditFeedback.style.color = '#c92a3a';

          data.flags.forEach(flag => {
            const chip = document.createElement('span');
            chip.className = 'audit-chip';
            chip.textContent = flag;
            auditFlags.appendChild(chip);
          });
        } else {
          jobAuditResponse.style.borderColor = '#c6f6d5';
          jobAuditResponse.style.backgroundColor = '#f0fff4';
          auditTitle.textContent = `✅ POSTING APPROVED`;
          auditTitle.style.color = '#38a169';
          auditFeedback.textContent = 'This posting meets safety guidelines. Proceeding to student roster board.';
          auditFeedback.style.color = '#276749';

          const chip = document.createElement('span');
          chip.className = 'audit-chip safe';
          chip.textContent = 'SAFE_VACANCY';
          auditFlags.appendChild(chip);
        }
      } else {
        setTimeout(() => pollAuditResult(logId), 3000);
      }
    } catch (e) {
      btnAuditJob.textContent = 'Assess Job For Scam Risk';
    }
  }

  // 12. NGO Portal Cusion Allocators
  btnNgoCushionPriya.addEventListener('click', () => {
    alert('Streak cushion token assigned to Priya Patel successfully!');
    addSanitizerLog('NGO Operations: Distributed study grace cushion to Priya Patel.', 'clean');
    btnNgoCushionPriya.disabled = true;
    btnNgoCushionPriya.textContent = 'Assigned';
  });

  btnNgoCushionAmit.addEventListener('click', () => {
    alert('Streak cushion token assigned to Amit Meena successfully!');
    addSanitizerLog('NGO Operations: Distributed study grace cushion to Amit Meena.', 'clean');
    btnNgoCushionAmit.disabled = true;
    btnNgoCushionAmit.textContent = 'Assigned';
  });

  // 13. SRE Telemetry Pollers
  async function pollServerHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.status === 503) {
        setSystemUnhealthy();
        return;
      }
      const data = await res.json();
      if (data.status === 'healthy') {
        isSystemHealthy = true;
        healthDot.className = 'status-dot green';
        healthText.textContent = '200 OK';
        healthText.className = 'value text-success';

        const db = data.services.database;
        telemetryDb.textContent = `${db.pool_idle}/${db.pool_total}`;
        telemetryDb.className = 'value text-success';

        telemetryLatency.textContent = `${db.latency_ms}ms`;
        telemetryLatency.className = 'value';
      }
    } catch (e) {
      setSystemUnhealthy();
    }
  }

  function setSystemUnhealthy() {
    isSystemHealthy = false;
    healthDot.className = 'status-dot red';
    healthText.textContent = '503 Service Unavailable';
    healthText.className = 'value text-danger';
    telemetryDb.textContent = '0/10';
    telemetryDb.className = 'value text-danger';
    telemetryLatency.textContent = '---';
    telemetryLatency.className = 'value text-danger';
  }

  // Poll health every 10 seconds
  setInterval(pollServerHealth, 10000);
  pollServerHealth(); // Initial run

  btnViewHealth.addEventListener('click', () => {
    updateModalTelemetry();
    healthModal.classList.remove('hidden');
  });

  closeHealthModal.addEventListener('click', () => {
    healthModal.classList.add('hidden');
  });

  async function updateModalTelemetry() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      
      if (data.status === 'healthy') {
        modalStatusText.textContent = '200 OK';
        modalStatusText.className = 'value text-success';
        const db = data.services.database;
        modalMemory.textContent = `34.2% (${data.services.memory.used_mb}MB / 512MB)`;
        modalLatency.textContent = `${db.latency_ms}ms`;
      } else {
        modalStatusText.textContent = '503 Service Unavailable';
        modalStatusText.className = 'value text-danger';
        modalMemory.textContent = `97.6% (501.2MB / 512MB)`;
        modalLatency.textContent = '---';
      }
    } catch (e) {
      modalStatusText.textContent = '503 Service Unavailable';
      modalStatusText.className = 'value text-danger';
      modalMemory.textContent = `---`;
      modalLatency.textContent = '---';
    }
  }

  // Telemetry Controls posting to backend
  btnCrashDb.addEventListener('click', async () => {
    await fetch(`${API_BASE}/api/health/crash-db`, { method: 'POST' });
    pollServerHealth();
    addSanitizerLog('SRE Alert: CRITICAL DB POOL CRASH simulated. GET /api/health returns 503.', 'redacted');
  });

  btnSpikeMemory.addEventListener('click', async () => {
    await fetch(`${API_BASE}/api/health/spike-memory`, { method: 'POST' });
    pollServerHealth();
    addSanitizerLog('SRE Alert: Memory spike above 95% threshold. Heavy event loops registered.', 'redacted');
  });

  btnRestoreSystem.addEventListener('click', async () => {
    await fetch(`${API_BASE}/api/health/restore`, { method: 'POST' });
    pollServerHealth();
    addSanitizerLog('SRE Status: Global system restored. Infrastructure state: Healthy.', 'clean');
  });
});
