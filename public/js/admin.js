/* Admin panel at /admin. Every call sends the predefined admin API key. */
$(function () {
  renderTopbar('admin');

  let adminKey = sessionStorage.getItem('kd_admin') || '';
  let summary = null, codes = [], students = [], teachers = [], keys = [], logs = [];
  let currentTab = 'overview';

  // One helper for all admin calls: A('GET', '/keys')  ->  /api/admin/keys
  function A(method, path, body) { return api(method, '/api/admin' + path, adminKey, body); }

  // ---------------- sign-in ----------------
  function showGate(message) {
    $('#panel').prop('hidden', true);
    $('#gate').prop('hidden', false);
    $('#gateError').text(message || '');
    $('#adminKey').val('').trigger('focus');
  }
  $('#gateForm').on('submit', function (e) {
    e.preventDefault();
    adminKey = $('#adminKey').val().trim();
    enter();
  });
  function enter() {
    A('GET', '/summary')
      .done(function () { sessionStorage.setItem('kd_admin', adminKey); $('#gate').prop('hidden', true); $('#panel').prop('hidden', false); loadAll(); })
      .fail(function (xhr) { const err = errorOf(xhr); sessionStorage.removeItem('kd_admin'); showGate(err.status + ' ' + err.message); });
  }
  $('#signout').on('click', function () { sessionStorage.removeItem('kd_admin'); adminKey = ''; showGate(''); });

  // Any 401/403 from an admin call sends you back to the sign-in box.
  function failed(xhr) {
    const err = errorOf(xhr);
    if (err.status === 401 || err.status === 403) { sessionStorage.removeItem('kd_admin'); showGate(err.message); return; }
    toast(err.message, 'bad');
  }

  // ---------------- loading ----------------
  function loadAll() {
    $.when(A('GET', '/summary'), A('GET', '/students'), A('GET', '/teachers'), A('GET', '/keys'), A('GET', '/logs'))
      .done(function (s, st, t, k, l) {
        summary = s[0].data; codes = s[0].statusCodes;
        students = st[0].data; teachers = t[0].data; keys = k[0].data; logs = l[0].data;
        drawAll();
      })
      .fail(failed);
  }
  $('#reload').on('click', function () { loadAll(); toast('Refreshed'); });

  function drawAll() { drawOverview(); fillOwners(); drawKeys(); drawPeople('students'); drawPeople('teachers'); drawActivity(); }

  // ---------------- tabs ----------------
  function openTab(name) {
    currentTab = name;
    $('#tabs button').attr('aria-selected', 'false').filter('[data-tab="' + name + '"]').attr('aria-selected', 'true');
    ['overview', 'keys', 'students', 'teachers', 'activity'].forEach(function (t) { $('#tab-' + t).prop('hidden', t !== name); });
  }
  $('#tabs').on('click', 'button', function () { openTab($(this).data('tab')); });

  // ---------------- overview ----------------
  function drawOverview() {
    const s = summary;
    let bars = '';
    const max = Math.max.apply(null, codes.map(function (c) { return c.total; }).concat([1]));
    codes.forEach(function (c) {
      bars += '<div class="bar-row"><span>' + statusChip(c.status_code) + '</span><div class="meter"><span style="width:' + Math.round(c.total / max * 100) + '%;background:' + (c.status_code < 300 ? 'var(--ok)' : 'var(--bad)') + '"></span></div><b>' + c.total + '</b></div>';
    });
    let near = '';
    keys.filter(function (k) { return k.status === 'active' && k.requestLimit && k.requestsUsed / k.requestLimit >= 0.8; }).forEach(function (k) {
      near += '<div class="bar-row"><span>' + esc(k.ownerName) + '</span>' + meterHtml(k.requestsUsed, k.requestLimit) + '<b>' + k.requestsUsed + '/' + k.requestLimit + '</b></div>';
    });
    $('#tab-overview').html(
      '<div class="tiles" style="margin-bottom:20px">' +
      '<div class="tile"><b>' + s.students + '</b><span>Students</span></div><div class="tile"><b>' + s.teachers + '</b><span>Teachers</span></div>' +
      '<div class="tile"><b>' + s.activeKeys + '</b><span>Active keys</span></div><div class="tile"><b>' + s.revokedKeys + '</b><span>Revoked keys</span></div>' +
      '<div class="tile"><b>' + s.requestsToday + '</b><span>Requests today</span></div><div class="tile bad"><b>' + s.rejectedToday + '</b><span>Refused today</span></div></div>' +
      '<div class="split"><section class="card"><h2>Responses so far</h2><p class="sub">How the server answered every API request.</p><div class="bars">' + (bars || '<p class="muted">No requests yet.</p>') + '</div></section>' +
      '<section class="card"><h2>Keys close to their limit</h2><p class="sub">80% used or more.</p><div class="bars">' + (near || '<p class="muted">None right now.</p>') + '</div></section></div>');
  }

  // ---------------- keys ----------------
  function fillOwners(selectId) {
    const role = $('#genRole').val();
    const list = role === 'student' ? students : teachers;
    let opts = '';
    list.forEach(function (p) {
      opts += '<option value="' + p.id + '"' + (p.activeKeys ? ' disabled' : '') + '>' + esc(p.name) + (p.activeKeys ? ' (has an active key)' : '') + '</option>';
    });
    $('#genOwner').html(opts);
    if (selectId) $('#genOwner').val(selectId);
    $('#genLimit').val(role === 'student' ? 10 : 30);
  }
  $('#genRole').on('change', function () { fillOwners(); });

  $('#genForm').on('submit', function (e) {
    e.preventDefault();
    A('POST', '/keys', { role: $('#genRole').val(), ownerId: Number($('#genOwner').val()), requestLimit: Number($('#genLimit').val()) })
      .done(function (res) {
        toast(res.message, 'ok');
        $('#newKey').html('<div class="newkey"><div><div class="hint" style="margin:0 0 4px">New key for ' + esc(res.data.ownerName) + ' (' + res.data.requestLimit + ' requests)</div><div class="keytext">' + esc(res.data.apiKey) + '</div></div>' +
          '<button class="btn small" type="button" data-copy="' + esc(res.data.apiKey) + '">Copy key</button></div>');
        loadAll();
      })
      .fail(failed);
  });

  function drawKeys() {
    if (!keys.length) { $('#keysTable').html('<div class="empty"><b>No keys yet</b>Generate the first one above.</div>'); return; }
    let rows = '';
    keys.forEach(function (k) {
      const active = k.status === 'active';
      rows += '<tr><td><span class="keytext">' + esc(k.apiKey) + '</span> <button class="btn ghost small" type="button" data-copy="' + esc(k.apiKey) + '" aria-label="Copy key">Copy</button></td>' +
        '<td class="owner">' + avatar(k.ownerName, k.role) + '<b>' + esc(k.ownerName) + '</b><br><span class="chip ' + k.role + '">' + k.role + '</span></td>' +
        '<td style="min-width:150px">' + meterHtml(k.requestsUsed, k.requestLimit) + '<span class="hint">' + k.requestsUsed + ' of ' + k.requestLimit + ' used</span></td>' +
        '<td><span class="chip ' + (active ? 'ok' : 'bad') + '">' + (active ? 'Active' : 'Revoked') + '</span></td>' +
        '<td>' + fmtDate(k.lastUsedAt) + '</td>' +
        '<td class="actions">' + (active ?
          '<button class="btn ghost small" data-act="limit" data-id="' + k.id + '">Edit limit</button><button class="btn ghost small" data-act="reset" data-id="' + k.id + '">Reset usage</button><button class="btn danger small" data-act="revoke" data-id="' + k.id + '">Revoke</button>' : '<span class="muted">No actions</span>') + '</td></tr>';
    });
    $('#keysTable').html('<div class="table-wrap"><table class="data"><thead><tr><th>Key</th><th>Owner</th><th>Usage</th><th>Status</th><th>Last used</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }

  $('#panel').on('click', '[data-copy]', function () { copyText($(this).data('copy')); });

  $('#keysTable').on('click', '[data-act]', function () {
    const id = $(this).data('id'), act = $(this).data('act');
    const k = keys.find(function (x) { return x.id === id; });

    if (act === 'limit') {
      numberDialog({ title: 'Edit request limit', text: k.ownerName + ' has used ' + k.requestsUsed + ' requests.', value: k.requestLimit }).then(function (n) {
        if (n === null) return;
        A('PUT', '/keys/' + id + '/limit', { requestLimit: n }).done(function (r) { toast(r.message, 'ok'); loadAll(); }).fail(failed);
      });
    }
    if (act === 'reset') {
      confirmDialog({ title: 'Reset usage?', text: 'The count for ' + k.ownerName + ' goes back to 0.', okText: 'Reset usage' }).then(function (yes) {
        if (yes) A('PUT', '/keys/' + id + '/reset').done(function (r) { toast(r.message, 'ok'); loadAll(); }).fail(failed);
      });
    }
    if (act === 'revoke') {
      confirmDialog({ title: 'Revoke this key?', text: k.ownerName + ' will be refused immediately (HTTP 403). This cannot be undone.', okText: 'Revoke key', danger: true }).then(function (yes) {
        if (yes) A('PUT', '/keys/' + id + '/revoke').done(function (r) { toast(r.message, 'ok'); loadAll(); }).fail(failed);
      });
    }
  });

  // ---------------- students + teachers ----------------
  function drawPeople(kind) {
    const list = kind === 'students' ? students : teachers;
    const role = kind === 'students' ? 'student' : 'teacher';
    let rows = '';
    list.forEach(function (p) {
      rows += '<tr><td>' + avatar(p.name, role) + '<b>' + esc(p.name) + '</b></td><td>' + esc(p.department) + '</td><td>' + esc(kind === 'students' ? p.semester : p.course) + '</td>' +
        '<td>' + (p.activeKeys ? '<span class="chip ok">Has a key</span>' : '<span class="chip">No key</span>') + '</td>' +
        '<td class="actions">' + (p.activeKeys ? '' : '<button class="btn small" data-make="' + role + '" data-id="' + p.id + '">Generate key</button>') + '</td></tr>';
    });
    $('#tab-' + kind).html('<div class="card"><h2>' + (kind === 'students' ? 'Students' : 'Teachers') + ' (' + list.length + ')</h2><p class="sub">Everyone stored in the database.</p>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Department</th><th>' + (kind === 'students' ? 'Semester' : 'Course') + '</th><th>API key</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>');
  }
  $('#panel').on('click', '[data-make]', function () {
    $('#genRole').val($(this).data('make'));
    fillOwners($(this).data('id'));
    openTab('keys');
    $('#genLimit').trigger('focus');
  });

  // ---------------- activity ----------------
  function drawActivity() {
    let rows = '';
    logs.forEach(function (l) {
      rows += '<tr><td>' + fmtDate(l.createdAt) + '</td><td>' + (l.ownerName ? esc(l.ownerName) : '<span class="muted">' + (l.role === 'admin' ? 'Administrator' : 'Unknown key') + '</span>') + '</td>' +
        '<td><span class="chip ' + (l.role === 'none' ? '' : l.role) + '">' + (l.role === 'none' ? 'no key' : l.role) + '</span></td>' +
        '<td><span class="keytext">' + l.method + ' ' + esc(l.endpoint) + '</span></td><td>' + statusChip(l.statusCode) + '</td></tr>';
    });
    $('#tab-activity').html('<div class="card"><h2>Recent activity</h2><p class="sub">The latest 100 API requests, saved in the api_logs table.</p>' +
      (rows ? '<div class="table-wrap"><table class="data"><thead><tr><th>Time</th><th>Who</th><th>Role</th><th>Request</th><th>Response</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
        '<div class="empty"><b>No requests yet</b>Use a student or teacher key and they show up here.</div>') + '</div>');
  }

  // ---------------- start ----------------
  if (adminKey) enter(); else showGate('');
});
