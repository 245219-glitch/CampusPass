/* Student portal: shows ONLY the signed-in student's own marks. */
$(function () {
  renderTopbar('student');
  const saved = getSaved('student');

  if (!saved) {
    $('#refresh').hide();
    $('#app').html('<div class="state"><h2>No student key saved</h2><p>Add the API key your administrator gave you, then come back here.</p><a class="btn" href="/settings">Go to Settings</a></div>');
    return;
  }

  function load() {
    $('#app').html('<div class="state"><p style="margin:0">Loading your marks…</p></div>');
    // The id comes from the saved key. Even if it is edited, the server checks it again.
    api('GET', '/api/students/' + saved.ownerId + '/marks', saved.key)
      .done(function (res) { saveUsage('student', res.meta); render(res); })
      .fail(function (xhr) {
        const err = errorOf(xhr);
        $('#app').html('<div class="state">' + statusChip(err.status) + '<h2>Could not load your marks</h2><p>' + esc(err.message) +
          '</p><a class="btn ghost" href="/settings">Check your key in Settings</a></div>');
      });
  }

  function render(res) {
    const marks = res.data;
    let sum = 0, best = null;
    marks.forEach(function (m) { sum += m.total; if (!best || m.total > best.total) best = m; });
    const overall = marks.length ? Math.round(sum / marks.length) : 0;

    let rows = '';
    marks.forEach(function (m) {
      rows += '<tr><td><b>' + esc(m.course) + '</b></td><td class="num">' + m.midterm + ' / 30</td><td class="num">' + m.sessional + ' / 20</td>' +
        '<td class="num">' + m.final_exam + ' / 50</td><td class="num"><b>' + m.total + '</b> / 100</td><td>' + gradeChip(m.total) + '</td></tr>';
    });

    const html =
      '<div class="portal-top"><div>' + passCard({ role: 'student', name: res.student.name, key: saved.key, used: res.meta.requestsUsed, limit: res.meta.requestsLimit }) + '</div>' +
      '<div class="tiles"><div class="tile ringtile">' + ring(overall) + '<span>Overall<br>average</span></div>' +
      '<div class="tile"><b>' + marks.length + '</b><span>Courses</span></div>' +
      '<div class="tile"><b>' + (best ? best.total : '—') + '</b><span>Best: ' + esc(best ? best.course : '') + '</span></div></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Course</th><th class="num">Midterm</th><th class="num">Sessional</th><th class="num">Final</th><th class="num">Total</th><th>Grade</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<section class="card" style="margin-top:26px"><h2>Test the access rules</h2>' +
      '<p class="sub">These requests should be refused. Refused requests do not use up your limit.</p>' +
      '<div class="btn-row"><button class="btn ghost small" data-probe="other">Open another student\'s marks</button>' +
      '<button class="btn ghost small" data-probe="list">List all students</button>' +
      '<button class="btn ghost small" data-probe="nokey">Send without a key</button></div>' +
      '<pre class="console" id="probeOut">Press a button to send the request.</pre></section>';
    $('.page-head h1').text('Hi, ' + res.student.name.split(' ')[0]);
    $('#app').html(html);
  }

  // Demonstration: try to break the rules and show what the server answers.
  function probe(url, key) {
    const xhr = api('GET', url, key);
    xhr.always(function () {
      const good = xhr.status < 300;
      const body = xhr.responseJSON ? JSON.stringify(xhr.responseJSON, null, 2) : '(no response)';
      $('#probeOut').html('GET ' + esc(url) + '\n' + (key ? 'x-api-key: ' + esc(maskKey(key)) : '(no x-api-key header)') +
        '\n\n<span class="' + (good ? 'ok' : 'bad') + '">HTTP ' + xhr.status + ' ' + (STATUS_NAMES[xhr.status] || '') + '</span>\n' + esc(body));
    });
  }
  $('#app').on('click', '[data-probe]', function () {
    const kind = $(this).data('probe');
    const other = saved.ownerId === 1 ? 2 : 1;
    if (kind === 'other') probe('/api/students/' + other + '/marks', saved.key);
    if (kind === 'list') probe('/api/students', saved.key);
    if (kind === 'nokey') probe('/api/students/' + saved.ownerId + '/marks', '');
  });

  $('#refresh').on('click', load);
  load();
});
