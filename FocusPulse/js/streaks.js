/**
 * FocusPulse - Streaks Module
 * Implements S06 (Current streak), S09 (Streak reset on missed day), S16 (Local timezone & midnight).
 * Accurately analyzes consecutive local calendar dates where the daily goal was met.
 */

const Streaks = {
  /**
   * Calculates current streak and longest streak for the current user.
   * A day counts towards the streak ONLY if completed focus sessions >= daily goal for that day.
   * If a calendar day was missed between the last qualifying day and today/yesterday, current streak resets to 0.
   */
  calculate() {
    const user = Storage.getCurrentUser();
    if (!user) return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, isGoalMetToday: false };

    const targetGoal = Goals.getDailyGoal();
    const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []).filter(s => s.userId === user.id && s.status === 'completed');

    // Group completed sessions count by local date string
    const countsByDate = {};
    sessions.forEach(s => {
      const d = s.dateStr || Utils.getLocalDateString(s.completedAt);
      countsByDate[d] = (countsByDate[d] || 0) + 1;
    });

    // Find all qualifying dates (where sessions >= daily goal)
    const qualifyingDates = Object.keys(countsByDate)
      .filter(dateStr => countsByDate[dateStr] >= targetGoal)
      .sort(); // ascending date order

    if (qualifyingDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, isGoalMetToday: false };
    }

    const todayStr = Utils.getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = Utils.getLocalDateString(yesterday);

    const isGoalMetToday = countsByDate[todayStr] >= targetGoal;
    const isGoalMetYesterday = countsByDate[yesterdayStr] >= targetGoal;

    // S09: Check if current streak is alive.
    // If goal was met today, streak is alive. If not met today BUT met yesterday, streak is alive (today is still in progress).
    // If missed yesterday AND not met today, the consecutive streak is broken (resets to 0).
    let currentStreak = 0;
    let longestStreak = 0;

    // Helper to calculate day difference between two YYYY-MM-DD dates
    const diffDays = (d1Str, d2Str) => {
      const d1 = new Date(d1Str);
      const d2 = new Date(d2Str);
      const diffTime = Math.abs(d2 - d1);
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    };

    // Calculate historical streaks
    let tempStreak = 1;
    longestStreak = 1;

    for (let i = 1; i < qualifyingDates.length; i++) {
      const prev = qualifyingDates[i - 1];
      const curr = qualifyingDates[i];
      if (diffDays(prev, curr) === 1) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 1;
      }
    }

    // Determine current active streak
    const lastQualifying = qualifyingDates[qualifyingDates.length - 1];
    if (lastQualifying === todayStr || lastQualifying === yesterdayStr) {
      // Trace backwards from lastQualifying
      currentStreak = 1;
      let checkDate = new Date(lastQualifying);
      
      for (let i = qualifyingDates.length - 2; i >= 0; i--) {
        const prevDate = new Date(qualifyingDates[i]);
        checkDate.setDate(checkDate.getDate() - 1);
        const expectedStr = Utils.getLocalDateString(checkDate);

        if (qualifyingDates[i] === expectedStr) {
          currentStreak++;
        } else {
          break;
        }
      }
    } else {
      // S09: A calendar day was missed! Reset streak to 0.
      currentStreak = 0;
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      lastActiveDate: lastQualifying,
      isGoalMetToday
    };
  }
};
