const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const descriptionInput = document.getElementById('task-description');
const dueDateInput = document.getElementById('task-due-date');
const taskList = document.getElementById('task-list');
const searchInput = document.getElementById('search-input');
const filterButtons = Array.from(document.querySelectorAll('.filter-button'));
const countActive = document.getElementById('count-active');
const countCompleted = document.getElementById('count-completed');
const formTitle = document.getElementById('form-title');
const submitButton = document.getElementById('submit-button');
const cancelEdit = document.getElementById('cancel-edit');
const template = document.getElementById('task-item-template');
const toastContainer = document.getElementById('toast-container');

const STORAGE_KEY = 'personalTaskManagerTasks';
let tasks = [];
let filterStatus = 'all';
let editingTaskId = null;
let dragSourceId = null;

function formatDueDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(task) {
  if (task.completed || !task.dueDate) return false;
  return new Date(task.dueDate).setHours(23, 59, 59, 999) < new Date();
}

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function sortTasks(items) {
  return items.slice().sort((a, b) => {
    if (typeof a.order === 'number' && typeof b.order === 'number') {
      return a.order - b.order;
    }
    if (typeof a.order === 'number') return -1;
    if (typeof b.order === 'number') return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function createTaskPayload(body) {
  return {
    id: String(Date.now()) + Math.random().toString(16).slice(2),
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim(),
    dueDate: body.dueDate ? String(body.dueDate) : '',
    completed: false,
    createdAt: new Date().toISOString(),
    order: typeof body.order === 'number' ? body.order : undefined
  };
}

function getFilteredTasks() {
  const query = searchInput.value.trim().toLowerCase();
  return tasks.filter((task) => {
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && !task.completed) ||
      (filterStatus === 'completed' && task.completed);

    const matchesSearch = task.title.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });
}

function createToast(message, type = 'success') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

function updateCounts() {
  const activeCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.filter((task) => task.completed).length;
  countActive.textContent = `${activeCount} active`;
  countCompleted.textContent = `${completedCount} completed`;
}

function renderTasks() {
  const visibleTasks = getFilteredTasks();
  taskList.innerHTML = '';

  if (visibleTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<strong>No tasks found.</strong><p>Try adding a new task, changing the filter, or updating your search.</p>`;
    taskList.appendChild(empty);
    updateCounts();
    return;
  }

  visibleTasks.forEach((task) => {
    const item = template.content.firstElementChild.cloneNode(true);
    item.classList.add('animate-entry');
    item.dataset.taskId = task.id;
    if (task.completed) {
      item.classList.add('completed');
    }
    if (isOverdue(task)) {
      item.classList.add('overdue');
    }

    const checkbox = item.querySelector('.toggle-complete');
    const title = item.querySelector('.task-title');
    const description = item.querySelector('.task-description');
    const meta = item.querySelector('.task-meta');
    const editButton = item.querySelector('.edit-button');
    const deleteButton = item.querySelector('.delete-button');

    checkbox.checked = task.completed;
    title.textContent = task.title;
    description.textContent = task.description || 'No description provided.';
    meta.textContent = task.dueDate ? `Due ${formatDueDate(task.dueDate)}` : 'No due date';

    checkbox.addEventListener('change', () => toggleCompletion(task.id, checkbox.checked));
    editButton.addEventListener('click', () => startEdit(task));
    deleteButton.addEventListener('click', () => deleteTask(task.id, task.title));

    item.addEventListener('dragstart', () => {
      dragSourceId = task.id;
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      item.classList.remove('drag-over');
      const targetId = task.id;
      if (dragSourceId && dragSourceId !== targetId) {
        reorderTasks(dragSourceId, targetId);
      }
    });

    taskList.appendChild(item);
  });

  updateCounts();
}

function addTask(payload) {
  const task = createTaskPayload(payload);
  tasks.push(task);
  saveTasks();
  renderTasks();
  createToast('Task added successfully.');
}

function updateTask(id, payload) {
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return;
  tasks[index] = {
    ...tasks[index],
    title: payload.title,
    description: payload.description,
    dueDate: payload.dueDate
  };
  saveTasks();
  renderTasks();
  createToast('Task updated successfully.');
}

function toggleCompletion(taskId, completed) {
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index === -1) return;
  tasks[index].completed = completed;
  saveTasks();
  renderTasks();
  createToast(`Marked task ${completed ? 'complete' : 'active'}.`);
}

function deleteTask(taskId, title) {
  const confirmed = confirm(`Delete task "${title}"? This cannot be undone.`);
  if (!confirmed) return;
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderTasks();
  createToast('Task deleted.');
}

function reorderTasks(sourceId, targetId) {
  const currentOrder = tasks.map((task) => task.id);
  const sourceIndex = currentOrder.indexOf(sourceId);
  const targetIndex = currentOrder.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  currentOrder.splice(sourceIndex, 1);
  currentOrder.splice(targetIndex, 0, sourceId);
  tasks = currentOrder.map((id, index) => ({
    ...tasks.find((task) => task.id === id),
    order: index
  }));
  saveTasks();
  renderTasks();
  createToast('Task order updated.');
}

function startEdit(task) {
  editingTaskId = task.id;
  formTitle.textContent = 'Edit Task';
  submitButton.textContent = 'Update Task';
  cancelEdit.classList.remove('hidden');
  titleInput.value = task.title;
  descriptionInput.value = task.description;
  dueDateInput.value = task.dueDate;
  titleInput.focus();
}

function resetForm() {
  editingTaskId = null;
  formTitle.textContent = 'Add New Task';
  submitButton.textContent = 'Add Task';
  cancelEdit.classList.add('hidden');
  form.reset();
}

function handleFormSubmit(event) {
  event.preventDefault();
  const payload = {
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    dueDate: dueDateInput.value || ''
  };

  if (!payload.title) {
    createToast('Task title is required.', 'error');
    return;
  }

  if (editingTaskId) {
    updateTask(editingTaskId, payload);
  } else {
    addTask(payload);
  }
  resetForm();
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    filterStatus = button.dataset.status;
    renderTasks();
  });
});

searchInput.addEventListener('input', () => renderTasks());
searchInput.addEventListener('focus', () => {
  searchInput.placeholder = 'Start typing to search…';
});
searchInput.addEventListener('blur', () => {
  if (!searchInput.value) {
    searchInput.placeholder = 'Find tasks by title';
  }
});
form.addEventListener('submit', handleFormSubmit);
cancelEdit.addEventListener('click', resetForm);

tasks = loadTasks();
renderTasks();
