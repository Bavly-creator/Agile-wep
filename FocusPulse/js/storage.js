/**
 * FocusPulse - Storage Module (Vanilla JavaScript)
 * Safely manages client-side persistence in localStorage.
 * Handles schema validation, corrupt data fallback, and initial demo seed data.
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
  NOTES: 'focuspulse_notes'
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
    return this.getCurrentUser()?.id || 'usr_demo_01';
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

  // Seed default demonstration data if workspace is clean
  initDemoData() {
    // 1. Seed Demo User
    let users = this.getData(STORAGE_KEYS.USERS, []);
    if (!users || users.length === 0) {
      const demoUser = {
        id: 'usr_demo_01',
        name: 'Bavly Romany',
        email: 'bavly@focuspulse.io',
        password: 'password123',
        role: 'Student / Product Owner',
        avatar: 'BR',
        createdAt: '2026-11-01'
      };
      users = [demoUser];
      this.saveData(STORAGE_KEYS.USERS, users);
      this.setCurrentUser(demoUser);
    }

    const currentUserId = this.getCurrentUser()?.id || 'usr_demo_01';

    // 2. Seed Default Courses
    let courses = this.getData(STORAGE_KEYS.COURSES, null);
    if (!courses) {
      courses = [
        { id: 'crs_1', userId: currentUserId, name: 'Agile Software Engineering', code: 'SET 312', icon: '⚡', color: '#8b5cf6', description: 'Scrum ceremonies, TDD, CI/CD, and agile methodologies.', targetMinutes: 600, isArchived: false, createdAt: '2026-11-01' },
        { id: 'crs_2', userId: currentUserId, name: 'Data Structures & Algorithms', code: 'CS 204', icon: '💻', color: '#42d9f5', description: 'Balanced trees, graph algorithms, and asymptotic complexity.', targetMinutes: 450, isArchived: false, createdAt: '2026-11-01' },
        { id: 'crs_3', userId: currentUserId, name: 'Cloud Computing Architecture', code: 'IT 405', icon: '🌐', color: '#10b981', description: 'Microservices, Docker containerization, and AWS serverless.', targetMinutes: 300, isArchived: false, createdAt: '2026-11-01' },
        { id: 'crs_4', userId: currentUserId, name: 'Human-Computer Interaction', code: 'SE 320', icon: '🎨', color: '#f59e0b', description: 'UI/UX heuristics, usability testing, and accessibility.', targetMinutes: 200, isArchived: false, createdAt: '2026-11-01' }
      ];
      this.saveData(STORAGE_KEYS.COURSES, courses);
    }

    // 3. Seed Default Goals
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

    // 4. Seed Historical Focus Sessions (for instant realistic stats & streak)
    let sessions = this.getData(STORAGE_KEYS.SESSIONS, null);
    if (!sessions) {
      // Calculate consecutive days leading up to today
      const today = new Date();
      sessions = [];

      const makeDateStr = (daysAgo) => {
        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      // 3 days ago (completed 4 sessions to build streak)
      for (let i = 0; i < 4; i++) {
        sessions.push({
          id: `sess_3_${i}`,
          userId: currentUserId,
          courseId: 'crs_1',
          courseName: 'Agile Software Engineering',
          durationMinutes: 25,
          completedAt: `${makeDateStr(3)}T10:${15 + i * 30}:00`,
          dateStr: makeDateStr(3),
          status: 'completed',
          notes: 'Covered Sprint Planning & Backlog'
        });
      }

      // 2 days ago (completed 4 sessions)
      for (let i = 0; i < 4; i++) {
        sessions.push({
          id: `sess_2_${i}`,
          userId: currentUserId,
          courseId: 'crs_2',
          courseName: 'Data Structures & Algorithms',
          durationMinutes: 25,
          completedAt: `${makeDateStr(2)}T14:${10 + i * 30}:00`,
          dateStr: makeDateStr(2),
          status: 'completed',
          notes: 'Balanced Tree implementations'
        });
      }

      // Yesterday (completed 4 sessions)
      for (let i = 0; i < 4; i++) {
        sessions.push({
          id: `sess_1_${i}`,
          userId: currentUserId,
          courseId: 'crs_1',
          courseName: 'Agile Software Engineering',
          durationMinutes: 25,
          completedAt: `${makeDateStr(1)}T16:${20 + i * 30}:00`,
          dateStr: makeDateStr(1),
          status: 'completed',
          notes: 'User Story Acceptance Criteria'
        });
      }

      // Today (completed 2 sessions so far, 2 remaining to hit goal!)
      sessions.push({
        id: `sess_0_0`,
        userId: currentUserId,
        courseId: 'crs_3',
        courseName: 'Cloud Computing Architecture',
        durationMinutes: 25,
        completedAt: `${makeDateStr(0)}T09:30:00`,
        dateStr: makeDateStr(0),
        status: 'completed',
        notes: 'Containerization & Dockerfile'
      });
      sessions.push({
        id: `sess_0_1`,
        userId: currentUserId,
        courseId: 'crs_1',
        courseName: 'Agile Software Engineering',
        durationMinutes: 25,
        completedAt: `${makeDateStr(0)}T11:00:00`,
        dateStr: makeDateStr(0),
        status: 'completed',
        notes: 'Focus Reactor UI Wireframe'
      });

      this.saveData(STORAGE_KEYS.SESSIONS, sessions);
    }

    // 5. Seed Study Groups (Epic 4)
    let groups = this.getData(STORAGE_KEYS.GROUPS, null);
    if (!groups) {
      groups = [
        {
          id: 'grp_01',
          name: 'ECU Team 7 - FocusPulse',
          code: 'FP-7712',
          creatorId: currentUserId,
          createdAt: '2026-11-05',
          description: 'Official Agile study group for Team 7 members.',
          weeklyChallengeTarget: 1200, // 1200 minutes
          members: [
            { id: currentUserId, name: 'Bavly Romany', role: 'Product Owner', weeklyMinutes: 350 },
            { id: 'm_2', name: 'Nicole Aziz', role: 'Scrum Master', weeklyMinutes: 275 },
            { id: 'm_3', name: 'Mina Ehab', role: 'Developer', weeklyMinutes: 250 },
            { id: 'm_4', name: 'David Gerges', role: 'Developer', weeklyMinutes: 200 },
            { id: 'm_5', name: 'David Albert', role: 'Developer', weeklyMinutes: 175 }
          ]
        }
      ];
      this.saveData(STORAGE_KEYS.GROUPS, groups);
    }

    // 6. Seed Badges (Epic 5)
    let badges = this.getData(STORAGE_KEYS.BADGES, null);
    if (!badges) {
      badges = [
        { id: 'bdg_first_session', title: 'First Spark', description: 'Completed your first 25-minute Pomodoro session.', icon: '⚡', unlocked: true, unlockedAt: '2026-11-01' },
        { id: 'bdg_streak_3', title: 'Momentum Builder', description: 'Achieved a consecutive 3-day study streak.', icon: '🔥', unlocked: true, unlockedAt: '2026-11-12' },
        { id: 'bdg_streak_7', title: 'Unstoppable Habit', description: 'Achieved a consecutive 7-day study streak.', icon: '🌟', unlocked: false, unlockedAt: null },
        { id: 'bdg_streak_30', title: 'Master of Focus', description: 'Maintained a 30-day streak of excellence.', icon: '👑', unlocked: false, unlockedAt: null },
        { id: 'bdg_century', title: 'Century Club', description: 'Accumulated over 100 minutes of pure focus time.', icon: '💯', unlocked: true, unlockedAt: '2026-11-02' },
        { id: 'bdg_team', title: 'Synergy Partner', description: 'Joined a collaborative study group.', icon: '🤝', unlocked: true, unlockedAt: '2026-11-05' }
      ];
      this.saveData(STORAGE_KEYS.BADGES, badges);
    }

    // 7. Seed Distractions (S19)
    let distractions = this.getData(STORAGE_KEYS.DISTRACTIONS, null);
    if (!distractions) {
      distractions = [
        { id: 'dst_1', userId: currentUserId, timestamp: new Date().toISOString(), category: 'Social Media', text: 'Checked Discord notification on phone.' },
        { id: 'dst_2', userId: currentUserId, timestamp: new Date().toISOString(), category: 'Noise', text: 'Hallway chatter outside study room.' }
      ];
      this.saveData(STORAGE_KEYS.DISTRACTIONS, distractions);
    }

    // 8. Seed Preferences
    let prefs = this.getData(STORAGE_KEYS.PREFERENCES, null);
    if (!prefs) {
      prefs = {
        theme: 'dark',
        soundEnabled: true,
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
  }
};

// Initialize seed data automatically on load
Storage.initDemoData();
