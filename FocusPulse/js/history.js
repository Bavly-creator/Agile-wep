/**
 * FocusPulse - History Module
 * Implements S08: Daily log of focus minutes per course (5 points).
 * Provides grouping by date, course filtering, and status distinction (Completed vs Interrupted).
 */

const History = {
  // Get all session logs for the current user
  getSessions(courseFilter = 'all', statusFilter = 'all') {
    const user = Storage.getCurrentUser();
    if (!user) return [];

    let sessions = Storage.getData(STORAGE_KEYS.SESSIONS, [])
      .filter(s => s.userId === user.id)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)); // latest first

    if (courseFilter !== 'all') {
      sessions = sessions.filter(s => s.courseId === courseFilter);
    }

    if (statusFilter !== 'all') {
      sessions = sessions.filter(s => s.status === statusFilter);
    }

    return sessions;
  },

  // Group focus minutes by course for a given date
  getDailyCourseBreakdown(dateStr = Utils.getLocalDateString()) {
    const user = Storage.getCurrentUser();
    if (!user) return {};

    const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []).filter(s => 
      s.userId === user.id && 
      s.dateStr === dateStr && 
      s.status === 'completed'
    );

    const breakdown = {};
    sessions.forEach(s => {
      const course = s.courseName || 'General';
      breakdown[course] = (breakdown[course] || 0) + (s.durationMinutes || 0);
    });

    return breakdown;
  },

  // Calculate overall summary metrics
  getSummaryStats() {
    const user = Storage.getCurrentUser();
    if (!user) return { totalCompletedMinutes: 0, totalCompletedSessions: 0, interruptedCount: 0 };

    const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []).filter(s => s.userId === user.id);
    let totalCompletedMinutes = 0;
    let totalCompletedSessions = 0;
    let interruptedCount = 0;

    sessions.forEach(s => {
      if (s.status === 'completed') {
        totalCompletedMinutes += (s.durationMinutes || 0);
        totalCompletedSessions++;
      } else if (s.status === 'interrupted') {
        interruptedCount++;
      }
    });

    return {
      totalCompletedMinutes,
      totalCompletedSessions,
      interruptedCount
    };
  }
};
