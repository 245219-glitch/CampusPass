/* Teacher portal: every student record and every mark. */
$(function () {
  renderTopbar('teacher');
  const saved = getSaved('teacher');
  let students = [], marks = [], meta = null, selected = null, tab = 'students';

  if (!saved) {
    $('#refresh').hide();
    $('#app').html('<div class="state"><h2>No teacher key saved</h2><p>Add the API key your administrator gave you, then come back here.</p><a class="btn" href="/settings">Go to Settings</a></div>');
    return;
  }

  function load() {
    $('#app').html('<div class="state"><p style="margin:0">Loading class records…</p></div>');
    // Two AJAX calls at the same time; the page waits for both.
    $.when(api('GET', '/api/students', saved.key), api('GET', '/api/marks', saved.key))
      .done(function (a, b) {
        students = a[0].data;
        marks = b[0].data;
        meta = b[0].meta;
        saveUsage('teacher', meta);
        students.forEach(function (s) {
          const own = marks.filter(function (m) { return m.student_id === s.id; });
          s.average = own.length ? Math.round(own.reduce(function (t, m) { return t + m.total; }, 0) / own.length) : 0;
        });
        render();
      })
      .fail(function (xhr) {
        const err = errorOf(xhr);
        $('#app').html('<div class="state">' + statusChip(err.status) + '<h2>Could not load class records</h2><p>' + esc(err.message) +
          '</p><a class="btn ghost" href="/settings">Check your key in Settings</a></div>');
      });
  }

  function courses() {
    const list = [];
    marks.forEach(function (m) { if (list.indexOf(m.course) < 0) list.push(m.course); });
    return list.sort();
  }

  function render() {
    const classAvg = students.length ? Math.round(students.reduce(function (t, s) { return t + s.average; }, 0) / students.length) : 0;
    let bars = '';
    courses().forEach(function (c) {
      const own = marks.filter(function (m) { return m.course === c; });
      const avg = Math.round(own.reduce(function (t, m) { return t + m.total; }, 0) / own.length);
      bars += '<div class="bar-row"><span>' + esc(c) + '</span><div class="meter"><span style="width:' + avg + '%"></span></div><b>' + avg + '%</b></div>';
    });

    $('.page-head h1').text('Welcome, ' + saved.name.replace('M. ', '').split(' ')[0]);
    $('#app').html(
      '<div class="portal-top"><div>' + passCard({ role: 'teacher', name: saved.name, key: saved.key, used: meta.requestsUsed, limit: meta.requestsLimit }) + '</div>' +
      '<div class="tiles"><div class="tile"><b>' + students.length + '</b><span>Students</span></div><div class="tile"><b>' + courses().length + '</b><span>Courses</span></div>' +
      '<div class="tile ringtile">' + ring(classAvg) + '<span>Class<br>average</span></div></div></div>' +
      '<section class="card" style="margin-bottom:26px"><h2>Average by course</h2><p class="sub">Across all students.</p><div class="bars">' + bars + '</div></section>' +
      '<div class="tabs" role="tablist"><button role="tab" data-tab="students" aria-selected="' + (tab === 'students') + '">Students</button>' +
      '<button role="tab" data-tab="marks" aria-selected="' + (tab === 'marks') + '">All marks</button></div><div id="tabBody"></div>');
    drawTab();
  }

  function drawTab() {
    if (tab === 'students') drawStudents(); else drawMarks();
  }

  // ----- Students tab: list on the left, one student's marks on the right -----
  function drawStudents() {
    $('#tabBody').html('<div class="master"><div><div class="toolbar"><input id="q" type="search" placeholder="Search by name" aria-label="Search students"></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Semester</th><th class="num">Average</th></tr></thead><tbody id="stuRows"></tbody></table></div></div>' +
      '<aside class="card sticky" id="detail"></aside></div>');
    fillStudents('');
    showDetail();
  }
  function fillStudents(q) {
    q = q.toLowerCase();
    let rows = '';
    students.forEach(function (s) {
      if (s.name.toLowerCase().indexOf(q) < 0) return;
      rows += '<tr data-id="' + s.id + '" class="' + (selected === s.id ? 'selected' : '') + '" tabindex="0" style="cursor:pointer"><td>' + avatar(s.name) + '<b>' + esc(s.name) + '</b></td><td>' + esc(s.semester) + '</td>' +
        '<td class="num">' + s.average + '% ' + gradeChip(s.average) + '</td></tr>';
    });
    $('#stuRows').html(rows || '<tr><td colspan="3" class="empty"><b>No match</b>Try a different name.</td></tr>');
  }
  function showDetail() {
    const s = students.find(function (x) { return x.id === selected; });
    if (!s) { $('#detail').html('<div class="empty"><b>Select a student</b>Their marks appear here.</div>'); return; }
    let rows = '';
    marks.filter(function (m) { return m.student_id === s.id; }).forEach(function (m) {
      rows += '<tr><td>' + esc(m.course) + '</td><td class="num"><b>' + m.total + '</b></td><td>' + gradeChip(m.total) + '</td></tr>';
    });
    $('#detail').html(avatar(s.name, 'student', true) + '<h2>' + esc(s.name) + '</h2><p class="sub">' + esc(s.department) + ' · ' + esc(s.semester) + ' · record #' + s.id + '</p>' +
      '<table class="data"><thead><tr><th>Course</th><th class="num">Total</th><th>Grade</th></tr></thead><tbody>' + rows + '</tbody></table>');
  }

  // ----- All marks tab -----
  function drawMarks() {
    let opts = '<option value="">All courses</option>';
    courses().forEach(function (c) { opts += '<option>' + esc(c) + '</option>'; });
    $('#tabBody').html('<div class="toolbar"><input id="mq" type="search" placeholder="Search by name" aria-label="Search marks"><select id="mc" aria-label="Filter by course">' + opts + '</select></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Student</th><th>Course</th><th class="num">Midterm</th><th class="num">Sessional</th><th class="num">Final</th><th class="num">Total</th><th>Grade</th></tr></thead><tbody id="markRows"></tbody></table></div>');
    fillMarks();
  }
  function fillMarks() {
    const q = ($('#mq').val() || '').toLowerCase(), c = $('#mc').val();
    let rows = '';
    marks.forEach(function (m) {
      if (m.name.toLowerCase().indexOf(q) < 0 || (c && m.course !== c)) return;
      rows += '<tr><td><b>' + esc(m.name) + '</b></td><td>' + esc(m.course) + '</td><td class="num">' + m.midterm + '</td><td class="num">' + m.sessional + '</td><td class="num">' + m.final_exam + '</td><td class="num"><b>' + m.total + '</b></td><td>' + gradeChip(m.total) + '</td></tr>';
    });
    $('#markRows').html(rows || '<tr><td colspan="7" class="empty"><b>No marks found</b>Change the search or course.</td></tr>');
  }

  $('#app').on('click', '[data-tab]', function () {
    tab = $(this).data('tab');
    $('[data-tab]').attr('aria-selected', 'false');
    $(this).attr('aria-selected', 'true');
    drawTab();
  });
  $('#app').on('input', '#q', function () { fillStudents($(this).val()); });
  $('#app').on('input change', '#mq, #mc', fillMarks);
  $('#app').on('click keydown', '#stuRows tr[data-id]', function (e) {
    if (e.type === 'keydown' && e.key !== 'Enter') return;
    selected = Number($(this).data('id'));
    $('#stuRows tr').removeClass('selected');
    $(this).addClass('selected');
    showDetail();
  });

  $('#refresh').on('click', load);
  load();
});
