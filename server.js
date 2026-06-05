const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readTasks() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const tasks = JSON.parse(raw || '[]');
    return Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, '[]', 'utf8');
      return [];
    }
    throw error;
  }
}

async function writeTasks(tasks) {
  await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function sortTasks(tasks) {
  return tasks.slice().sort((a, b) => {
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
    completed: Boolean(body.completed),
    createdAt: new Date().toISOString(),
    order: typeof body.order === 'number' ? body.order : undefined
  };
}

app.get('/api/tasks', async (req, res) => {
  const tasks = await readTasks();
  res.json(sortTasks(tasks));
});

app.post('/api/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Task title is required.' });
  }

  const tasks = await readTasks();
  const task = createTaskPayload(req.body);
  tasks.push(task);
  await writeTasks(tasks);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', async (req, res) => {
  const tasks = await readTasks();
  const index = tasks.findIndex((t) => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const existing = tasks[index];
  const updated = {
    ...existing,
    title: String(req.body.title || existing.title).trim(),
    description: String(req.body.description || existing.description).trim(),
    dueDate: req.body.dueDate !== undefined ? String(req.body.dueDate) : existing.dueDate,
    completed: req.body.completed !== undefined ? Boolean(req.body.completed) : existing.completed,
    order: req.body.order !== undefined ? (req.body.order === null ? undefined : Number(req.body.order)) : existing.order
  };
  tasks[index] = updated;
  await writeTasks(tasks);
  res.json(updated);
});

app.delete('/api/tasks/:id', async (req, res) => {
  const tasks = await readTasks();
  const filtered = tasks.filter((t) => t.id !== req.params.id);
  if (filtered.length === tasks.length) {
    return res.status(404).json({ error: 'Task not found.' });
  }
  await writeTasks(filtered);
  res.status(204).send();
});

app.post('/api/tasks/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array of task IDs.' });
  }
  const tasks = await readTasks();
  const orderMap = new Map(order.map((id, index) => [id, index]));
  const updated = tasks.map((task) => ({
    ...task,
    order: orderMap.has(task.id) ? orderMap.get(task.id) : task.order
  }));
  await writeTasks(updated);
  res.json(sortTasks(updated));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Personal Task Manager running at http://localhost:${PORT}`);
});
