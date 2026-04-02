/* ============================================
   Taska — script.js
   Full app logic: auth helpers, tasks, UI
   ============================================ */

// =============================================
// STORAGE HELPERS
// =============================================

function getSession() {
  return JSON.parse(localStorage.getItem('taska_session') || 'null');
}

function getTasksKey() {
  const s = getSession();
  return s ? 'taska_tasks_' + s.id : 'taska_tasks_guest';
}

function getTasks() {
  return JSON.parse(localStorage.getItem(getTasksKey()) || '[]');
}

function saveTasks(tasks) {
  localStorage.setItem(getTasksKey(), JSON.stringify(tasks));
}

// =============================================
// TASK STATE
// =============================================

let activeFilter = 'all';

// =============================================
// ADD TASK
// =============================================

function addTask() {
  const input    = document.getElementById('taskInput');
  const catEl    = document.getElementById('taskCategory');
  const priEl    = document.getElementById('taskPriority');
  const dueEl    = document.getElementById('taskDue');

  const text     = input ? input.value.trim() : '';
  if (!text) {
    toast('Please enter a task!', 'error');
    if (input) { input.focus(); input.style.borderColor = 'var(--red)'; setTimeout(() => input.style.borderColor = '', 1200); }
    return;
  }

  const task = {
    id:        Date.now(),
    text:      text,
    category:  catEl ? catEl.value : 'General',
    priority:  priEl ? priEl.value : 'Medium',
    due:       dueEl ? dueEl.value : '',
    completed: false,
    createdAt: new Date().toISOString(),
  };

  const tasks = getTasks();
  tasks.unshift(task);
  saveTasks(tasks);

  if (input) input.value = '';

  renderTasks();
  updateStats();
  toast('Task added! ✦', 'success');
}

// =============================================
// CLEAR ADD FORM
// =============================================

function clearAddForm() {
  const ids = ['taskInput','taskCategory','taskPriority','taskDue'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  // Reset due to today
  const dueEl = document.getElementById('taskDue');
  if (dueEl) dueEl.value = new Date().toISOString().split('T')[0];
}

// =============================================
// TOGGLE COMPLETE
// =============================================

function toggleComplete(id) {
  const tasks = getTasks();
  const task  = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed      = !task.completed;
  task.completedAt    = task.completed ? new Date().toISOString() : null;

  saveTasks(tasks);
  renderTasks();
  updateStats();

  toast(task.completed ? 'Task marked done ✅' : 'Task reopened', task.completed ? 'success' : 'info');
}

// =============================================
// DELETE TASK
// =============================================

function deleteTask(id) {
  const tasks   = getTasks();
  const taskTxt = (tasks.find(t => t.id === id) || {}).text || 'Task';

  const updated = tasks.filter(t => t.id !== id);
  saveTasks(updated);
  renderTasks();
  updateStats();
  toast('"' + taskTxt.slice(0, 30) + '" deleted', 'info');
}

// =============================================
// INLINE EDIT
// =============================================

function startEdit(id) {
  const tasks = getTasks();
  const task  = tasks.find(t => t.id === id);
  if (!task) return;

  const li = document.querySelector(`[data-id="${id}"]`);
  if (!li) return;

  const textEl = li.querySelector('.task-text');
  if (!textEl) return;

  const currentText = task.text;

  // Swap text span for input
  const input = document.createElement('input');
  input.type  = 'text';
  input.value = currentText;
  input.className = 'task-edit-input';
  textEl.replaceWith(input);
  input.focus();
  input.select();

  // Save on enter or blur
  const save = () => {
    const newText = input.value.trim();
    if (newText && newText !== currentText) {
      task.text = newText;
      saveTasks(tasks);
      toast('Task updated ✏️', 'info');
    }
    renderTasks();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { renderTasks(); } // cancel
  });

  input.addEventListener('blur', save);
}

// =============================================
// FILTER
// =============================================

function setFilter(filter, el) {
  activeFilter = filter;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  renderTasks();
}

// =============================================
// RENDER TASKS
// =============================================

function renderTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;

  const search  = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const sortVal = document.getElementById('sortSelect')?.value || 'newest';
  const today   = new Date().toISOString().split('T')[0];

  let tasks = getTasks();

  // ---- Filter ----
  if (activeFilter === 'pending')   tasks = tasks.filter(t => !t.completed);
  if (activeFilter === 'completed') tasks = tasks.filter(t =>  t.completed);
  if (activeFilter === 'high')      tasks = tasks.filter(t => t.priority === 'High');
  if (activeFilter === 'today')     tasks = tasks.filter(t => t.due === today);

  // ---- Search ----
  if (search) {
    tasks = tasks.filter(t =>
      t.text.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search) ||
      t.priority.toLowerCase().includes(search)
    );
  }

  // ---- Sort ----
  const priWeight = { High: 0, Medium: 1, Low: 2 };

  tasks.sort((a, b) => {
    switch (sortVal) {
      case 'oldest':   return new Date(a.createdAt) - new Date(b.createdAt);
      case 'priority': return (priWeight[a.priority] || 1) - (priWeight[b.priority] || 1);
      case 'due':      return (!a.due ? 1 : !b.due ? -1 : a.due.localeCompare(b.due));
      case 'az':       return a.text.localeCompare(b.text);
      default:         return new Date(b.createdAt) - new Date(a.createdAt); // newest
    }
  });

  // Completed tasks always go to bottom within their group
  tasks.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

  // ---- Empty state ----
  if (tasks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${search ? '🔍' : '✦'}</div>
        <div class="empty-title">${search ? 'No matching tasks' : 'No tasks yet'}</div>
        <div class="empty-sub">${search ? 'Try a different search term' : 'Add your first task above!'}</div>
      </div>`;
    return;
  }

  // ---- Build items ----
  list.innerHTML = tasks.map(task => {
    const isOverdue = task.due && task.due < today && !task.completed;
    const dueLabel  = task.due
      ? (task.due === today ? '📅 Today' : formatDate(task.due))
      : '';

    return `
      <div class="task-item pri-${task.priority.toLowerCase()} ${task.completed ? 'completed' : ''}" data-id="${task.id}">

        <!-- Check button -->
        <div class="task-check" onclick="toggleComplete(${task.id})" title="Toggle complete">
          ${task.completed ? '✓' : ''}
        </div>

        <!-- Body -->
        <div class="task-body">
          <div class="task-text">${escHtml(task.text)}</div>
          <div class="task-meta">
            <span class="task-cat">${escHtml(task.category)}</span>
            <span class="pri-badge ${task.priority.toLowerCase()}">${task.priority}</span>
            ${dueLabel ? `<span class="task-date ${isOverdue ? 'overdue' : ''}">${isOverdue ? '⚠️ Overdue · ' : ''}${dueLabel}</span>` : ''}
          </div>
        </div>

        <!-- Actions -->
        <div class="task-actions">
          <button class="btn-icon success" onclick="toggleComplete(${task.id})" title="${task.completed ? 'Reopen' : 'Complete'}">
            ${task.completed ? '↩' : '✓'}
          </button>
          <button class="btn-icon" onclick="startEdit(${task.id})" title="Edit">✏️</button>
          <button class="btn-icon danger" onclick="deleteTask(${task.id})" title="Delete">🗑</button>
        </div>

      </div>`;
  }).join('');
}

// =============================================
// STATS
// =============================================

function updateStats() {
  const tasks   = getTasks();
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const pending = total - done;
  const high    = tasks.filter(t => t.priority === 'High' && !t.completed).length;

  const el = id => document.getElementById(id);
  if (el('statTotal'))   el('statTotal').textContent   = total;
  if (el('statDone'))    el('statDone').textContent    = done;
  if (el('statPending')) el('statPending').textContent = pending;
  if (el('statHigh'))    el('statHigh').textContent    = high;
}

// =============================================
// AUTH HELPERS
// =============================================

function logout() {
  if (!confirm('Log out of Taska?')) return;
  localStorage.removeItem('taska_session');
  window.location.href = 'login.html';
}

// =============================================
// FORM VALIDATION HELPERS
// =============================================

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function clearErrors() {
  document.querySelectorAll('.err-msg').forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
}

// =============================================
// EYE TOGGLE (password)
// =============================================

function toggleEye(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type  = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁';
}

// =============================================
// TOAST NOTIFICATION
// =============================================

function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: '✦' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || '✦'}</span><span>${message}</span>`;
  container.appendChild(t);

  setTimeout(() => {
    t.classList.add('toast-fade');
    setTimeout(() => t.remove(), 320);
  }, 3000);
}

// =============================================
// UTILITIES
// =============================================

function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}