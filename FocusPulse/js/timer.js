/**
 * FocusPulse - FOCUS REACTOR Engine
 * Implements S03 (25-min Pomodoro), S04 (Interrupted sessions excluded), S07 (5-min break).
 * Accurate Date.now() delta countdown, 6 Animation States, Web Audio chimes, Deep Focus mode.
 */

const Timer = {
  // Constants
  FOCUS_DEFAULT_SECONDS: 25 * 60, // 25 minutes (1500s)
  BREAK_DEFAULT_SECONDS: 5 * 60,   // 5 minutes (300s)
  RING_CIRCUMFERENCE: 1194,        // 2 * PI * 190

  // State
  mode: 'focus', // 'focus' | 'break'
  status: 'idle', // 'idle' | 'activating' | 'running' | 'paused' | 'complete'
  courseId: null,
  courseName: 'General Study',
  totalDurationSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  targetEndTime: null,
  timerInterval: null,
  autoRefreshTimer: null,
  soundEnabled: true,
  isDeepFocus: false,

  getDurationPreferences() {
    return Storage.getData(STORAGE_KEYS.PREFERENCES, { focusDuration: 25, breakDuration: 5 });
  },

  adjustDuration(delta) {
    if (!['idle', 'paused'].includes(this.status)) {
      Utils.showToast('Pause the timer before changing its duration.', 'warning');
      return;
    }
    const prefs = this.getDurationPreferences();
    const key = this.mode === 'break' ? 'breakDuration' : 'focusDuration';
    const min = this.mode === 'break' ? 1 : 5;
    const max = this.mode === 'break' ? 30 : 120;
    const fallback = this.mode === 'break' ? 5 : 25;
    const previousDuration = Number(prefs[key] || fallback);
    prefs[key] = Math.min(max, Math.max(min, previousDuration + delta));
    Storage.saveData(STORAGE_KEYS.PREFERENCES, prefs);
    this.totalDurationSeconds = prefs[key] * 60;
    if (this.status === 'paused') {
      const elapsedSeconds = Math.max(0, (previousDuration * 60) - this.remainingSeconds);
      this.remainingSeconds = Math.max(60, this.totalDurationSeconds - elapsedSeconds);
      this.persistTimerState();
    } else {
      this.remainingSeconds = this.totalDurationSeconds;
    }
    this.updateModeLabels(prefs);
    this.updateDisplay();
    Utils.showToast(`${this.mode === 'break' ? 'Break' : 'Focus'} duration: ${prefs[key]} minutes`, 'info');
  },

  init() {
    this.bindEvents();
    this.updateModeLabels();
    this.restoreTimerState();
    this.scheduleAutoRefresh();
  },

  scheduleAutoRefresh() {
    clearTimeout(this.autoRefreshTimer);
    if (!['running', 'paused', 'activating'].includes(this.status)) return;

    // Refresh periodically so the page stays synchronized while preserving
    // the active timer through ACTIVE_TIMER/localStorage.
    this.autoRefreshTimer = setTimeout(() => window.location.reload(), 60000);
  },

  // --------------------------------------------------------------------------
  // 1. Timer Lifecycle & Accurate Date.now() Calculation
  // --------------------------------------------------------------------------
  startFocus(courseId, courseName) {
    if (!courseId) {
      Utils.showToast('Please select a course to power up the reactor!', 'warning');
      return false;
    }

    const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, { focusDuration: 25 });
    const durationSec = (prefs.focusDuration || 25) * 60;

    this.mode = 'focus';
    this.courseId = courseId;
    this.courseName = courseName;
    this.totalDurationSeconds = durationSec;
    this.remainingSeconds = durationSec;
    this.targetEndTime = Date.now() + durationSec * 1000;
    this.status = 'activating';
    this.persistTimerState();
    this.scheduleAutoRefresh();

    // Trigger Activation State
    this.setAnimationState('activating');
    if (this.soundEnabled) Utils.playActivationSound();

    setTimeout(() => {
      this.status = 'running';
      this.setAnimationState('focus');
      this.startTickLoop();
      this.persistTimerState();
      this.updateControls();
      Utils.showToast(`Focus Reactor ignited for ${this.courseName}!`, 'info');
    }, 700);

    return true;
  },

  startBreak() {
    const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, { breakDuration: 5 });
    const durationSec = (prefs.breakDuration || 5) * 60;

    this.mode = 'break';
    this.status = 'running';
    this.totalDurationSeconds = durationSec;
    this.remainingSeconds = durationSec;
    this.targetEndTime = Date.now() + durationSec * 1000;

    this.setAnimationState('recovery');
    if (this.soundEnabled) Utils.playBreakSound();

    this.startTickLoop();
    this.persistTimerState();
    this.scheduleAutoRefresh();
    Utils.showToast('Recovery mode active. Take a deep breath.', 'info');
  },

  startTickLoop() {
    clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.status !== 'running') return;

      const now = Date.now();
      const diffSec = Math.round((this.targetEndTime - now) / 1000);

      if (diffSec <= 0) {
        this.remainingSeconds = 0;
        this.updateDisplay();
        this.onTimerComplete();
      } else {
        this.remainingSeconds = diffSec;
        this.updateDisplay();

        // Check for Final Minute transition (< 60s during focus)
        if (this.mode === 'focus' && this.remainingSeconds <= 60 && this.remainingSeconds > 0) {
          this.setAnimationState('final-minute');
        } else if (this.mode === 'focus' && this.remainingSeconds > 60) {
          this.setAnimationState('focus');
        }
      }
    }, 500); // 500ms check ensures smooth responsiveness
  },

  pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    clearInterval(this.timerInterval);
    this.persistTimerState();
    this.updateControls();
    Utils.showToast('Focus Reactor paused.', 'info');
  },

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.targetEndTime = Date.now() + this.remainingSeconds * 1000;
    this.setAnimationState(this.mode === 'focus' ? (this.remainingSeconds <= 60 ? 'final-minute' : 'focus') : 'recovery');
    this.startTickLoop();
    this.persistTimerState();
    this.updateControls();
    Utils.showToast('Focus Reactor resumed.', 'info');
  },

  // S04: Interrupted sessions do not count
  cancelPrompt() {
    Utils.openModal('cancelConfirmModal');
  },

  confirmCancel(reason = 'Interrupted by user') {
    Utils.closeModal('cancelConfirmModal');
    clearInterval(this.timerInterval);

    // Save as interrupted session (0 focus minutes credited)
    if (this.mode === 'focus' && this.status !== 'idle') {
      const user = Storage.getCurrentUser();
      if (user) {
        const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []);
        sessions.push({
          id: 'sess_' + Date.now(),
          userId: user.id,
          courseId: this.courseId,
          courseName: this.courseName,
          durationMinutes: 0, // IMPORTANT: Interrupted sessions give 0 minutes!
          completedAt: new Date().toISOString(),
          dateStr: Utils.getLocalDateString(),
          status: 'interrupted',
          notes: `Session cancelled: ${reason}`
        });
        Storage.saveData(STORAGE_KEYS.SESSIONS, sessions);
      }
      Utils.showToast('Session cancelled. Interrupted sessions do not count toward focus time or streak.', 'warning');
    }

    this.resetToIdle();
  },

  skipBreak() {
    clearInterval(this.timerInterval);
    Utils.showToast('Break skipped. Reactor ready for your next session!', 'info');
    this.resetToIdle();
  },

  resetToIdle() {
    this.mode = 'focus';
    this.status = 'idle';
    const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, { focusDuration: 25 });
    this.totalDurationSeconds = (prefs.focusDuration || 25) * 60;
    this.remainingSeconds = this.totalDurationSeconds;
    this.targetEndTime = null;

    Storage.deleteData(STORAGE_KEYS.ACTIVE_TIMER);
    clearTimeout(this.autoRefreshTimer);
    this.setAnimationState('idle');
    this.updateDisplay();
    this.updateControls();
  },

  // S03 & S07: Session Complete & Auto Break Switch
  onTimerComplete() {
    clearInterval(this.timerInterval);
    Storage.deleteData(STORAGE_KEYS.ACTIVE_TIMER);

    if (this.mode === 'focus') {
      this.status = 'complete';
      this.setAnimationState('complete');
      if (this.soundEnabled) Utils.playCompletionSound();

      // Record completed 25-minute session
      const user = Storage.getCurrentUser();
      if (user) {
        const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []);
        const durationMins = Math.round(this.totalDurationSeconds / 60);
        sessions.push({
          id: 'sess_' + Date.now(),
          userId: user.id,
          courseId: this.courseId,
          courseName: this.courseName,
          durationMinutes: durationMins,
          completedAt: new Date().toISOString(),
          dateStr: Utils.getLocalDateString(),
          status: 'completed',
          notes: 'Standard 25-min Pomodoro Completed'
        });
        Storage.saveData(STORAGE_KEYS.SESSIONS, sessions);

        // Check and evaluate badges automatically
        if (window.Badges) Badges.evaluate(user.id);
      }

      Utils.showToast('Reactor Overcharged! 25 min Focus Completed!', 'success');

      // Auto-transition to 5-minute break
      setTimeout(() => {
        this.startBreak();
      }, 2500);
    } else {
      // Break complete
      if (this.soundEnabled) Utils.playBreakSound();
      Utils.showToast('Recovery break completed! Ready for another focus session.', 'success');
      this.resetToIdle();
    }
  },

  // --------------------------------------------------------------------------
  // 2. State & Display Synchronizer
  // --------------------------------------------------------------------------
  updateDisplay() {
    const timeEl = document.getElementById('reactorCountdown');
    const labelEl = document.getElementById('reactorSessionLabel');
    const statusTextEl = document.getElementById('reactorStatusText');
    const progressRing = document.getElementById('reactorProgressRing');
    const durationValue = document.getElementById('reactorDurationValue');

    if (timeEl) {
      timeEl.textContent = Utils.formatTime(this.remainingSeconds);
    }
    if (durationValue) durationValue.textContent = Math.round(this.totalDurationSeconds / 60);

    if (labelEl) {
      labelEl.textContent = this.mode === 'focus' ? this.courseName : '5-Min Recovery Break';
    }

    if (statusTextEl) {
      if (this.status === 'idle') statusTextEl.textContent = 'REACTOR READY';
      else if (this.status === 'activating') statusTextEl.textContent = 'IGNITING CORE...';
      else if (this.status === 'paused') statusTextEl.textContent = 'REACTOR PAUSED';
      else if (this.status === 'complete') statusTextEl.textContent = 'SESSION COMPLETE!';
      else if (this.mode === 'break') statusTextEl.textContent = 'RECOVERY MODE';
      else if (this.remainingSeconds <= 60) statusTextEl.textContent = 'FINAL MINUTE';
      else statusTextEl.textContent = 'DEEP FOCUS';
    }

    // Update SVG Circular Progress Ring
    if (progressRing && this.totalDurationSeconds > 0) {
      const progressFraction = (this.totalDurationSeconds - this.remainingSeconds) / this.totalDurationSeconds;
      const offset = this.RING_CIRCUMFERENCE * (1 - progressFraction);
      progressRing.style.strokeDashoffset = Math.max(0, offset);
    }

    // Update Document Title
    const modePrefix = this.mode === 'focus' ? '⚡ Focus' : '☕ Break';
    document.title = this.status === 'running' 
      ? `(${Utils.formatTime(this.remainingSeconds)}) ${modePrefix} - FocusPulse`
      : 'Focus Reactor - FocusPulse';
  },

  updateModeLabels(prefs = this.getDurationPreferences()) {
    const focusBtn = document.getElementById('focusModeBtn');
    const breakBtn = document.getElementById('breakModeBtn');
    if (focusBtn) focusBtn.textContent = `Pomodoro (${prefs.focusDuration || 25}m)`;
    if (breakBtn) breakBtn.textContent = `Break (${prefs.breakDuration || 5}m)`;
  },

  setAnimationState(stateName) {
    const stage = document.getElementById('reactorStage');
    if (!stage) return;

    stage.classList.remove('state-idle', 'state-activating', 'state-focus', 'state-final-minute', 'state-complete', 'state-recovery');
    stage.classList.add(`state-${stateName}`);
  },

  updateControls() {
    const startBtn = document.getElementById('btnStartReactor');
    const pauseBtn = document.getElementById('btnPauseReactor');
    const resumeBtn = document.getElementById('btnResumeReactor');
    const cancelBtn = document.getElementById('btnCancelReactor');
    const skipBreakBtn = document.getElementById('btnSkipBreak');

    if (!startBtn) return;

    if (this.status === 'idle') {
      startBtn.style.display = 'inline-flex';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (skipBreakBtn) skipBreakBtn.style.display = 'none';
    } else if (this.status === 'running') {
      startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'inline-flex';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = this.mode === 'focus' ? 'inline-flex' : 'none';
      if (skipBreakBtn) skipBreakBtn.style.display = this.mode === 'break' ? 'inline-flex' : 'none';
    } else if (this.status === 'paused') {
      startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'inline-flex';
      if (cancelBtn) cancelBtn.style.display = this.mode === 'focus' ? 'inline-flex' : 'none';
      if (skipBreakBtn) skipBreakBtn.style.display = this.mode === 'break' ? 'inline-flex' : 'none';
    }
  },

  // --------------------------------------------------------------------------
  // 3. Persistence Across Page Refreshes
  // --------------------------------------------------------------------------
  persistTimerState() {
    const state = {
      mode: this.mode,
      status: this.status,
      courseId: this.courseId,
      courseName: this.courseName,
      totalDurationSeconds: this.totalDurationSeconds,
      remainingSeconds: this.remainingSeconds,
      targetEndTime: this.targetEndTime,
      savedAt: Date.now()
    };
    Storage.saveData(STORAGE_KEYS.ACTIVE_TIMER, state);
  },

  restoreTimerState() {
    const state = Storage.getData(STORAGE_KEYS.ACTIVE_TIMER);
    if (!state) {
      this.resetToIdle();
      return;
    }

    this.mode = state.mode || 'focus';
    this.courseId = state.courseId;
    this.courseName = state.courseName || 'General Study';
    this.totalDurationSeconds = state.totalDurationSeconds || this.FOCUS_DEFAULT_SECONDS;

    if ((state.status === 'running' || state.status === 'activating') && state.targetEndTime) {
      const now = Date.now();
      const diffSec = Math.round((state.targetEndTime - now) / 1000);

      if (diffSec <= 0) {
        // Finished while browser was away
        this.remainingSeconds = 0;
        this.onTimerComplete();
      } else {
        this.remainingSeconds = diffSec;
        this.targetEndTime = state.targetEndTime;
        this.status = 'running';
        this.setAnimationState(this.mode === 'focus' ? (this.remainingSeconds <= 60 ? 'final-minute' : 'focus') : 'recovery');
        this.startTickLoop();
      }
    } else if (state.status === 'paused') {
      this.status = 'paused';
      this.remainingSeconds = state.remainingSeconds;
      this.setAnimationState(this.mode === 'focus' ? 'focus' : 'recovery');
    } else {
      this.resetToIdle();
    }

    this.updateDisplay();
    this.updateControls();
  },

  // --------------------------------------------------------------------------
  // 4. Special Modes (Deep Focus & Distraction Capture)
  // --------------------------------------------------------------------------
  toggleDeepFocus() {
    this.isDeepFocus = !this.isDeepFocus;
    document.body.classList.toggle('deep-focus-active', this.isDeepFocus);
    Utils.showToast(this.isDeepFocus ? 'Deep Focus Mode engaged. Zero distractions.' : 'Deep Focus Mode exited.', 'info');
  },

  bindEvents() {
    window.addEventListener('beforeunload', () => {
      if (this.status === 'running' || this.status === 'paused' || this.status === 'activating') {
        this.persistTimerState();
      }
    });

    document.getElementById('btnDecreaseDuration')?.addEventListener('click', () => this.adjustDuration(-5));
    document.getElementById('btnIncreaseDuration')?.addEventListener('click', () => this.adjustDuration(5));

    // Start Focus
    const startBtn = document.getElementById('btnStartReactor');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const select = document.getElementById('reactorCourseSelect');
        const courseId = select ? select.value : null;
        const courseName = select && select.selectedOptions[0] ? select.selectedOptions[0].text : 'General Study';
        if (this.mode === 'break') this.startBreak();
        else this.startFocus(courseId, courseName);
      });
    }

    document.querySelectorAll('.reactor-mode-btn').forEach(button => {
      button.addEventListener('click', () => {
        if (this.status !== 'idle') {
          Utils.showToast('Finish the current session before switching timer modes.', 'warning');
          return;
        }
        this.mode = button.dataset.mode === 'break' ? 'break' : 'focus';
        document.querySelectorAll('.reactor-mode-btn').forEach(btn => btn.classList.toggle('active', btn === button));
        const prefs = this.getDurationPreferences();
        const duration = this.mode === 'break' ? (prefs.breakDuration || 5) : (prefs.focusDuration || 25);
        this.totalDurationSeconds = duration * 60;
        this.remainingSeconds = this.totalDurationSeconds;
        this.updateModeLabels(prefs);
        this.updateDisplay();
      });
    });

    // Pause
    const pauseBtn = document.getElementById('btnPauseReactor');
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pause());

    // Resume
    const resumeBtn = document.getElementById('btnResumeReactor');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.resume());

    // Cancel
    const cancelBtn = document.getElementById('btnCancelReactor');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelPrompt());

    const confirmCancelBtn = document.getElementById('btnConfirmCancelSession');
    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => this.confirmCancel());

    // Skip Break
    const skipBreakBtn = document.getElementById('btnSkipBreak');
    if (skipBreakBtn) skipBreakBtn.addEventListener('click', () => this.skipBreak());

    // Deep Focus Toggle
    const deepFocusBtn = document.getElementById('btnToggleDeepFocus');
    if (deepFocusBtn) deepFocusBtn.addEventListener('click', () => this.toggleDeepFocus());

    const exitDeepFocusBtn = document.getElementById('btnExitDeepFocus');
    if (exitDeepFocusBtn) exitDeepFocusBtn.addEventListener('click', () => this.toggleDeepFocus());

    // Sound Toggle
    const soundBtn = document.getElementById('btnToggleReactorSound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        soundBtn.classList.toggle('active', this.soundEnabled);
        Utils.showToast(this.soundEnabled ? 'Reactor Sound Effects Enabled' : 'Reactor Muted', 'info');
      });
    }

    // Distraction quick log
    const distractionBtn = document.getElementById('btnQuickDistraction');
    if (distractionBtn) {
      distractionBtn.addEventListener('click', () => {
        Utils.openModal('quickDistractionModal');
      });
    }

    const saveDistractionBtn = document.getElementById('btnSaveQuickDistraction');
    if (saveDistractionBtn) {
      saveDistractionBtn.addEventListener('click', () => {
        const textInput = document.getElementById('quickDistractionText');
        const catSelect = document.getElementById('quickDistractionCategory');
        if (textInput && textInput.value.trim()) {
          const user = Storage.getCurrentUser();
          if (user) {
            const list = Storage.getData(STORAGE_KEYS.DISTRACTIONS, []);
            list.push({
              id: 'dst_' + Date.now(),
              userId: user.id,
              timestamp: new Date().toISOString(),
              category: catSelect ? catSelect.value : 'General',
              text: textInput.value.trim()
            });
            Storage.saveData(STORAGE_KEYS.DISTRACTIONS, list);
            textInput.value = '';
            Utils.closeModal('quickDistractionModal');
            Utils.showToast('Distraction logged. Refocus on your session!', 'info');
          }
        }
      });
    }
  }
};
