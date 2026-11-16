/**
 * Pulse AI Client Engine - FocusPulse
 * University Project - Team 7
 * Optional academic assistant powered through the server API.
 * 3 AI Modes, 3D Flip Flashcards, Practice Quiz Runner, and Focus Reactor Integration
 */

(function () {
  'use strict';

  // State Management
  const state = {
    mode: 'tutor', // 'lecture' | 'tutor' | 'combined'
    activeChatId: null,
    activeDocId: null,
    activeCourseId: 'all',
    chats: [],
    documents: [],
    flashcards: [],
    currentCardIndex: 0,
    quizQuestions: [],
    currentQuizIndex: 0,
    quizScore: 0,
    isGenerating: false
  };

  // -------------------------------------------------------------
  // INITIALIZATION & STORAGE
  // -------------------------------------------------------------
  function init() {
    loadDocuments();
    loadChats();
    loadFlashcards();
    loadQuiz();
    populateCourseFilter();
    setupEventListeners();

    // Check if redirected from another page with course query
    const urlParams = new URLSearchParams(window.location.search);
    const courseParam = urlParams.get('course');
    if (courseParam) {
      state.activeCourseId = courseParam;
      const select = document.getElementById('pulseCourseFilter');
      if (select) select.value = courseParam;
    }

    renderDocumentsList();
    renderChatHistory();

    // If no active chat, create default
    if (!state.activeChatId && state.chats.length > 0) {
      selectChat(state.chats[0].id);
    } else if (!state.activeChatId) {
      createNewChat();
    }

    renderFlashcard();
    renderQuiz();
    const summaryDisplay = document.getElementById('pulseSummaryDisplay');
    if (summaryDisplay) summaryDisplay.textContent = 'Select a lecture and choose a study note format when you are ready.';
  }

  function loadDocuments() {
    try {
      const userId = getCurrentUserId();
      const stored = localStorage.getItem(`focuspulse_ai_documents_${userId}`);
      const docs = stored ? JSON.parse(stored) : [];
      state.documents = Array.isArray(docs) ? docs.filter(doc => doc.serverDocumentId || /\.(txt|md|json|csv)$/i.test(doc.fileName || '')).map(doc => ({ ...doc, id: doc.serverDocumentId || doc.id, serverDocumentId: doc.serverDocumentId || null })) : [];
      saveDocuments();
      state.activeDocId = state.documents[0]?.id || null;
    } catch (e) {
      state.documents = [];
      state.activeDocId = null;
    }
  }

  function saveDocuments() {
    try {
      localStorage.setItem(`focuspulse_ai_documents_${getCurrentUserId()}`, JSON.stringify(state.documents));
    } catch (e) {}
  }

  function getCurrentUserId() {
    return typeof Storage !== 'undefined' ? (Storage.getCurrentUser()?.id || 'anonymous') : 'anonymous';
  }

  function loadChats() {
    try {
      const stored = localStorage.getItem(`focuspulse_ai_chats_${getCurrentUserId()}`);
      const legacyStored = localStorage.getItem('focuspulse_ai_chats');
      state.chats = stored ? JSON.parse(stored) : (legacyStored ? JSON.parse(legacyStored) : []);
      state.chats = state.chats.filter(chat => !chat.userId || chat.userId === getCurrentUserId());
      state.chats.forEach(chat => { chat.messages = (chat.messages || []).filter(message => message.role !== 'ai'); });
      state.chats.forEach(chat => { chat.userId = getCurrentUserId(); });
      if (state.chats.length === 0) {
        createNewChat();
      } else {
        saveChats();
      }
    } catch (e) {
      state.chats = [];
      createNewChat();
    }
  }

  function saveChats() {
    try {
      localStorage.setItem(`focuspulse_ai_chats_${getCurrentUserId()}`, JSON.stringify(state.chats));
    } catch (e) {}
  }

  function loadFlashcards() {
    try {
      const stored = localStorage.getItem(`focuspulse_ai_flashcards_${getCurrentUserId()}`);
      state.flashcards = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(state.flashcards)) state.flashcards = [];
    } catch (e) {
      state.flashcards = [];
    }
  }

  function saveFlashcards() {
    try {
      localStorage.setItem(`focuspulse_ai_flashcards_${getCurrentUserId()}`, JSON.stringify(state.flashcards));
    } catch (e) {}
  }

  function saveQuiz() {
    try { localStorage.setItem(`focuspulse_ai_quiz_${getCurrentUserId()}`, JSON.stringify(state.quizQuestions)); } catch (e) {}
  }

  async function generateStudyTool(type) {
    const activeDoc = state.documents.find(doc => doc.id === state.activeDocId);
    const status = document.getElementById(type === 'quiz' ? 'pulseQuizQuestion' : 'pulseCardFrontText');
    if (!activeDoc) {
      if (status) status.textContent = 'Add and select a readable lecture first.';
      return;
    }
    if (status) status.textContent = 'Creating study material…';
    try {
      const response = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, documentId: activeDoc.serverDocumentId || activeDoc.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
      if (type === 'quiz') {
        if (!Array.isArray(result.quiz) || result.quiz.some(q => !q.question || !Array.isArray(q.options) || !Number.isInteger(q.correctIndex))) throw new Error('The service returned an invalid quiz. Try again.');
        state.quizQuestions = result.quiz;
        state.currentQuizIndex = 0;
        state.quizScore = 0;
        saveQuiz();
        renderQuiz();
      } else {
        if (!Array.isArray(result.flashcards) || result.flashcards.some(card => !card.question || !card.answer)) throw new Error('The service returned invalid flashcards. Try again.');
        state.flashcards = result.flashcards.map(card => ({ ...card, mastered: false }));
        state.currentCardIndex = 0;
        saveFlashcards();
        renderFlashcard();
      }
    } catch (error) {
      if (status) status.textContent = `Study material generation is unavailable: ${error.message}`;
    }
  }

  function loadQuiz() {
    try {
      const stored = localStorage.getItem(`focuspulse_ai_quiz_${getCurrentUserId()}`);
      state.quizQuestions = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(state.quizQuestions)) state.quizQuestions = [];
    } catch (e) {
      state.quizQuestions = [];
    }
  }

  // Populate course dropdown from Storage
  function populateCourseFilter() {
    const select = document.getElementById('pulseCourseFilter');
    if (!select) return;

    select.innerHTML = '<option value="all">All Courses</option>';
    if (window.FocusPulseStorage && typeof window.FocusPulseStorage.getCourses === 'function') {
      const courses = window.FocusPulseStorage.getCourses().filter(c => !c.archived);
      courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.icon || '📚'} ${c.code || c.name}`;
        select.appendChild(opt);
      });
    }
  }

  // -------------------------------------------------------------
  // CHAT MANAGEMENT
  // -------------------------------------------------------------
  function createNewChat() {
    const newChat = {
      id: 'chat_' + Date.now(),
      userId: getCurrentUserId(),
      title: 'New Study Session',
      courseId: state.activeCourseId !== 'all' ? state.activeCourseId : 'c1',
      docId: state.activeDocId,
      createdAt: new Date().toISOString(),
      messages: []
    };
    state.chats.unshift(newChat);
    state.activeChatId = newChat.id;
    saveChats();
    renderChatHistory();
    renderActiveChatMessages();
  }

  function selectChat(chatId) {
    state.activeChatId = chatId;
    const chat = state.chats.find(c => c.id === chatId);
    if (chat && chat.docId) {
      state.activeDocId = chat.docId;
    }
    renderChatHistory();
    renderActiveChatMessages();
    updateActiveDocDisplay();
  }

  function deleteChat(chatId, e) {
    if (e) e.stopPropagation();
    state.chats = state.chats.filter(c => c.id !== chatId);
    if (state.activeChatId === chatId) {
      state.activeChatId = state.chats[0]?.id || null;
      if (!state.activeChatId) createNewChat();
    }
    saveChats();
    renderChatHistory();
    renderActiveChatMessages();
  }

  function renderChatHistory() {
    const list = document.getElementById('pulseChatHistoryList');
    if (!list) return;

    list.innerHTML = '';
    state.chats.forEach(chat => {
      const item = document.createElement('div');
      item.className = `pulse-chat-item ${chat.id === state.activeChatId ? 'active' : ''}`;
      item.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="pulse-chat-item-title">${escapeHtml(chat.title)}</span>
        <button class="pulse-chat-item-delete" title="Delete conversation" data-id="${chat.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;
      item.addEventListener('click', () => selectChat(chat.id));
      const delBtn = item.querySelector('.pulse-chat-item-delete');
      delBtn.addEventListener('click', (ev) => deleteChat(chat.id, ev));
      list.appendChild(item);
    });
  }

  function renderActiveChatMessages() {
    const wrap = document.getElementById('pulseMessagesWrap');
    if (!wrap) return;

    wrap.innerHTML = '';
    const currentChat = state.chats.find(c => c.id === state.activeChatId);
    if (!currentChat) return;

    currentChat.messages.forEach(msg => {
      appendMessageToUI(msg.role, msg.text, msg.isStreaming);
    });

    wrap.scrollTop = wrap.scrollHeight;
  }

  function appendMessageToUI(role, text, isStreaming = false) {
    const wrap = document.getElementById('pulseMessagesWrap');
    if (!wrap) return null;

    const row = document.createElement('div');
    row.className = `pulse-msg-row ${role}`;
    const avatar = role === 'user' ? 'U' : '✨';

    row.innerHTML = `
      <div class="pulse-msg-avatar">${avatar}</div>
      <div class="pulse-msg-bubble">
        <div class="pulse-msg-content">${formatMarkdown(text)}</div>
        ${isStreaming ? '<span class="pulse-typing-cursor"></span>' : ''}
      </div>
    `;

    wrap.appendChild(row);
    wrap.scrollTop = wrap.scrollHeight;
    return row;
  }

  // -------------------------------------------------------------
  // SEND MESSAGE & STREAMING ENGINE
  // -------------------------------------------------------------
  async function sendMessage() {
    if (state.isGenerating) return;
    const input = document.getElementById('pulseMessageInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    const currentChat = state.chats.find(c => c.id === state.activeChatId);
    if (!currentChat) return;

    // Set title on first message
    if (currentChat.messages.length <= 1) {
      currentChat.title = text.length > 28 ? text.substring(0, 28) + '...' : text;
      renderChatHistory();
    }

    // Add user message
    currentChat.messages.push({
      role: 'user',
      text,
      timestamp: new Date().toISOString()
    });
    appendMessageToUI('user', text);
    saveChats();

    // Prepare AI Placeholder
    state.isGenerating = true;
    const aiBubbleRow = appendMessageToUI('ai', '', true);
    const contentEl = aiBubbleRow.querySelector('.pulse-msg-content');
    const cursorEl = aiBubbleRow.querySelector('.pulse-typing-cursor');

    // Retrieve active document
    const activeDoc = state.documents.find(d => d.id === state.activeDocId);
    const docContext = activeDoc ? activeDoc.text : '';

    // Attempt streaming with Gemini
    let accumulatedText = '';
    try {
      accumulatedText = await callStreamingGemini(text, state.mode, docContext, (delta) => {
        accumulatedText += delta;
        contentEl.innerHTML = formatMarkdown(accumulatedText);
        const wrap = document.getElementById('pulseMessagesWrap');
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
      }, activeDoc?.serverDocumentId || activeDoc?.id);
    } catch (apiError) {
      accumulatedText = `Pulse AI is unavailable right now. ${apiError.message || 'Check the server and AI provider configuration, then try again.'}`;
      contentEl.textContent = accumulatedText;
    }

    // Clean up cursor
    if (cursorEl) cursorEl.remove();
    contentEl.innerHTML = formatMarkdown(accumulatedText);

    if (!accumulatedText.startsWith('Pulse AI is unavailable')) {
      currentChat.messages.push({ role: 'ai', text: accumulatedText, timestamp: new Date().toISOString() });
      saveChats();
    }
    state.isGenerating = false;
  }

  // Stream real responses from the server; provider credentials stay server-side.
  async function callStreamingGemini(userPrompt, mode, docContext, onChunk, documentId) {
    const response = await fetch('/api/ai/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userPrompt, mode, documentId, stream: true })
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(problem.error || `Pulse AI request failed (${response.status}).`);
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '', fullOutput = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() || '';
      for (const event of events) {
        const line = event.split(/\r?\n/).find(item => item.startsWith('data: '));
        if (!line) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') continue;
        const part = JSON.parse(payload);
        if (part.error) throw new Error(part.error);
        if (part.text) { fullOutput += part.text; onChunk(part.text); }
      }
      if (done) break;
    }
    if (!fullOutput) throw new Error('Pulse AI returned an empty response. Please try again.');
    return fullOutput;
  }
  // -------------------------------------------------------------
  // DOCUMENT LIBRARY & OUTLINE
  // -------------------------------------------------------------
  function renderDocumentsList() {
    const list = document.getElementById('pulseDocList');
    if (!list) return;

    list.innerHTML = '';
    state.documents.forEach(doc => {
      const item = document.createElement('div');
      item.className = `pulse-doc-item ${doc.id === state.activeDocId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="pulse-doc-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div>
        <div class="pulse-doc-meta">
          <div class="pulse-doc-name">${escapeHtml(doc.title)}</div>
          <div class="pulse-doc-sub">${doc.slideCount || 6} slides • ${escapeHtml(doc.fileName)}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        state.activeDocId = doc.id;
        renderDocumentsList();
        updateActiveDocDisplay();
        renderSummary('quick');
      });
      list.appendChild(item);
    });

    updateActiveDocDisplay();
  }

  function updateActiveDocDisplay() {
    const activeDoc = state.documents.find(d => d.id === state.activeDocId);
    const badge = document.getElementById('pulseActiveDocBadge');
    if (!badge) return;

    if (activeDoc) {
      badge.classList.add('has-doc');
      badge.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <span>${escapeHtml(activeDoc.title.length > 25 ? activeDoc.title.substring(0, 25) + '...' : activeDoc.title)}</span>
      `;
    } else {
      badge.classList.remove('has-doc');
      badge.innerHTML = `<span>No document attached</span>`;
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('courseId', state.activeCourseId !== 'all' ? state.activeCourseId : 'general');
    try {
      const response = await fetch('/api/ai/upload', { method: 'POST', body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
      const doc = result.document;
      state.documents.unshift({ ...doc, id: doc.id, serverDocumentId: doc.id, userId: getCurrentUserId() });
      state.activeDocId = doc.id;
      saveDocuments();
      renderDocumentsList();
      window.FocusPulseUtils?.showToast?.(`Added “${file.name}” to your lecture library.`, 'success');
    } catch (error) {
      window.FocusPulseUtils?.showToast?.(error.message || 'Could not upload this document.', 'error');
    } finally {
      const input = document.getElementById('pulseFileInput');
      if (input) input.value = '';
    }
  }

  // -------------------------------------------------------------
  // STUDY SUMMARIES GENERATOR
  // -------------------------------------------------------------
  function renderSummary(type = 'quick') {
    const display = document.getElementById('pulseSummaryDisplay');
    if (!display) return;
    const activeDoc = state.documents.find(d => d.id === state.activeDocId);
    if (!activeDoc) {
      display.textContent = 'Add a readable lecture text file to create study materials grounded in your own course content.';
      return;
    }
    display.textContent = 'Preparing study notes from this document…';
    fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'summary', summaryType: type, documentId: activeDoc.serverDocumentId || activeDoc.id }) })
      .then(async response => { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`); return result; })
      .then(result => { display.innerHTML = formatMarkdown(result.content || 'The service returned no summary.'); })
      .catch(error => { display.textContent = `Study material generation is unavailable: ${error.message}`; });
  }

  // -------------------------------------------------------------
  // 3D FLIP FLASHCARDS RUNNER
  // -------------------------------------------------------------
  function renderFlashcard() {
    if (!state.flashcards.length) {
      const front = document.getElementById('pulseCardFrontText');
      if (front) front.textContent = 'Generate flashcards from your selected lecture.';
      const back = document.getElementById('pulseCardBackText');
      if (back) back.textContent = 'Generated answers will appear here.';
      const count = document.getElementById('pulseCardCounter');
      if (count) count.textContent = '0 cards';
      return;
    }
    const card = state.flashcards[state.currentCardIndex];
    if (!card) return;

    const frontText = document.getElementById('pulseCardFrontText');
    const backText = document.getElementById('pulseCardBackText');
    const metaFront = document.getElementById('pulseCardMetaFront');
    const metaBack = document.getElementById('pulseCardMetaBack');
    const cardEl = document.getElementById('pulseFlipCard');
    const countEl = document.getElementById('pulseCardCounter');
    const masteredBtn = document.getElementById('btnMarkMastered');

    if (cardEl) cardEl.classList.remove('is-flipped');
    if (frontText) frontText.textContent = card.question;
    if (backText) backText.textContent = card.answer;
    if (metaFront) metaFront.textContent = `Card ${state.currentCardIndex + 1} of ${state.flashcards.length}`;
    if (metaBack) metaBack.textContent = `Citation: ${card.citation || 'Lecture Slides'}`;
    if (countEl) countEl.textContent = `${state.currentCardIndex + 1} / ${state.flashcards.length}`;

    if (masteredBtn) {
      if (card.mastered) {
        masteredBtn.classList.add('mastered');
        masteredBtn.textContent = '✓ Mastered';
      } else {
        masteredBtn.classList.remove('mastered');
        masteredBtn.textContent = 'Mark Mastered';
      }
    }
  }

  function nextFlashcard() {
    state.currentCardIndex = (state.currentCardIndex + 1) % state.flashcards.length;
    renderFlashcard();
  }

  function prevFlashcard() {
    state.currentCardIndex = (state.currentCardIndex - 1 + state.flashcards.length) % state.flashcards.length;
    renderFlashcard();
  }

  function toggleFlipCard() {
    const cardEl = document.getElementById('pulseFlipCard');
    if (cardEl) {
      cardEl.classList.toggle('is-flipped');
    }
  }

  function toggleMastered() {
    const card = state.flashcards[state.currentCardIndex];
    if (card) {
      card.mastered = !card.mastered;
      saveFlashcards();
      renderFlashcard();
      if (card.mastered && window.FocusPulseUtils && window.FocusPulseUtils.showToast) {
        window.FocusPulseUtils.showToast('Card marked as mastered! 🌟', 'success');
      }
    }
  }

  // -------------------------------------------------------------
  // PRACTICE QUIZ RUNNER
  // -------------------------------------------------------------
  function renderQuiz() {
    if (!state.quizQuestions.length) {
      const question = document.getElementById('pulseQuizQuestion');
      if (question) question.textContent = 'Generate a quiz from your selected lecture to begin.';
      const options = document.getElementById('pulseQuizOptions');
      if (options) options.innerHTML = '';
      const meta = document.getElementById('pulseQuizMeta');
      if (meta) meta.textContent = 'No quiz generated';
      return;
    }
    const q = state.quizQuestions[state.currentQuizIndex];
    if (!q) return;

    const qTitle = document.getElementById('pulseQuizQuestion');
    const optContainer = document.getElementById('pulseQuizOptions');
    const metaEl = document.getElementById('pulseQuizMeta');
    const feedbackEl = document.getElementById('pulseQuizFeedback');

    if (metaEl) metaEl.textContent = `Question ${state.currentQuizIndex + 1} of ${state.quizQuestions.length}`;
    if (qTitle) qTitle.textContent = q.question;
    if (feedbackEl) {
      feedbackEl.style.display = 'none';
      feedbackEl.innerHTML = '';
    }

    if (optContainer) {
      optContainer.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];
      q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'pulse-quiz-option';
        btn.innerHTML = `<strong>${letters[idx]}.</strong> <span>${escapeHtml(opt)}</span>`;
        btn.addEventListener('click', () => handleQuizAnswer(idx, btn));
        optContainer.appendChild(btn);
      });
    }
  }

  function handleQuizAnswer(selectedIndex, selectedBtn) {
    const q = state.quizQuestions[state.currentQuizIndex];
    if (!q) return;

    const optButtons = document.querySelectorAll('.pulse-quiz-option');
    optButtons.forEach(btn => btn.disabled = true);

    const isCorrect = selectedIndex === q.correctIndex;
    if (isCorrect) {
      selectedBtn.classList.add('correct');
      state.quizScore++;
    } else {
      selectedBtn.classList.add('incorrect');
      if (optButtons[q.correctIndex]) {
        optButtons[q.correctIndex].classList.add('correct');
      }
    }

    const feedbackEl = document.getElementById('pulseQuizFeedback');
    if (feedbackEl) {
      feedbackEl.style.display = 'block';
      feedbackEl.innerHTML = `
        <div style="font-weight:700; color:${isCorrect ? 'var(--color-primary)' : 'var(--color-text-secondary)'}; margin-bottom:0.25rem;">
          ${isCorrect ? '✓ Correct!' : '✗ Not quite.'}
        </div>
        <div>${escapeHtml(q.explanation)} <span class="pulse-citation-tag">${escapeHtml(q.citation || 'Slide Reference')}</span></div>
        <div style="margin-top:0.65rem;">
          <button id="btnNextQuiz" class="btn btn-primary btn-sm">
            ${state.currentQuizIndex < state.quizQuestions.length - 1 ? 'Next Question →' : 'Complete Quiz'}
          </button>
        </div>
      `;
      const nextBtn = document.getElementById('btnNextQuiz');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (state.currentQuizIndex < state.quizQuestions.length - 1) {
            state.currentQuizIndex++;
            renderQuiz();
          } else {
            showQuizCompleted();
          }
        });
      }
    }
  }

  function showQuizCompleted() {
    const qTitle = document.getElementById('pulseQuizQuestion');
    const optContainer = document.getElementById('pulseQuizOptions');
    const feedbackEl = document.getElementById('pulseQuizFeedback');

    if (qTitle) qTitle.textContent = `🎉 Quiz Completed! Score: ${state.quizScore} / ${state.quizQuestions.length}`;
    if (optContainer) optContainer.innerHTML = '';
    if (feedbackEl) {
      feedbackEl.style.display = 'block';
      const pct = Math.round((state.quizScore / state.quizQuestions.length) * 100);
      feedbackEl.innerHTML = `
        <div style="font-size:1.1rem; font-weight:700; color:var(--color-primary); margin-bottom:0.5rem;">
          Mastery Level: ${pct}%
        </div>
        <p>Great practice session! You can retake this quiz or start a Focus Reactor session to anchor your knowledge.</p>
        <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
          <button id="btnRetakeQuiz" class="btn btn-outline btn-sm">Retake Quiz</button>
          <button id="btnQuizPomodoro" class="btn btn-primary btn-sm">Launch Focus Reactor</button>
        </div>
      `;
      document.getElementById('btnRetakeQuiz')?.addEventListener('click', () => {
        state.currentQuizIndex = 0;
        state.quizScore = 0;
        renderQuiz();
      });
      document.getElementById('btnQuizPomodoro')?.addEventListener('click', launchPomodoro);
    }
  }

  // -------------------------------------------------------------
  // FOCUS REACTOR INTEGRATION
  // -------------------------------------------------------------
  function launchPomodoro() {
    const activeDoc = state.documents.find(d => d.id === state.activeDocId);
    const courseId = activeDoc?.courseId || (state.activeCourseId !== 'all' ? state.activeCourseId : 'c1');

    try {
      sessionStorage.setItem('focuspulse_launch_pomodoro', JSON.stringify({
        courseId,
        lectureTitle: activeDoc ? activeDoc.title : 'Pulse AI Study Material',
        timestamp: Date.now()
      }));
    } catch (e) {}

    window.location.href = `timer.html?course=${encodeURIComponent(courseId)}&ref=pulse_ai`;
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS & DOM HOOKS
  // -------------------------------------------------------------
  function setupEventListeners() {
    // Mode Pills
    document.querySelectorAll('.pulse-mode-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pulse-mode-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        if (window.FocusPulseUtils && window.FocusPulseUtils.showToast) {
          window.FocusPulseUtils.showToast(`Switched to ${btn.textContent.trim()}`, 'info');
        }
      });
    });

    // New Chat Button
    document.getElementById('btnNewChat')?.addEventListener('click', createNewChat);

    // Course Filter
    document.getElementById('pulseCourseFilter')?.addEventListener('change', (e) => {
      state.activeCourseId = e.target.value;
      renderChatHistory();
    });

    // Left Panel Nav Tabs (Chats vs Documents)
    document.querySelectorAll('.pulse-nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.pulse-nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const view = tab.dataset.view;
        const chatSec = document.getElementById('pulseChatHistorySection');
        const docSec = document.getElementById('pulseDocSection');
        if (view === 'chats') {
          if (chatSec) chatSec.style.display = 'block';
          if (docSec) docSec.style.display = 'none';
        } else {
          if (chatSec) chatSec.style.display = 'none';
          if (docSec) docSec.style.display = 'block';
        }
      });
    });

    // Send Button & Textarea Enter Key
    const sendBtn = document.getElementById('btnSendMessage');
    const input = document.getElementById('pulseMessageInput');

    sendBtn?.addEventListener('click', sendMessage);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-expand Textarea
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });

    // Suggestion Chips
    document.querySelectorAll('.pulse-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (input) {
          input.value = chip.textContent.replace(/^[⚡📋💡🎯]\s*/, '').trim();
          input.focus();
          sendMessage();
        }
      });
    });

    // File Upload Input
    const fileInput = document.getElementById('pulseFileInput');
    document.getElementById('btnUploadDoc')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
      }
    });

    // Launch Reactor Button in Top Bar
    document.getElementById('btnLaunchReactor')?.addEventListener('click', launchPomodoro);

    // Right Intel Panel Tabs (Summary, Flashcards, Quiz)
    document.querySelectorAll('.pulse-intel-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pulse-intel-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const sumView = document.getElementById('pulseSummaryView');
        const fcView = document.getElementById('pulseFlashcardsView');
        const qzView = document.getElementById('pulseQuizView');

        if (sumView) sumView.style.display = tab === 'summary' ? 'flex' : 'none';
        if (fcView) fcView.style.display = tab === 'flashcards' ? 'flex' : 'none';
        if (qzView) qzView.style.display = tab === 'quiz' ? 'flex' : 'none';
      });
    });

    // Summary Sub-mode buttons
    document.querySelectorAll('.pulse-btn-summary-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pulse-btn-summary-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSummary(btn.dataset.type);
      });
    });

    // Flashcard Controls
    document.getElementById('pulseFlipCard')?.addEventListener('click', toggleFlipCard);
    document.getElementById('btnNextCard')?.addEventListener('click', nextFlashcard);
    document.getElementById('btnPrevCard')?.addEventListener('click', prevFlashcard);
    document.getElementById('btnMarkMastered')?.addEventListener('click', toggleMastered);
    document.getElementById('btnGenerateFlashcards')?.addEventListener('click', () => generateStudyTool('flashcards'));
    document.getElementById('btnGenerateQuiz')?.addEventListener('click', () => generateStudyTool('quiz'));

    // Toggle Intel Panel (Mobile/Tablet)
    document.getElementById('btnToggleIntel')?.addEventListener('click', () => {
      const panel = document.getElementById('pulseIntelPanel');
      if (panel) panel.classList.toggle('open');
    });
  }

  // -------------------------------------------------------------
  // UTILITY HELPERS
  // -------------------------------------------------------------
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMarkdown(text) {
    if (!text) return '';

    let out = escapeHtml(text);

    // Code blocks ```code```
    out = out.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code `code`
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **bold**
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic *italic*
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headers ### Header
    out = out.replace(/^### (.*$)/gim, '<h4 style="margin:0.75rem 0 0.35rem; color:var(--color-primary); font-size:1rem;">$1</h4>');
    out = out.replace(/^## (.*$)/gim, '<h3 style="margin:0.85rem 0 0.4rem; color:var(--color-primary); font-size:1.1rem;">$1</h3>');

    // Citations [Slide X] or [Sec Y]
    out = out.replace(/\[(Slide \d+|Sec(?:tion)? [\d.]+)\]/gi, '<span class="pulse-citation-tag">$1</span>');

    // Unordered lists - item
    out = out.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    out = out.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks to paragraphs
    out = out.split('\n\n').map(p => {
      if (p.startsWith('<pre') || p.startsWith('<h') || p.startsWith('<ul')) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return out;
  }

  // Auto-boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FocusPulseAI = {
    init,
    sendMessage,
    createNewChat,
    renderSummary,
    launchPomodoro
  };

})();
