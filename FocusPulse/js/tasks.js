const TasksPage = {
  items: [], editingId: null,
  init() {
    this.items = Storage.getUserItems(STORAGE_KEYS.TASKS);
    const courseInput = document.querySelector('#taskForm [name="course"]');
    if (courseInput && window.Courses) {
      const list = document.createElement('datalist'); list.id = 'taskCourseOptions';
      list.innerHTML = Courses.getAll(false).map(course => `<option value="${this.escape(course.name)}"></option>`).join('');
      courseInput.setAttribute('list', list.id); courseInput.after(list);
    }
    const filter = document.getElementById('taskFilter');
    if (filter) filter.insertAdjacentHTML('beforeend', '<option value="overdue">Overdue</option><option value="upcoming">Upcoming</option>');
    const toolbar = document.querySelector('.workspace-toolbar');
    const taskForm = document.getElementById('taskForm');
    if (taskForm && !taskForm.elements.namedItem('estimatedMinutes')) {
      const label = document.createElement('label'); label.textContent = 'Estimated time (minutes)';
      const estimate = document.createElement('input'); estimate.type = 'number'; estimate.name = 'estimatedMinutes'; estimate.min = '15'; estimate.max = '600'; estimate.step = '15'; estimate.value = '45'; estimate.required = true; label.append(estimate);
      taskForm.insertBefore(label, this.submitButton());
    }
    if (toolbar && !document.getElementById('taskPriorityFilter')) toolbar.insertAdjacentHTML('beforeend', '<select id="taskPriorityFilter" aria-label="Filter by priority"><option value="all">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select>');
    this.bind(); this.render();
  },
  bind() {
    document.getElementById('taskForm')?.addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      const title = String(data.get('title') || '').trim();
      if (!title) return;
      const existing = this.items.find(task => task.id === this.editingId);
      const task = { ...(existing || {}), id: existing?.id || crypto.randomUUID(), title, course: String(data.get('course') || '').trim(), due: String(data.get('due') || ''), estimatedMinutes: Math.max(15, Math.min(600, Number(data.get('estimatedMinutes')) || 45)), priority: String(data.get('priority') || 'Medium'), status: existing?.status || 'open', createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      this.items = existing ? this.items.map(item => item.id === existing.id ? task : item) : [task, ...this.items];
      Storage.saveUserItems(STORAGE_KEYS.TASKS, this.items); form.reset(); this.editingId = null; this.submitButton().textContent = 'Save task'; this.render(); Utils.showToast(existing ? 'Task updated' : 'Task saved', 'success');
    });
    ['taskSearch','taskFilter','taskPriorityFilter'].forEach(id => document.getElementById(id)?.addEventListener('input', () => this.render()));
    document.getElementById('taskList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-action]'); if (!button) return;
      const task = this.items.find(item => item.id === button.dataset.id); if (!task) return;
      if (button.dataset.action === 'toggle') { task.status = task.status === 'done' ? 'open' : 'done'; task.completedAt = task.status === 'done' ? new Date().toISOString() : null; }
      if (button.dataset.action === 'delete') { if (!confirm(`Delete “${task.title}”?`)) return; this.items = this.items.filter(item => item.id !== task.id); }
      if (button.dataset.action === 'edit') {
        this.editingId = task.id; const form = document.getElementById('taskForm');
        ['title','course','due','priority','estimatedMinutes'].forEach(name => { const input = form.elements.namedItem(name); if (input) input.value = task[name] || (name === 'priority' ? 'Medium' : name === 'estimatedMinutes' ? 45 : ''); });
        this.submitButton().textContent = 'Update task'; form.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
      }
      Storage.saveUserItems(STORAGE_KEYS.TASKS, this.items); this.render();
    });
  },
  submitButton() { return document.querySelector('#taskForm button[type="submit"], #taskForm button:not([type])'); },
  render() {
    const list = document.getElementById('taskList'); if (!list) return;
    const query = (document.getElementById('taskSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('taskFilter')?.value || 'all';
    const priority = document.getElementById('taskPriorityFilter')?.value || 'all';
    const today = new Date(); const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const rows = this.items.filter(task => {
      const textMatches = `${task.title} ${task.course || ''}`.toLowerCase().includes(query);
      const statusMatches = status === 'all' || (status === 'overdue' ? task.status !== 'done' && task.due && task.due < todayKey : status === 'upcoming' ? task.status !== 'done' && task.due && task.due >= todayKey : task.status === status);
      return textMatches && statusMatches && (priority === 'all' || task.priority === priority);
    }).sort((a,b) => (a.due || '9999').localeCompare(b.due || '9999'));
    list.innerHTML = rows.length ? rows.map(task => {
      const overdue = task.status !== 'done' && task.due && task.due < todayKey;
      const due = task.due ? new Date(`${task.due}T12:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'No deadline';
      return `<article class="workspace-item"><div><div class="item-title">${this.escape(task.title)}</div><div class="item-meta">${this.escape(task.course || 'Independent study')} · <span class="${overdue?'task-overdue':''}">${overdue?'Overdue · ':''}${due}</span> · ${Number(task.estimatedMinutes)||45} min estimated</div></div><div class="item-actions"><span class="status-chip priority-${String(task.priority||'medium').toLowerCase()}">${this.escape(task.priority||'Medium')}</span><button class="icon-btn" data-action="edit" data-id="${this.escape(task.id)}">Edit</button><button class="icon-btn" data-action="toggle" data-id="${this.escape(task.id)}">${task.status==='done'?'Reopen':'Complete'}</button><button class="icon-btn" data-action="delete" data-id="${this.escape(task.id)}" aria-label="Delete task">Delete</button></div></article>`;
    }).join('') : `<div class="empty-state">${this.items.length ? 'No tasks match these filters.' : 'No tasks yet. Add the next small step above.'}</div>`;
  },
  escape(value) { const element=document.createElement('span'); element.textContent=String(value ?? ''); return element.innerHTML; }
};
