const PlannerPage = {
  items: [], editingId: null, cursor: new Date(), view: 'week',
  init() {
    this.items = Storage.getUserItems(STORAGE_KEYS.PLANNER_EVENTS);
    this.cursor.setHours(0, 0, 0, 0);
    const fillCourses = select => {
      if (!select || !window.Courses) return;
      select.insertAdjacentHTML('beforeend', Courses.getAll(false).map(course => `<option value="${this.escape(course.id)}">${this.escape(course.name)}</option>`).join(''));
    };
    fillCourses(document.querySelector('#plannerForm [name="courseId"]'));
    const controls = document.getElementById('plannerCalendarControls');
    if (controls) controls.innerHTML = '<div class="planner-controls" role="toolbar" aria-label="Planner view"><button type="button" data-shift="-1" aria-label="Previous period">‹</button><button type="button" data-today>Today</button><button type="button" data-shift="1" aria-label="Next period">›</button><strong id="plannerRange"></strong><div class="planner-view-switch"><button type="button" data-view="day">Day</button><button type="button" data-view="week" class="active">Week</button><button type="button" data-view="month">Month</button></div></div>';
    this.bind(); this.render();
  },
  bind() {
    document.getElementById('plannerForm')?.addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget, data = new FormData(form), title = String(data.get('title') || '').trim(); if (!title) return;
      const previous = this.items.find(item => item.id === this.editingId), course = Courses.getById(String(data.get('courseId') || ''));
      const entry = { ...(previous || {}), id: previous?.id || crypto.randomUUID(), title, date: String(data.get('date') || ''), time: String(data.get('time') || ''), durationMinutes: Number(data.get('durationMinutes')) || 60, type: String(data.get('type') || 'Study session'), notes: String(data.get('notes') || '').trim(), courseId: course?.id || '', courseName: course?.name || '', updatedAt: new Date().toISOString() };
      this.items = previous ? this.items.map(item => item.id === previous.id ? entry : item) : [entry, ...this.items]; Storage.saveUserItems(STORAGE_KEYS.PLANNER_EVENTS, this.items);
      this.editingId = null; form.reset(); form.elements.namedItem('durationMinutes').value = 60; form.querySelector('[type="submit"]').textContent = 'Add to planner'; this.cursor = new Date(`${entry.date}T12:00:00`); this.render(); Utils.showToast(previous ? 'Calendar entry updated' : 'Calendar entry saved', 'success');
    });
    document.querySelector('.planner-controls')?.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.view) { this.view = button.dataset.view; document.querySelectorAll('.planner-view-switch [data-view]').forEach(item => item.classList.toggle('active', item === button)); }
      else if (button.hasAttribute('data-today')) this.cursor = new Date();
      else if (button.dataset.shift) { const step = Number(button.dataset.shift); if (this.view === 'day') this.cursor.setDate(this.cursor.getDate() + step); else if (this.view === 'week') this.cursor.setDate(this.cursor.getDate() + step * 7); else this.cursor.setMonth(this.cursor.getMonth() + step); }
      this.cursor.setHours(0, 0, 0, 0); this.render();
    });
    document.getElementById('plannerCalendarList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-action]'); if (!button) return; const entry = this.items.find(item => item.id === button.dataset.id); if (!entry) return;
      if (button.dataset.action === 'start') { const url=new URL('timer.html',location.href);url.searchParams.set('course',entry.courseId||'');url.searchParams.set('objective',entry.objective||entry.title);url.searchParams.set('duration',String(Math.max(5,Math.min(120,Number(entry.durationMinutes)||25))));url.searchParams.set('planned',entry.id);location.href=url.href;return; }
      if (button.dataset.action === 'delete') { if (!confirm(`Delete “${entry.title}” from your calendar?`)) return; this.items = this.items.filter(item => item.id !== entry.id); }
      else if (button.dataset.action === 'edit') { this.editingId = entry.id; const form = document.getElementById('plannerForm'); ['title','date','time','durationMinutes','type','notes','courseId'].forEach(key => { const field = form.elements.namedItem(key); if (field) field.value = entry[key] || ''; }); form.querySelector('[type="submit"]').textContent = 'Update entry'; form.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      else if (button.dataset.action === 'move') { const date = new Date(`${entry.date}T12:00:00`); date.setDate(date.getDate() + Number(button.dataset.delta)); entry.date = this.key(date); entry.updatedAt = new Date().toISOString(); }
      Storage.saveUserItems(STORAGE_KEYS.PLANNER_EVENTS, this.items); this.render();
    });
  },
  range() { const date = new Date(this.cursor); if (this.view === 'day') return [date, date]; if (this.view === 'month') return [new Date(date.getFullYear(), date.getMonth(), 1), new Date(date.getFullYear(), date.getMonth() + 1, 0)]; const start = new Date(date); start.setDate(start.getDate() - (start.getDay() + 6) % 7); const end = new Date(start); end.setDate(end.getDate() + 6); return [start, end]; },
  render() {
    const list = document.getElementById('plannerCalendarList'); if (!list) return; const [start, end] = this.range(), keyStart = this.key(start), keyEnd = this.key(end), label = document.getElementById('plannerRange');
    if (label) label.textContent = this.view === 'month' ? start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : this.view === 'day' ? start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const rows = this.items.filter(item => item.date >= keyStart && item.date <= keyEnd).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    list.innerHTML = rows.length ? rows.map(item => `<article class="workspace-item"><div><div class="item-title">${this.escape(item.title)} ${item.autoGenerated ? '<span class="status-chip">Suggested</span>' : ''}</div><div class="item-meta">${new Date(`${item.date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${item.time ? ` · ${this.escape(item.time)}` : ''}${item.type==='Exam'?'':' · '+(Number(item.durationMinutes)||60)+' min'} · ${this.escape(item.type || 'Study session')}${item.courseName ? ` · ${this.escape(item.courseName)}` : ''}</div>${item.notes ? `<p class="planner-note">${this.escape(item.notes)}</p>` : ''}</div><div class="item-actions">${item.type==='Study session'&&item.status!=='completed'?`<button class="sage-btn primary" data-action="start" data-id="${this.escape(item.id)}">Start Studying</button>`:''}<button class="icon-btn" data-action="move" data-delta="-1" data-id="${this.escape(item.id)}" aria-label="Move one day earlier">← day</button><button class="icon-btn" data-action="move" data-delta="1" data-id="${this.escape(item.id)}" aria-label="Move one day later">day →</button><button class="icon-btn" data-action="edit" data-id="${this.escape(item.id)}">Edit</button><button class="icon-btn" data-action="delete" data-id="${this.escape(item.id)}">Delete</button></div></article>`).join('') : '<div class="empty-state">Nothing on the calendar for this period. Add a class, study session, assignment, or exam above.</div>';
  },
  key(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; },
  escape(value) { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML; }
};
