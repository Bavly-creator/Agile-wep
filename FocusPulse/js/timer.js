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
  plannedSessionId: null,
  launchDurationSeconds: null,

  getDurationPreferences() {
    return Storage.getData(STORAGE_KEYS.PREFERENCES, { focusDuration: 25, breakDuration: 5, longBreakDuration: 15 });
  },

  isBreakMode() { return this.mode !== 'focus'; },

  adjustDuration(delta) {
    if (!['idle', 'paused'].includes(this.status)) {
      Utils.showToast('Pause the timer before changing its duration.', 'warning');
      return;
    }
    const prefs = this.getDurationPreferences();
    const key = this.mode === 'long-break' ? 'longBreakDuration' : this.mode === 'break' ? 'breakDuration' : 'focusDuration';
    const min = this.isBreakMode() ? 1 : 5;
    const max = this.isBreakMode() ? 60 : 120;
    const fallback = this.mode === 'long-break' ? 15 : this.mode === 'break' ? 5 : 25;
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
    Utils.showToast(`${this.isBreakMode() ? 'Break' : 'Focus'} duration: ${prefs[key]} minutes`, 'info');
  },

  init() {
    this.soundEnabled = Storage.getData(STORAGE_KEYS.PREFERENCES, {}).soundEnabled !== false;
    const soundButton = document.getElementById('btnToggleReactorSound');
    if (soundButton) { soundButton.classList.toggle('active', this.soundEnabled); soundButton.textContent = this.soundEnabled ? 'Completion chime on' : 'Sounds off'; }
    this.bindEvents();
    this.updateModeLabels();
    this.restoreTimerState();
    this.applyLaunchParameters();
    this.scheduleAutoRefresh();
  },

  applyLaunchParameters() {
    if (Storage.getData(STORAGE_KEYS.ACTIVE_TIMER)) return;
    const params = new URLSearchParams(window.location.search);
    const duration = Number(params.get('duration'));
    const objective = params.get('objective');
    const planned = params.get('planned');
    const courseId = params.get('course');
    if (courseId) {
      const course = window.Courses?.getById(courseId);
      const select = document.getElementById('reactorCourseSelect');
      if (course && select) {
        this.courseId = course.id;
        this.courseName = course.name;
        select.value = course.id;
      }
    }
    if (Number.isFinite(duration) && duration >= 5 && duration <= 120) {
      this.launchDurationSeconds = duration * 60;
      this.totalDurationSeconds = this.remainingSeconds = this.launchDurationSeconds;
    }
    if (objective) {
      this.objective = objective.slice(0, 120);
      const input = document.getElementById('timerObjective');
      if (input) input.value = this.objective;
    }
    this.plannedSessionId = planned || null;
    this.updateDisplay();
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
    if (this.status === 'complete') this.plannedSessionId = null;
    const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, { focusDuration: 25 });
    const durationSec = this.launchDurationSeconds || (prefs.focusDuration || 25) * 60;

    this.mode = 'focus';
    this.courseId = courseId;
    this.courseName = courseName || 'Independent study';
    this.objective = document.getElementById('timerObjective')?.value.trim() || '';
    this.launchDurationSeconds = null;
    this.totalDurationSeconds = durationSec;
    this.remainingSeconds = durationSec;
    this.targetEndTime = Date.now() + durationSec * 1000;
    this.status = 'activating';
    this.persistTimerState();
    this.scheduleAutoRefresh();

    // Trigger Activation State
    this.setAnimationState('activating');
    this.updateControls();
    this.updateDisplay();
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
    const prefs = this.getDurationPreferences();
    const durationSec = (this.mode === 'long-break' ? (prefs.longBreakDuration || 15) : (prefs.breakDuration || 5)) * 60;

    if (!this.isBreakMode()) this.mode = 'break';
    this.status = 'running';
    this.totalDurationSeconds = durationSec;
    this.remainingSeconds = durationSec;
    this.targetEndTime = Date.now() + durationSec * 1000;

    this.setAnimationState('recovery');
    if (this.soundEnabled) Utils.playBreakSound();

    this.startTickLoop();
    this.persistTimerState();
    this.scheduleAutoRefresh();
    this.updateDisplay();
    this.updateControls();
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
    this.remainingSeconds = Math.max(0, Math.round((this.targetEndTime - Date.now()) / 1000));
    if (this.remainingSeconds <= 0) { this.onTimerComplete(); return; }
    this.status = 'paused';
    clearInterval(this.timerInterval);
    if (this.soundEnabled) Utils.playControlSound('pause');
    this.persistTimerState();
    this.updateDisplay();
    this.updateControls();
    Utils.showToast('Focus Reactor paused.', 'info');
  },

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    if (this.soundEnabled) Utils.playControlSound('resume');
    this.targetEndTime = Date.now() + this.remainingSeconds * 1000;
    this.setAnimationState(this.mode === 'focus' ? (this.remainingSeconds <= 60 ? 'final-minute' : 'focus') : 'recovery');
    this.startTickLoop();
    this.persistTimerState();
    this.updateDisplay();
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
    if (!this.isBreakMode() && this.status !== 'idle') {
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
        if (window.Goals) {
          const progress = Goals.getTodayProgress();
          if (progress.isMet && progress.completed === progress.target && Storage.getData(STORAGE_KEYS.PREFERENCES, {}).goalSound !== false) Utils.playGoalSound();
        }
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

  resetTimer() {
    if (['running', 'paused', 'activating'].includes(this.status) && !this.isBreakMode()) {
      this.cancelPrompt();
      return;
    }
    const selectedMode = this.mode;
    this.resetToIdle();
    if (selectedMode !== 'focus') {
      this.mode = selectedMode;
      const prefs = this.getDurationPreferences();
      const duration = selectedMode === 'long-break' ? (prefs.longBreakDuration || 15) : (prefs.breakDuration || 5);
      this.totalDurationSeconds = this.remainingSeconds = duration * 60;
      document.querySelectorAll('.reactor-mode-btn').forEach(button => button.classList.toggle('active', button.dataset.mode === selectedMode));
      this.updateDisplay();
      this.updateControls();
    }
    Utils.showToast('Timer reset to its selected duration.', 'info');
  },

  resetToIdle() {
    this.mode = 'focus';
    this.status = 'idle';
    this.plannedSessionId = null;
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

    if (!this.isBreakMode()) {
      this.status = 'complete';
      this.setAnimationState('complete');
      if (this.soundEnabled) Utils.playCompletionSound();

      // Record completed 25-minute session
      const user = Storage.getCurrentUser();
      const durationMins = Math.round(this.totalDurationSeconds / 60);
      if (user) {
        const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []);
        sessions.push({
          id: 'sess_' + Date.now(),
          userId: user.id,
          courseId: this.courseId,
          courseName: this.courseName,
          durationMinutes: durationMins,
          completedAt: new Date().toISOString(),
          dateStr: Utils.getLocalDateString(),
          status: 'completed',
          notes: this.objective || 'Focus session completed',
          plannedSessionId: this.plannedSessionId || null
        });
        Storage.saveData(STORAGE_KEYS.SESSIONS, sessions);
        if (this.plannedSessionId) {
          const events = Storage.getUserItems(STORAGE_KEYS.PLANNER_EVENTS);
          const planned = events.find(item => item.id === this.plannedSessionId);
          if (planned) { planned.status = 'completed'; planned.actualDurationMinutes = durationMins; planned.completedSessionId = sessions[sessions.length - 1].id; Storage.saveUserItems(STORAGE_KEYS.PLANNER_EVENTS, events); }
        }

        // Check and evaluate badges automatically
        if (window.Badges) Badges.evaluate(user.id);
      }

      Utils.showToast(`Focus session complete · ${durationMins} minutes`, 'success');

      this.updateDisplay();
      this.updateControls();
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
    const durationValue = document.getElementById('reactorDurationValue');

    if (timeEl) {
      const nextTime = Utils.formatTime(this.remainingSeconds);
      if (timeEl.textContent !== nextTime) {
        timeEl.textContent = nextTime;
        const reduceMotion = document.documentElement.dataset.motion === 'off' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (!reduceMotion && typeof timeEl.animate === 'function') {
          timeEl.animate([{ opacity: .82, transform: 'translateY(2px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 150, easing: 'ease-out' });
        }
      }
    }
    if (durationValue) durationValue.textContent = Math.round(this.totalDurationSeconds / 60);

    if (labelEl) {
      labelEl.textContent = this.mode === 'focus' ? this.courseName : this.mode === 'long-break' ? 'Long recovery break' : 'Short recovery break';
    }

    if (statusTextEl) {
      if (this.status === 'idle') statusTextEl.textContent = this.isBreakMode() ? 'Ready for a pause' : 'Ready when you are';
      else if (this.status === 'activating') statusTextEl.textContent = 'Settling in';
      else if (this.status === 'paused') statusTextEl.textContent = 'Paused';
      else if (this.status === 'complete') statusTextEl.textContent = this.isBreakMode() ? 'Break complete' : 'Session complete';
      else if (this.isBreakMode()) statusTextEl.textContent = 'Take a breather';
      else statusTextEl.textContent = 'In focus';
    }

    const progressBar = document.getElementById('reactorProgressBar');
    const progressTrack = progressBar?.parentElement;
    if (progressBar && this.totalDurationSeconds > 0) {
      const progressFraction = (this.totalDurationSeconds - this.remainingSeconds) / this.totalDurationSeconds;
      const percent = Math.max(0, Math.min(100, progressFraction * 100));
      progressBar.style.width = `${percent}%`;
      progressTrack?.setAttribute('aria-valuenow', String(Math.round(percent)));
    }
    const stage = document.getElementById('reactorStage');
    if (stage) stage.classList.toggle('state-recovery', this.isBreakMode());
    const breakNote = document.getElementById('timerBreakNote');
    if (breakNote) breakNote.hidden = !(this.status === 'complete' && !this.isBreakMode());
    const breakSuggestion = document.getElementById('timerBreakSuggestion');
    if (breakSuggestion && this.status === 'complete' && !this.isBreakMode()) {
      const count = Storage.getUserItems(STORAGE_KEYS.SESSIONS).filter(session => session.status === 'completed' && session.dateStr === Utils.getLocalDateString()).length;
      breakSuggestion.textContent = count >= 4 ? `${count} focus sessions completed today. A longer recovery break may feel right before your next block.` : 'Your focus session is complete. Take a moment to reset before your next study block.';
    }
    this.updateDailySummary();

    // Update Document Title
    const modePrefix = this.mode === 'focus' ? '⚡ Focus' : '☕ Break';
    document.title = this.status === 'running' 
      ? `(${Utils.formatTime(this.remainingSeconds)}) ${modePrefix} - FocusPulse`
      : 'Focus Timer · FocusPulse';
  },

  updateDailySummary() {
    const user = Storage.getCurrentUser();
    const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []).filter(session => session.userId === user?.id && session.status === 'completed' && session.dateStr === Utils.getLocalDateString());
    const count = document.getElementById('stopwatchSessions');
    if (count) count.textContent = sessions.length;
    const progress = Goals.getTodayProgress();
    const goal = document.getElementById('stopwatchGoal');
    if (goal) goal.textContent = `${progress.completed} / ${progress.target}`;
  },

  updateModeLabels(prefs = this.getDurationPreferences()) {
    const focusBtn = document.getElementById('focusModeBtn');
    const breakBtn = document.getElementById('breakModeBtn');
    const longBreakBtn = document.getElementById('longBreakModeBtn');
    if (focusBtn) focusBtn.textContent = `Focus · ${prefs.focusDuration || 25} min`;
    if (breakBtn) breakBtn.textContent = `Short break · ${prefs.breakDuration || 5} min`;
    if (longBreakBtn) longBreakBtn.textContent = `Long break · ${prefs.longBreakDuration || 15} min`;
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

    if (this.status === 'activating') {
      startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';
      if (skipBreakBtn) skipBreakBtn.style.display = 'none';
      return;
    }

    if (this.status === 'idle' || this.status === 'complete') {
      startBtn.style.display = 'inline-flex';
      const startLabel = startBtn.querySelector('span');
      if (startLabel) startLabel.textContent = this.status === 'complete' && !this.isBreakMode() ? 'Start another focus session' : this.isBreakMode() ? 'Start break' : 'Start session';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (skipBreakBtn) skipBreakBtn.style.display = 'none';
      const breakAction = document.getElementById('btnStartBreakFromComplete');
      if (breakAction) breakAction.style.display = this.status === 'complete' && !this.isBreakMode() ? 'inline-flex' : 'none';
      const longBreakAction = document.getElementById('btnStartLongBreakFromComplete');
      if (longBreakAction) longBreakAction.style.display = this.status === 'complete' && !this.isBreakMode() ? 'inline-flex' : 'none';
      const nextAction = document.getElementById('btnNextFocusSession');
      if (nextAction) nextAction.style.display = this.status === 'complete' && !this.isBreakMode() ? 'inline-flex' : 'none';
    } else if (this.status === 'running') {
      startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'inline-flex';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = !this.isBreakMode() ? 'inline-flex' : 'none';
      if (skipBreakBtn) skipBreakBtn.style.display = this.isBreakMode() ? 'inline-flex' : 'none';
      document.getElementById('btnStartBreakFromComplete')?.style.setProperty('display','none');
      document.getElementById('btnStartLongBreakFromComplete')?.style.setProperty('display','none');
      document.getElementById('btnNextFocusSession')?.style.setProperty('display','none');
    } else if (this.status === 'paused') {
      startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'inline-flex';
      if (cancelBtn) cancelBtn.style.display = !this.isBreakMode() ? 'inline-flex' : 'none';
      if (skipBreakBtn) skipBreakBtn.style.display = this.isBreakMode() ? 'inline-flex' : 'none';
      document.getElementById('btnStartBreakFromComplete')?.style.setProperty('display','none');
      document.getElementById('btnStartLongBreakFromComplete')?.style.setProperty('display','none');
      document.getElementById('btnNextFocusSession')?.style.setProperty('display','none');
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
      objective: this.objective || '',
      plannedSessionId: this.plannedSessionId || null,
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
    this.objective = state.objective || '';
    this.plannedSessionId = state.plannedSessionId || null;
    const objectiveInput = document.getElementById('timerObjective');
    if (objectiveInput) objectiveInput.value = this.objective;
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
    document.addEventListener('keydown', event => {
      const tag=event.target?.tagName?.toLowerCase();
      if(event.altKey&&event.shiftKey&&event.key.toLowerCase()==='s'&&!['input','textarea','select'].includes(tag)){
        event.preventDefault();if(this.status==='running')this.pause();else if(this.status==='paused')this.resume();else{const select=document.getElementById('reactorCourseSelect');if(this.isBreakMode())this.startBreak();else this.startFocus(select?.value||null,select?.selectedOptions[0]?.text||'Independent study')}
      }
    });
    window.addEventListener('beforeunload', () => {
      if (this.status === 'running' || this.status === 'paused' || this.status === 'activating') {
        this.persistTimerState();
      }
    });

    document.getElementById('btnDecreaseDuration')?.addEventListener('click', () => this.adjustDuration(-5));
    document.getElementById('btnIncreaseDuration')?.addEventListener('click', () => this.adjustDuration(5));
    document.getElementById('btnResetTimer')?.addEventListener('click', () => this.resetTimer());

    // Start Focus
    const startBtn = document.getElementById('btnStartReactor');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const select = document.getElementById('reactorCourseSelect');
        const courseId = select ? select.value : null;
        const courseName = select && select.selectedOptions[0] ? select.selectedOptions[0].text : 'General Study';
        if (this.isBreakMode()) this.startBreak();
        else this.startFocus(courseId, courseName);
      });
    }

    document.querySelectorAll('.reactor-mode-btn').forEach(button => {
      button.addEventListener('click', () => {
        if (!['idle', 'complete'].includes(this.status)) {
          Utils.showToast('Finish the current session before switching timer modes.', 'warning');
          return;
        }
        this.mode = ['break','long-break'].includes(button.dataset.mode) ? button.dataset.mode : 'focus';
        document.querySelectorAll('.reactor-mode-btn').forEach(btn => btn.classList.toggle('active', btn === button));
        const prefs = this.getDurationPreferences();
        const duration = this.mode === 'long-break' ? (prefs.longBreakDuration || 15) : this.mode === 'break' ? (prefs.breakDuration || 5) : (prefs.focusDuration || 25);
        this.totalDurationSeconds = duration * 60;
        this.remainingSeconds = this.totalDurationSeconds;
        this.updateModeLabels(prefs);
        this.updateDisplay();
      });
    });

    document.getElementById('timerObjective')?.addEventListener('input', event => {
      this.objective = event.target.value.slice(0,120);
      if (this.status === 'running' || this.status === 'paused') this.persistTimerState();
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

    document.getElementById('btnStartBreakFromComplete')?.addEventListener('click', () => { this.mode = 'break'; this.startBreak(); });
    document.getElementById('btnStartLongBreakFromComplete')?.addEventListener('click', () => { this.mode = 'long-break'; this.startBreak(); });
    document.getElementById('btnNextFocusSession')?.addEventListener('click', () => {
      const select = document.getElementById('reactorCourseSelect');
      this.startFocus(select?.value || null, select?.selectedOptions[0]?.text || 'Independent study');
    });

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
        const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, {}); prefs.soundEnabled = this.soundEnabled; Storage.saveData(STORAGE_KEYS.PREFERENCES, prefs);
        soundBtn.classList.toggle('active', this.soundEnabled);
        soundBtn.textContent = this.soundEnabled ? 'Completion chime on' : 'Sounds off';
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
