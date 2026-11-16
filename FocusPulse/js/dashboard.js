/**
 * FocusPulse - Dashboard Controller
 * Connects storage, streaks, goals, insights, and ambient lofi widget to the main view.
 */

const Dashboard = {
  init() {
    this.renderHeader();
    this.renderStats();
    this.renderReactorPreview();
    this.renderRecentSessions();
    this.renderCoursePills();
    this.renderAcademicAgenda();
    this.renderGroupPreview();
    this.renderWeeklyReview();
    this.initAmbientPlayer();
    
    // Render HTML5 Canvas Chart
    setTimeout(() => {
      if (window.Insights) {
        Insights.renderWeeklyBarChart('dashboardWeeklyChart');
      }
    }, 100);
  },

  renderHeader() {
    const user = Storage.getCurrentUser();
    const welcomeEl = document.getElementById('dashWelcomeName');
    const dateEl = document.getElementById('dashCurrentDate');

    if (welcomeEl && user) {
      welcomeEl.textContent = user.name;
    }

    if (dateEl) {
      const today = new Date();
      dateEl.textContent = today.toLocaleDateString(undefined, { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  },

  renderStats() {
    const summary = History.getSummaryStats();
    const goalProg = Goals.getTodayProgress();
    const streakData = Streaks.calculate();
    const badges = Badges.getAll().filter(b => b.unlocked);

    // Total Focus Time
    const focusTimeEl = document.getElementById('dashTotalFocusTime');
    if (focusTimeEl) {
      focusTimeEl.textContent = Utils.formatMinutes(summary.totalCompletedMinutes);
    }

    // Daily Goal
    const goalEl = document.getElementById('dashDailyGoalProgress');
    const goalLabelEl = document.getElementById('dashGoalSubtext');
    if (goalEl) {
      goalEl.textContent = `${goalProg.completed}/${goalProg.target}`;
      if (goalLabelEl) {
        goalLabelEl.textContent = goalProg.isMet 
          ? '🎯 Goal Achieved Today!' 
          : `${goalProg.remaining} session${goalProg.remaining > 1 ? 's' : ''} left to keep streak`;
      }
    }

    // Current Streak
    const streakEl = document.getElementById('dashCurrentStreak');
    if (streakEl) {
      streakEl.textContent = `${streakData.currentStreak} Days`;
    }

    // Unlocked Badges
    const badgesEl = document.getElementById('dashTotalBadges');
    if (badgesEl) {
      badgesEl.textContent = badges.length;
    }
  },

  renderReactorPreview() {
    const timeEl = document.getElementById('dashPreviewTime');
    const activeTimer = Storage.getData(STORAGE_KEYS.ACTIVE_TIMER);

    if (timeEl) {
      if (activeTimer && activeTimer.status === 'running') {
        const diff = Math.max(0, Math.round((activeTimer.targetEndTime - Date.now()) / 1000));
        timeEl.textContent = Utils.formatTime(diff);
      } else {
        timeEl.textContent = '25:00';
      }
    }
  },

  renderRecentSessions() {
    const listEl = document.getElementById('dashRecentSessionsList');
    if (!listEl) return;

    const sessions = History.getSessions('all', 'all').slice(0, 5); // top 5

    if (sessions.length === 0) {
      listEl.innerHTML = `<p class="text-muted" style="padding: 1rem 0;">No focus sessions logged yet. Ignite the Focus Reactor to begin!</p>`;
      return;
    }

    listEl.innerHTML = sessions.map(s => {
      const isCompleted = s.status === 'completed';
      const badgeClass = isCompleted ? 'badge-mint' : 'badge-rose';
      const badgeText = isCompleted ? `${s.durationMinutes} min` : 'Interrupted';
      const friendlyDate = Utils.formatDateFriendly(s.dateStr);

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${isCompleted ? 'var(--accent-mint)' : 'var(--accent-rose)'};"></div>
            <div>
              <div style="font-weight: 600; font-size: 0.92rem;">${s.courseName || 'General Study'}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${friendlyDate} • ${s.notes || 'Pomodoro Session'}</div>
            </div>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    }).join('');
  },

  renderCoursePills() {
    const container = document.getElementById('dashCoursePillList');
    if (!container) return;

    const courses = Courses.getAll();
    if (courses.length === 0) {
      container.innerHTML = `<span class="text-muted" style="font-size: 0.85rem;">No courses registered yet.</span>`;
      return;
    }

    container.innerHTML = courses.map(c => `
      <div class="course-item-pill">
        <span class="course-color-dot" style="background-color: ${c.color}"></span>
        <span style="font-weight: 500;">${c.name}</span>
        <span style="color: var(--text-muted); font-size: 0.75rem;">(${c.code})</span>
      </div>
    `).join('');
  },

  renderAcademicAgenda() {
    const today = new Date();
    const key = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
    const planEl = document.getElementById('dashTodayPlan');
    const taskEl = document.getElementById('dashUpcomingTasks');
    if (planEl) {
      const events = Storage.getUserItems(STORAGE_KEYS.PLANNER_EVENTS).filter(event => event.date === key).sort((a,b) => (a.time || '').localeCompare(b.time || ''));
      planEl.innerHTML = events.length ? events.slice(0,4).map(event => `<article class="workspace-item"><div><div class="item-title">${this.escapeText(event.title)}</div><div class="item-meta">${this.escapeText(event.type || 'Study session')}</div></div></article>`).join('') : '<div class="empty-state">Your day is open. Add a class, study session, or exam to the planner.</div>';
    }
    if (taskEl) {
      const tasks = Storage.getUserItems(STORAGE_KEYS.TASKS).filter(task => task.status !== 'done').sort((a,b) => (a.due || '9999').localeCompare(b.due || '9999'));
      taskEl.innerHTML = tasks.length ? tasks.slice(0,4).map(task => {
        const overdue = task.due && task.due < key;
        const dueLabel = task.due ? (overdue ? 'Overdue · ' : 'Due ') + new Date(task.due+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}) : 'No deadline';
        return `<article class="workspace-item"><div><div class="item-title">${this.escapeText(task.title)}</div><div class="item-meta">${this.escapeText(task.course || 'General study')} · ${dueLabel}</div></div><span class="status-chip">${this.escapeText(task.priority || 'Medium')}</span></article>`;
      }).join('') : '<div class="empty-state">No open tasks yet. Add an assignment or a small next step.</div>';
    }
  },

  renderGroupPreview() {
    const host=document.getElementById('dashGroupQuickSync');if(!host)return;
    const groups=window.Groups?.getUserGroups?.()||[];
    if(!groups.length){host.innerHTML='<div class="dashboard-group-empty"><p>No study groups yet.</p><a class="btn btn-secondary btn-sm" href="groups.html">Explore study groups</a></div>';return}
    const group=groups[0],stats=Groups.getWeeklyStats(group.id);host.innerHTML=`<div class="dashboard-group-row"><div><strong>${this.escapeText(group.name)}</strong><span>${stats.totalMinutes} of ${stats.targetMinutes} focus minutes this week · ${stats.members.length} member${stats.members.length===1?'':'s'}</span></div><a class="btn btn-secondary btn-sm" href="group-details.html?id=${encodeURIComponent(group.id)}">View group</a></div>`;
  },

  renderWeeklyReview() {
    const host=document.getElementById('dashWeeklyReview');if(!host)return;
    const now=new Date(),today=Utils.getLocalDateString(),week=Utils.getCurrentWeekDates(),sessions=Storage.getUserItems(STORAGE_KEYS.SESSIONS).filter(item=>item.status==='completed'&&week.includes(item.dateStr)),tasks=Storage.getUserItems(STORAGE_KEYS.TASKS),completedTasks=tasks.filter(item=>item.status==='done'&&item.completedAt&&week.includes(item.completedAt.slice(0,10))).length,minutes=sessions.reduce((sum,item)=>sum+Number(item.durationMinutes||0),0),courses=new Set(sessions.map(item=>item.courseId).filter(Boolean)).size,missed=Storage.getUserItems(STORAGE_KEYS.PLANNER_EVENTS).filter(item=>item.autoGenerated&&item.status==='planned'&&item.date<today).length,goal=Goals.getTodayProgress();
    const next=tasks.filter(item=>item.status!=='done').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'))[0];
    host.innerHTML=`<div class="weekly-review-metric"><strong>${Utils.formatMinutes(minutes)}</strong><span>focus this week</span></div><div class="weekly-review-metric"><strong>${completedTasks}</strong><span>tasks completed</span></div><div class="weekly-review-metric"><strong>${courses}</strong><span>courses studied</span></div><div class="weekly-review-metric"><strong>${missed}</strong><span>past suggested sessions</span></div><p class="weekly-review-next">${next?`Next priority: <strong>${this.escapeText(next.title)}</strong>${next.due?` · due ${new Date(`${next.due}T12:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:''}.`: 'No open tasks right now.'} Today’s goal: ${goal.completed} of ${goal.target} sessions.</p>`;
  },

  escapeText(value) { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; },

  // Purple Hub Inspired Ambient Music Player
  initAmbientPlayer() {
    const playBtn = document.getElementById('ambientPlayBtn');
    const titleEl = document.getElementById('ambientTitle');
    let isPlaying = false;
    let synthInterval = null;

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        playBtn.innerHTML = isPlaying 
          ? `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
          : `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

        if (isPlaying) {
          Utils.showToast('Lofi Ambient Study Soundscape Active', 'info');
          // Simulated subtle ambient soundscape using Web Audio API
          const ctx = Utils.getAudioContext();
          if (ctx) {
            const playChime = () => {
              if (!isPlaying) return;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              const freqs = [261.63, 329.63, 392.00, 523.25];
              const f = freqs[Math.floor(Math.random() * freqs.length)];
              osc.frequency.setValueAtTime(f, ctx.currentTime);
              gain.gain.setValueAtTime(0.001, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.1);
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.8);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 1.9);
            };
            playChime();
            synthInterval = setInterval(playChime, 3200);
          }
        } else {
          clearInterval(synthInterval);
        }
      });
    }
  }
};
