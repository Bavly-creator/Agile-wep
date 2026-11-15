/**
 * FocusPulse - Goals Module
 * Implements S05: Set daily goal (between 1 and 12 focus sessions).
 * Tracks today's completed sessions against the user's active goal.
 */

const Goals = {
  // Get active daily goal for current user (defaults to 4 sessions = 100 min)
  getDailyGoal() {
    const user = Storage.getCurrentUser();
    if (!user) return 4;

    const allGoals = Storage.getData(STORAGE_KEYS.GOALS, {});
    const userGoal = allGoals[user.id];
    return userGoal ? userGoal.dailySessionsGoal : 4;
  },

  // Set goal between 1 and 12 sessions
  setDailyGoal(sessionsCount) {
    const user = Storage.getCurrentUser();
    if (!user) return { success: false, message: 'User not logged in.' };

    sessionsCount = parseInt(sessionsCount, 10);
    if (isNaN(sessionsCount) || sessionsCount < 1 || sessionsCount > 12) {
      return { success: false, message: 'Daily goal must be between 1 and 12 sessions.' };
    }

    const allGoals = Storage.getData(STORAGE_KEYS.GOALS, {});
    allGoals[user.id] = {
      dailySessionsGoal: sessionsCount,
      updatedAt: new Date().toISOString()
    };

    Storage.saveData(STORAGE_KEYS.GOALS, allGoals);
    return { success: true, goal: sessionsCount };
  },

  // Calculate today's completed focus sessions
  getTodayProgress() {
    const user = Storage.getCurrentUser();
    if (!user) return { completed: 0, target: 4, percentage: 0, isMet: false, remaining: 4 };

    const todayStr = Utils.getLocalDateString();
    const allSessions = Storage.getData(STORAGE_KEYS.SESSIONS, []);

    // Filter sessions completed by current user today
    const todaySessions = allSessions.filter(s => 
      s.userId === user.id && 
      s.dateStr === todayStr && 
      s.status === 'completed'
    );

    const completed = todaySessions.length;
    const target = this.getDailyGoal();
    const percentage = Math.min(100, Math.round((completed / target) * 100));
    const isMet = completed >= target;
    const remaining = Math.max(0, target - completed);

    return {
      completed,
      target,
      percentage,
      isMet,
      remaining
    };
  }
};
