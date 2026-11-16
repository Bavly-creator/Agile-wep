/**
 * FocusPulse - Global App Controller
 * Manages theme switching, responsive sidebar navigation, user headers, and global events.
 */

const App = {
  init() {
    this.applyTheme();
    this.setupUserUI();
    this.setupNavigation();
    this.setupQuickCapture();
    this.bindGlobalEvents();
  },

  // --------------------------------------------------------------------------
    // 1. Theme Management (Forest, Sage & Cream)
  // --------------------------------------------------------------------------
  applyTheme() {
    const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, { theme: 'light' });
    let currentTheme = prefs.theme || 'light';

    // Support system preference if set to 'system'
    if (currentTheme === 'system') {
      currentTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', currentTheme);
    const motionOff = prefs.reduceMotion || prefs.animationsEnabled === false || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    document.documentElement.setAttribute('data-motion', motionOff ? 'off' : 'on');

    const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
    themeToggleBtns.forEach(btn => {
      btn.innerHTML = currentTheme === 'dark' 
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="transform: rotate(0deg); transition: transform 0.4s ease;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="transform: rotate(360deg); transition: transform 0.4s ease;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      btn.setAttribute('title', currentTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  },

  toggleTheme() {
    const prefs = Storage.getData(STORAGE_KEYS.PREFERENCES, { theme: 'light' });
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    prefs.theme = current === 'dark' ? 'light' : 'dark';
    Storage.saveData(STORAGE_KEYS.PREFERENCES, prefs);
    this.applyTheme();
    Utils.showToast(`Switched to ${prefs.theme === 'dark' ? 'Sage & Paper dark' : 'Sage & Paper light'} mode`, 'info');
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
    if (user.isGuest && roleEl) roleEl.textContent = 'Guest · this device';
    if (user.isGuest) {
      const footer = document.querySelector('.sidebar-footer');
      if (footer && !footer.querySelector('.guest-upgrade-link')) {
        const link = document.createElement('a'); link.href = 'register.html'; link.className = 'guest-upgrade-link';
        link.textContent = 'Create an account'; link.setAttribute('aria-label','Create an account to keep your study workspace');
        footer.append(link);
      }
    }

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
    const workspaceNav = document.querySelector('.workspace-nav');
    if (workspaceNav) {
      workspaceNav.innerHTML = [
        ['Workspace', [['⌂','Dashboard','dashboard.html'],['▣','My Courses','courses.html'],['✓','Tasks & Assignments','tasks.html'],['◷','Study Planner','planner.html'],['◉','Focus Timer','timer.html']]],
        ['Personal growth', [['↗','Progress & Statistics','insights.html'],['◌','Study Groups','groups.html'],['◇','Achievements','badges.html'],['✎','My Notes','notes.html']]],
        ['Additional tool', [['✦','Pulse AI','pulse-ai.html']]], ['Settings', [['⚙','Settings','settings.html']]]
      ].map(([label, links]) => `<div class="nav-section-label">${label}</div>${links.map(([icon,name,href])=>`<a href="${href}" class="${href===currentPath?'active':''}"><span aria-hidden="true">${icon}</span>${name}</a>`).join('')}`).join('');
      return;
    }
    const nav = document.querySelector('.sidebar-nav');
    if (nav) {
      const groups = [
        ['Workspace', [['dashboard.html','Dashboard','M4 4h6v6H4z M14 4h6v6h-6z M14 14h6v6h-6z M4 14h6v6H4z'],['courses.html','My Courses','M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5'],['tasks.html','Tasks & Assignments','M5 12l4 4L19 6'],['planner.html','Study Planner','M4 5h16v15H4z M8 3v4 M16 3v4 M4 10h16'],['timer.html','Focus Timer','M12 8v5l3 2 M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z']]],
        ['Personal growth', [['insights.html','Progress & Statistics','M4 19V9 M10 19V5 M16 19v-7 M22 19V3'],['groups.html','Study Groups','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8'],['badges.html','Achievements','M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z'],['notes.html','My Notes','M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5'],['history.html','Study History','M3 12a9 9 0 1 0 2.6-6.4L3 8 M3 3v5h5 M12 7v5l3 2'],['streaks.html','Study Streaks','M12 22a7 7 0 0 0 7-7c0-4-4-6-4-11-4 3-6 7-4 10-2-1-3-2-3-4-2 2-3 4-3 6a7 7 0 0 0 7 6z'],['challenges.html','Group Challenges','M12 3v18 M3 12h18']]],
        ['Additional tool', [['pulse-ai.html','Pulse AI','M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z M9 10h.01 M15 10h.01 M8 14s1 2 4 2 4-2 4-2']]],
        ['Settings', [['settings.html','Settings','M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3']]]
      ];
      nav.innerHTML = groups.map(([label, links]) => `<div class="nav-section-label">${label}</div>${links.map(([href,name,path])=>`<a href="${href}" class="nav-link ${href===currentPath?'active':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${path}" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${name}</span></a>`).join('')}`).join('');
    }
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

  setupQuickCapture() {
    const header = document.querySelector('.workspace-header, .top-navbar-right');
    if (!header) return;
    if (header && !document.getElementById('quickCaptureOpen')) {
      const button = document.createElement('button'); button.type = 'button'; button.id = 'quickCaptureOpen'; button.className = 'sage-btn quick-capture-open'; button.textContent = 'Quick capture'; button.setAttribute('aria-keyshortcuts', 'Alt+Q'); button.title = 'Quick capture (Alt+Q)';
      header.append(button);
    }
    if (document.getElementById('quickCaptureDialog')) return;
    const dialog = document.createElement('dialog'); dialog.id = 'quickCaptureDialog'; dialog.className = 'quick-capture-dialog'; dialog.setAttribute('aria-labelledby', 'quickCaptureTitle');
    dialog.innerHTML = '<form id="quickCaptureForm" class="workspace-form"><div class="quick-capture-heading"><div><p class="item-meta">Capture now, organize later</p><h2 id="quickCaptureTitle">Quick capture</h2></div><button id="quickCaptureClose" class="icon-btn" type="button" aria-label="Close quick capture">×</button></div><label>Save as<select name="kind"><option value="task">Task</option><option value="idea">Study note</option><option value="reminder">Reminder</option></select></label><label>Title<input name="title" maxlength="160" required autocomplete="off" placeholder="What do you need to remember?"></label><label>Course (optional)<select name="courseId"><option value="">No course</option></select></label><label>Date (for tasks and reminders)<input name="date" type="date"></label><label>Details (optional)<textarea name="details" rows="3" maxlength="2000" placeholder="A quick note for later"></textarea></label><div class="quick-capture-actions"><button class="sage-btn" id="quickCaptureCancel" type="button">Cancel</button><button class="sage-btn primary" type="submit">Save capture</button></div></form>';
    document.body.append(dialog);
    const courseSelect = dialog.querySelector('[name="courseId"]');
    if (courseSelect && window.Courses) Courses.getAll(false).forEach(course => { const option=document.createElement('option');option.value=course.id;option.textContent=course.name;courseSelect.append(option); });
    const open = () => { const form=document.getElementById('quickCaptureForm');form.reset();form.elements.namedItem('date').required=false;dialog.showModal();form.elements.namedItem('title').focus(); };
    document.getElementById('quickCaptureOpen')?.addEventListener('click', open);
    document.getElementById('quickCaptureClose')?.addEventListener('click', () => dialog.close());
    document.getElementById('quickCaptureCancel')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('[name="kind"]')?.addEventListener('change', event => { const dateField=dialog.querySelector('[name="date"]');dateField.required=event.target.value==='reminder';if(dateField.required&&!dateField.value)dateField.value=Utils.getLocalDateString(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();const form=event.currentTarget,data=new FormData(form),title=String(data.get('title')||'').trim(),kind=String(data.get('kind')),course=window.Courses?.getById?.(String(data.get('courseId')||'')),date=String(data.get('date')||Utils.getLocalDateString()),details=String(data.get('details')||'').trim(),id=crypto.randomUUID(),userId=Storage.getCurrentUserId();if(!title)return;
      if(kind==='task') Storage.saveUserItems(STORAGE_KEYS.TASKS,[...Storage.getUserItems(STORAGE_KEYS.TASKS),{id,userId,title,course:course?.name||'',due:date,priority:'Medium',estimatedMinutes:45,status:'open',notes:details,createdAt:new Date().toISOString()}]);
      else if(kind==='idea') Storage.saveUserItems(STORAGE_KEYS.NOTES,[...Storage.getUserItems(STORAGE_KEYS.NOTES),{id,userId,title,course:course?.name||'',body:details||title,tags:['quick capture'],pinned:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]);
      else Storage.saveUserItems(STORAGE_KEYS.PLANNER_EVENTS,[...Storage.getUserItems(STORAGE_KEYS.PLANNER_EVENTS),{id,userId,title,date:date||Utils.getLocalDateString(),type:'Personal event',courseId:course?.id||'',courseName:course?.name||'',notes:details,createdAt:new Date().toISOString()}]);
      dialog.close();Utils.showToast('Saved to your workspace.','success');
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
      if (e.altKey && e.key.toLowerCase() === 'q' && !e.repeat) { e.preventDefault(); document.getElementById('quickCaptureOpen')?.click(); }
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
