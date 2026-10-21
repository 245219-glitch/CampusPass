/* Settings page: students and teachers enter and save their API key. */
$(function () {
  renderTopbar('settings');

  // Show the keys that are saved in this browser, as passes.
  function showSaved() {
    const box = $('#saved').empty();
    ['student', 'teacher'].forEach(function (role) {
      const s = getSaved(role);
      if (!s) {
        box.append('<div class="state" style="width:100%;max-width:360px;padding:22px"><p style="margin:0">No ' + role + ' key saved yet.</p></div>');
        return;
      }
      const wrap = $('<div></div>').html(passCard({ role: role, name: s.name, key: s.key, used: s.used, limit: s.limit }));
      wrap.append('<div class="btn-row" style="margin-top:12px"><a class="btn small" href="/' + role + '">Open ' + role + ' portal</a>' +
        '<button class="btn ghost small" type="button" data-remove="' + role + '">Remove</button></div>');
      box.append(wrap);
    });
  }

  // Save = ask the server who owns the key. Only a key the server accepts is stored.
  $('#keyForm').on('submit', function (e) {
    e.preventDefault();
    const key = $('#keyInput').val().trim();
    const result = $('#result').empty();
    $('#saveBtn').prop('disabled', true).text('Checking…');

    api('GET', '/api/me', key)
      .done(function (res) {
        const role = res.meta.role;
        setSaved(role, { key: key, role: role, ownerId: res.data.id, name: res.data.name, used: res.meta.requestsUsed, limit: res.meta.requestsLimit });
        $('#keyInput').val('');
        result.html('<span class="chip ok">200 OK</span> Saved as a <b>' + role + '</b> key for <b>' + esc(res.data.name) + '</b>.');
        toast('Key saved', 'ok');
        showSaved();
      })
      .fail(function (xhr) {
        const err = errorOf(xhr);
        result.html(statusChip(err.status) + ' ' + esc(err.message));
      })
      .always(function () { $('#saveBtn').prop('disabled', false).text('Save key'); });
  });

  $('#demoKeys').on('click', 'button', function () { $('#keyInput').val($(this).data('key')).trigger('focus'); });
  $('#saved').on('click', '[data-remove]', function () { clearSaved($(this).data('remove')); showSaved(); toast('Key removed'); });

  showSaved();
});
