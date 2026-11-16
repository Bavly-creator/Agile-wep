/** FocusPulse guest entry and server-backed account authentication. */
const Auth = {
  apiBase: '/api/auth',

  isLoggedIn() { return Boolean(Storage.getCurrentUser()); },

  async requireAuth() {
    const user = Storage.getCurrentUser();
    if (user?.isGuest) return true;
    if (user && !user.isGuest) {
      const result = await this.request('/me', { method: 'GET' });
      if (result.success && result.user) { Storage.setCurrentUser(result.user); return true; }
      Storage.clearUserSession();
    }
    window.location.replace('index.html');
    return false;
  },

  async redirectIfAuth() {
    const user = Storage.getCurrentUser();
    if (user?.isGuest) { window.location.replace('dashboard.html'); return; }
    if (user && !user.isGuest) {
      const result = await this.request('/me', { method: 'GET' });
      if (result.success && result.user) window.location.replace('dashboard.html');
      else Storage.clearUserSession();
    }
  },

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const csrf = document.cookie.split('; ').find(cookie => cookie.startsWith('fp_csrf='))?.split('=').slice(1).join('=');
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    let response;
    try {
      response = await fetch(`${this.apiBase}${path}`, { credentials: 'same-origin', ...options, headers });
    } catch {
      return { success: false, message: 'FocusPulse account service is unavailable. You can still continue as a guest.' };
    }
    const result = await response.json().catch(() => ({}));
    return response.ok ? { success: true, ...result } : { success: false, ...result, message: result.message || 'Something went wrong. Please try again.' };
  },

  startGuestSession() {
    const previous = Storage.getCurrentUser();
    const user = { id: 'guest_local', name: 'Guest Student', role: 'Guest', avatar: 'GS', isGuest: true, createdAt: Utils.getLocalDateString() };
    const keys = [STORAGE_KEYS.COURSES, STORAGE_KEYS.SESSIONS, STORAGE_KEYS.GROUPS, STORAGE_KEYS.BADGES, STORAGE_KEYS.DISTRACTIONS, STORAGE_KEYS.TASKS, STORAGE_KEYS.PLANNER_EVENTS, STORAGE_KEYS.NOTES, STORAGE_KEYS.EXAMS];
    keys.forEach(key => {
      const rows = Storage.getData(key, []);
      if (!Array.isArray(rows)) return;
      const migrated = rows.map(row => {
        if (!row.userId || row.userId === previous?.id || row.userId === 'usr_demo_01') return { ...row, userId: user.id, ...(Array.isArray(row.members) ? { members: row.members.map(member => member.id === previous?.id || member.id === 'usr_demo_01' ? { ...member, id: user.id, name: user.name, role: 'Team Lead / Creator' } : member) } : {}) };
        return row;
      });
      Storage.saveData(key, migrated);
    });
    const availability = Storage.getData(STORAGE_KEYS.STUDY_AVAILABILITY, {});
    if (previous?.id && availability[previous.id]) { availability[user.id] = availability[previous.id]; delete availability[previous.id]; Storage.saveData(STORAGE_KEYS.STUDY_AVAILABILITY, availability); }
    const oldUsers = Storage.getData(STORAGE_KEYS.USERS, []);
    if (Array.isArray(oldUsers)) Storage.saveData(STORAGE_KEYS.USERS, oldUsers.map(({ password, ...userRecord }) => userRecord));
    Storage.setCurrentUser(user);
    window.location.href = 'dashboard.html';
  },

  async register(email, password, confirmPassword) {
    if (password !== confirmPassword) return { success: false, message: 'The passwords do not match.' };
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return { success: false, message: 'Use at least 10 characters, including uppercase, lowercase, and a number.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { success: false, message: 'Enter a valid email address.' };
    return this.request('/register', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
  },

  async login(email, password) {
    const result = await this.request('/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
    if (result.success && result.user) {
      const previous = Storage.getCurrentUser();
      if (previous?.isGuest) {
        [STORAGE_KEYS.COURSES, STORAGE_KEYS.SESSIONS, STORAGE_KEYS.GROUPS, STORAGE_KEYS.BADGES, STORAGE_KEYS.DISTRACTIONS, STORAGE_KEYS.TASKS, STORAGE_KEYS.PLANNER_EVENTS, STORAGE_KEYS.NOTES, STORAGE_KEYS.EXAMS].forEach(key => {
          const records = Storage.getData(key, []);
          if (!Array.isArray(records)) return;
          Storage.saveData(key, records.map(record => record.userId === previous.id ? { ...record, userId: result.user.id, ...(Array.isArray(record.members) ? { members: record.members.map(member => member.id === previous.id ? { ...member, id: result.user.id, name: result.user.name, role: 'Team Lead / Creator' } : member) } : {}) } : record));
        });
        const goals = Storage.getData(STORAGE_KEYS.GOALS, {});
        if (goals[previous.id]) { goals[result.user.id] = goals[previous.id]; delete goals[previous.id]; Storage.saveData(STORAGE_KEYS.GOALS, goals); }
        const availability = Storage.getData(STORAGE_KEYS.STUDY_AVAILABILITY, {});
        if (availability[previous.id]) { availability[result.user.id] = availability[previous.id]; delete availability[previous.id]; Storage.saveData(STORAGE_KEYS.STUDY_AVAILABILITY, availability); }
      }
      Storage.setCurrentUser(result.user);
    }
    return result;
  },

  async logout() {
    await this.request('/logout', { method: 'POST', body: '{}' });
    Storage.clearUserSession();
    window.location.href = 'index.html';
  },

  async resetPassword(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { success: false, message: 'Enter a valid email address.' };
    return this.request('/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
  },

  async completePasswordReset(token, password, confirmPassword) {
    if (password !== confirmPassword) return { success: false, message: 'The passwords do not match.' };
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return { success: false, message: 'Use at least 10 characters, including uppercase, lowercase, and a number.' };
    return this.request('/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
  }
};
