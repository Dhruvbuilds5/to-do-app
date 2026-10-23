const KEY = 'bento-todo-v1';
const $ = id => document.getElementById(id);
const CIRC = 2 * Math.PI * 50;          // length of the progress ring

const els = {
  today: $('todayDate'), greeting: $('greeting'), heroSub: $('heroSub'),
  ringBar: $('ringBar'), percent: $('percent'),
  dueToday: $('dueToday'), overdue: $('overdueCount'),
  listNav: $('listNav'), listForm: $('listForm'), listInput: $('listInput'),
  taskForm: $('taskForm'), taskTitle: $('taskTitle'), taskDate: $('taskDate'),
  taskTime: $('taskTime'), taskListSel: $('taskListSel'),
  listTitle: $('listTitle'), filters: $('filters'), clearBtn: $('clearBtn'),
  taskUl: $('taskUl'), empty: $('emptyMsg'),
  dialog: $('editDialog'), editForm: $('editForm'), editTitle: $('editTitle'),
  editDate: $('editDate'), editTime: $('editTime'), editList: $('editList'),
  cancelEdit: $('cancelEdit')
};

// ---------- Saving and loading ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaultState() {
  return {
    lists: [{ id: uid(), name: 'Personal' }, { id: uid(), name: 'Work' }],
    tasks: [],
    activeList: 'all',
    filter: 'all'
  };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && Array.isArray(data.lists) && data.lists.length && Array.isArray(data.tasks)) {
      return data;
    }
  } catch (e) {}
  return null;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

let state = load() || defaultState();
let lastAddedId = null;
let editingId = null;

// ---------- Date helpers ----------
const pad = n => String(n).padStart(2, '0');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Tasks with a date but no time are due at the end of that day
function dueDate(t) {
  return t.date ? new Date(`${t.date}T${t.time || '23:59'}`) : null;
}

function isLate(t) {
  return !t.done && t.date && dueDate(t) < new Date();
}

function formatDue(t) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${t.date}T00:00`);
  const diff = Math.round((d - today) / 864e5);

  let text;
  if (diff === 0) text = 'Today';
  else if (diff === 1) text = 'Tomorrow';
  else if (diff === -1) text = 'Yesterday';
  else text = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (t.time) {
    const tm = new Date(`${t.date}T${t.time}`);
    text += ' · ' + tm.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return text;
}

// ---------- Small helpers ----------
function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function listName(id) {
  const l = state.lists.find(l => l.id === id);
  return l ? l.name : '';
}

function fillListSelect(select, selectedId) {
  select.innerHTML = '';
  state.lists.forEach(l => {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.name;
    select.appendChild(o);
  });
  select.value = state.lists.some(l => l.id === selectedId) ? selectedId : state.lists[0].id;
}

function sortTasks(arr) {
  return arr.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;       // finished tasks go last
    const da = dueDate(a), db = dueDate(b);
    if (da && db) return da - db;                        // earliest due first
    if (da) return -1;
    if (db) return 1;
    return b.created - a.created;                        // newest first
  });
}

// ---------- Rendering ----------
function renderHero() {
  const now = new Date();
  const hr = now.getHours();
  els.greeting.textContent = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  els.today.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const total = state.tasks.length;
  const left = state.tasks.filter(t => !t.done).length;
  if (total === 0) els.heroSub.textContent = 'Add your first task to get started.';
  else if (left === 0) els.heroSub.textContent = "You're all caught up. 🎉";
  else els.heroSub.textContent = `You have ${left} task${left === 1 ? '' : 's'} left.`;
}

function renderStats() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  els.percent.textContent = pct + '%';
  els.ringBar.style.strokeDasharray = CIRC;
  els.ringBar.style.strokeDashoffset = CIRC * (1 - pct / 100);

  const today = todayStr();
  els.dueToday.textContent = state.tasks.filter(t => !t.done && t.date === today).length;

  const late = state.tasks.filter(isLate).length;
  els.overdue.textContent = `${late} overdue`;
  els.overdue.classList.toggle('alert', late > 0);
}

function renderLists() {
  els.listNav.innerHTML = '';

  const addItem = (id, name, count, deletable) => {
    const li = h('li', state.activeList === id ? 'active' : '');
    li.dataset.id = id;

    const btn = h('button', 'nav-btn');
    btn.dataset.action = 'select-list';
    btn.append(h('span', '', name), h('span', 'count', count));
    li.appendChild(btn);

    if (deletable) {
      const del = h('button', 'nav-del', '✕');
      del.dataset.action = 'delete-list';
      del.setAttribute('aria-label', `Delete list ${name}`);
      li.appendChild(del);
    }
    els.listNav.appendChild(li);
  };

  addItem('all', 'All tasks', state.tasks.filter(t => !t.done).length, false);
  state.lists.forEach(l => {
    const count = state.tasks.filter(t => t.listId === l.id && !t.done).length;
    addItem(l.id, l.name, count, state.lists.length > 1);
  });

  // Keep the "Add task" list dropdown in sync
  const keep = els.taskListSel.value;
  fillListSelect(els.taskListSel, state.activeList !== 'all' ? state.activeList : keep);
}

function taskEl(t) {
  const li = h('li', 'task' + (t.done ? ' done' : '') + (t.id === lastAddedId ? ' enter' : ''));
  li.dataset.id = t.id;

  const check = h('button', 'check');
  check.dataset.action = 'toggle';
  check.setAttribute('aria-label', t.done ? 'Mark as not done' : 'Mark as done');
  check.setAttribute('aria-pressed', String(t.done));

  const body = h('div', 'body');
  const meta = h('div', 'meta');
  meta.appendChild(h('span', 'chip', listName(t.listId)));
  if (t.date) meta.appendChild(h('span', 'chip due' + (isLate(t) ? ' late' : ''), formatDue(t)));
  body.append(h('div', 'title', t.title), meta);

  const actions = h('div', 'actions');
  const edit = h('button', 'icon-btn', 'Edit');
  edit.dataset.action = 'edit';
  const del = h('button', 'icon-btn del', '✕');
  del.dataset.action = 'delete';
  del.setAttribute('aria-label', 'Delete task');
  actions.append(edit, del);

  li.append(check, body, actions);
  return li;
}

function renderTasks() {
  const inScope = state.tasks.filter(t => state.activeList === 'all' || t.listId === state.activeList);
  const visible = inScope.filter(t =>
    state.filter === 'all' || (state.filter === 'active' ? !t.done : t.done)
  );

  els.listTitle.textContent = state.activeList === 'all' ? 'All tasks' : listName(state.activeList);
  els.filters.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === state.filter)
  );

  els.taskUl.innerHTML = '';
  sortTasks(visible).forEach(t => els.taskUl.appendChild(taskEl(t)));

  if (visible.length === 0) {
    els.empty.textContent =
      inScope.length === 0 ? 'Nothing here yet. Add a task above ✨' :
      state.filter === 'done' ? 'No completed tasks yet.' : 'All done here. Nice work! 🎉';
  } else {
    els.empty.textContent = '';
  }

  els.clearBtn.hidden = !inScope.some(t => t.done);
}

function render() {
  renderHero();
  renderStats();
  renderLists();
  renderTasks();
  lastAddedId = null;       // so the slide-in animation only plays once
}

function commit() {
  save();
  render();
}

// ---------- Adding ----------
els.taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = els.taskTitle.value.trim();
  if (!title) return;

  let date = els.taskDate.value;
  const time = els.taskTime.value;
  if (time && !date) date = todayStr();       // a time with no date means today

  const task = {
    id: uid(),
    title,
    date,
    time,
    listId: els.taskListSel.value,
    done: false,
    created: Date.now()
  };
  state.tasks.push(task);
  lastAddedId = task.id;

  els.taskTitle.value = '';
  els.taskDate.value = '';
  els.taskTime.value = '';
  commit();
  els.taskTitle.focus();
});

els.listForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = els.listInput.value.trim();
  if (!name) return;

  const exists = state.lists.some(l => l.name.toLowerCase() === name.toLowerCase());
  if (!exists) {
    const list = { id: uid(), name };
    state.lists.push(list);
    state.activeList = list.id;
  }
  els.listInput.value = '';
  commit();
});

// ---------- Clicks inside lists and tasks ----------
els.listNav.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.closest('li').dataset.id;

  if (btn.dataset.action === 'select-list') {
    state.activeList = id;
    commit();
  }

  if (btn.dataset.action === 'delete-list') {
    const count = state.tasks.filter(t => t.listId === id).length;
    const ok = count === 0 || confirm(`Delete "${listName(id)}" and its ${count} task(s)?`);
    if (!ok) return;
    state.lists = state.lists.filter(l => l.id !== id);
    state.tasks = state.tasks.filter(t => t.listId !== id);
    if (state.activeList === id) state.activeList = 'all';
    commit();
  }
});

els.taskUl.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.closest('.task').dataset.id;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  if (btn.dataset.action === 'toggle') {
    task.done = !task.done;
    commit();
  } else if (btn.dataset.action === 'delete') {
    state.tasks = state.tasks.filter(t => t.id !== id);
    commit();
  } else if (btn.dataset.action === 'edit') {
    openEdit(task);
  }
});

els.filters.addEventListener('click', e => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  state.filter = btn.dataset.filter;
  commit();
});

els.clearBtn.addEventListener('click', () => {
  state.tasks = state.tasks.filter(t =>
    !(t.done && (state.activeList === 'all' || t.listId === state.activeList))
  );
  commit();
});

// ---------- Editing ----------
function openEdit(task) {
  editingId = task.id;
  els.editTitle.value = task.title;
  els.editDate.value = task.date;
  els.editTime.value = task.time;
  fillListSelect(els.editList, task.listId);
  els.dialog.showModal();
}

els.editForm.addEventListener('submit', e => {
  e.preventDefault();
  const task = state.tasks.find(t => t.id === editingId);
  const title = els.editTitle.value.trim();
  if (!task || !title) return;

  let date = els.editDate.value;
  const time = els.editTime.value;
  if (time && !date) date = todayStr();

  Object.assign(task, { title, date, time, listId: els.editList.value });
  els.dialog.close();
  commit();
});

els.cancelEdit.addEventListener('click', () => els.dialog.close());

// Clicking the dark area outside the window closes it
els.dialog.addEventListener('click', e => {
  if (e.target === els.dialog) els.dialog.close();
});

// ---------- Backup ----------
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `todo-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('importBtn').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.lists) || !data.lists.length || !Array.isArray(data.tasks)) throw 0;
      if (!confirm('Replace your current tasks with this backup?')) return;
      state = data;
      commit();
    } catch (err) {
      alert('That file is not a valid backup.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});
// ---------- Start ----------
render();
setInterval(render, 60000);      // refresh overdue status every minute

// Lets the app be installed and work offline
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}