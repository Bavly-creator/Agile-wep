/**
 * FocusPulse - Badges & Achievements Module
 * Implements S18: Badges for streak milestones (3-day, 7-day, 30-day) & productivity.
 * Evaluates conditions automatically, prevents duplicates, and triggers unlock notifications.
 */

const Badges = {
  getAll() {
    return Storage.getData(STORAGE_KEYS.BADGES, []);
  },

  // S18: Automatically evaluate and award badges for the user
  evaluate(userId) {
    if (!userId) {
      const user = Storage.getCurrentUser();
      if (!user) return [];
      userId = user.id;
    }

    const badges = this.getAll();
    const streakData = Streaks.calculate();
    const historySummary = History.getSummaryStats();
    const userGroups = Groups.getUserGroups();
    const newUnlocked = [];

    badges.forEach(badge => {
      if (badge.unlocked) return; // Already unlocked

      let shouldUnlock = false;

      switch (badge.id) {
        case 'bdg_first_session':
          if (historySummary.totalCompletedSessions >= 1) shouldUnlock = true;
          break;
        case 'bdg_streak_3':
          if (streakData.currentStreak >= 3 || streakData.longestStreak >= 3) shouldUnlock = true;
          break;
        case 'bdg_streak_7':
          if (streakData.currentStreak >= 7 || streakData.longestStreak >= 7) shouldUnlock = true;
          break;
        case 'bdg_streak_30':
          if (streakData.currentStreak >= 30 || streakData.longestStreak >= 30) shouldUnlock = true;
          break;
        case 'bdg_century':
          if (historySummary.totalCompletedMinutes >= 100) shouldUnlock = true;
          break;
        case 'bdg_team':
          if (userGroups.length > 0) shouldUnlock = true;
          break;
      }

      if (shouldUnlock) {
        badge.unlocked = true;
        badge.unlockedAt = Utils.getLocalDateString();
        newUnlocked.push(badge);

        // Toast notification for achievement unlocked!
        Utils.showToast(`🏆 Achievement Unlocked: ${badge.title}!`, 'success', 4500);
      }
    });

    if (newUnlocked.length > 0) {
      Storage.saveData(STORAGE_KEYS.BADGES, badges);
    }

    return badges;
  }
};
