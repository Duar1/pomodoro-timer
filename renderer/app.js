// ===== State =====
const state = {
  mode: 'work',
  timerRunning: false,
  timeRemaining: 25 * 60,
  totalTime: 25 * 60,
  pomodoroCount: 0, // sessions completed in current work streak (for auto long-break)

  settings: {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    alwaysOnTop: false,
  },

  tasks: [],
  history: [],     // { timestamp, mode, modeLabel, duration }
};

// ===== DOM refs =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  modeTabs: $$('.mode-tab'),
  mmss: $('#timer-mmss'),
  label: $('#timer-label'),
  ringProgress: $('#ring-progress'),
  btnToggle: $('#btn-toggle'),
  btnReset: $('#btn-reset'),
  taskInput: $('#task-input'),
  btnAddTask: $('#btn-add-task'),
  taskList: $('#task-list'),
  statToday: $('#stat-today'),
  statTotal: $('#stat-total'),
  historyList: $('#history-list'),
  historyEmpty: $('#history-empty'),
  settingWork: $('#setting-work'),
  settingShort: $('#setting-short'),
  settingLong: $('#setting-long'),
  settingOntop: $('#setting-ontop'),
  btnMinimize: $('#btn-minimize'),
};

// ===== Timer engine =====
let timerInterval = null;
let timerEndTime = null;

function startTimer() {
  if (state.timeRemaining <= 0) return;
  state.timerRunning = true;
  timerEndTime = Date.now() + state.timeRemaining * 1000;

  timerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
    state.timeRemaining = remaining;
    renderTimer();

    if (remaining <= 0) {
      onPomodoroComplete();
    }
  }, 100);

  window.electronAPI.updateTrayMenu(true);
  renderControls();
}

function pauseTimer() {
  state.timerRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerEndTime = null;
  window.electronAPI.updateTrayMenu(false);
  renderControls();
}

function toggleTimer() {
  if (state.timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  pauseTimer();
  state.timeRemaining = getModeDuration();
  state.totalTime = state.timeRemaining;
  renderTimer();
  renderControls();
}

function switchMode(mode) {
  pauseTimer();
  state.mode = mode;
  state.timeRemaining = getModeDuration();
  state.totalTime = state.timeRemaining;
  if (mode === 'work') {
    state.pomodoroCount = 0;
  }
  renderModeTabs();
  renderTimer();
  renderControls();
}

function getModeDuration() {
  const key = state.mode === 'work' ? 'workDuration'
    : state.mode === 'shortBreak' ? 'shortBreakDuration'
    : 'longBreakDuration';
  return state.settings[key] * 60;
}

function onPomodoroComplete() {
  pauseTimer();

  // Capture before switching mode
  const completedMode = state.mode;
  const completedDuration = getModeDuration();

  if (completedMode === 'work') {
    state.pomodoroCount++;
    recordHistory(completedMode, Math.round(completedDuration / 60));
    // Auto-switch: every 4th work session → long break
    if (state.pomodoroCount % 4 === 0) {
      state.mode = 'longBreak';
    } else {
      state.mode = 'shortBreak';
    }
  } else {
    // Break complete → back to work
    recordHistory(completedMode, Math.round(completedDuration / 60));
    state.mode = 'work';
  }

  state.timeRemaining = getModeDuration();
  state.totalTime = state.timeRemaining;

  playAlarm();
  window.electronAPI.sendNotification(
    '番茄钟',
    completedMode === 'work' ? '太棒了！休息一下吧。' : '休息结束！开始专注吧。'
  );

  renderModeTabs();
  renderTimer();
  renderControls();
  renderStats();
  renderHistory();
}

// ===== Sound =====
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    function beep(freq, startTime, duration) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    }

    const now = ctx.currentTime;
    beep(660, now, 0.2);
    beep(880, now + 0.2, 0.2);
    beep(1100, now + 0.4, 0.35);

    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

// ===== History & Stats =====
function recordHistory(mode, duration) {
  const modeLabels = {
    work: '专注',
    shortBreak: '短休息',
    longBreak: '长休息',
  };
  state.history.unshift({
    timestamp: new Date().toISOString(),
    mode: mode,
    modeLabel: modeLabels[mode],
    duration: duration,
  });
  // Keep last 500 entries
  if (state.history.length > 500) state.history.length = 500;
  persistNow();
}

function getTodayCount() {
  const today = new Date().toISOString().slice(0, 10);
  return state.history.filter((h) => h.timestamp.slice(0, 10) === today && h.mode === 'work').length;
}

// ===== Rendering =====
function renderTimer() {
  const mins = Math.floor(state.timeRemaining / 60);
  const secs = state.timeRemaining % 60;
  dom.mmss.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const labels = {
    work: '专注时间',
    shortBreak: '短休息',
    longBreak: '长休息',
  };
  dom.label.textContent = labels[state.mode];

  // Progress ring (depletes from full to empty as time counts down)
  const circumference = 2 * Math.PI * 95;
  const progress = state.timeRemaining / state.totalTime;
  const offset = circumference * (1 - progress);
  dom.ringProgress.style.strokeDasharray = circumference;
  dom.ringProgress.style.strokeDashoffset = offset;

  const isBreak = state.mode === 'shortBreak' || state.mode === 'longBreak';
  const color = isBreak ? 'var(--accent-break)' : 'var(--accent-work)';
  dom.ringProgress.style.stroke = color;
}

function renderControls() {
  dom.btnToggle.textContent = state.timerRunning ? '暂停' : '开始';
  dom.btnToggle.disabled = state.timeRemaining <= 0 && !state.timerRunning;
  dom.btnReset.disabled = false;
}

function renderModeTabs() {
  dom.modeTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === state.mode);
  });
}

function renderTasks() {
  dom.taskList.innerHTML = '';
  if (state.tasks.length === 0) return;

  state.tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = `
      <input type="checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}" />
      <span class="task-text ${task.completed ? 'done' : ''}">${escapeHtml(task.text)}</span>
      <button class="task-del" data-id="${task.id}">&times;</button>
    `;
    dom.taskList.appendChild(li);
  });
}

function renderStats() {
  dom.statToday.textContent = getTodayCount();
  dom.statTotal.textContent = state.history.filter((h) => h.mode === 'work').length;
}

function renderHistory() {
  dom.historyList.innerHTML = '';
  const recent = state.history.slice(0, 20);

  if (recent.length === 0) {
    dom.historyEmpty.style.display = 'block';
    return;
  }
  dom.historyEmpty.style.display = 'none';

  recent.forEach((h) => {
    const d = new Date(h.timestamp);
    const time = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <span class="history-time">${time}</span>
      <span class="history-mode mode-${h.mode}">${h.modeLabel}</span>
      <span>${h.duration}分钟</span>
    `;
    dom.historyList.appendChild(li);
  });
}

function renderSettings() {
  dom.settingWork.value = state.settings.workDuration;
  dom.settingShort.value = state.settings.shortBreakDuration;
  dom.settingLong.value = state.settings.longBreakDuration;
  dom.settingOntop.checked = state.settings.alwaysOnTop;
}

function renderAll() {
  renderTimer();
  renderControls();
  renderModeTabs();
  renderTasks();
  renderStats();
  renderHistory();
  renderSettings();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Update state =====
let persistTimer = null;

function updateState(changes) {
  if (changes.settings) {
    Object.assign(state.settings, changes.settings);
  }
  if (changes.tasks !== undefined) {
    state.tasks = changes.tasks;
  }
  if (changes.history !== undefined) {
    state.history = changes.history;
  }
  schedulePersist();
  renderAll();
}

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 300);
}

async function persistNow() {
  try {
    await window.electronAPI.saveData({
      settings: state.settings,
      tasks: state.tasks,
      historyData: state.history,
    });
  } catch {}
}

// ===== Event handlers =====

// Timer controls
dom.btnToggle.addEventListener('click', toggleTimer);
dom.btnReset.addEventListener('click', resetTimer);

// Mode tabs
dom.modeTabs.forEach((tab) => {
  tab.addEventListener('click', () => switchMode(tab.dataset.mode));
});

// Tasks
dom.btnAddTask.addEventListener('click', () => {
  const text = dom.taskInput.value.trim();
  if (!text) return;
  state.tasks.push({ id: Date.now(), text, completed: false });
  dom.taskInput.value = '';
  updateState({ tasks: state.tasks });
});

dom.taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.btnAddTask.click();
});

dom.taskList.addEventListener('click', (e) => {
  const id = Number(e.target.dataset.id);
  if (!id) return;

  if (e.target.type === 'checkbox') {
    const task = state.tasks.find((t) => t.id === id);
    if (task) {
      task.completed = e.target.checked;
      updateState({ tasks: state.tasks });
    }
  }

  if (e.target.classList.contains('task-del')) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    updateState({ tasks: state.tasks });
  }
});

// Settings
dom.settingWork.addEventListener('change', () => {
  const v = Math.max(1, Math.min(120, parseInt(dom.settingWork.value) || 25));
  state.settings.workDuration = v;
  if (state.mode === 'work' && !state.timerRunning) {
    state.timeRemaining = v * 60;
    state.totalTime = v * 60;
  }
  updateState({ settings: state.settings });
});

dom.settingShort.addEventListener('change', () => {
  const v = Math.max(1, Math.min(30, parseInt(dom.settingShort.value) || 5));
  state.settings.shortBreakDuration = v;
  if (state.mode === 'shortBreak' && !state.timerRunning) {
    state.timeRemaining = v * 60;
    state.totalTime = v * 60;
  }
  updateState({ settings: state.settings });
});

dom.settingLong.addEventListener('change', () => {
  const v = Math.max(1, Math.min(60, parseInt(dom.settingLong.value) || 15));
  state.settings.longBreakDuration = v;
  if (state.mode === 'longBreak' && !state.timerRunning) {
    state.timeRemaining = v * 60;
    state.totalTime = v * 60;
  }
  updateState({ settings: state.settings });
});

dom.settingOntop.addEventListener('change', () => {
  state.settings.alwaysOnTop = dom.settingOntop.checked;
  window.electronAPI.setAlwaysOnTop(state.settings.alwaysOnTop);
  updateState({ settings: state.settings });
});

// Minimize to tray
dom.btnMinimize.addEventListener('click', () => {
  window.electronAPI.minimizeToTray();
});

// Tray commands
window.electronAPI.onTrayCommand((command) => {
  if (command === 'start-pause') toggleTimer();
  if (command === 'reset') resetTimer();
});

// ===== Keyboard shortcuts =====
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return; // Don't intercept typing
  if (e.code === 'Space') {
    e.preventDefault();
    toggleTimer();
  }
  if (e.code === 'KeyR') {
    resetTimer();
  }
});

// ===== Init =====
async function init() {
  try {
    const data = await window.electronAPI.loadData();
    if (data.settings) Object.assign(state.settings, data.settings);
    if (data.tasks) state.tasks = data.tasks;
    if (data.historyData) state.history = data.historyData;
  } catch {}

  // Apply persisted settings
  state.timeRemaining = getModeDuration();
  state.totalTime = state.timeRemaining;
  window.electronAPI.setAlwaysOnTop(state.settings.alwaysOnTop);
  window.electronAPI.updateTrayMenu(false);

  renderAll();
}

init();
