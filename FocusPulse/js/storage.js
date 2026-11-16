/**
 * FocusPulse - Storage Module (Vanilla JavaScript)
 * Safely manages client-side persistence in localStorage.
 * Handles schema validation, corrupt data fallback, and version-safe local defaults.
 */

const STORAGE_KEYS = {
  USERS: 'focuspulse_users',
  CURRENT_USER: 'focuspulse_current_user',
  COURSES: 'focuspulse_courses',
  SESSIONS: 'focuspulse_sessions',
  GOALS: 'focuspulse_goals',
  GROUPS: 'focuspulse_groups',
  BADGES: 'focuspulse_badges',
  DISTRACTIONS: 'focuspulse_distractions',
  ACTIVE_TIMER: 'focuspulse_active_timer',
  PREFERENCES: 'focuspulse_preferences',
  TASKS: 'focuspulse_tasks',
  PLANNER_EVENTS: 'focuspulse_planner_events',
  NOTES: 'focuspulse_notes',
  EXAMS: 'focuspulse_exams',
  STUDY_AVAILABILITY: 'focuspulse_study_availability'
};

const Storage = {
  // Generic safe getters and setters
  getData(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`[Storage] Error reading ${key}:`, e);
      return defaultValue;
    }
  },

  saveData(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[Storage] Error saving ${key}:`, e);
      return false;
    }
  },

  deleteData(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`[Storage] Error removing ${key}:`, e);
      return false;
    }
  },

  getCurrentUserId() {
    return this.getCurrentUser()?.id || 'guest_local';
  },

  getUserItems(key) {
    const userId = this.getCurrentUserId();
    const data = this.getData(key, []);
    return Array.isArray(data) ? data.filter(item => !item.userId || item.userId === userId) : [];
  },

  saveUserItems(key, items) {
    const userId = this.getCurrentUserId();
    const all = this.getData(key, []);
    const otherUsers = Array.isArray(all) ? all.filter(item => item.userId && item.userId !== userId) : [];
    return this.saveData(key, [...otherUsers, ...items.map(item => ({ ...item, userId }))]);
  },

  // Current session management
  getCurrentUser() {
    return this.getData(STORAGE_KEYS.CURRENT_USER, null);
  },

  setCurrentUser(user) {
    return this.saveData(STORAGE_KEYS.CURRENT_USER, user);
  },

  clearUserSession() {
    this.deleteData(STORAGE_KEYS.CURRENT_USER);
    this.deleteData(STORAGE_KEYS.ACTIVE_TIMER);
  },

  // Initialize version-safe local data without fictional student activity.
  initLocalData() {
    // Local authentication has moved to the server. Keep old records available for guest migration.
    if (!Array.isArray(this.getData(STORAGE_KEYS.USERS, []))) this.saveData(STORAGE_KEYS.USERS, []);

    const currentUserId = this.getCurrentUser()?.id || 'guest_local';

    // Ensure core collections exist while preserving existing records.
    if (!Array.isArray(this.getData(STORAGE_KEYS.COURSES, null))) this.saveData(STORAGE_KEYS.COURSES, []);

    // Set a reasonable default goal without inventing completed activity.
    let goals = this.getData(STORAGE_KEYS.GOALS, null);
    if (!goals) {
      goals = {
        [currentUserId]: {
          dailySessionsGoal: 4, // 4 Pomodoros target per day (100 min)
          updatedAt: new Date().toISOString()
        }
      };
      this.saveData(STORAGE_KEYS.GOALS, goals);
    }

    if (!Array.isArray(this.getData(STORAGE_KEYS.SESSIONS, null))) this.saveData(STORAGE_KEYS.SESSIONS, []);
    if (!Array.isArray(this.getData(STORAGE_KEYS.GROUPS, null))) this.saveData(STORAGE_KEYS.GROUPS, []);
    if (!Array.isArray(this.getData(STORAGE_KEYS.BADGES, null))) this.saveData(STORAGE_KEYS.BADGES, []);
    if (!Array.isArray(this.getData(STORAGE_KEYS.DISTRACTIONS, null))) this.saveData(STORAGE_KEYS.DISTRACTIONS, []);
    let prefs = this.getData(STORAGE_KEYS.PREFERENCES, null);
    if (!prefs) {
      prefs = {
        theme: 'system',
        longBreakDuration: 15,
        soundEnabled: true,
        startSound: true,
        pauseSound: false,
        resumeSound: false,
        breakSound: true,
        completeSound: true,
        goalSound: true,
        masterVolume: 0.3,
        animationsEnabled: true,
        reduceMotion: false,
        autoStartBreaks: true,
        focusDuration: 25,
        breakDuration: 5
      };
      this.saveData(STORAGE_KEYS.PREFERENCES, prefs);
    }

    // Empty, version-safe collections for the academic workspace modules.
    [STORAGE_KEYS.TASKS, STORAGE_KEYS.PLANNER_EVENTS, STORAGE_KEYS.NOTES].forEach(key => {
      if (!Array.isArray(this.getData(key, null))) this.saveData(key, []);
    });
    if (!Array.isArray(this.getData(STORAGE_KEYS.EXAMS, null))) this.saveData(STORAGE_KEYS.EXAMS, []);
  }
};

// Initialize seed data automatically on load
Storage.initLocalData();
