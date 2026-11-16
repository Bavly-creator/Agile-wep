/**
 * FocusPulse - Study Groups Module
 * Implements S11 (Create Group), S12 (Join with Code), S13 (Group Weekly Total).
 * Local study-group records. Group activity is calculated from locally recorded sessions.
 */

const Groups = {
  // Get all groups the current user belongs to
  getUserGroups() {
    const user = Storage.getCurrentUser();
    if (!user) return [];

    const allGroups = Storage.getData(STORAGE_KEYS.GROUPS, []);
    return allGroups.filter(g => g.members && g.members.some(m => m.id === user.id));
  },

  getGroupById(groupId) {
    const allGroups = Storage.getData(STORAGE_KEYS.GROUPS, []);
    const group = allGroups.find(g => g.id === groupId);
    return group ? { ...group, members: (group.members || []).filter(member => !String(member.id).startsWith('sim_')) } : null;
  },

  // S11: Create a study group with unique code
  create(name, description = '', targetWeeklyMinutes = 1200) {
    const user = Storage.getCurrentUser();
    if (!user) return { success: false, message: 'User not logged in.' };

    name = (name || '').trim();
    if (!name) {
      return { success: false, message: 'Group name cannot be empty.' };
    }

    // Generate unique 6-character code: e.g. "FP-7294"
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const code = `FP-${randomDigits}`;

    const newGroup = {
      id: 'grp_' + Date.now(),
      name: name,
      code: code,
      description: description || 'Collaborative study space.',
      creatorId: user.id,
      createdAt: Utils.getLocalDateString(),
      weeklyChallengeTarget: parseInt(targetWeeklyMinutes, 10) || 1200,
      members: [
        {
          id: user.id,
          name: user.name,
          role: 'Team Lead / Creator',
          weeklyMinutes: 0
        }
      ]
    };

    const allGroups = Storage.getData(STORAGE_KEYS.GROUPS, []);
    allGroups.push(newGroup);
    Storage.saveData(STORAGE_KEYS.GROUPS, allGroups);

    // Evaluate badge
    if (window.Badges) Badges.evaluate(user.id);

    return { success: true, group: newGroup };
  },

  // S12: Join study group with code
  join(code) {
    const user = Storage.getCurrentUser();
    if (!user) return { success: false, message: 'User not logged in.' };

    code = (code || '').trim().toUpperCase();
    if (!code) {
      return { success: false, message: 'Please enter an invitation code.' };
    }

    const allGroups = Storage.getData(STORAGE_KEYS.GROUPS, []);
    const group = allGroups.find(g => g.code === code);

    if (!group) {
      return { success: false, message: 'Invalid invitation code. No matching group found.' };
    }

    // Prevent duplicate membership
    const isMember = group.members.some(m => m.id === user.id);
    if (isMember) {
      return { success: false, message: 'You are already a member of this study group.' };
    }

    group.members.push({
      id: user.id,
      name: user.name,
      role: 'Member',
      weeklyMinutes: 0
    });

    Storage.saveData(STORAGE_KEYS.GROUPS, allGroups);

    // Evaluate badge
    if (window.Badges) Badges.evaluate(user.id);

    return { success: true, group: group };
  },

  // S13: Calculate group weekly total and member contributions
  getWeeklyStats(groupId) {
    const group = this.getGroupById(groupId);
    if (!group) return null;

    const weekDates = Utils.getCurrentWeekDates();
    const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []);

    // Derive each locally available member's contribution from real focus sessions.
    const updatedMembers = (group.members || []).filter(member => !String(member.id).startsWith('sim_')).map(member => {
      const weeklyMinutes = sessions.filter(session => session.userId === member.id && weekDates.includes(session.dateStr) && session.status === 'completed').reduce((sum, session) => sum + (session.durationMinutes || 0), 0);
      return { ...member, weeklyMinutes };
    });

    const totalMinutes = updatedMembers.reduce((sum, m) => sum + (m.weeklyMinutes || 0), 0);

    return {
      groupName: group.name,
      code: group.code,
      targetMinutes: group.weeklyChallengeTarget || 1200,
      totalMinutes: totalMinutes,
      members: updatedMembers.sort((a, b) => (b.weeklyMinutes || 0) - (a.weeklyMinutes || 0))
    };
  }
};
