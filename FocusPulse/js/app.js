/**
 * FocusPulse - Global App Controller
 * Manages theme switching, responsive sidebar navigation, user headers, and global events.
 */

const App = {
  init() {
    this.applyTheme();
    this.setupUserUI();
    this.setupNavigation();
    this.bindGlobalEvents();
  },

  // --------------------------------------------------------------------------
  // 1. Theme Management (Aurora Night / Cloud Light)
  // --------------------------------------------------------------------------
  applyTheme() {
    const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, { theme: 'dark' });
    let currentTheme = prefs.theme || 'dark';

    // Support system preference if set to 'system'
    if (currentTheme === 'system') {
      currentTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    document.documentElement.setAttribute('data-theme', currentTheme);

    const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
    themeToggleBtns.forEach(btn => {
      btn.innerHTML = currentTheme === 'dark' 
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="transform: rotate(0deg); transition: transform 0.4s ease;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="transform: rotate(360deg); transition: transform 0.4s ease;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      btn.setAttribute('title', currentTheme === 'dark' ? 'Switch to Cloud Light' : 'Switch to Aurora Night');
    });
  },

  toggleTheme() {
    const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, { theme: 'dark' });
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    prefs.theme = current === 'dark' ? 'light' : 'dark';
    Storage.saveData(STORAGE_KEYS.PREFERENCES, prefs);
    this.applyTheme();
    Utils.showToast(`Switched to ${prefs.theme === 'dark' ? 'Aurora Night' : 'Cloud Light'} mode`, 'info');
  },

  // --------------------------------------------------------------------------
  // 2. User Profile Display & Streak Counter in Topbar
  // --------------------------------------------------------------------------
  setupUserUI() {
    const user = Storage.getCurrentUser();
    if (!user) return;

    // Sidebar footer
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role || 'Student';
    if (avatarEl) avatarEl.textContent = user.avatar || user.name.substring(0, 2).toUpperCase();

    // Topbar streak pill
    const topStreakCount = document.getElementById('topbarStreakCount');
    if (topStreakCount && window.Streaks) {
      const streak = Streaks.calculate();
      topStreakCount.textContent = `${streak.currentStreak}d`;
    }
  },

  // --------------------------------------------------------------------------
  // 3. Navigation Highlighting
  // --------------------------------------------------------------------------
  setupNavigation() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath || (currentPath === '' && href === 'dashboard.html')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  },

  // --------------------------------------------------------------------------
  // 4. Global Event Listeners
  // --------------------------------------------------------------------------
  bindGlobalEvents() {
    // Theme toggles
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleTheme());
    });

    // Mobile sidebar toggle
    const toggleBtn = document.querySelector('.sidebar-toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Logout buttons (S10)
    document.querySelectorAll('.btn-logout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
      });
    });

    // Close modals on overlay click or Escape key
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        if (document.body.classList.contains('deep-focus-active') && window.Timer) {
          Timer.toggleDeepFocus();
        }
      }
    });
  }
};

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
