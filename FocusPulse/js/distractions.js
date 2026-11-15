/**
 * FocusPulse - Distraction Notes Module
 * Implements S19: Distraction notes (3 points).
 * Captures interruptions during sessions, categorizes them, and provides reflective history.
 */

const Distractions = {
  getAll() {
    const user = Storage.getCurrentUser();
    if (!user) return [];
    const list = Storage.getData(STORAGE_KEYS.DISTRACTIONS, []);
    return list.filter(d => d.userId === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  add(text, category = 'General', sessionId = null) {
    const user = Storage.getCurrentUser();
    if (!user) return { success: false, message: 'User not logged in.' };

    text = (text || '').trim();
    if (!text) {
      return { success: false, message: 'Distraction note cannot be blank.' };
    }

    const newDistraction = {
      id: 'dst_' + Date.now(),
      userId: user.id,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      category: category,
      text: text
    };

    const list = Storage.getData(STORAGE_KEYS.DISTRACTIONS, []);
    list.push(newDistraction);
    Storage.saveData(STORAGE_KEYS.DISTRACTIONS, list);

    return { success: true, item: newDistraction };
  },

  delete(id) {
    let list = Storage.getData(STORAGE_KEYS.DISTRACTIONS, []);
    list = list.filter(d => d.id !== id);
    Storage.saveData(STORAGE_KEYS.DISTRACTIONS, list);
    return { success: true };
  },

  getCategoryStats() {
    const items = this.getAll();
    const stats = {};
    items.forEach(item => {
      const cat = item.category || 'General';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
  }
};
