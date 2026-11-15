/**
 * FocusPulse - Challenges Module
 * Implements S14: Weekly group challenge (5 points).
 * Tracks cumulative weekly focus progress against target with visual celebration state.
 */

const Challenges = {
  // Get active challenges for the current user's groups
  getActiveChallenges() {
    const userGroups = Groups.getUserGroups();
    return userGroups.map(group => {
      const stats = Groups.getWeeklyStats(group.id);
      const target = stats.targetMinutes || 1200;
      const progress = stats.totalMinutes || 0;
      const percentage = Math.min(100, Math.round((progress / target) * 100));
      const isCompleted = progress >= target;
      const remaining = Math.max(0, target - progress);

      return {
        groupId: group.id,
        groupName: group.name,
        targetMinutes: target,
        currentMinutes: progress,
        percentage: percentage,
        isCompleted: isCompleted,
        remainingMinutes: remaining,
        topContributors: stats.members.slice(0, 3)
      };
    });
  }
};
