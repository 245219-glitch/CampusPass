/* =====================================================================
   Shared helpers used by every page (jQuery AJAX + small UI parts).
   ===================================================================== */

// Escape text before putting it inside an HTML string (stops HTML injection).
function esc(text) {
  return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ONE function for every AJAX call. The API key travels in the x-api-key header.
function api(method, url, key, body) {
  return $.ajax({
    url: url,
    type: method,
    dataType: 'json',
    contentType: 'application/json',
    data: body ? JSON.stringify(body) : undefined,
    headers: { 'x-api-key': key || '' }
  });
}

// Turn a failed request into { status, message }.
function errorOf(xhr) {
  const d = xhr.responseJSON;
  return {
    status: xhr.status || 0,
    message: d && d.message ? d.message : 'Cannot reach the server. Is Node.js running?'
  };
}

// ---------- where keys are saved (this browser only) ----------
const STORE = { student: 'kd_student', teacher: 'kd_teacher' };
function getSaved(role) {
  try { return JSON.parse(localStorage.getItem(STORE[role])); } catch (e) { return null; }
}
function setSaved(role, value) { localStorage.setItem(STORE[role], JSON.stringify(value)); }
function clearSaved(role) { localStorage.removeItem(STORE[role]); }
// Remember the latest usage numbers so the Settings page can show them.
function saveUsage(role, meta) {
  const s = getSaved(role);
  if (s && meta) { s.used = meta.requestsUsed; s.limit = meta.requestsLimit; setSaved(role, s); }
}

// ---------- top bar ----------
function renderTopbar(active) {
  const links = [['/', 'Home'], ['/settings', 'Settings'], ['/student', 'Student'], ['/teacher', 'Teacher'], ['/admin', 'Admin']];
  let nav = '';
  links.forEach(function (l) {
    nav += '<a href="' + l[0] + '"' + (l[1].toLowerCase() === active ? ' aria-current="page"' : '') + '>' + l[1] + '</a>';
  });
  if (!$('.foot').length) $('body').append('<footer class="foot"><b>CampusPass</b> &middot; University API Access Management &middot; FSD Lab 07 &middot; v2</footer>');
  $('#topbar').html('<div class="wrap"><a class="brand" href="/"><span class="brand-mark"></span>CampusPass</a><nav class="nav" aria-label="Main">' + nav + '</nav></div>');
}

// ---------- small formatters ----------
function maskKey(key) {
  key = String(key || '');
  return key.length <= 10 ? key : key.slice(0, 4) + '\u2022\u2022\u2022\u2022' + key.slice(-4);
}
function gradeOf(total) {
  return total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : 'F';
}
function gradeChip(total) { const g = gradeOf(total); return '<span class="grade ' + g + '">' + g + '</span>'; }
function fmtDate(iso) {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
const STATUS_NAMES = { 200: 'OK', 201: 'Created', 400: 'Bad request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not found', 409: 'Conflict', 429: 'Too many requests', 500: 'Server error' };
function statusChip(code) {
  const kind = code < 300 ? 'ok' : code === 429 || code === 400 || code === 404 || code === 409 ? 'warn' : 'bad';
  return '<span class="chip ' + kind + '">' + code + ' ' + (STATUS_NAMES[code] || '') + '</span>';
}
function meterHtml(used, limit) {
  const pct = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
  const cls = pct >= 100 ? 'full' : pct >= 80 ? 'warn' : '';
  return '<div class="meter ' + cls + '" role="img" aria-label="' + used + ' of ' + limit + ' requests used"><span style="width:' + pct + '%"></span></div>';
}

// ---------- the access pass (each request punches one hole) ----------
function passCard(o) {
  const used = o.used == null ? 0 : o.used;
  const limit = o.limit == null ? 0 : o.limit;
  const dots = Math.min(Math.max(limit, 1), 30);
  let punched = limit ? Math.round(used / limit * dots) : 0;
  if (used > 0 && punched === 0) punched = 1;
  let holes = '';
  for (let i = 0; i < dots; i++) holes += '<i class="' + (i < punched ? 'punched' : '') + '" style="--d:' + (i * 70 + 500) + 'ms"></i>';
  const left = Math.max(limit - used, 0);
  const count = o.limit == null ? 'Usage not checked yet' : '<b>' + left + '</b> of ' + limit + ' requests left';
  return '<article class="pass ' + o.role + (o.revoked ? ' revoked' : '') + (o.demo ? ' demo' : '') + '">' +
    '<div class="pass-role">' + (o.role === 'student' ? 'Student pass' : o.role === 'teacher' ? 'Teacher pass' : 'Administrator pass') + '</div>' +
    '<div class="pass-name">' + esc(o.name) + '</div>' +
    '<div class="pass-key">' + esc(maskKey(o.key)) + '</div>' +
    '<div class="holes" aria-hidden="true">' + holes + '</div>' +
    '<div class="pass-count">' + count + '</div></article>';
}

// ---------- toast messages ----------
function toast(message, kind) {
  let box = $('#toasts');
  if (!box.length) box = $('<div id="toasts" role="status" aria-live="polite"></div>').appendTo('body');
  const t = $('<div class="toast"></div>').addClass(kind || '').text(message).appendTo(box);
  setTimeout(function () { t.fadeOut(250, function () { t.remove(); }); }, 3800);
}

// ---------- dialogs (native <dialog>) ----------
function confirmDialog(o) {
  return new Promise(function (resolve) {
    const d = $('<dialog><form method="dialog"><h3></h3><p></p><div class="btn-row">' +
      '<button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok"></button></div></form></dialog>');
    d.find('h3').text(o.title);
    d.find('p').text(o.text);
    const ok = d.find('.btn-row .btn').last().text(o.okText || 'Confirm');
    if (o.danger) ok.addClass('danger');
    d.appendTo('body');
    d[0].addEventListener('close', function () { resolve(d[0].returnValue === 'ok'); d.remove(); });
    d[0].showModal();
  });
}
function numberDialog(o) {
  return new Promise(function (resolve) {
    const d = $('<dialog><form method="dialog"><h3></h3><p></p><label for="dlgNum">Request limit</label>' +
      '<input id="dlgNum" type="number" min="1" max="100000" step="1" required>' +
      '<div class="btn-row"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok">Save limit</button></div></form></dialog>');
    d.find('h3').text(o.title);
    d.find('p').text(o.text);
    d.find('input').val(o.value);
    d.appendTo('body');
    d[0].addEventListener('close', function () {
      resolve(d[0].returnValue === 'ok' ? Number(d.find('input').val()) : null);
      d.remove();
    });
    d[0].showModal();
    d.find('input').trigger('select');
  });
}

function copyText(text) {
  const done = function () { toast('Copied to clipboard', 'ok'); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done);
  else { const t = $('<textarea>').val(text).appendTo('body'); t[0].select(); document.execCommand('copy'); t.remove(); done(); }
}

// Round initials badge shown next to names.
function avatar(name, role, big) {
  const parts = String(name || '?').replace(/\./g, '').split(/\s+/).filter(Boolean);
  const letters = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  return '<span class="avatar ' + (role === 'teacher' ? 'teacher' : '') + (big ? ' lg' : '') + '" aria-hidden="true">' + esc(letters) + '</span>';
}

// Progress ring (used for averages).
function ring(percent) {
  return '<div class="ring" style="--p:' + Math.max(0, Math.min(100, percent)) + '"><b>' + percent + '%</b></div>';
}

// 3D tilt: passes lean toward the mouse.
$(document).on('mousemove', '.pass', function (e) {
  const r = this.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
  this.style.setProperty('--ry', (x * 16) + 'deg');
  this.style.setProperty('--rx', (-y * 16) + 'deg');
});
$(document).on('mouseleave', '.pass', function () { this.style.setProperty('--rx', '0deg'); this.style.setProperty('--ry', '0deg'); });

// Count-up: big tile numbers roll up from 0 when they appear.
function countUp(el) {
  const text = el.textContent, m = text.match(/^(\d+)(%?)$/);
  if (!m || el.dataset.done || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.dataset.done = '1';
  const end = Number(m[1]), start = performance.now();
  (function tick(now) {
    const t = Math.min((now - start) / 700, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3))) + m[2];
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}
new MutationObserver(function () { $('.tile b').each(function () { countUp(this); }); })
  .observe(document.documentElement, { childList: true, subtree: true });
