'use strict';

const accountStorage = window.localStorage;
let currentUser = accountStorage.getItem('activeTimetableUser') || '';
const userStorage = {
  getItem(k) { return accountStorage.getItem(`timetable:${currentUser || 'guest'}:${k}`); },
  setItem(k, v) { accountStorage.setItem(`timetable:${currentUser || 'guest'}:${k}`, v); },
  removeItem(k) { accountStorage.removeItem(`timetable:${currentUser || 'guest'}:${k}`); }
};

const byId = id => document.getElementById(id);
const dayNamesVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const shortDayNamesVi = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
const monthNamesVi = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

const pastelColors = ['#FAEDCB', '#C9E4DE', '#C6DEF1', '#DBCDF0', '#F2C6DE', '#F7D9C4'];
const allColors = [...pastelColors, '#000000', '#FFFFFF'];

const DAY_START = 405;
const DAY_END = 1305;
const ROW_HEIGHT = 52;
const STEP_MIN = 1;
const today = new Date();

let events = [];
let tasks = [];
let courses = [];
let notes = [];
let docs = [];
let logs = [];
let studySessions = [];

let nextId = 1, nextTaskId = 1, nextCourseId = 1, nextNoteId = 1, nextDocId = 1;

let viewDate = new Date();
let viewMode = 'week';
let currentView = 'home';
let popoverDate = new Date(viewDate);

let savedWeek = [];
let drag = null;
let dayColors = {};
let timeColor = '#C6DEF1';

let pomoTimeLeft = 45 * 60;
let pomoTimerId = null;
let pomoRunning = false;

const quotes = [
  "Học, học nữa, học mãi - Không ngừng nỗ lực mỗi ngày để chạm tới thành công!",
  "Đường đi khó không phải vì ngăn sông cách núi, mà vì lòng người ngại núi e sông.",
  "Kiến thức là tài sản quý giá nhất mà không ai có thể cướp đi của bạn.",
  "Hôm nay bạn nỗ lực 1 chút, ngày mai kết quả sẽ gấp bội.",
  "Hãy làm những việc bình thường với lòng đam mê phi thường."
];
function changeQuote() {
  let rand = quotes[Math.floor(Math.random() * quotes.length)];
  if (byId('quoteDisplay')) byId('quoteDisplay').textContent = `"${rand}"`;
}

const loadData = (key, fallback) => { try { return JSON.parse(userStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const saveData = (key, value) => userStorage.setItem(key, JSON.stringify(value));

const pad2 = n => String(n).padStart(2, '0');

const dateKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const addDays = (d, n) => { let x = new Date(d); x.setDate(x.getDate() + n); return x; };

const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));

const formatDate = d => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

const timeToMinutes = s => { let [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

const minutesToTime = m => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

const eventDate = e => e.date || dateKey(addDays(mondayOf(viewDate), e.day || 0));

const visibleEvents = () => events.filter(e => {
  if (viewMode === 'day') return eventDate(e) === dateKey(viewDate);
  return eventDate(e) >= dateKey(mondayOf(viewDate)) && eventDate(e) <= dateKey(addDays(mondayOf(viewDate), 6));
});

function updateLiveClockAndGreeting() {
  let now = new Date();
  let hours = now.getHours();
  let greeting = "Chào ngày mới";
  if (hours >= 5 && hours < 11) greeting = "Chào buổi sáng";
  else if (hours >= 11 && hours < 14) greeting = "Chào buổi trưa";
  else if (hours >= 14 && hours < 18) greeting = "Chào buổi chiều";
  else greeting = "Chào buổi tối";

  let nameStr = currentUser ? `, ${currentUser}` : "";
  if (byId('homeGreeting')) {
    byId('homeGreeting').textContent = `${greeting}${nameStr}! ✨`;
  }

  let timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  let dateStr = `${dayNamesVi[now.getDay()]} ngày ${now.getDate()} tháng ${now.getMonth()+1}, ${now.getFullYear()}`;
  if (byId('liveClock')) {
    byId('liveClock').textContent = `⏰ ${dateStr} - ${timeStr}`;
  }
}
setInterval(updateLiveClockAndGreeting, 1000);

function logAction(action, details) {
  let now = new Date();
  let timeStr = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  logs.unshift({ time: timeStr, action, details });
  if (logs.length > 100) logs.pop();
  saveData('timetableLogs', logs);
}

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return '';
  let parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

function toast(message, ms = 2000) {
  byId('toast').textContent = message;
  byId('toast').classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => byId('toast').classList.remove('show'), ms);
}

function closeOnOutsideClick(backdropId, closeIt) {
  const backdrop = byId(backdropId);
  backdrop.onclick = event => {
    if (event.target !== backdrop) return;
    if (closeIt) closeIt(); else backdrop.hidden = true;
  };
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function saveEvents() { saveData('timetableEvents', events); userStorage.setItem('timetableNextId', nextId); }
function saveTasks() { saveData('timetableTasks', tasks); userStorage.setItem('timetableNextTaskId', nextTaskId); }
function saveCourses() { saveData('timetableCourses', courses); userStorage.setItem('timetableNextCourseId', nextCourseId); }
function saveNotes() { saveData('timetableNotes', notes); userStorage.setItem('timetableNextNoteId', nextNoteId); }
function saveDocs() { saveData('timetableDocs', docs); userStorage.setItem('timetableNextDocId', nextDocId); }

function darkenInDarkMode(hex) {
  if (!document.body.classList.contains('dark')) return hex;
  if (hex.startsWith('#') && hex.length === 7) {
    let n = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return '#' + n.map(v => Math.round(v * 0.42).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  return hex;
}

function isDarkColor(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return false;
  const value = parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness < 128;
}

function readableTextColor(hex) {
  if (hex.startsWith('#') && hex.length === 7) {
    let c = hex.slice(1), r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 140 ? '#fff' : '#000';
  }
  return document.body.classList.contains('dark') ? '#fff' : '#000';
}

function applyAppearance() {
  let isDark = userStorage.getItem('darkMode') === '1';
  document.body.classList.toggle('dark', isDark);

  let pageCol = userStorage.getItem('pageColor') || '#FFFFFF';
  let gridCol = userStorage.getItem('gridColor') || '#FFFFFF';
  let activeTimeCol = darkenInDarkMode(timeColor || '#C6DEF1');

  document.documentElement.style.setProperty('--page', darkenInDarkMode(pageCol));
  document.documentElement.style.setProperty('--grid', darkenInDarkMode(gridCol));
  document.documentElement.style.setProperty('--time', activeTimeCol);

  const setVar = (name, value) => document.documentElement.style.setProperty(name, value);

  const pageBg = darkenInDarkMode(pageCol);
  const pageIsDark = isDarkColor(pageBg);
  setVar('--ink-p', pageIsDark ? '#f3f6f9' : '#263447');
  setVar('--muted-p', pageIsDark ? '#c9d2dc' : '#5b6b7b');
  setVar('--accent-p', pageIsDark ? '#8cc4ff' : '#1d5fb0');
  setVar('--good-p', pageIsDark ? '#7fd69a' : '#1f7a3a');
  setVar('--bad-p', pageIsDark ? '#ff9a94' : '#b0302a');

  const gridBg = darkenInDarkMode(gridCol);
  const boxBg = gridCol.toUpperCase() === '#FFFFFF' ? (isDark ? '#202c3a' : '#ffffff') : gridBg;
  const boxIsDark = isDarkColor(boxBg);
  setVar('--box', boxBg);
  setVar('--ink-g', boxIsDark ? '#f3f6f9' : '#263447');
  setVar('--muted-g', boxIsDark ? '#c9d2dc' : '#5b6b7b');
  setVar('--accent-g', boxIsDark ? '#8cc4ff' : '#1d5fb0');

  setVar('--ink-t', isDarkColor(activeTimeCol) ? '#f3f6f9' : '#263447');

  document.body.classList.toggle('page-dark', pageIsDark);
  document.body.classList.toggle('grid-dark', isDarkColor(gridBg));

  byId('light').classList.toggle('active', !isDark);
  byId('dark').classList.toggle('active', isDark);
}

function makePalette(container, selected, change) {
  byId(container).innerHTML = '';
  allColors.forEach(c => {
    let b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = c;
    b.title = c;
    b.classList.toggle('selected', c.toLowerCase() === selected.toLowerCase());
    b.onclick = () => change(c);
    byId(container).append(b);
  });
  let custom = document.createElement('button');
  custom.type = 'button';
  custom.className = 'custom';
  custom.textContent = '+';
  custom.title = 'Màu tùy chỉnh';
  let input = document.createElement('input');
  input.type = 'color';
  input.hidden = true;
  input.value = selected;
  custom.onclick = () => input.click();
  input.oninput = () => change(input.value);
  byId(container).append(custom, input);
}

function buildSettings() {
  makePalette('pagePalette', userStorage.getItem('pageColor') || '#FFFFFF', c => { userStorage.setItem('pageColor', c); applyAppearance(); buildSettings(); });
  makePalette('gridPalette', userStorage.getItem('gridColor') || '#FFFFFF', c => { userStorage.setItem('gridColor', c); applyAppearance(); buildSettings(); });
}

function openWeekdayPicker(header, index) {
  const wasOpen = !!header.querySelector('.picker-popover');
  document.querySelectorAll('.picker-popover').forEach(x => x.remove());
  if (wasOpen) return;
  let p = document.createElement('div');
  p.className = 'picker-popover';
  p.hidden = false;
  p.onclick = e => e.stopPropagation();
  makePaletteInto(p, dayColors[index] || '#C6DEF1', c => { dayColors[index] = c; saveData('dayColors', dayColors); render(); });
  header.append(p);
}

function closeFloatingPickers() {
  document.querySelectorAll('body > .picker-popover').forEach(x => x.remove());
}
window.addEventListener('scroll', closeFloatingPickers, true);

function openTimePicker(ev) {
  const wasOpen = !!document.querySelector('body > .picker-popover');
  document.querySelectorAll('.picker-popover').forEach(x => x.remove());
  if (wasOpen) return;
  let p = document.createElement('div');
  p.className = 'picker-popover';
  p.hidden = false;
  p.onclick = e => e.stopPropagation();
  makePaletteInto(p, timeColor || '#C6DEF1', c => { timeColor = c; userStorage.setItem('timeColor', timeColor); p.remove(); applyAppearance(); render(); });
  p.style.position = 'fixed';
  p.style.zIndex = 100;
  p.style.visibility = 'hidden';
  document.body.append(p);
  const w = p.offsetWidth, h = p.offsetHeight;
  p.style.left = Math.max(4, Math.min(ev.clientX, window.innerWidth - w - 4)) + 'px';
  p.style.top = Math.max(4, Math.min(ev.clientY, window.innerHeight - h - 4)) + 'px';
  p.style.visibility = '';
}

function makePaletteInto(parent, selected, change) {
  let palette = document.createElement('div');
  palette.className = 'palette';
  allColors.forEach(c => {
    let b = document.createElement('button');
    b.className = 'swatch';
    b.type = 'button';
    b.style.background = c;
    b.classList.toggle('selected', c.toLowerCase() === selected.toLowerCase());
    b.onclick = e => { e.stopPropagation(); change(c); };
    palette.append(b);
  });
  let input = document.createElement('input');
  input.type = 'color';
  input.hidden = true;
  input.value = selected;
  let custom = document.createElement('button');
  custom.type = 'button';
  custom.className = 'custom';
  custom.textContent = '+';
  custom.onclick = e => { e.stopPropagation(); input.click(); };
  input.oninput = () => change(input.value);
  parent.append(palette, custom, input);
}

function renderPopoverCalendar() {
  let y = popoverDate.getFullYear();
  let m = popoverDate.getMonth();
  byId('popMonthYearLabel').textContent = `${monthNamesVi[m]} ${y}`;

  let grid = byId('popDaysGrid');
  grid.innerHTML = '';

  let firstDayOfMonth = new Date(y, m, 1);
  let lastDayOfMonth = new Date(y, m + 1, 0);
  let startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
  let totalDays = lastDayOfMonth.getDate();
  let prevMonthLastDay = new Date(y, m, 0).getDate();

  for (let i = startDayIndex - 1; i >= 0; i--) {
    let dNum = prevMonthLastDay - i;
    let dObj = new Date(y, m - 1, dNum);
    let cell = document.createElement('div');
    cell.className = 'pop-day-cell other-month';
    cell.textContent = dNum;
    cell.onclick = e => { e.stopPropagation(); viewDate = dObj; viewMode = 'week'; byId('monthPopover').hidden = true; render(); };
    grid.append(cell);
  }

  for (let d = 1; d <= totalDays; d++) {
    let dObj = new Date(y, m, d);
    let cell = document.createElement('div');
    cell.className = 'pop-day-cell';
    cell.textContent = d;
    let dStr = dateKey(dObj);
    if (dStr === dateKey(today)) cell.classList.add('today');
    if (dStr === dateKey(viewDate)) cell.classList.add('selected');
    cell.onclick = e => { e.stopPropagation(); viewDate = dObj; viewMode = 'week'; byId('monthPopover').hidden = true; render(); };
    grid.append(cell);
  }

  let totalCellsSoFar = startDayIndex + totalDays;
  let remainingCells = totalCellsSoFar % 7 === 0 ? 0 : 7 - (totalCellsSoFar % 7);
  for (let i = 1; i <= remainingCells; i++) {
    let dObj = new Date(y, m + 1, i);
    let cell = document.createElement('div');
    cell.className = 'pop-day-cell other-month';
    cell.textContent = i;
    cell.onclick = e => { e.stopPropagation(); viewDate = dObj; viewMode = 'week'; byId('monthPopover').hidden = true; render(); };
    grid.append(cell);
  }
}

function isTaskNearOrOverdue(t) {
  if (!t.date || t.completed) return false;
  let timeStr = t.time || '00:00';
  let deadlineDate = new Date(`${t.date}T${timeStr}:00`);
  let now = new Date();
  let diffMs = deadlineDate - now;
  let diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= 1;
}

function taskDeadlineMs(t) {
  if (!t.date) return Infinity;
  return new Date(`${t.date}T${t.time || '23:59'}:00`).getTime();
}
function isTaskOverdue(t) {
  return !t.completed && !!t.date && taskDeadlineMs(t) < Date.now();
}
const PRIORITY_RANK = { high: 0, mid: 1, low: 2 };
const PRIORITY_LABEL = { high: '🔴 Cao', mid: '🟡 Vừa', low: '🟢 Thấp' };
function sortedTasks() {
  const group = t => t.completed ? 2 : (isTaskOverdue(t) ? 1 : 0);
  return tasks.slice().sort((a, b) => {
    const da = taskDeadlineMs(a), db = taskDeadlineMs(b);
    const dd = da === db ? 0 : (da < db ? -1 : 1);
    return group(a) - group(b) || dd || (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) || (b.id - a.id);
  });
}

function freeMinutesUntil(deadlineMs) {
  const endDay = new Date(deadlineMs), endKey = dateKey(endDay);
  let total = 0;
  for (let d = new Date(), n = 0; dateKey(d) <= endKey && n < 120; d = addDays(d, 1), n++) {
    const dk = dateKey(d);
    freeSlotsFor(dk, 30).forEach(sl => {
      const en = dk === endKey ? Math.min(sl.end, endDay.getHours() * 60 + endDay.getMinutes()) : sl.end;
      if (en - sl.start >= 30) total += en - sl.start;
    });
  }
  return total;
}

function computeTaskWarnings() {
  const out = new Map();
  let cum = 0;
  tasks.filter(t => !t.completed && !isTaskOverdue(t) && t.date && Number(t.estimate) > 0)
    .sort((x, y) => taskDeadlineMs(x) - taskDeadlineMs(y))
    .forEach(t => {
      cum += Number(t.estimate) * 60;
      const avail = freeMinutesUntil(taskDeadlineMs(t));
      if (cum > avail) out.set(t.id, { need: cum, avail });
    });
  return out;
}

let taskFilter = 'all';
function refreshTaskFilter() {
  const sel = byId('taskSubjectFilter');
  sel.innerHTML = '';
  const add = (v, txt) => { const o = document.createElement('option'); o.value = v; o.textContent = txt; sel.append(o); };
  add('all', 'Tất cả môn');
  [...new Set(tasks.map(t => t.subject).filter(Boolean))].forEach(n => add(n, n));
  if (tasks.some(t => !t.subject)) add('__none', 'Chung (không chọn môn)');
  if ([...sel.options].some(o => o.value === taskFilter)) sel.value = taskFilter; else taskFilter = 'all';
}
byId('taskSubjectFilter').onchange = () => { taskFilter = byId('taskSubjectFilter').value; renderTasksPage(); };

let exams = [];
function saveExams() { saveData('timetableExams', exams); }
function daysUntil(dateStr) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T00:00:00') - t0) / 86400000);
}
function renderExamStrip() {
  const strip = byId('examStrip');
  strip.innerHTML = '';
  exams.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(ex => {
    const n = daysUntil(ex.date);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'exam-chip' + (n < 0 ? ' past' : n <= 3 ? ' urgent' : n <= 7 ? ' soon' : '');
    const ico = document.createElement('span'); ico.className = 'ex-ico'; ico.textContent = '📆';
    const nm = document.createElement('span'); nm.className = 'ex-name'; nm.textContent = ex.name;
    const bd = document.createElement('span'); bd.className = 'ex-badge';
    bd.textContent = n < 0 ? 'đã thi' : n === 0 ? 'thi hôm nay!' : 'còn ' + n + ' ngày';
    b.append(ico, nm, bd);
    b.title = `Ngày thi: ${formatDateDDMMYYYY(ex.date)}`;
    b.onclick = () => openExamForm(ex);
    strip.append(b);
  });
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'exam-chip add';
  add.textContent = '＋ Thêm kỳ thi'; add.title = 'Thêm kỳ thi để đếm ngược số ngày còn lại';
  add.onclick = () => openExamForm();
  strip.append(add);
}
function openExamForm(ex = null) {
  byId('examForm').reset();
  byId('examId').value = ex?.id || '';
  byId('examFormTitle').textContent = ex ? 'Chỉnh sửa kỳ thi' : 'Thêm kỳ thi';
  byId('examName').value = ex?.name || '';
  byId('examDate').value = ex?.date || '';
  byId('deleteExamBtn').hidden = !ex;
  byId('examNameList').innerHTML = '';
  courses.forEach(c => { const o = document.createElement('option'); o.value = c.name; byId('examNameList').append(o); });
  byId('examBackdrop').hidden = false;
}
function saveExamFromForm() {
  const name = byId('examName').value.trim(), dateStr = byId('examDate').value;
  if (!name || !dateStr) { toast('Hãy nhập môn thi và ngày thi.'); return null; }
  let ex = exams.find(x => x.id === Number(byId('examId').value));
  if (ex) { ex.name = name; ex.date = dateStr; logAction('Sửa', `Kỳ thi: ${name}`); }
  else {
    ex = { id: exams.reduce((m, x) => Math.max(m, x.id), 0) + 1, name, date: dateStr };
    exams.push(ex);
    logAction('Thêm', `Kỳ thi: ${name}`);
  }
  saveExams();
  return ex;
}
byId('examForm').onsubmit = e => {
  e.preventDefault();
  if (!saveExamFromForm()) return;
  byId('examBackdrop').hidden = true;
  renderTasksPage();
  toast('Đã lưu kỳ thi.');
};
byId('cancelExamBtn').onclick = () => { byId('examBackdrop').hidden = true; };
closeOnOutsideClick('examBackdrop');
byId('deleteExamBtn').onclick = () => {
  const ex = exams.find(x => x.id === Number(byId('examId').value));
  if (!ex) return;
  const reviews = events.filter(e => e.reviewFor === ex.id);
  if (!confirm(`Bạn có chắc muốn xóa kỳ thi này?${reviews.length ? ' Các buổi ôn tập đã tạo trong Lịch học cũng sẽ bị xóa.' : ''}`)) return;
  exams = exams.filter(x => x.id !== ex.id);
  if (reviews.length) { events = events.filter(e => e.reviewFor !== ex.id); saveEvents(); }
  saveExams();
  logAction('Xóa', `Kỳ thi: ${ex.name}`);
  byId('examBackdrop').hidden = true;
  renderTasksPage();
};

byId('makeReviewBtn').onclick = () => {
  const ex = saveExamFromForm();
  if (!ex) return;
  if (daysUntil(ex.date) < 1) { toast('Ngày thi cần sau hôm nay để tạo lịch ôn tập.'); return; }
  const count = Math.max(1, Math.min(14, Number(byId('reviewCount').value) || 5));
  const len = Math.max(30, Math.min(240, Number(byId('reviewLen').value) || 90));
  events = events.filter(e => e.reviewFor !== ex.id);
  const days = [];
  for (let d = new Date(); dateKey(d) < ex.date && days.length < 120; d = addDays(d, 1)) {
    const slots = freeSlotsFor(dateKey(d), len, 480);
    if (slots.length) days.push({ day: dateKey(d), start: slots[0].start });
  }
  const n = Math.min(count, days.length);
  for (let i = 0; i < n; i++) {
    const pick = days[Math.floor((i + 0.5) * days.length / n)];
    events.push({ id: nextId++, title: `Ôn thi: ${ex.name}`, description: '', date: pick.day, start: minutesToTime(pick.start), end: minutesToTime(pick.start + len), bg: '#F7D9C4', reviewFor: ex.id });
  }
  saveEvents();
  logAction('Thêm', `Lịch ôn tập: ${ex.name} (${n} buổi)`);
  byId('examBackdrop').hidden = true;
  renderTasksPage();
  toast(n ? (n < count ? `Chỉ tìm được ${n}/${count} buổi trống. Đã thêm vào Lịch học.` : `Đã thêm ${n} buổi ôn tập vào Lịch học.`) : 'Không còn khung giờ trống trước ngày thi.', 3500);
};

const isGraded = c => c.score !== null && c.score !== undefined && c.score !== '' && !isNaN(Number(c.score));

function getHUMGGrade(score) {
  if (score >= 9.0) return { letter: 'A+', point: 4.0 };
  if (score >= 8.5) return { letter: 'A', point: 3.8 };
  if (score >= 8.0) return { letter: 'B+', point: 3.5 };
  if (score >= 7.0) return { letter: 'B', point: 3.0 };
  if (score >= 6.5) return { letter: 'C+', point: 2.5 };
  if (score >= 5.5) return { letter: 'C', point: 2.0 };
  if (score >= 5.0) return { letter: 'D+', point: 1.5 };
  if (score >= 4.0) return { letter: 'D', point: 1.0 };
  return { letter: 'F', point: 0.0 };
}

function renderTasksPage() {
  let list = byId('taskList');
  list.innerHTML = '';
  refreshTaskFilter();
  renderExamStrip();
  const taskWarn = computeTaskWarnings();
  const shown = sortedTasks().filter(t => taskFilter === 'all' || (taskFilter === '__none' ? !t.subject : t.subject === taskFilter));
  if (tasks.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.6;">Chưa có nhiệm vụ nào được tạo.</div>';
  } else if (!shown.length) {
    list.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.6;">Không có nhiệm vụ nào thuộc môn này.</div>';
  } else {
    shown.forEach((t) => {
      let overdue = isTaskOverdue(t);
      let item = document.createElement('div');
      item.className = 'task-item' + (t.completed ? ' completed' : '') + (overdue ? ' overdue' : '');

      let taskBg = darkenInDarkMode(t.color || '#C6DEF1');
      let taskTextColor = readableTextColor(taskBg);
      item.classList.toggle('on-dark', isDarkColor(taskBg));
      item.style.background = taskBg;
      item.style.color = taskTextColor;

      let chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'task-checkbox' + (overdue ? ' overdue' : '');
      chk.checked = !!t.completed;
      if (overdue) chk.title = 'Quá hạn (tick nếu bạn đã hoàn thành muộn)';
      chk.onchange = () => {
        t.completed = chk.checked;
        if (chk.checked) t.doneAt = dateKey(new Date()); else delete t.doneAt;
        saveTasks();
        renderTasksPage();
      };

      let content = document.createElement('div');
      content.className = 'task-content';

      let titleRow = document.createElement('div');
      titleRow.className = 'task-title-row';

      let title = document.createElement('span');
      title.className = 'task-title-text';
      title.textContent = t.text;
      titleRow.append(title);
      content.append(titleRow);

      let descEl = null;
      if (t.description) {
        descEl = document.createElement('div');
        descEl.className = 'task-desc-text';
        descEl.textContent = t.description;
        descEl.hidden = true;
        content.append(descEl);
      }

      let meta = document.createElement('div');
      meta.className = 'task-meta';
      if (t.date || t.time) {
        let formattedDate = formatDateDDMMYYYY(t.date);
        let deadlineStr = 'Hạn: ' + (formattedDate ? formattedDate : '') + (t.time ? ' ' + t.time : '');
        let deadlineEl = document.createElement('span');
        deadlineEl.className = 'task-deadline';
        deadlineEl.textContent = deadlineStr + (overdue ? ' · Quá hạn' : '');

        if (!overdue && isTaskNearOrOverdue(t)) {
          deadlineEl.classList.add('warning');
        }

        meta.append(deadlineEl);
      }

      const addTag = txt => { const sp = document.createElement('span'); sp.className = 'task-tag'; sp.textContent = txt; meta.append(sp); };
      if (t.subject) addTag('📚 ' + t.subject);
      if (t.priority) addTag(PRIORITY_LABEL[t.priority] || '');
      if (Number(t.estimate) > 0) addTag('⏱ ~' + fmtDur(Number(t.estimate) * 60));
      content.append(meta);
      if (taskWarn.has(t.id)) {
        const w = taskWarn.get(t.id), warn = document.createElement('div');
        warn.className = 'task-warn';
        warn.textContent = `⚠ Cần ~${fmtDur(w.need)} (gồm các việc đến hạn trước) nhưng chỉ còn ~${fmtDur(w.avail)} trống trong Lịch học`;
        content.append(warn);
      }

      content.onclick = () => {
        if (descEl) descEl.hidden = !descEl.hidden;
      };

      let moreWrap = document.createElement('div');
      moreWrap.className = 'task-more-wrap';

      let moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'task-more-btn';
      moreBtn.textContent = '⋯';
      moreBtn.onclick = ev => {
        ev.stopPropagation();
        document.querySelectorAll('.task-menu').forEach(m => { if (m !== menu) m.hidden = true; });
        menu.hidden = !menu.hidden;
        menu.style.top = ''; menu.style.bottom = '';
        if (!menu.hidden) {
          let area = list.closest('.task-scroll-area').getBoundingClientRect();
          if (menu.getBoundingClientRect().bottom > area.bottom) { menu.style.top = 'auto'; menu.style.bottom = '26px'; }
        }
      };

      let menu = document.createElement('div');
      menu.className = 'task-menu';
      menu.hidden = true;

      let editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Chỉnh sửa';
      editBtn.onclick = ev => {
        ev.stopPropagation();
        menu.hidden = true;
        openTaskForm(t);
      };

      let delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Xóa';
      delBtn.style.color = '#c55';
      delBtn.onclick = ev => {
        ev.stopPropagation();
        menu.hidden = true;
        if (confirm('Bạn có chắc muốn xóa nhiệm vụ này?')) {
          logAction('Xóa', `Nhiệm vụ: ${t.text}`);
          tasks = tasks.filter(x => x.id !== t.id);
          saveTasks();
          renderTasksPage();
        }
      };

      menu.append(editBtn, delBtn);
      moreWrap.append(moreBtn, menu);

      item.append(chk, content, moreWrap);
      list.append(item);
    });
  }

  let totalTasks = tasks.length;
  let completedTasks = tasks.filter(t => t.completed).length;
  let percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  byId('statTotal').textContent = totalTasks;
  byId('statCompleted').textContent = completedTasks;
  byId('statPercent').textContent = percent + '%';

  if (byId('progressBarFill')) {
    byId('progressBarFill').style.width = percent + '%';
    if (percent < 50) byId('progressBarFill').style.backgroundColor = '#d9534f';
    else if (percent < 80) byId('progressBarFill').style.backgroundColor = '#f0ad4e';
    else byId('progressBarFill').style.backgroundColor = '#5cb85c';
  }

  let courseBody = byId('courseTableBody');
  courseBody.innerHTML = '';
  if (courses.length === 0) {
    courseBody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.6;">Chưa có môn học nào.</td></tr>';
    byId('gpaDisplay').textContent = '0.00';
    byId('creditsDisplay').textContent = '0';
  } else {
    let totalPointsWeighted = 0;
    let totalCredits = 0;
    let passedCredits = 0;

    courses.slice().sort((a, b) => (isGraded(a) ? 1 : 0) - (isGraded(b) ? 1 : 0) || b.id - a.id).forEach(c => {
      let tr = document.createElement('tr');
      let graded = isGraded(c);
      let humg = graded ? getHUMGGrade(c.score) : null;
      if (graded) {
        totalPointsWeighted += humg.point * c.credits;
        totalCredits += Number(c.credits);
        if (humg.letter !== 'F') passedCredits += Number(c.credits);
      } else tr.className = 'pending';

      tr.innerHTML = `
        <td><b>${escapeHtml(c.name)}</b></td>
        <td>${c.credits}</td>
        <td>${graded ? c.score : '—'}</td>
        <td>${graded ? `<b>${humg.letter}</b> (${humg.point})` : '<i>Chưa thi</i>'}</td>
        <td>
          <div style="display:flex; gap:4px;">
            <button type="button" class="btn" style="padding:2px 6px; font-size:11px;" onclick="openCourseForm(${c.id})">Sửa</button>
            <button type="button" class="btn" style="padding:2px 6px; font-size:11px; background:#f4c5c5; border-color:#d59999;" onclick="deleteCourse(${c.id})">Xóa</button>
          </div>
        </td>
      `;
      courseBody.append(tr);
    });

    let gpa = totalCredits > 0 ? (totalPointsWeighted / totalCredits).toFixed(2) : '0.00';
    byId('gpaDisplay').textContent = gpa;
    byId('creditsDisplay').textContent = passedCredits;
  }
}

function renderNotes() {
  let grid = byId('notesGrid');
  grid.innerHTML = '';
  if (notes.length === 0) {
    grid.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.6;">Chưa có ghi nhớ nào. Bấm "Thêm ghi chú" để tạo.</div>';
    return;
  }
  notes.forEach(n => {
    let card = document.createElement('div');
    card.className = 'note-card';
    let cardBg = darkenInDarkMode(n.color || '#C6DEF1');
    card.style.background = cardBg;
    card.style.color = readableTextColor(cardBg);

    let titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'note-title-input';
    titleInput.placeholder = 'Tiêu đề...';
    titleInput.value = n.title || '';
    titleInput.oninput = () => {
      n.title = titleInput.value;
      saveNotes();
    };

    let contentInput = document.createElement('textarea');
    contentInput.className = 'note-content-input';
    contentInput.placeholder = 'Nhập nội dung ghi nhớ...';
    contentInput.value = n.content || '';
    contentInput.oninput = () => {
      n.content = contentInput.value;
      saveNotes();
    };

    let actionsRow = document.createElement('div');
    actionsRow.className = 'note-actions';

    let colorPickerSpan = document.createElement('div');
    colorPickerSpan.style.display = 'flex';
    colorPickerSpan.style.gap = '6px';
    colorPickerSpan.style.alignItems = 'center';

    pastelColors.slice(0, 6).forEach(col => {
      let dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'swatch note-dot' + ((n.color || '').toLowerCase() === col.toLowerCase() ? ' on' : '');
      dot.style.background = col;
      dot.onclick = () => {
        n.color = col;
        saveNotes();
        renderNotes();
      };
      colorPickerSpan.append(dot);
    });

    let delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn';
    delBtn.style.padding = '2px 8px';
    delBtn.style.fontSize = '11px';
    delBtn.style.background = '#f4c5c5';
    delBtn.style.borderColor = '#d59999';
    delBtn.textContent = 'Xóa';
    delBtn.onclick = () => {
      logAction('Xóa', `Ghi nhớ: ${n.title || '(Không tiêu đề)'}`);
      notes = notes.filter(x => x.id !== n.id);
      saveNotes();
      renderNotes();
    };

    actionsRow.append(colorPickerSpan, delBtn);
    card.append(titleInput, contentInput, actionsRow);
    grid.append(card);
  });
}

byId('addNoteBtn').onclick = () => {
  let newNote = { id: nextNoteId++, title: '', content: '', color: '#C6DEF1' };
  notes.unshift(newNote);
  logAction('Thêm', 'Ghi chú mới');
  saveNotes();
  renderNotes();
};

function setDocColor(id, col) {
  const d = docs.find(x => x.id === id); if (!d) return;
  d.color = (d.color || '').toLowerCase() === col.toLowerCase() ? '' : col;
  saveDocs(); renderDocsPage();
}
function renderDocsPage() {
  let grid = byId('docsGrid');
  grid.innerHTML = '';
  if (docs.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:30px; opacity:0.6;">Chưa có tài liệu nào được lưu trữ. Bấm "Thêm tài liệu" để bắt đầu.</div>';
    return;
  }
  docs.forEach(d => {
    let card = document.createElement('div');
    card.className = 'doc-card';
    if (d.color) { let bg = darkenInDarkMode(d.color); card.classList.add('tinted'); card.style.background = bg; card.style.color = readableTextColor(bg); }
    card.innerHTML = `
      <div>
        <span style="font-size: 11px; font-weight: bold; background: var(--mint); color: var(--ink-mint); padding: 2px 6px; border-radius: 4px; border: 1px solid #7bc5b4;">${escapeHtml(d.subject || 'Chung')}</span>
        <h4 style="margin-top: 6px;">${escapeHtml(d.title)}</h4>
      </div>
      ${d.link ? `<a class="doc-link" href="${escapeHtml(d.link)}" target="_blank" rel="noopener" title="Mở liên kết">🔗 ${escapeHtml(d.link)}</a>` : ''}
      ${d.fileData ? `<a class="doc-link" href="${d.fileData}" download="${d.fileName || 'tai-lieu'}" title="Tải tệp đính kèm">📎 Tải tệp: ${d.fileName || 'Tệp đính kèm'}</a>` : ''}
      ${d.description ? `<p style="margin: 0; font-size: 13px; opacity: 0.9; white-space: pre-wrap;">${escapeHtml(d.description)}</p>` : ''}
      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-top:auto;">
        <div class="doc-dots" style="display:flex; gap:6px; align-items:center;">${pastelColors.slice(0, 6).map(c => `<button type="button" class="swatch note-dot${(d.color || '').toLowerCase() === c.toLowerCase() ? ' on' : ''}" style="background:${c}" onclick="setDocColor(${d.id}, '${c}')"></button>`).join('')}</div>
        <div style="display:flex; gap:6px;">
        <button type="button" class="btn" style="padding:2px 8px; font-size:11px;" onclick="openDocForm(${d.id})">Sửa</button>
        <button type="button" class="btn" style="padding:2px 8px; font-size:11px; background:#f4c5c5; border-color:#d59999;" onclick="deleteDoc(${d.id})">Xóa</button>
        </div>
      </div>
    `;
    grid.append(card);
  });
}

function openDocForm(id = null) {
  byId('docFormModal').reset();
  if (id !== null) {
    let d = docs.find(x => x.id === id);
    if (!d) return;
    byId('docId').value = d.id;
    byId('docFormTitle').textContent = 'Chỉnh sửa tài liệu';
    byId('docTitleInput').value = d.title;
    byId('docSubjectInput').value = d.subject || '';
    byId('docLinkInput').value = d.link || '';
    byId('docDescInput').value = d.description || '';
    byId('deleteDocBtn').hidden = false;
  } else {
    byId('docId').value = '';
    byId('docFormTitle').textContent = 'Thêm tài liệu học phần';
    byId('deleteDocBtn').hidden = true;
  }
  byId('docBackdrop').hidden = false;
}

byId('addDocBtn').onclick = () => openDocForm();
byId('cancelDocBtn').onclick = () => { byId('docBackdrop').hidden = true; };
closeOnOutsideClick('docBackdrop');

byId('deleteDocBtn').onclick = () => {
  let id = Number(byId('docId').value);
  let d = docs.find(x => x.id === id);
  if (d) logAction('Xóa', `Tài liệu: ${d.title}`);
  docs = docs.filter(x => x.id !== id);
  saveDocs();
  byId('docBackdrop').hidden = true;
  renderDocsPage();
};

byId('docFormModal').onsubmit = e => {
  e.preventDefault();
  let id = byId('docId').value ? Number(byId('docId').value) : nextDocId++;
  let title = byId('docTitleInput').value.trim();
  let subject = byId('docSubjectInput').value.trim();
  let link = byId('docLinkInput').value.trim();
  let description = byId('docDescInput').value.trim();
  let fileInput = byId('docFileInput');
  if (!title) return;

  let existing = docs.find(x => x.id === id) || {};
  let fileData = existing.fileData || '';
  let fileName = existing.fileName || '';

  const processAndSave = (dataUrl, name) => {
    let docObj = { id, title, subject, link, description, fileData: dataUrl || fileData, fileName: name || fileName, color: existing.color || '' };
    let existingIdx = docs.findIndex(x => x.id === id);
    if (existingIdx >= 0) {
      docs[existingIdx] = docObj;
      logAction('Sửa', `Tài liệu: ${title}`);
      toast('Đã cập nhật tài liệu.');
    } else {
      docs.unshift(docObj);
      logAction('Thêm', `Tài liệu: ${title}`);
      toast('Đã thêm tài liệu thành công.');
    }
    saveDocs();
    byId('docBackdrop').hidden = true;
    renderDocsPage();
  };

  if (fileInput.files && fileInput.files[0]) {
    let file = fileInput.files[0];
    let reader = new FileReader();
    reader.onload = function(uploadEvent) {
      processAndSave(uploadEvent.target.result, file.name);
    };
    reader.readAsDataURL(file);
  } else {
    processAndSave();
  }
};

function deleteDoc(id) {
  if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
  let d = docs.find(x => x.id === id);
  if (d) logAction('Xóa', `Tài liệu: ${d.title}`);
  docs = docs.filter(x => x.id !== id);
  saveDocs();
  renderDocsPage();
  toast('Đã xóa tài liệu.');
}

function renderDataPage() {
  let tbody = byId('logTableBody');
  tbody.innerHTML = '';
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; opacity:0.6;">Chưa có lịch sử hoạt động nào.</td></tr>';
    return;
  }
  logs.forEach(l => {
    let tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.time}</td>
      <td><b>${l.action}</b></td>
      <td>${escapeHtml(l.details)}</td>
    `;
    tbody.append(tr);
  });
}

byId('clearLogsBtn').onclick = () => {
  if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử?')) return;
  logs = [];
  userStorage.removeItem('timetableLogs');
  renderDataPage();
  toast('Đã xóa toàn bộ lịch sử.');
};

const fmtDur = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? ' ' + r + 'p' : ''}` : `${r}p`; };
const minutesBetween = (from, to) => studySessions.filter(x => x.date >= from && x.date <= to).reduce((a, x) => a + x.minutes, 0);

function buildBarChart(el) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i - 6));
  const vals = days.map(d => minutesBetween(dateKey(d), dateKey(d)));
  const max = Math.max(60, ...vals);
  el.innerHTML = days.map((d, i) => `
    <div class="bar-col${i === 6 ? ' today' : ''}" title="${formatDate(d)}: ${fmtDur(vals[i])}">
      <div class="bar-val">${vals[i] ? fmtDur(vals[i]) : ''}</div>
      <div class="bar" style="height: ${Math.round(vals[i] / max * 100)}px"></div>
      <div class="bar-lbl">${shortDayNamesVi[(d.getDay() + 6) % 7]}</div>
    </div>`).join('');
}

function calcStreak() {
  const now = new Date(), todayKey = dateKey(now);
  const dset = new Set(studySessions.map(x => x.date));
  let cursor = dset.has(todayKey) ? now : addDays(now, -1), streak = 0;
  while (dset.has(dateKey(cursor))) { streak++; cursor = addDays(cursor, -1); }
  let best = 0, run = 0, prev = null;
  [...dset].sort().forEach(dk => {
    run = prev && dateKey(addDays(new Date(prev + 'T00:00:00'), 1)) === dk ? run + 1 : 1;
    best = Math.max(best, run); prev = dk;
  });
  return { streak, best };
}

function buildHeatmap(el) {
  const now = new Date(), todayKey = dateKey(now);
  const start = addDays(mondayOf(now), -77), perDay = {};
  studySessions.forEach(x => { perDay[x.date] = (perDay[x.date] || 0) + x.minutes; });
  let cells = '';
  for (let i = 0; i < 84; i++) {
    const d = addDays(start, i), k = dateKey(d), m = perDay[k] || 0;
    const lvl = m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
    cells += `<i class="heat-cell l${lvl}${k > todayKey ? ' future' : ''}" title="${formatDate(d)}: ${m ? fmtDur(m) : 'không học'}"></i>`;
  }
  el.innerHTML = cells;
}

function renderHomeStats() {
  if (!byId('homeStats')) return;
  const now = new Date(), todayKey = dateKey(now);
  const mon = mondayOf(now), weekMin = minutesBetween(dateKey(mon), dateKey(addDays(mon, 6)));
  const goalH = Number(userStorage.getItem('weeklyGoalHours')) || 10;
  const pct = Math.min(100, Math.round(weekMin / (goalH * 60) * 100));
  const { streak } = calcStreak();
  const pendingTasks = tasks.filter(t => !t.completed && !isTaskOverdue(t)).length;
  const nextExam = exams.filter(e => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  byId('homeTiles').innerHTML = `
    <div class="home-tile" onclick="switchView('stats')"><span>Hôm nay</span><b>${fmtDur(minutesBetween(todayKey, todayKey))}</b><small>giờ học</small></div>
    <div class="home-tile" onclick="switchView('stats')"><span>Tuần này</span><b>${fmtDur(weekMin)}</b><small>${pct}% mục tiêu ${goalH}h</small></div>
    <div class="home-tile" onclick="switchView('stats')"><span>Chuỗi ngày học</span><b>🔥 ${streak}</b><small>ngày liên tiếp</small></div>
    <div class="home-tile" onclick="switchView('tasks')"><span>Nhiệm vụ còn lại</span><b>${pendingTasks}</b><small>${nextExam ? escapeHtml(nextExam.name) + ' thi còn ' + daysUntil(nextExam.date) + ' ngày' : 'chưa có kỳ thi'}</small></div>`;
}

function renderStatsPage() {
  const now = new Date(), todayKey = dateKey(now);
  byId('statsToday').textContent = `Hôm nay: ${fmtDur(minutesBetween(todayKey, todayKey))}`;
  byId('statsEmpty').hidden = studySessions.length > 0;

  const mon = mondayOf(now), monKey = dateKey(mon), sunKey = dateKey(addDays(mon, 6));
  const goalH = Number(userStorage.getItem('weeklyGoalHours')) || 10;
  const weekMin = minutesBetween(monKey, sunKey);
  const pct = Math.min(100, Math.round(weekMin / (goalH * 60) * 100));
  byId('weeklyGoalInput').value = goalH;
  byId('goalDone').textContent = fmtDur(weekMin);
  byId('goalPct').textContent = `(${pct}%)`;
  byId('goalBar').style.width = pct + '%';
  byId('goalBar').style.backgroundColor = pct < 50 ? '#d9534f' : pct < 80 ? '#f0ad4e' : '#5cb85c';

  const lastMon = addDays(mon, -7), lastWeekMin = minutesBetween(dateKey(lastMon), dateKey(addDays(lastMon, 6)));
  const diff = weekMin - lastWeekMin;
  const diffTxt = diff === 0 ? 'bằng tuần trước' : `<span class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲ +' : '▼ -'}${fmtDur(Math.abs(diff))}</span> so với tuần trước`;
  const doneIn = (a, b) => tasks.filter(t => t.completed && t.doneAt && t.doneAt >= a && t.doneAt <= b).length;
  const doneThis = doneIn(monKey, sunKey), doneLast = doneIn(dateKey(lastMon), dateKey(addDays(lastMon, 6)));
  const studyDays = new Set(studySessions.filter(x => x.date >= monKey && x.date <= sunKey).map(x => x.date)).size;
  const sessionsThis = studySessions.filter(x => x.date >= monKey && x.date <= sunKey).length;
  byId('weekSummary').innerHTML = `
    <div class="sum-row"><span>Giờ học tuần này</span><b>${fmtDur(weekMin)}</b></div>
    <div class="sum-row"><span>So với tuần trước (${fmtDur(lastWeekMin)})</span><span>${diffTxt}</span></div>
    <div class="sum-row"><span>Số phiên học · số ngày có học</span><b>${sessionsThis} · ${studyDays}/7</b></div>
    <div class="sum-row"><span>Nhiệm vụ hoàn thành (tuần trước: ${doneLast})</span><b>${doneThis}</b></div>`;

  buildBarChart(byId('barChart'));

  const from30 = dateKey(addDays(now, -29)), bySub = {};
  studySessions.filter(x => x.date >= from30 && x.date <= todayKey).forEach(x => { const k = x.subject || 'Chung'; bySub[k] = (bySub[k] || 0) + x.minutes; });
  const total = Object.values(bySub).reduce((a, b) => a + b, 0);
  byId('subjectBars').innerHTML = total ? Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([n, m]) => `
    <div class="sub-row"><div class="sub-top"><span>${escapeHtml(n)}</span><span>${fmtDur(m)} · ${Math.round(m / total * 100)}%</span></div>
    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${Math.round(m / total * 100)}%"></div></div></div>`).join('')
    : '<div style="font-size:13px; opacity:0.7;">Chưa có dữ liệu trong 30 ngày qua.</div>';

  const { streak, best } = calcStreak();
  byId('streakLine').innerHTML = streak ? `🔥 Chuỗi hiện tại: <b>${streak} ngày</b> · Dài nhất: <b>${best} ngày</b>`
    : `Chưa có chuỗi. Học một phiên hôm nay để bắt đầu! ${best ? '(Dài nhất: ' + best + ' ngày)' : ''}`;

  buildHeatmap(byId('heatmap'));
}

byId('weeklyGoalInput').onchange = () => {
  const v = Math.max(1, Math.min(100, Number(byId('weeklyGoalInput').value) || 10));
  userStorage.setItem('weeklyGoalHours', v);
  renderStatsPage();
};
byId('addSessionBtn').onclick = () => {
  fillSubjectSelect(byId('sessionSubject'));
  byId('sessionDate').value = dateKey(new Date());
  byId('sessionMinutes').value = 60;
  byId('sessionBackdrop').hidden = false;
};
byId('cancelSession').onclick = () => { byId('sessionBackdrop').hidden = true; };
closeOnOutsideClick('sessionBackdrop');
byId('sessionForm').onsubmit = e => {
  e.preventDefault();
  const minutes = Math.round(Number(byId('sessionMinutes').value));
  if (!(minutes > 0)) return;
  const subject = byId('sessionSubject').value;
  studySessions.push({ date: byId('sessionDate').value, minutes, subject });
  saveData('studySessions', studySessions);
  logAction('Thêm', `Giờ học: ${minutes} phút${subject ? ' - ' + subject : ''}`);
  byId('sessionBackdrop').hidden = true;
  renderStatsPage();
  toast('Đã ghi giờ học.');
};

function updatePomoDisplay() {
  let m = Math.floor(pomoTimeLeft / 60);
  let s = pomoTimeLeft % 60;
  byId('pomoTimer').textContent = `${pad2(m)}:${pad2(s)}`;
  byId('pomoTimer').classList.toggle('break', pomoMode === 'break');
  byId('pomoSubject').disabled = pomoMode === 'break';
  byId('pomoStart').textContent = pomoRunning ? 'Tạm dừng' : 'Bắt đầu';
}

let pomoMode = 'study', pomoTotalMin = 45;

function setPomoTime(minutes, modeName) {
  clearInterval(pomoTimerId);
  pomoRunning = false;
  pomoMode = modeName || 'study';
  pomoTotalMin = minutes;
  pomoTimeLeft = minutes * 60;
  byId('customMinInput').value = minutes;
  updatePomoDisplay();
}

function recordStudySession() {
  if (pomoMode !== 'study' || !(pomoTotalMin > 0)) return;
  const subject = byId('pomoSubject').value;
  studySessions.push({ date: dateKey(new Date()), minutes: pomoTotalMin, subject });
  saveData('studySessions', studySessions);
  logAction('Thêm', `Giờ học: ${pomoTotalMin} phút${subject ? ' - ' + subject : ''}`);
  toast(`Đã ghi ${pomoTotalMin} phút học${subject ? ' môn ' + subject : ''}.`);
}

function fillSubjectSelect(sel, withGeneral = true) {
  const cur = sel.value;
  sel.innerHTML = '';
  const names = [...new Set(courses.map(c => c.name))];
  if (withGeneral) { const o = document.createElement('option'); o.value = ''; o.textContent = 'Chung (không chọn môn)'; sel.append(o); }
  names.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.append(o); });
  if (cur && names.includes(cur)) sel.value = cur;
}

function applyCustomTime() {
  let val = parseInt(byId('customMinInput').value);
  if (!val || val <= 0) {
    toast('Vui lòng nhập số phút hợp lệ.');
    return;
  }
  setPomoTime(val, pomoMode);
}

byId('pomoStart').onclick = () => {
  if (pomoRunning) {
    clearInterval(pomoTimerId);
    pomoRunning = false;
    updatePomoDisplay();
    return;
  }
  if (pomoTimeLeft <= 0) pomoTimeLeft = (parseInt(byId('customMinInput').value) || pomoTotalMin || 45) * 60;
  pomoRunning = true;
  updatePomoDisplay();
  pomoTimerId = setInterval(() => {
    if (pomoTimeLeft > 0) {
      pomoTimeLeft--;
      updatePomoDisplay();
    } else {
      clearInterval(pomoTimerId);
      pomoRunning = false;
      updatePomoDisplay();
      recordStudySession();
      byId('timerAlertModal').hidden = false;
    }
  }, 1000);
};

byId('pomoReset').onclick = applyCustomTime;
byId('customMinInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyCustomTime(); } });

function initToolsPage() {
  notes = loadData('timetableNotes', []);
  nextNoteId = Number(userStorage.getItem('timetableNextNoteId') || 1);
  if (notes.length === 0) {
    notes.push({ id: nextNoteId++, title: 'Ghi chú mẫu', content: 'Nhập ý chính cần ghi nhớ tại đây...', color: '#C6DEF1' });
    saveNotes();
  }
  renderNotes();
  fillSubjectSelect(byId('pomoSubject'));
  updatePomoDisplay();
}

byId('calcInput').onkeydown = e => {
  if (e.key === 'Enter') {
    calculateMath();
  }
};

function calculateMath() {
  let expr = byId('calcInput').value.trim();
  if (!expr) return;
  try {
    let result = Function(`'use strict'; return (${expr})`)();
    byId('calcResult').textContent = result;
  } catch {
    byId('calcResult').textContent = 'Biểu thức lỗi';
  }
}

byId('exportExcelBtn').onclick = () => {
  if (courses.length === 0) {
    toast('Môn học & Điểm số chưa có môn nào để xuất Excel.');
    return;
  }
  let dataToExport = courses.map((c, index) => {
    let humg = isGraded(c) ? getHUMGGrade(c.score) : null;
    return {
      "STT": index + 1,
      "Tên môn học": c.name,
      "Số tín chỉ": c.credits,
      "Điểm tổng kết (Thang 10)": humg ? c.score : '',
      "Điểm chữ": humg ? humg.letter : 'Chưa thi',
      "Điểm hệ 4": humg ? humg.point : ''
    };
  });

  let worksheet = XLSX.utils.json_to_sheet(dataToExport);
  let workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "BangDiemHUMG");

  let totalPointsWeighted = 0;
  let totalCredits = 0;
  courses.filter(isGraded).forEach(c => {
    let humg = getHUMGGrade(c.score);
    totalPointsWeighted += humg.point * c.credits;
    totalCredits += Number(c.credits);
  });
  let gpa = totalCredits > 0 ? (totalPointsWeighted / totalCredits).toFixed(2) : '0.00';

  XLSX.utils.sheet_add_aoa(worksheet, [["", "", "", "", "GPA Tích lũy:", Number(gpa)]], {origin: -1});

  XLSX.writeFile(workbook, "BangDiem_HUMG.xlsx");
  toast('Đã xuất Môn học & Điểm số ra file Excel.');
};

byId('exportPdfBtn').onclick = () => {
  window.print();
};

function deleteCourse(id) {
  if (!confirm('Bạn có chắc muốn xóa môn học này?')) return;
  let c = courses.find(x => x.id === id);
  if (c) logAction('Xóa', `Môn học: ${c.name}`);
  courses = courses.filter(c => c.id !== id);
  saveCourses();
  renderTasksPage();
  toast('Đã xóa môn học.');
}

function openTaskForm(t = null) {
  byId('taskFormModal').reset();
  byId('taskId').value = t?.id || '';
  byId('taskFormTitle').textContent = t ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ';
  byId('deleteTaskBtn').hidden = !t;
  byId('taskTitleInput').value = t?.text || '';
  byId('taskDateInput').value = t?.date || '';
  byId('taskTimeInput').value = t?.time || '';
  byId('taskDescInput').value = t?.description || '';
  byId('taskColorInput').value = t?.color || '#C6DEF1';
  fillSubjectSelect(byId('taskSubjectInput'));
  if (t?.subject && ![...byId('taskSubjectInput').options].some(o => o.value === t.subject)) {
    const o = document.createElement('option'); o.value = t.subject; o.textContent = t.subject; byId('taskSubjectInput').append(o);
  }
  byId('taskSubjectInput').value = t?.subject || '';
  byId('taskPriorityInput').value = t?.priority || 'mid';
  byId('taskEstimateInput').value = t?.estimate || '';

  makePalette('taskPaletteContainer', byId('taskColorInput').value, c => {
    byId('taskColorInput').value = c;
    document.querySelectorAll('#taskPaletteContainer .swatch').forEach(b => b.classList.toggle('selected', b.style.backgroundColor === c));
  });
  byId('taskBackdrop').hidden = false;
}

byId('addTaskBtn').onclick = () => openTaskForm();
byId('cancelTaskBtn').onclick = () => { byId('taskBackdrop').hidden = true; };
closeOnOutsideClick('taskBackdrop');

byId('deleteTaskBtn').onclick = () => {
  let id = Number(byId('taskId').value);
  let t = tasks.find(x => x.id === id);
  if (t) logAction('Xóa', `Nhiệm vụ: ${t.text}`);
  tasks = tasks.filter(x => x.id !== id);
  saveTasks();
  byId('taskBackdrop').hidden = true;
  renderTasksPage();
};

byId('taskFormModal').onsubmit = e => {
  e.preventDefault();
  let id = Number(byId('taskId').value) || nextTaskId++;
  let text = byId('taskTitleInput').value.trim();
  if (!text) return;

  let taskData = {
    id,
    text,
    date: byId('taskDateInput').value,
    time: byId('taskTimeInput').value,
    description: byId('taskDescInput').value,
    color: byId('taskColorInput').value,
    subject: byId('taskSubjectInput').value,
    priority: byId('taskPriorityInput').value,
    estimate: Math.max(0, Number(byId('taskEstimateInput').value) || 0),
    completed: false
  };

  let existingIdx = tasks.findIndex(x => x.id === id);
  if (existingIdx >= 0) {
    taskData.completed = tasks[existingIdx].completed;
    if (tasks[existingIdx].doneAt) taskData.doneAt = tasks[existingIdx].doneAt;
    tasks[existingIdx] = taskData;
    logAction('Sửa', `Nhiệm vụ: ${text}`);
  } else {
    tasks.push(taskData);
    logAction('Thêm', `Nhiệm vụ: ${text}`);
  }

  saveTasks();
  byId('taskBackdrop').hidden = true;
  renderTasksPage();
  toast('Đã lưu nhiệm vụ thành công.');
};

function openCourseForm(id = null) {
  byId('courseFormModal').reset();
  if (id !== null) {
    let c = courses.find(x => x.id === id);
    if (!c) return;
    byId('courseId').value = c.id;
    byId('courseFormTitle').textContent = 'Chỉnh sửa môn học';
    byId('courseNameInput').value = c.name;
    byId('courseCreditsInput').value = c.credits;
    byId('courseScoreInput').value = isGraded(c) ? c.score : 8.5;
    byId('coursePendingInput').checked = !isGraded(c);
  } else {
    byId('courseId').value = '';
    byId('courseFormTitle').textContent = 'Thêm môn học';
    byId('courseNameInput').value = '';
    byId('courseCreditsInput').value = 3;
    byId('courseScoreInput').value = 8.5;
    byId('coursePendingInput').checked = false;
  }
  syncPendingUI();
  byId('courseBackdrop').hidden = false;
}

function syncPendingUI() {
  const pending = byId('coursePendingInput').checked;
  byId('courseScoreInput').disabled = pending;
  byId('courseScoreInput').required = !pending;
}
byId('coursePendingInput').onchange = syncPendingUI;

byId('addCourseBtn').onclick = () => openCourseForm();
byId('cancelCourseBtn').onclick = () => { byId('courseBackdrop').hidden = true; };
closeOnOutsideClick('courseBackdrop');

byId('courseFormModal').onsubmit = e => {
  e.preventDefault();
  let id = byId('courseId').value ? Number(byId('courseId').value) : null;
  let name = byId('courseNameInput').value.trim();
  let credits = Number(byId('courseCreditsInput').value);
  let score = byId('coursePendingInput').checked ? null : Number(byId('courseScoreInput').value);
  if (!name) return;

  if (id !== null) {
    let c = courses.find(x => x.id === id);
    if (c) {
      c.name = name;
      c.credits = credits;
      c.score = score;
    }
    logAction('Sửa', `Môn học: ${name}`);
    toast('Đã cập nhật môn học thành công.');
  } else {
    courses.push({ id: nextCourseId++, name, credits, score });
    logAction('Thêm', `Môn học: ${name}`);
    toast('Đã thêm môn học thành công.');
  }

  saveCourses();
  byId('courseBackdrop').hidden = true;
  renderTasksPage();
};

const remindersOn = () => userStorage.getItem('remindersOn') === '1';
const notifGranted = () => 'Notification' in window && Notification.permission === 'granted';

function updateRemindNote() {
  byId('remindToggle').checked = remindersOn();
  byId('remindNote').textContent = !remindersOn() ? 'Nhắc trước giờ học 10 phút và nhiệm vụ còn 1 giờ đến hạn.'
    : notifGranted() ? 'Đang bật thông báo hệ thống. Chỉ nhắc khi trang này còn mở.'
    : 'Trình duyệt chưa cho phép thông báo hệ thống nên nhắc nhở chỉ hiện trong trang. Trang cần còn mở.';
}

byId('remindToggle').onchange = async () => {
  if (byId('remindToggle').checked) {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) {  }
    }
    userStorage.setItem('remindersOn', '1');
    updateRemindNote();
    toast('Đã bật nhắc nhở.');
    checkReminders();
  } else {
    userStorage.setItem('remindersOn', '0');
    updateRemindNote();
    toast('Đã tắt nhắc nhở.');
  }
};

function checkReminders() {
  if (!remindersOn()) return;
  const nowMs = Date.now();
  const sent = new Set(loadData('remindersSent', []));
  const msgs = [];
  const add = (id, title, body) => { if (!sent.has(id)) { sent.add(id); msgs.push({ title, body }); } };

  events.forEach(e => {
    const left = (new Date(`${eventDate(e)}T${e.start}:00`).getTime() - nowMs) / 60000;
    if (left > 0 && left <= 10) add(`e:${e.id}:${eventDate(e)}:${e.start}`, '📅 Sắp đến giờ học', `${e.title} lúc ${e.start} (còn ${Math.ceil(left)} phút)`);
  });
  tasks.forEach(t => {
    if (t.completed || !t.date) return;
    const left = (taskDeadlineMs(t) - nowMs) / 60000;
    if (left > 0 && left <= 60) add(`t:${t.id}:${t.date}:${t.time || ''}`, '⏰ Nhiệm vụ sắp đến hạn', `${t.text} (còn ${Math.ceil(left)} phút)`);
  });
  if (!msgs.length) return;

  saveData('remindersSent', [...sent].slice(-200));
  if (notifGranted()) msgs.forEach(m => { try { new Notification(m.title, { body: m.body }); } catch (e) {  } });
  toast(msgs.length === 1 ? `${msgs[0].title}: ${msgs[0].body}` : `🔔 ${msgs.length} nhắc nhở: ${msgs.map(m => m.body).join(' · ')}`, 7000);
}
setInterval(checkReminders, 60000);

const storagePrefix = () => `timetable:${currentUser || 'guest'}:`;

function exportBackup() {
  const prefix = storagePrefix(), data = {};
  for (let i = 0; i < accountStorage.length; i++) {
    const k = accountStorage.key(i);
    if (k.startsWith(prefix)) data[k.slice(prefix.length)] = accountStorage.getItem(k);
  }
  const payload = { app: 'quan-ly-thoi-gian-hoc-tap', version: 1, user: currentUser || 'guest', exportedAt: new Date().toISOString(), data };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  a.download = `QuanLyHocTap_${dateKey(new Date())}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  logAction('Sao lưu', `Xuất ${Object.keys(data).length} mục dữ liệu ra file`);
  toast('Đã tải file sao lưu.');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let payload;
    try { payload = JSON.parse(reader.result); } catch (e) { toast('File không đọc được (không phải JSON).'); return; }
    if (!payload || !String(payload.app || '').startsWith('quan-ly') || !payload.data || typeof payload.data !== 'object') { toast('Đây không phải file sao lưu của ứng dụng này.'); return; }
    const when = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString('vi-VN') : 'không rõ';
    if (!confirm(`Bạn có chắc muốn khôi phục dữ liệu từ bản sao lưu (${when})? Dữ liệu hiện tại của tài khoản này sẽ bị thay thế.`)) return;
    const prefix = storagePrefix();
    try {
      const old = [];
      for (let i = 0; i < accountStorage.length; i++) if (accountStorage.key(i).startsWith(prefix)) old.push(accountStorage.key(i));
      old.forEach(k => accountStorage.removeItem(k));
      Object.entries(payload.data).forEach(([k, v]) => { if (typeof v === 'string') accountStorage.setItem(prefix + k, v); });
    } catch (e) { toast('Không khôi phục được (bộ nhớ trình duyệt đầy?).'); return; }
    loadUserData();
    logAction('Khôi phục', 'Nhập dữ liệu từ file sao lưu');
    toast('Đã khôi phục dữ liệu.');
  };
  reader.readAsText(file);
}
document.querySelectorAll('[data-act="backup"]').forEach(b => b.onclick = exportBackup);
document.querySelectorAll('[data-act="restore"]').forEach(b => b.onclick = () => { byId('backupFile').value = ''; byId('backupFile').click(); });
byId('backupFile').onchange = () => { if (byId('backupFile').files[0]) importBackup(byId('backupFile').files[0]); };

function switchView(viewName) {
  currentView = viewName;
  render();
}

byId('homeViewBtn').onclick = () => switchView('home');
byId('calendarViewBtn').onclick = () => switchView('calendar');
byId('taskViewBtn').onclick = () => switchView('tasks');
byId('toolsViewBtn').onclick = () => switchView('tools');
byId('docViewBtn').onclick = () => switchView('docs');
byId('dataViewBtn').onclick = () => switchView('data');
byId('statsViewBtn').onclick = () => switchView('stats');

let navBarVisible = true;
function setNavVisible(v) {
  navBarVisible = v;
  byId('navSlide').classList.toggle('collapsed', !v);
}
let navOpenedAtY = null, navToggledAt = 0, navAutoHidden = false;
byId('toggleNavBtn').onclick = () => {
  setNavVisible(!navBarVisible);
  navAutoHidden = false;
  navOpenedAtY = navBarVisible && window.scrollY > 2 ? window.scrollY : null;
  navToggledAt = Date.now();
};

window.addEventListener('scroll', () => {
  if (window.matchMedia('(max-width: 800px)').matches) return;
  const y = window.scrollY;
  if (Date.now() - navToggledAt < 700) { if (navOpenedAtY !== null) navOpenedAtY = y; return; }
  if (y <= 2) { navOpenedAtY = null; if (!navBarVisible && navAutoHidden) { setNavVisible(true); navAutoHidden = false; } }
  else if (navBarVisible && y > 120 && (navOpenedAtY === null || y - navOpenedAtY > 80)) { setNavVisible(false); navAutoHidden = true; navOpenedAtY = null; }
}, { passive: true });

function render() {
  document.querySelectorAll('body > .event-menu').forEach(m => m.remove());
  closeFloatingPickers();
  let mon = mondayOf(viewDate);

  if (viewMode === 'week') {
    let weekDayName = dayNamesVi[(today.getDay())];
    byId('dateButton').innerHTML = `${formatDate(mon)} - ${formatDate(addDays(mon, 6))}<br><span style="font-weight:normal;font-size:12px;">${weekDayName} (${formatDate(today)})</span>`;
    byId('previous').innerHTML = 'Tuần trước<span>←</span>';
    byId('next').innerHTML = 'Tuần sau<span>→</span>';
  } else if (viewMode === 'day') {
    let dayName = dayNamesVi[viewDate.getDay()];
    byId('dateButton').innerHTML = `${formatDate(viewDate)}<br><span style="font-weight:normal;font-size:12px;">(${dayName})</span>`;
    byId('previous').innerHTML = 'Hôm trước<span>←</span>';
    byId('next').innerHTML = 'Hôm sau<span>→</span>';
  }

  byId('dayView').classList.toggle('active', currentView === 'calendar' && viewMode === 'day');
  byId('weekView').classList.toggle('active', currentView === 'calendar' && viewMode === 'week');

  byId('homeViewBtn').classList.toggle('active', currentView === 'home');
  byId('calendarViewBtn').classList.toggle('active', currentView === 'calendar');
  byId('taskViewBtn').classList.toggle('active', currentView === 'tasks');
  byId('toolsViewBtn').classList.toggle('active', currentView === 'tools');
  byId('docViewBtn').classList.toggle('active', currentView === 'docs');
  byId('dataViewBtn').classList.toggle('active', currentView === 'data');
  byId('statsViewBtn').classList.toggle('active', currentView === 'stats');

  byId('monthViewBtn').classList.remove('active');

  byId('homeMain').hidden = (currentView !== 'home');
  byId('toolsMain').hidden = (currentView !== 'tools');
  byId('docsMain').hidden = (currentView !== 'docs');
  byId('dataMain').hidden = (currentView !== 'data');
  byId('statsMain').hidden = (currentView !== 'stats');
  byId('calendarMain').hidden = (currentView !== 'calendar');
  byId('tasksMain').hidden = (currentView !== 'tasks');

  byId('navDateBar').hidden = (currentView !== 'calendar');
  byId('calendarFooter').hidden = (currentView !== 'calendar');

  if (currentView === 'home') {
    updateLiveClockAndGreeting();
    renderHomeStats();
    applyAppearance();
    return;
  }

  if (currentView === 'tools') {
    initToolsPage();
    applyAppearance();
    return;
  }

  if (currentView === 'docs') {
    renderDocsPage();
    applyAppearance();
    return;
  }

  if (currentView === 'stats') {
    renderStatsPage();
    applyAppearance();
    return;
  }

  if (currentView === 'data') {
    renderDataPage();
    applyAppearance();
    return;
  }

  if (currentView === 'tasks') {
    renderTasksPage();
    applyAppearance();
    return;
  }

  let heads = byId('heads'), scheduleContainer = byId('scheduleContainer');
  scheduleContainer.innerHTML = '<div class="times" id="times"></div><div class="columns" id="columns"></div>';

  heads.className = 'heads ' + viewMode;
  byId('columns').className = 'columns ' + viewMode;
  heads.innerHTML = ''; byId('columns').innerHTML = '';

  let activeTimeCol = darkenInDarkMode(timeColor || '#C6DEF1');
  let activeTextColor = readableTextColor(activeTimeCol);

  let timeHead = document.createElement('div');
  timeHead.className = 'head-time';
  timeHead.textContent = '06:45';
  timeHead.style.background = activeTimeCol;
  timeHead.style.color = activeTextColor;
  timeHead.title = 'Nhấp để đổi màu cột giờ';
  timeHead.onclick = e => { e.stopPropagation(); openTimePicker(e); };
  heads.append(timeHead);

  let indexes = viewMode === 'week' ? [0, 1, 2, 3, 4, 5, 6] : [(viewDate.getDay() + 6) % 7];
  indexes.forEach(i => {
    let h = document.createElement('div');
    h.className = 'day-head';
    h.style.background = darkenInDarkMode(dayColors[i] || '#C6DEF1');
    h.style.color = readableTextColor(darkenInDarkMode(dayColors[i] || '#C6DEF1'));
    h.innerHTML = `<span class="name">${shortDayNamesVi[i]}</span>`;
    h.title = 'Nhấp để đổi màu';
    h.onclick = e => { e.stopPropagation(); openWeekdayPicker(h, i); };
    heads.append(h);
    let col = document.createElement('div');
    col.className = 'column';
    col.dataset.day = i;
    byId('columns').append(col);
  });

  let timesEl = byId('times');
  timesEl.style.background = activeTimeCol;
  timesEl.style.color = activeTextColor;
  timesEl.style.backgroundImage = `linear-gradient(to bottom, var(--line) 1px, transparent 1px), repeating-linear-gradient(to bottom, ${activeTimeCol} 0, ${activeTimeCol} calc(var(--row) - 1px), var(--line) calc(var(--row) - 1px), var(--line) var(--row))`;
  timesEl.innerHTML = '';

  timesEl.onclick = e => { e.stopPropagation(); openTimePicker(e); };

  for (let t = DAY_START + 60; t <= DAY_END; t += 60) {
    let label = document.createElement('div');
    label.className = 'time-label';
    label.textContent = minutesToTime(t);
    label.style.top = (((t - DAY_START) / 60) - 0.5) * ROW_HEIGHT + 'px';
    label.onclick = e => { e.stopPropagation(); openTimePicker(e); };
    timesEl.append(label);
  }

  conflictSet = conflictIds();
  visibleEvents().forEach(e => {
    let idx = viewMode === 'day' ? 0 : indexes.indexOf((new Date(eventDate(e) + 'T00:00:00').getDay() + 6) % 7);
    let col = byId('columns').children[idx];
    if (col) drawEvent(e, col);
  });
  applyAppearance();
}

function freeSlotsFor(dayKey, minLen = 45, from = DAY_START, ignoreId = 0) {
  let lo = from;
  if (dayKey === dateKey(new Date())) {
    const n = new Date();
    lo = Math.max(lo, Math.ceil((n.getHours() * 60 + n.getMinutes()) / 5) * 5);
  }
  const busy = events.filter(e => eventDate(e) === dayKey && e.id !== ignoreId).map(e => [timeToMinutes(e.start), timeToMinutes(e.end)]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = lo;
  busy.forEach(([st, en]) => {
    if (st - cur >= minLen) out.push({ start: cur, end: st });
    cur = Math.max(cur, en);
  });
  if (DAY_END - cur >= minLen) out.push({ start: cur, end: DAY_END });
  return out;
}

function conflictIds() {
  const byDay = {}, ids = new Set();
  events.forEach(e => { (byDay[eventDate(e)] = byDay[eventDate(e)] || []).push(e); });
  Object.values(byDay).forEach(list => {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (timeToMinutes(list[i].start) < timeToMinutes(list[j].end) && timeToMinutes(list[j].start) < timeToMinutes(list[i].end)) { ids.add(list[i].id); ids.add(list[j].id); }
    }
  });
  return ids;
}
let conflictSet = new Set();

function closeEventMenus() {
  document.querySelectorAll('body > .event-menu').forEach(m => { m.hidden = true; });
}
window.addEventListener('scroll', closeEventMenus, true);
window.addEventListener('resize', closeEventMenus);

function drawEvent(e, col) {
  let box = document.createElement('div');
  box.className = 'event';
  box.dataset.id = e.id;
  let top = (timeToMinutes(e.start) - DAY_START) / 60 * ROW_HEIGHT, height = (timeToMinutes(e.end) - timeToMinutes(e.start)) / 60 * ROW_HEIGHT;
  box.style.top = top + 'px';
  box.style.height = Math.max(12, height) + 'px';
  box.style.background = darkenInDarkMode(e.bg || '#C6DEF1');
  box.style.color = readableTextColor(darkenInDarkMode(e.bg || '#C6DEF1'));
  box.innerHTML = '<button class="more" type="button">⋯</button><div class="event-menu" hidden><button data-action="edit">Chỉnh sửa</button><button data-action="duplicate">Nhân bản sự kiện</button><button data-action="delete">Xóa sự kiện</button></div><div class="event-title"></div><div class="event-time"></div><div class="event-desc"></div><div class="resize"></div>';

  box.querySelector('.event-title').textContent = (conflictSet.has(e.id) ? '⚠ ' : '') + (e.seriesId ? '🔁 ' : '') + e.title;
  if (conflictSet.has(e.id)) { box.classList.add('conflict'); box.title = 'Trùng giờ với sự kiện khác'; }
  box.querySelector('.event-time').textContent = e.start + ' - ' + e.end;
  box.querySelector('.event-desc').textContent = e.description || '';

  const menuEl = box.querySelector('.event-menu');
  menuEl.addEventListener('click', () => setTimeout(() => { menuEl.hidden = true; }, 0), true);
  box.querySelector('.more').onclick = ev => {
    ev.stopPropagation();
    const willOpen = menuEl.hidden;
    closeEventMenus();
    if (!willOpen) return;
    document.body.append(menuEl);
    menuEl.hidden = false;
    const r = ev.currentTarget.getBoundingClientRect();
    menuEl.style.position = 'fixed';
    menuEl.style.zIndex = 100;
    menuEl.style.minWidth = '150px';
    menuEl.style.right = 'auto';
    menuEl.style.bottom = 'auto';
    menuEl.style.top = (r.bottom + 4) + 'px';
    menuEl.style.left = Math.max(4, Math.min(r.right - menuEl.offsetWidth, window.innerWidth - menuEl.offsetWidth - 4)) + 'px';
    if (r.bottom + 4 + menuEl.offsetHeight > window.innerHeight) menuEl.style.top = Math.max(4, r.top - menuEl.offsetHeight - 4) + 'px';
  };
  box.querySelector('[data-action="edit"]').onclick = ev => { ev.stopPropagation(); openForm(e); };

  box.querySelector('[data-action="duplicate"]').onclick = ev => {
    ev.stopPropagation();
    const originalDate = eventDate(e);
    const originalStart = timeToMinutes(e.start);
    const duration = timeToMinutes(e.end) - originalStart;
    const eventsOnSameDay = events.filter(item => eventDate(item) === originalDate);
    let freeSlot = null;

    for (let distance = STEP_MIN; distance <= DAY_END - DAY_START && !freeSlot; distance += STEP_MIN) {
      for (const direction of [1, -1]) {
        const start = originalStart + distance * direction;
        const end = start + duration;
        if (start < DAY_START || end > DAY_END) continue;
        const overlaps = eventsOnSameDay.some(item => start < timeToMinutes(item.end) && end > timeToMinutes(item.start));
        if (!overlaps) { freeSlot = { start, end }; break; }
      }
    }

    if (!freeSlot) { toast('Không còn khung giờ trống gần sự kiện này.'); return; }
    const duplicate = { ...e, id: nextId++, date: originalDate, start: minutesToTime(freeSlot.start), end: minutesToTime(freeSlot.end) };
    delete duplicate.day;
    delete duplicate.seriesId;
    events.push(duplicate);
    logAction('Thêm', `Nhân bản sự kiện: ${e.title}`);
    saveEvents();
    render();
    toast('Đã nhân bản sự kiện vào khung giờ trống gần đó.');
  };

  box.querySelector('[data-action="delete"]').onclick = ev => { ev.stopPropagation(); deleteEventFlow(e, true); };

  box.ondblclick = ev => { if (!ev.target.closest('button,.event-menu,.resize')) openForm(e); };
  box.onpointerdown = beginDrag;
  col.append(box);
}

function openForm(e = null) {
  byId('form').reset();
  byId('eventId').value = e?.id || '';
  byId('formTitle').textContent = e ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện';
  byId('deleteEvent').hidden = !e;
  byId('title').value = e?.title || '';
  byId('description').value = e?.description || '';
  byId('start').value = e?.start || '08:45';
  byId('end').value = e?.end || '09:45';
  byId('eventColor').value = e?.bg || '#C6DEF1';
  byId('eventDate').innerHTML = '';

  let baseDate = mondayOf(viewDate);
  for (let i = 0; i < 7; i++) {
    let d = addDays(baseDate, i), o = document.createElement('option');
    o.value = dateKey(d);
    o.textContent = shortDayNamesVi[i] + ' · ' + formatDate(d);
    o.selected = e ? eventDate(e) === o.value : viewMode === 'day' ? dateKey(viewDate) === o.value : i === 0;
    byId('eventDate').append(o);
  }
  if (e && !Array.from(byId('eventDate').options).some(o => o.value === eventDate(e))) {
    let o = document.createElement('option');
    o.value = eventDate(e);
    o.textContent = eventDate(e);
    o.selected = true;
    byId('eventDate').prepend(o);
  }

  makePalette('eventPalette', byId('eventColor').value, c => {
    byId('eventColor').value = c;
    document.querySelectorAll('#eventPalette .swatch').forEach(b => b.classList.toggle('selected', b.style.backgroundColor === c));
  });
  const inSeries = !!(e && e.seriesId);
  byId('repeatSelect').value = 'none';
  byId('repeatUntil').value = '';
  byId('repeatWrap').hidden = inSeries;
  byId('repeatUntilWrap').hidden = true;
  byId('seriesNote').hidden = !inSeries;
  byId('backdrop').hidden = false;
}

function updateRepeatUI() {
  const weekly = byId('repeatSelect').value === 'weekly';
  byId('repeatUntilWrap').hidden = !weekly;
  if (weekly) {
    const base = byId('eventDate').value;
    if (!byId('repeatUntil').value || byId('repeatUntil').value < base) byId('repeatUntil').value = dateKey(addDays(new Date(base + 'T00:00:00'), 98));
  }
}
byId('repeatSelect').onchange = updateRepeatUI;
byId('eventDate').onchange = () => { if (byId('repeatSelect').value === 'weekly') updateRepeatUI(); };

function askSeries(title, text) {
  return new Promise(resolve => {
    byId('seriesTitle').textContent = title;
    byId('seriesText').textContent = text;
    byId('seriesBackdrop').hidden = false;
    const done = v => { byId('seriesBackdrop').hidden = true; resolve(v); };
    byId('seriesOne').onclick = () => done('one');
    byId('seriesAll').onclick = () => done('all');
    byId('seriesCancel').onclick = () => done(null);
    byId('seriesBackdrop').onclick = ev => { if (ev.target === byId('seriesBackdrop')) done(null); };
  });
}

async function deleteEventFlow(e, needConfirm) {
  const members = e.seriesId ? events.filter(x => x.seriesId === e.seriesId) : [];
  if (members.length > 1) {
    const scope = await askSeries('Xóa sự kiện lặp lại', `"${e.title}" nằm trong chuỗi ${members.length} sự kiện. Bạn muốn xóa chỉ sự kiện này hay cả chuỗi?`);
    if (!scope) return false;
    if (scope === 'all') {
      logAction('Xóa', `Chuỗi sự kiện: ${e.title} (${members.length} buổi)`);
      events = events.filter(x => x.seriesId !== e.seriesId);
    } else {
      logAction('Xóa', `Sự kiện: ${e.title}`);
      events = events.filter(x => x.id !== e.id);
    }
  } else {
    if (needConfirm && !confirm('Bạn có chắc muốn xóa sự kiện này?')) return false;
    logAction('Xóa', `Sự kiện: ${e.title}`);
    events = events.filter(x => x.id !== e.id);
  }
  saveEvents(); render();
  return true;
}

function closeForm() { byId('backdrop').hidden = true; }

byId('form').onsubmit = async ev => {
  ev.preventDefault();
  const start = byId('start').value, end = byId('end').value;
  if (timeToMinutes(end) <= timeToMinutes(start)) { toast('Giờ kết thúc phải sau giờ bắt đầu.'); return; }
  const titleVal = byId('title').value.trim();
  if (!titleVal) return;

  const editId = Number(byId('eventId').value) || 0;
  const old = editId ? events.find(x => x.id === editId) : null;
  const fields = { title: titleVal, description: byId('description').value, start, end, bg: byId('eventColor').value };
  const newDate = byId('eventDate').value;
  const weekly = byId('repeatSelect').value === 'weekly' && !byId('repeatWrap').hidden;
  const until = byId('repeatUntil').value;
  if (weekly && (!until || until < newDate)) { toast('Hãy chọn ngày kết thúc lặp lại (không trước ngày bắt đầu).'); return; }

  let savedIds = [];

  if (old && old.seriesId && events.filter(x => x.seriesId === old.seriesId).length > 1) {
    const scope = await askSeries('Lưu thay đổi', 'Áp dụng thay đổi cho chỉ sự kiện này hay cả chuỗi lặp lại? (Nếu đổi ngày, cả chuỗi sẽ dời theo.)');
    if (!scope) return;
    const delta = Math.round((new Date(newDate + 'T00:00:00') - new Date(eventDate(old) + 'T00:00:00')) / 86400000);
    if (scope === 'all') {
      events.filter(x => x.seriesId === old.seriesId).forEach(m => {
        const md = dateKey(addDays(new Date(eventDate(m) + 'T00:00:00'), delta));
        Object.assign(m, fields, { date: md });
        delete m.day;
        savedIds.push(m.id);
      });
    } else {
      Object.assign(old, fields, { date: newDate });
      delete old.day;
      savedIds.push(old.id);
    }
    logAction('Sửa', `Sự kiện lặp: ${titleVal}${scope === 'all' ? ' (cả chuỗi)' : ''}`);
  } else {
    const item = { id: old ? old.id : nextId++, ...fields, date: newDate };
    if (old) { item.seriesId = old.seriesId; events = events.filter(x => x.id !== old.id); }
    events.push(item);
    savedIds.push(item.id);

    let created = 1;
    if (weekly) {
      const sid = 's' + Date.now();
      item.seriesId = sid;
      for (let d = addDays(new Date(newDate + 'T00:00:00'), 7); dateKey(d) <= until && created < 60; d = addDays(d, 7)) {
        const ne = { id: nextId++, ...fields, date: dateKey(d), seriesId: sid };
        events.push(ne); savedIds.push(ne.id);
        created++;
      }
    }
    logAction(old ? 'Sửa' : 'Thêm', `Sự kiện: ${titleVal}${weekly ? ` (lặp hàng tuần, ${created} buổi)` : ''}`);
    if (weekly) toast(`Đã tạo ${created} buổi lặp hàng tuần.`);
  }
  saveEvents(); closeForm(); render();

  const clash = conflictIds();
  const bad = events.filter(x => savedIds.includes(x.id) && clash.has(x.id));
  if (bad.length) {
    const other = events.find(o => !savedIds.includes(o.id) && clash.has(o.id) && eventDate(o) === eventDate(bad[0]) && timeToMinutes(o.start) < timeToMinutes(bad[0].end) && timeToMinutes(bad[0].start) < timeToMinutes(o.end));
    toast(`⚠ Trùng giờ${other ? ' với "' + other.title + '"' : ''}${bad.length > 1 ? ` (${bad.length} buổi bị trùng)` : ''}.`, 3800);
  }
};

byId('cancel').onclick = closeForm;
closeOnOutsideClick('backdrop', closeForm);
byId('deleteEvent').onclick = async () => {
  const evObj = events.find(x => x.id === Number(byId('eventId').value));
  if (!evObj) return;
  if (await deleteEventFlow(evObj, false)) closeForm();
};
byId('add').onclick = () => openForm();

function renderSlotList() {
  const dayKey = byId('slotDay').value, minLen = Number(byId('slotMin').value);
  const slots = freeSlotsFor(dayKey, minLen, DAY_START, Number(byId('eventId').value) || 0);
  byId('slotList').innerHTML = '';
  if (!slots.length) { byId('slotList').innerHTML = '<div class="slot-empty">Không còn khoảng trống phù hợp trong ngày này.</div>'; return; }
  slots.forEach(sl => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn';
    b.innerHTML = `<b>${minutesToTime(sl.start)} – ${minutesToTime(sl.end)}</b><span>${fmtDur(sl.end - sl.start)} · bấm để chọn</span>`;
    b.onclick = () => {

      const cur = timeToMinutes(byId('end').value) - timeToMinutes(byId('start').value);
      const len = cur > 0 ? cur : 60;
      byId('slotBackdrop').hidden = true;
      byId('eventDate').value = dayKey;
      byId('start').value = minutesToTime(sl.start);
      byId('end').value = minutesToTime(Math.min(sl.end, sl.start + len));
      if (!byId('title').value.trim()) byId('title').value = 'Học';
      byId('eventDate').dispatchEvent(new Event('change'));
    };
    byId('slotList').append(b);
  });
}
byId('freeSlotBtn').onclick = () => {
  byId('slotDay').innerHTML = '';
  [...byId('eventDate').options].forEach(o => {
    const c = document.createElement('option');
    c.value = o.value; c.textContent = o.textContent;
    if (o.value === byId('eventDate').value) c.selected = true;
    byId('slotDay').append(c);
  });
  renderSlotList();
  byId('slotBackdrop').hidden = false;
};
byId('slotDay').onchange = renderSlotList;
byId('slotMin').onchange = renderSlotList;
byId('closeSlots').onclick = () => { byId('slotBackdrop').hidden = true; };
closeOnOutsideClick('slotBackdrop');

byId('dayView').onclick = () => { currentView = 'calendar'; viewMode = 'day'; render(); };
byId('weekView').onclick = () => { currentView = 'calendar'; viewMode = 'week'; render(); };

byId('monthViewBtn').onclick = e => {
  e.stopPropagation();
  let pop = byId('monthPopover');
  pop.hidden = !pop.hidden;
  if (!pop.hidden) { popoverDate = new Date(viewDate); renderPopoverCalendar(); }
};

byId('popPrevMonth').onclick = e => {
  e.stopPropagation();
  popoverDate = new Date(popoverDate.getFullYear(), popoverDate.getMonth() - 1, 1);
  renderPopoverCalendar();
};
byId('popNextMonth').onclick = e => {
  e.stopPropagation();
  popoverDate = new Date(popoverDate.getFullYear(), popoverDate.getMonth() + 1, 1);
  renderPopoverCalendar();
};

byId('previous').onclick = () => {
  if (viewMode === 'week') viewDate = addDays(viewDate, -7);
  else if (viewMode === 'day') viewDate = addDays(viewDate, -1);
  render();
};
byId('next').onclick = () => {
  if (viewMode === 'week') viewDate = addDays(viewDate, 7);
  else if (viewMode === 'day') viewDate = addDays(viewDate, 1);
  render();
};
byId('dateButton').onclick = () => { viewDate = new Date(); render(); };

function placeSettings() {
  const box = byId('settings'); if (box.hidden) return;
  const r = byId('settingsButton').getBoundingClientRect();
  box.style.setProperty('--settings-top', Math.round(r.bottom + 10) + 'px');
  const right = Math.max(8, Math.round(innerWidth - r.right - 4));
  box.style.right = right + 'px';
}
byId('settingsButton').onclick = e => { e.stopPropagation(); byId('settings').hidden = !byId('settings').hidden; placeSettings(); };
['scroll', 'resize'].forEach(ev => window.addEventListener(ev, () => requestAnimationFrame(placeSettings), { passive: true }));

function updateAccountBar() {
  byId('userLabel').textContent = currentUser ? currentUser : '';
  byId('registerButton').hidden = !!currentUser;
  byId('loginButton').textContent = currentUser ? 'Đăng xuất' : 'Đăng nhập';
  updateLiveClockAndGreeting();
}

function loadUserData() {
  events = loadData('timetableEvents', []);
  nextId = Number(userStorage.getItem('timetableNextId') || 1);
  tasks = loadData('timetableTasks', []);
  nextTaskId = Number(userStorage.getItem('timetableNextTaskId') || 1);
  courses = loadData('timetableCourses', []);
  nextCourseId = Number(userStorage.getItem('timetableNextCourseId') || 1);
  docs = loadData('timetableDocs', []);
  nextDocId = Number(userStorage.getItem('timetableNextDocId') || 1);
  logs = loadData('timetableLogs', []);
  studySessions = loadData('studySessions', []);
  exams = loadData('timetableExams', []);
  dayColors = loadData('dayColors', {});
  timeColor = userStorage.getItem('timeColor') || '#C6DEF1';
  savedWeek = loadData('savedWeek', []);
  applyAppearance();
  buildSettings();
  render();
  updateAccountBar();
  fillSubjectSelect(byId('pomoSubject'));
  updateRemindNote();
  setTimeout(checkReminders, 1500);
}

function getAccounts() {
  try { return JSON.parse(accountStorage.getItem('timetableAccounts') || '{}'); } catch { return {}; }
}

byId('registerButton').onclick = () => { byId('settings').hidden = true; byId('registerBackdrop').hidden = false; };
byId('loginButton').onclick = () => {
  if (currentUser) {
    if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
    currentUser = '';
    accountStorage.removeItem('activeTimetableUser');
    loadUserData();
    toast('Đã đăng xuất.');
  } else {
    byId('loginUsername').value = '';
    byId('loginPassword').value = '';
    byId('settings').hidden = true;
    byId('loginBackdrop').hidden = false;
  }
};

byId('closeLogin').onclick = () => { byId('loginBackdrop').hidden = true; };
byId('closeRegister').onclick = () => { byId('registerBackdrop').hidden = true; };
closeOnOutsideClick('loginBackdrop');
closeOnOutsideClick('registerBackdrop');

byId('loginForm').onsubmit = e => {
  e.preventDefault();
  const username = byId('loginUsername').value.trim();
  const password = byId('loginPassword').value;
  const account = getAccounts()[username.toLowerCase()];
  if (!account || account.password !== password) { toast('Tên đăng nhập hoặc mật khẩu không đúng.'); return; }
  currentUser = account.username;
  accountStorage.setItem('activeTimetableUser', currentUser);
  byId('loginBackdrop').hidden = true;
  byId('loginForm').reset();
  loadUserData();
  toast(`Đăng nhập thành công. Xin chào ${currentUser}!`);
};

byId('registerForm').onsubmit = e => {
  e.preventDefault();
  const username = byId('registerUsername').value.trim();
  const password = byId('registerPassword').value;
  const confirmation = byId('registerConfirm').value;
  if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(username)) { toast('Tên đăng nhập cần 3–24 ký tự: chữ, số, _ hoặc -.'); return; }
  if (password.length < 4) { toast('Mật khẩu phải có ít nhất 4 ký tự.'); return; }
  if (password !== confirmation) { toast('Mật khẩu nhập lại không khớp.'); return; }

  const accounts = getAccounts();
  const accountKey = username.toLowerCase();
  if (accounts[accountKey]) { toast('Tên đăng nhập này đã tồn tại.'); return; }

  accounts[accountKey] = { username, password };
  accountStorage.setItem('timetableAccounts', JSON.stringify(accounts));
  currentUser = username;
  accountStorage.setItem('activeTimetableUser', currentUser);
  byId('registerBackdrop').hidden = true;
  byId('registerForm').reset();
  loadUserData();
  toast(`Tạo tài khoản thành công. Xin chào ${currentUser}!`);
};

document.addEventListener('click', e => {
  if (!e.target.closest('.settings') && !e.target.closest('#settingsButton')) byId('settings').hidden = true;
  if (!e.target.closest('.picker-popover') && !e.target.closest('.day-head') && !e.target.closest('.head-time') && !e.target.closest('.times') && !e.target.closest('.time-label')) {
    document.querySelectorAll('.picker-popover').forEach(x => x.remove());
  }
  if (!e.target.closest('#monthViewBtn') && !e.target.closest('#monthPopover')) byId('monthPopover').hidden = true;
  if (!e.target.closest('.task-more-wrap')) document.querySelectorAll('.task-menu').forEach(m => m.hidden = true);
  if (!e.target.closest('.event-menu')) closeEventMenus();
});

byId('light').onclick = () => { userStorage.setItem('darkMode', '0'); applyAppearance(); render(); };
byId('dark').onclick = () => { userStorage.setItem('darkMode', '1'); applyAppearance(); render(); };
byId('reset').onclick = () => {
  ['pageColor', 'gridColor', 'timeColor', 'darkMode', 'dayColors'].forEach(k => userStorage.removeItem(k));
  dayColors = {}; timeColor = '#C6DEF1';
  applyAppearance(); buildSettings(); render();
  toast('Đã đặt lại màu sắc mặc định.');
};

byId('clearAllData').onclick = () => {
  if (!confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu? Tất cả sự kiện, nhiệm vụ, môn học, ghi nhớ, tài liệu, lịch sử và màu sắc sẽ bị xóa.')) return;

  const savedKeys = [
    'timetableEvents', 'timetableNextId', 'savedWeek', 'dayColors',
    'timetableTasks', 'timetableNextTaskId',
    'timetableCourses', 'timetableNextCourseId',
    'timetableNotes', 'timetableNextNoteId',
    'timetableDocs', 'timetableNextDocId',
    'timetableLogs', 'studySessions', 'timetableExams',
    'weeklyGoalHours', 'remindersOn', 'remindersSent',
    'pageColor', 'gridColor', 'timeColor', 'darkMode'
  ];
  savedKeys.forEach(key => userStorage.removeItem(key));

  events = [];  nextId = 1;
  tasks = [];   nextTaskId = 1;
  courses = []; nextCourseId = 1;
  notes = [];   nextNoteId = 1;
  docs = [];    nextDocId = 1;
  logs = [];  studySessions = [];  exams = [];
  savedWeek = [];  dayColors = {};  timeColor = '#C6DEF1';

  applyAppearance(); buildSettings(); render();
  toast('Đã xóa toàn bộ dữ liệu.');
};

byId('save').onclick = () => {
  let mon = mondayOf(viewDate);
  savedWeek = events.filter(e => eventDate(e) >= dateKey(mon) && eventDate(e) <= dateKey(addDays(mon, 6))).map(e => ({ ...e, day: (new Date(eventDate(e) + 'T00:00:00').getDay() + 6) % 7 }));
  saveData('savedWeek', savedWeek);
  toast('Đã lưu Lịch học của tuần này.');
};

byId('paste').onclick = () => {
  savedWeek = loadData('savedWeek', savedWeek);
  if (!savedWeek.length) { toast('Hãy bấm Lưu Lịch học của một tuần trước.'); return; }
  let mon = mondayOf(viewDate);
  savedWeek.forEach(e => { const copy = { ...e, id: nextId++, date: dateKey(addDays(mon, e.day || 0)) }; delete copy.seriesId; events.push(copy); });
  logAction('Thêm', 'Dán Lịch học tuần');
  saveEvents(); render();
  toast('Đã dán Lịch học vào tuần này.');
};

byId('clear').onclick = () => {
  if (!confirm('Bạn có chắc muốn xóa tất cả sự kiện trong Lịch học đang xem?')) return;
  logAction('Xóa', 'Lịch học trong khung nhìn hiện tại');
  if (viewMode === 'day') events = events.filter(e => eventDate(e) !== dateKey(viewDate));
  else { let mon = dateKey(mondayOf(viewDate)), sun = dateKey(addDays(mondayOf(viewDate), 6)); events = events.filter(e => eventDate(e) < mon || eventDate(e) > sun); }
  saveEvents(); render();
};

function beginDrag(ev) {
  if (ev.button !== 0 || ev.target.closest('button,.event-menu')) return;
  let box = ev.currentTarget, item = events.find(x => x.id === Number(box.dataset.id));
  if (!item) return;
  drag = { item, box, y: ev.clientY, start: timeToMinutes(item.start), end: timeToMinutes(item.end), resize: ev.target.classList.contains('resize') };
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag, { once: true });
}

function moveDrag(ev) {
  if (!drag) return;
  let delta = Math.round((ev.clientY - drag.y) / (ROW_HEIGHT / 60) / STEP_MIN) * STEP_MIN, s = drag.start, en = drag.end;
  if (drag.resize) en = Math.max(s + STEP_MIN, Math.min(DAY_END, en + delta));
  else {
    s = Math.max(DAY_START, Math.min(DAY_END - (en - s), s + delta));
    en = s + (drag.end - drag.start);
  }
  drag.box.style.top = ((s - DAY_START) / 60 * ROW_HEIGHT) + 'px';
  drag.box.style.height = ((en - s) / 60 * ROW_HEIGHT) + 'px';
  drag.preview = { s, en };
  if (!drag.resize && viewMode === 'week') {
    let col = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.column');
    if (col) drag.preview.day = Number(col.dataset.day);
  }
}

function endDrag() {
  window.removeEventListener('pointermove', moveDrag);
  if (!drag) return;
  let { item, preview } = drag;
  if (preview) {
    item.start = minutesToTime(preview.s);
    item.end = minutesToTime(preview.en);
    if (Number.isInteger(preview.day)) item.date = dateKey(addDays(mondayOf(viewDate), preview.day));
    logAction('Sửa', `Kéo thả lịch sự kiện: ${item.title}`);
    saveEvents();
  }
  drag = null;
  render();
}

loadUserData();

(function(){
  function strip(el){
    if(el.nodeType!==1) return;
    if(el.closest && el.closest('#barChart, .heatmap')) return;
    if(el.hasAttribute('title')){
      if(!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', el.getAttribute('title'));
      el.removeAttribute('title');
    }
    el.querySelectorAll && el.querySelectorAll('[title]').forEach(strip);
  }

  function wrapLabels(root){
    (root.querySelectorAll ? root.querySelectorAll('label.field:not([data-lbl])') : []).forEach(l=>{
      l.dataset.lbl='1';
      const t=[...l.childNodes].find(n=>n.nodeType===3 && n.textContent.trim());
      if(!t) return;
      const sp=document.createElement('span'); sp.className='lbl'; sp.textContent=t.textContent.trim();
      l.replaceChild(sp,t);
    });
  }
  function init(){
    strip(document.body); wrapLabels(document);
    document.querySelectorAll('form').forEach(f=>f.noValidate=true);
    new MutationObserver(ms=>{
      ms.forEach(m=>{
        if(m.type==='attributes') strip(m.target);
        else m.addedNodes.forEach(n=>{ strip(n); if(n.nodeType===1) wrapLabels(n); });
      });
    }).observe(document.body,{attributes:true,attributeFilter:['title'],childList:true,subtree:true});
  }

  document.addEventListener('submit',e=>{
    const f=e.target; if(!f.checkValidity) return;
    f.querySelectorAll('.invalid').forEach(i=>i.classList.remove('invalid'));
    if(!f.checkValidity()){
      e.preventDefault(); e.stopImmediatePropagation();
      const bad=[...f.querySelectorAll(':invalid')].filter(i=>i.willValidate);
      bad.forEach(i=>i.classList.add('invalid'));
      bad[0] && bad[0].focus();
    }
  },true);
  document.addEventListener('input',e=>e.target.classList&&e.target.classList.remove('invalid'),true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();

(function(){
  function setH(){ const t=document.querySelector('header.topbar'); if(t) document.documentElement.style.setProperty('--topbar-h', t.getBoundingClientRect().height+'px'); }
  window.addEventListener('resize',setH); window.addEventListener('load',setH);
  if(window.ResizeObserver){ const t=document.querySelector('header.topbar'); if(t) new ResizeObserver(setH).observe(t); }
  setH();
})();
