/**
 * FocusPulse - Courses Module (Enhanced)
 * Implements Feature 1: Complete Course Management & S02.
 * Course CRUD, Icons, Descriptions, Archiving/Restoring, Search, Filters, and Focus Stats.
 */

const Courses = {
  // Available course icons for selection
  ICONS: ['📚', '💻', '🧪', '📐', '🔬', '⚡', '🎨', '🌐', '🧠', '📊', '📝', '🎯'],

  // Get courses for current user
  getAll(includeArchived = true) {
    const user = Storage.getCurrentUser();
    if (!user) return [];
    const courses = Storage.getData(STORAGE_KEYS.COURSES, []);
    const userCourses = courses.filter(c => c.userId === user.id);
    return includeArchived ? userCourses : userCourses.filter(c => !c.isArchived);
  },

  getById(id) {
    const courses = Storage.getData(STORAGE_KEYS.COURSES, []);
    return courses.find(c => c.id === id);
  },

  // Add course with duplicate validation, custom icon, color, description, and weekly target
  add(name, code, description = '', color = '#8b5cf6', icon = '📚', targetMinutes = 300) {
    const user = Storage.getCurrentUser();
    if (!user) return { success: false, message: 'User not logged in.' };

    name = (name || '').trim();
    code = (code || '').trim().toUpperCase();
    description = (description || '').trim();
    color = color || '#8b5cf6';
    icon = icon || '📚';
    targetMinutes = parseInt(targetMinutes, 10) || 300;

    if (!name) {
      return { success: false, message: 'Course name cannot be blank.' };
    }

    const allCourses = Storage.getData(STORAGE_KEYS.COURSES, []);
    const userCourses = allCourses.filter(c => c.userId === user.id);

    // Prevent duplicate course names or codes for the same user
    const duplicate = userCourses.find(c => 
      c.name.toLowerCase() === name.toLowerCase() || (code && c.code.toLowerCase() === code.toLowerCase())
    );
    if (duplicate) {
      return { success: false, message: 'A course with this title or code already exists in your account.' };
    }

    const newCourse = {
      id: 'crs_' + Date.now(),
      userId: user.id,
      name: name,
      code: code || 'COURSE',
      description: description,
      color: color,
      icon: icon,
      targetMinutes: targetMinutes,
      isArchived: false,
      createdAt: Utils.getLocalDateString()
    };

    allCourses.push(newCourse);
    Storage.saveData(STORAGE_KEYS.COURSES, allCourses);

    return { success: true, course: newCourse };
  },

  // Update existing course details
  update(id, data) {
    const allCourses = Storage.getData(STORAGE_KEYS.COURSES, []);
    const courseIndex = allCourses.findIndex(c => c.id === id);
    if (courseIndex === -1) {
      return { success: false, message: 'Course not found.' };
    }

    // Check duplicate if name or code changed
    const user = Storage.getCurrentUser();
    if (data.name || data.code) {
      const duplicate = allCourses.find(c => 
        c.userId === user.id && 
        c.id !== id && 
        (
          (data.name && c.name.toLowerCase() === data.name.trim().toLowerCase()) ||
          (data.code && c.code.toLowerCase() === data.code.trim().toLowerCase())
        )
      );
      if (duplicate) {
        return { success: false, message: 'Another course already has this title or code.' };
      }
    }

    allCourses[courseIndex] = {
      ...allCourses[courseIndex],
      ...data,
      name: data.name ? data.name.trim() : allCourses[courseIndex].name,
      code: data.code ? data.code.trim().toUpperCase() : allCourses[courseIndex].code,
      targetMinutes: data.targetMinutes ? parseInt(data.targetMinutes, 10) : allCourses[courseIndex].targetMinutes
    };

    Storage.saveData(STORAGE_KEYS.COURSES, allCourses);
    return { success: true, course: allCourses[courseIndex] };
  },

  // Archive course
  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // Restore archived course
  restore(id) {
    return this.update(id, { isArchived: false });
  },

  // Delete course
  delete(id) {
    let allCourses = Storage.getData(STORAGE_KEYS.COURSES, []);
    allCourses = allCourses.filter(c => c.id !== id);
    Storage.saveData(STORAGE_KEYS.COURSES, allCourses);
    return { success: true };
  },

  // Search & Filter courses
  search(query = '', status = 'all') {
    let list = this.getAll(true);
    query = (query || '').toLowerCase().trim();

    if (status === 'active') {
      list = list.filter(c => !c.isArchived);
    } else if (status === 'archived') {
      list = list.filter(c => c.isArchived);
    }

    if (query) {
      list = list.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.code.toLowerCase().includes(query) || 
        (c.description && c.description.toLowerCase().includes(query))
      );
    }

    return list;
  },

  // Comprehensive stats for a course
  getStats(courseId) {
    const course = this.getById(courseId);
    if (!course) return null;

    const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, [])
      .filter(s => s.courseId === courseId && s.status === 'completed');

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const completedSessions = sessions.length;

    // Weekly focus minutes
    const weekDates = Utils.getCurrentWeekDates();
    const weeklyMinutes = sessions
      .filter(s => weekDates.includes(s.dateStr))
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    const targetMinutes = course.targetMinutes || 300;
    const progressPercent = Math.min(100, Math.round((weeklyMinutes / targetMinutes) * 100));

    return {
      totalMinutes,
      completedSessions,
      weeklyMinutes,
      targetMinutes,
      progressPercent
    };
  },

  // Calculate total focus minutes completed for this course
  getFocusMinutes(courseId) {
    const stats = this.getStats(courseId);
    return stats ? stats.totalMinutes : 0;
  }
};
