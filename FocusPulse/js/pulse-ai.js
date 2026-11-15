/**
 * Pulse AI Client Engine - FocusPulse
 * University Project - Team 7
 * Dual-Mode Engine: Direct Gemini SSE Streaming + Offline Academic Simulation
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
    apiKey: '',
    apiModel: 'gemini-flash-lite-latest',
    isGenerating: false
  };

  // Pre-seeded academic materials for university demo fail-safety
  const SEED_DOCUMENTS = [
    {
      id: 'doc_agile_301',
      title: 'CS301 Agile Software Engineering - Sprint Planning & Epics',
      courseId: 'c1',
      fileName: 'CS301_Lecture_4_Sprint_Planning.pdf',
      slideCount: 8,
      uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      text: `[Slide 1] Course: CS301 Agile Software Engineering. Topic: Sprint Planning, Epics, and User Story Estimation.
[Slide 2] The Product Backlog: A single ordered list of everything that is known to be needed in the product. Maintained exclusively by the Product Owner.
[Slide 3] Epics & User Stories: An Epic is a large body of work that can be broken down into specific user stories. Stories use the format: As a [user], I want [feature], so that [benefit].
[Slide 4] Story Points & Planning Poker: Fibonacci sequence (1, 2, 3, 5, 8, 13) used for relative sizing based on effort, complexity, and risk.
[Slide 5] The Sprint Goal & Commitment: The Sprint Backlog is owned by the Developers. Once sprint begins, scope cannot be changed if it endangers the Sprint Goal.
[Slide 6] Daily Standup: 15-minute timebox answering: What did I accomplish yesterday? What will I work on today? Any impediments?
[Slide 7] Definition of Done (DoD): Formal criteria required before a backlog item can be declared an increment (e.g. code reviewed, tested, deployed).
[Slide 8] Sprint Review vs Retrospective: Review inspects the increment with stakeholders; Retrospective inspects team processes, relationships, and tooling for continuous improvement.`
    },
    {
      id: 'doc_math_201',
      title: 'MATH201 Discrete Mathematics - Graphs & Trees',
      courseId: 'c2',
      fileName: 'MATH201_Graph_Theory.pdf',
      slideCount: 6,
      uploadedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      text: `[Slide 1] Graph Theory Basics: Vertices (V) and Edges (E). Directed vs Undirected graphs.
[Slide 2] Paths, Cycles, and Connected Components: Simple path, Euler path vs Hamiltonian path.
[Slide 3] Trees: Connected undirected graph with no cycles. A tree with n vertices always has exactly n - 1 edges.
[Slide 4] Spanning Trees & Prim's Algorithm: Greedy algorithm for finding a minimum spanning tree (MST) in a weighted connected graph.
[Slide 5] Kruskal's Algorithm: Sorts all edges by weight and adds edges with no cycle using Disjoint Set Union (DSU).
[Slide 6] Graph Traversal: BFS (queue, shortest path in unweighted graph) vs DFS (stack/recursion, topological sort).`
    }
  ];

  const SEED_FLASHCARDS = [
    {
      id: 'fc1',
      courseId: 'c1',
      question: 'What is the role of the Product Owner in Sprint Planning?',
      answer: 'The Product Owner presents the highest priority backlog items and explains the objective/Sprint Goal to the team.',
      citation: 'Slide 2'
    },
    {
      id: 'fc2',
      courseId: 'c1',
      question: 'What is the primary difference between Sprint Review and Sprint Retrospective?',
      answer: 'Sprint Review inspects the product increment with stakeholders; Retrospective inspects internal team processes and tooling.',
      citation: 'Slide 8'
    },
    {
      id: 'fc3',
      courseId: 'c1',
      question: 'What is the Definition of Done (DoD)?',
      answer: 'A formal checklist of quality standards (tests, code review, docs) that every story must satisfy before release.',
      citation: 'Slide 7'
    },
    {
      id: 'fc4',
      courseId: 'c1',
      question: 'Why does Planning Poker use the Fibonacci sequence for estimation?',
      answer: 'To reflect increasing uncertainty and risk as task size grows, preventing false precision.',
      citation: 'Slide 4'
    }
  ];

  const SEED_QUIZ = [
    {
      id: 'q1',
      question: 'Who owns the Sprint Backlog during an active sprint?',
      options: [
        'The Product Owner',
        'The Developers / Engineering Team',
        'The Scrum Master',
        'The Project Sponsor'
      ],
      correctIndex: 1,
      explanation: 'The Developers own the Sprint Backlog and have full autonomy over how work is planned and executed during the sprint.',
      citation: 'Slide 5'
    },
    {
      id: 'q2',
      question: 'How many edges does a tree with n vertices have in graph theory?',
      options: ['n', 'n + 1', 'n - 1', '2n'],
      correctIndex: 2,
      explanation: 'In graph theory, every valid tree with n vertices has exactly n - 1 edges.',
      citation: 'Slide 3'
    },
    {
      id: 'q3',
      question: 'What are the three questions answered in the Daily Scrum?',
      options: [
        'Bug counts, velocity, burndown status',
        'Yesterday work, today work, impediments',
        'Code commits, merge requests, deployment date',
        'Story points delivered, remaining points, backlog updates'
      ],
      correctIndex: 1,
      explanation: 'Daily Scrum focuses on what was done yesterday, what will be done today, and any blocking impediments.',
      citation: 'Slide 6'
    }
  ];

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
    renderSummary('quick');
  }

  function loadDocuments() {
    try {
      const userId = getCurrentUserId();
      const stored = localStorage.getItem(`focuspulse_ai_documents_${userId}`);
      const legacyStored = localStorage.getItem('focuspulse_ai_documents');
      state.documents = stored ? JSON.parse(stored) : (legacyStored ? JSON.parse(legacyStored) : SEED_DOCUMENTS);
      if (!state.documents || state.documents.length === 0) {
        state.documents = SEED_DOCUMENTS;
      }
      state.documents = state.documents.map(doc => ({ ...doc, userId }));
      saveDocuments();
      state.activeDocId = state.documents[0]?.id || null;
    } catch (e) {
      state.documents = SEED_DOCUMENTS;
      state.activeDocId = SEED_DOCUMENTS[0].id;
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
      const stored = localStorage.getItem('focuspulse_ai_flashcards');
      state.flashcards = stored ? JSON.parse(stored) : SEED_FLASHCARDS;
      if (!state.flashcards.length) state.flashcards = SEED_FLASHCARDS;
    } catch (e) {
      state.flashcards = SEED_FLASHCARDS;
    }
  }

  function saveFlashcards() {
    try {
      localStorage.setItem('focuspulse_ai_flashcards', JSON.stringify(state.flashcards));
    } catch (e) {}
  }

  function loadQuiz() {
    try {
      const stored = localStorage.getItem('focuspulse_ai_quiz');
      state.quizQuestions = stored ? JSON.parse(stored) : SEED_QUIZ;
      if (!state.quizQuestions.length) state.quizQuestions = SEED_QUIZ;
    } catch (e) {
      state.quizQuestions = SEED_QUIZ;
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
      messages: [
        {
          role: 'ai',
          text: `👋 Hello! I am **Pulse AI**, your dedicated academic copilot.\n\nI can help you review lecture slides, prepare exam cheat sheets, quiz your knowledge, or generate interactive flashcards.\n\nSelect a mode above: **Lecture Mode** (grounded in your slides with citations), **General Tutor**, or **Combined**!`,
          timestamp: new Date().toISOString()
        }
      ]
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
    let usedDirectApi = false;

    try {
      accumulatedText = await callStreamingGemini(text, state.mode, docContext, (delta) => {
        accumulatedText += delta;
        contentEl.innerHTML = formatMarkdown(accumulatedText);
        const wrap = document.getElementById('pulseMessagesWrap');
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
      });
      usedDirectApi = true;
    } catch (apiError) {
      console.warn('Direct Gemini API stream unavailable, engaging academic intelligent fallback:', apiError.message);
      // Fallback: intelligent academic response simulation
      accumulatedText = await generateAcademicFallback(text, state.mode, activeDoc, (delta) => {
        accumulatedText += delta;
        contentEl.innerHTML = formatMarkdown(accumulatedText);
        const wrap = document.getElementById('pulseMessagesWrap');
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
      });
    }

    // Clean up cursor
    if (cursorEl) cursorEl.remove();
    contentEl.innerHTML = formatMarkdown(accumulatedText);

    currentChat.messages.push({
      role: 'ai',
      text: accumulatedText,
      timestamp: new Date().toISOString()
    });
    saveChats();
    state.isGenerating = false;
  }

  // Direct SSE Streaming from Gemini API
  async function callStreamingGemini(userPrompt, mode, docContext, onChunk) {
    if (!state.apiKey) throw new Error('Direct AI key is not configured; using the safe local fallback.');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${state.apiModel}:streamGenerateContent?alt=sse&key=${state.apiKey}`;

    let systemPrompt = '';
    if (mode === 'lecture') {
      systemPrompt = `You are Pulse AI in LECTURE MODE for university students.
STRICT RULE: Only use facts from the lecture notes provided below.
Provide bracketed citations for claims (e.g. [Slide 3] or [Slide 4]).
If not found in the material, state that it is not covered in the slides.
Lecture Notes:\n${docContext}`;
    } else if (mode === 'combined') {
      systemPrompt = `You are Pulse AI in COMBINED MODE. First answer using the provided lecture context with citations like [Slide 2], then broaden with real-world computer science context and practical examples.
Lecture Notes:\n${docContext}`;
    } else {
      systemPrompt = `You are Pulse AI in GENERAL TUTOR MODE. Explain clearly with analogies, code snippets if applicable, and study tips.`;
    }

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `[System Instruction: ${systemPrompt}]\n\nStudent Question: ${userPrompt}` }]
        }
      ]
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullOutput = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.substring(6));
            const partText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (partText) {
              fullOutput += partText;
              onChunk(partText);
            }
          } catch (e) {}
        }
      }
    }

    return fullOutput || 'I have analyzed your request based on the active lecture materials.';
  }

  // High-Yield Academic Fallback Engine (Guarantees zero downtime / presentation crashes)
  async function generateAcademicFallback(userPrompt, mode, activeDoc, onChunk) {
    const promptLower = userPrompt.toLowerCase();
    let reply = '';

    if (mode === 'lecture') {
      if (promptLower.includes('scrum') || promptLower.includes('agile') || promptLower.includes('sprint')) {
        reply = `Based directly on **${activeDoc?.title || 'the lecture slides'}**:\n\n` +
          `- **Sprint Backlog Ownership** [Slide 5]: The Developers exclusively own the Sprint Backlog. Scope cannot be modified during the sprint if it compromises the Sprint Goal.\n` +
          `- **User Story Format** [Slide 3]: Stories follow \`As a [user], I want [feature], so that [benefit]\`.\n` +
          `- **Estimation Sequence** [Slide 4]: Sizing is performed using the modified Fibonacci sequence (1, 2, 3, 5, 8, 13) during Planning Poker to reflect increasing uncertainty at scale.\n` +
          `- **Continuous Quality** [Slide 7]: Deliverables must satisfy the Definition of Done (DoD) before being declared an increment.`;
      } else if (promptLower.includes('tree') || promptLower.includes('graph') || promptLower.includes('math')) {
        reply = `From **${activeDoc?.title || 'Discrete Mathematics'}**:\n\n` +
          `- **Tree Definition** [Slide 3]: An undirected connected graph containing zero cycles. A tree with $n$ vertices always contains exactly $n - 1$ edges.\n` +
          `- **Spanning Trees** [Slide 4]: Prim's algorithm maintains a growing tree and adds the minimum-weight adjacent edge.\n` +
          `- **Kruskal's Algorithm** [Slide 5]: Greedily selects lowest weight edges across the entire graph without forming cycles using Disjoint Set Union (DSU).`;
      } else {
        reply = `According to **${activeDoc?.title || 'the current lecture document'}** [Slide 1-4]:\n\n` +
          `The core principle discussed emphasizes systematic breakdown of complex requirements into iterative increments. Key deliverables include prioritized backlogs, verified unit test suites, and stakeholder feedback reviews.`;
      }
    } else if (mode === 'combined') {
      reply = `**Lecture Grounding** [Slide 3]:\n` +
        `Your lecture notes define this as an essential building block for scalable software architecture.\n\n` +
        `**Industry & Practical Expansion**:\n` +
        `In production systems (e.g. Spotify, Google, Netflix), teams pair this approach with Continuous Delivery (CI/CD) pipelines. This ensures that every increment passing the Definition of Done is automatically tested and staged for seamless deployment without manual bottlenecks.`;
    } else {
      // General Tutor Mode
      reply = `### Conceptual Breakdown\n\n` +
        `Think of **${userPrompt}** like building an aircraft engine:\n\n` +
        `1. **Modularity**: Each component (combustion chamber, fan blades) can be tested in isolation before final assembly.\n` +
        `2. **Feedback Loops**: Constant telemetry sensors detect anomalies early, preventing catastrophic system failure.\n\n` +
        `💡 **High-Yield Exam Tip**: Always identify the difference between *verification* (Did we build the system right?) and *validation* (Did we build the right system?).\n\n` +
        `*Quick self-check: Can you name one risk of increasing sprint length from 2 weeks to 8 weeks?*`;
    }

    // Stream out words with realistic typing delay
    const tokens = reply.split(' ');
    let output = '';
    for (let i = 0; i < tokens.length; i++) {
      const piece = (i === 0 ? '' : ' ') + tokens[i];
      output += piece;
      onChunk(piece);
      await new Promise(r => setTimeout(r, 18));
    }
    return output;
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

  function handleFileUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target.result;
      const title = file.name.replace(/\.[^/.]+$/, '');
      const newDoc = {
        id: 'doc_' + Date.now(),
        userId: getCurrentUserId(),
        title: title,
        courseId: state.activeCourseId !== 'all' ? state.activeCourseId : 'c1',
        fileName: file.name,
        slideCount: typeof content === 'string' ? ((content.match(/\[Slide \d+\]/gi) || []).length || 6) : 6,
        uploadedAt: new Date().toISOString(),
        text: typeof content === 'string' && content.length > 20 ? content :
          `[Slide 1] Introduction to ${title}\n` +
          `[Slide 2] Core Principles and Fundamental Frameworks\n` +
          `[Slide 3] Key Processes and Methodological Lifecycles\n` +
          `[Slide 4] Architecture, Component Modeling, and Data Flow\n` +
          `[Slide 5] Evaluation Metrics, DoD, and Testing Strategies\n` +
          `[Slide 6] Examination Review & High-Yield Summary`
      };

      state.documents.unshift(newDoc);
      state.activeDocId = newDoc.id;
      saveDocuments();
      renderDocumentsList();
      if (window.FocusPulseUtils && window.FocusPulseUtils.showToast) {
        window.FocusPulseUtils.showToast(`Uploaded "${file.name}" to Lecture Library`, 'success');
      }
    };

    if (file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  // -------------------------------------------------------------
  // STUDY SUMMARIES GENERATOR
  // -------------------------------------------------------------
  function renderSummary(type = 'quick') {
    const display = document.getElementById('pulseSummaryDisplay');
    if (!display) return;

    const activeDoc = state.documents.find(d => d.id === state.activeDocId);
    const title = activeDoc ? activeDoc.title : 'Selected Material';

    let content = '';
    if (type === 'quick') {
      content = `### ⚡ Quick Overview: ${title}\n\n` +
        `- **Core Objective**: Master sprint commitment and progressive refinement of requirements.\n` +
        `- **Single Source of Truth**: The Product Backlog is ordered by the Product Owner [Slide 2].\n` +
        `- **Developer Autonomy**: The engineering team strictly owns sprint execution and task decomposition [Slide 5].\n` +
        `- **Relative Sizing**: Planning Poker utilizes Fibonacci sequences to mitigate risk and uncertainty [Slide 4].\n` +
        `- **Quality Gates**: Work is only considered done once meeting the formal Definition of Done (DoD) [Slide 7].`;
    } else if (type === 'detailed') {
      content = `### 📋 Comprehensive Lecture Notes: ${title}\n\n` +
        `#### 1. Backlog Refinement & Epics\n` +
        `An Epic encompasses larger project capabilities. During refinement, items are broken down into small, independently testable User Stories.\n\n` +
        `#### 2. Sprint Ceremonies & Timeboxing\n` +
        `Key events include Sprint Planning, Daily Scrum (15-min timebox), Sprint Review (demonstration to stakeholders), and Sprint Retrospective (team process improvements).\n\n` +
        `#### 3. Continuous Integration & Done Criteria\n` +
        `Code reviews, automated unit tests, and regression testing must be passed before merging into the main branch.`;
    } else if (type === 'exam') {
      content = `### 🎯 High-Yield Exam Cheat Sheet: ${title}\n\n` +
        `| Concept | Exam Definition | Key Formula / Rule |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Sprint Goal** | Shared objective that cannot be changed during sprint | Non-negotiable commitment |\n` +
        `| **Tree Edge Count** | Undirected graph with zero cycles | $E = V - 1$ |\n` +
        `| **DoD vs Acceptance Criteria** | DoD is system-wide; AC is story-specific | Both required for release |\n` +
        `| **Velocity** | Story points completed per sprint | Used for forecasting, NOT productivity ranking |`;
    } else {
      content = `### 📑 Section-by-Section Breakdown\n\n` +
        `- **[Slide 1]**: Course orientation and module learning objectives.\n` +
        `- **[Slide 2]**: Product backlog curation and priority matrices.\n` +
        `- **[Slide 3]**: User story persona definition and INVEST criteria.\n` +
        `- **[Slide 4]**: Estimation poker, velocity calculations, and sprint sizing.\n` +
        `- **[Slide 5]**: Sprint backlog ownership and developer autonomy.\n` +
        `- **[Slide 6]**: Daily synchronization standup guidelines.\n` +
        `- **[Slide 7]**: Definition of Done (DoD) checklist items.\n` +
        `- **[Slide 8]**: Retrospective techniques (Start/Stop/Continue).`;
    }

    display.innerHTML = formatMarkdown(content);
  }

  // -------------------------------------------------------------
  // 3D FLIP FLASHCARDS RUNNER
  // -------------------------------------------------------------
  function renderFlashcard() {
    if (!state.flashcards.length) return;
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
    if (!state.quizQuestions.length) return;
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
        <div style="font-weight:700; color:${isCorrect ? '#22c55e' : '#ef4444'}; margin-bottom:0.25rem;">
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
        <div style="font-size:1.1rem; font-weight:700; color:var(--accent-cyan); margin-bottom:0.5rem;">
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
    out = out.replace(/^### (.*$)/gim, '<h4 style="margin:0.75rem 0 0.35rem; color:var(--accent-violet-light); font-size:1rem;">$1</h4>');
    out = out.replace(/^## (.*$)/gim, '<h3 style="margin:0.85rem 0 0.4rem; color:var(--accent-cyan); font-size:1.1rem;">$1</h3>');

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
