// =====================================================================
//  CAMPUSPASS - UNIVERSITY API ACCESS MANAGEMENT  -  FSD Lab 07
//  Node.js + Express + MySQL.  The pages in /public talk to this API
//  with jQuery AJAX and send the API key in the "x-api-key" header.
//
//  Start with:   npm install   then   node server.js
//  Open:         http://localhost:3100        (admin panel: /admin)
// =====================================================================

const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3100;

// The predefined administrator key (Requirement 5). Change it here if you like.
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin-key-789';

// ---------------------------------------------------------------------
//  1. DATABASE CONNECTION  (XAMPP defaults: root, empty password)
// ---------------------------------------------------------------------
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'campuspass_db',
  connectionLimit: 10
});

// Small helper so routes can use "await query(sql, [values])".
// The "?" placeholders keep user input out of the SQL text (no SQL injection).
function query(sql, values) {
  return new Promise(function (resolve, reject) {
    db.query(sql, values || [], function (err, rows) {
      if (err) reject(err); else resolve(rows);
    });
  });
}

// Express 4 does not catch errors thrown inside async routes, so we wrap them.
function route(fn) {
  return function (req, res, next) { fn(req, res, next).catch(next); };
}

// ---------------------------------------------------------------------
//  2. GENERAL MIDDLEWARE
// ---------------------------------------------------------------------
app.use(cors({
  origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
  exposedHeaders: ['X-Requests-Limit', 'X-Requests-Remaining']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/admin', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Usage log (Requirement 8): every API request is saved when it finishes,
// together with its HTTP status code. Reading the log itself is not logged.
app.use('/api', function (req, res, next) {
  res.on('finish', function () {
    if (req.path === '/health' || req.path === '/admin/logs') return;
    query(
      'INSERT INTO api_logs (api_key_id, role, method, endpoint, status_code) VALUES (?, ?, ?, ?, ?)',
      [req.logKeyId || null, req.logRole || 'none', req.method, req.originalUrl.slice(0, 200), res.statusCode]
    ).catch(function (e) { console.error('Log error:', e.message); });
  });
  next();
});

// ---------------------------------------------------------------------
//  3. API-KEY MIDDLEWARE  (runs BEFORE the route, like checkAccess in the manual)
//     Order:  checkKey -> allowRoles -> ownRecordOnly -> spendRequest
// ---------------------------------------------------------------------

// Step 1: find the key.   missing / unknown -> 401     revoked -> 403
function checkKey(req, res, next) {
  const key = req.get('x-api-key');
  if (!key) {
    return res.status(401).json({ message: 'Unauthorized: API key missing. Send it in the x-api-key header.' });
  }
  query('SELECT * FROM api_keys WHERE api_key = ?', [key]).then(function (rows) {
    if (!rows.length) {
      return res.status(401).json({ message: 'Unauthorized: invalid API key' });
    }
    const k = rows[0];
    const role = k.student_id ? 'student' : 'teacher';
    req.logKeyId = k.id;
    req.logRole = role;
    if (k.status === 'revoked') {
      return res.status(403).json({ message: 'Forbidden: this API key has been revoked' });
    }
    req.auth = {
      keyId: k.id,
      role: role,
      ownerId: k.student_id || k.teacher_id,
      limit: k.request_limit,
      used: k.requests_used
    };
    next();
  }).catch(next);
}

// Step 2: is this role allowed to use the endpoint?   -> 403
function allowRoles() {
  const roles = Array.prototype.slice.call(arguments);
  return function (req, res, next) {
    if (roles.includes(req.auth.role)) return next();
    res.status(403).json({ message: 'Forbidden: ' + req.auth.role + ' keys cannot use this endpoint' });
  };
}

// Step 3: for /students/:id routes.  A student may only open THEIR OWN id,
// so changing the number in the URL never works.  Teachers may open any id.
function ownRecordOnly(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Bad request: student id must be a positive whole number' });
  }
  if (req.auth.role === 'student' && req.auth.ownerId !== id) {
    return res.status(403).json({ message: 'Forbidden: students can only view their own records' });
  }
  req.studentId = id;
  next();
}

// Step 4: request limit.  One request is counted in the database.
// The UPDATE only succeeds while requests_used < request_limit, so two
// requests at the same moment can never go over the limit.   -> 429
function spendRequest(req, res, next) {
  query(
    "UPDATE api_keys SET requests_used = requests_used + 1, last_used_at = NOW() " +
    "WHERE id = ? AND status = 'active' AND requests_used < request_limit",
    [req.auth.keyId]
  ).then(function (result) {
    if (result.affectedRows === 0) {
      return res.status(429).json({ message: 'Too Many Requests: request limit reached. Ask the administrator to raise it.' });
    }
    req.auth.used = req.auth.used + 1;
    res.set('X-Requests-Limit', String(req.auth.limit));
    res.set('X-Requests-Remaining', String(Math.max(req.auth.limit - req.auth.used, 0)));
    next();
  }).catch(next);
}

// Usage information that is sent back with every student / teacher response.
function meta(req) {
  return {
    role: req.auth.role,
    requestsLimit: req.auth.limit,
    requestsUsed: req.auth.used,
    requestsRemaining: Math.max(req.auth.limit - req.auth.used, 0)
  };
}

// Admin endpoints use the predefined admin key.
function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function checkAdmin(req, res, next) {
  const key = req.get('x-api-key');
  if (!key) {
    return res.status(401).json({ message: 'Unauthorized: admin API key missing' });
  }
  if (sameText(key, ADMIN_KEY)) {
    req.logRole = 'admin';
    return next();
  }
  // A real student/teacher key is known, but is not allowed here -> 403.
  query('SELECT id, student_id FROM api_keys WHERE api_key = ?', [key]).then(function (rows) {
    if (rows.length) {
      req.logKeyId = rows[0].id;
      req.logRole = rows[0].student_id ? 'student' : 'teacher';
      return res.status(403).json({ message: 'Forbidden: only the administrator key can use admin endpoints' });
    }
    res.status(401).json({ message: 'Unauthorized: invalid admin API key' });
  }).catch(next);
}

// ---------------------------------------------------------------------
//  4. PUBLIC ROUTE
// ---------------------------------------------------------------------
app.get('/api/health', function (req, res) {
  res.json({ status: 'ok', service: 'CampusPass - University API Access Management' });
});

// ---------------------------------------------------------------------
//  5. STUDENT + TEACHER ROUTES
// ---------------------------------------------------------------------

// Who owns this key?  (used by the Settings page to verify a key)
app.get('/api/me', checkKey, allowRoles('student', 'teacher'), spendRequest, route(async function (req, res) {
  const table = req.auth.role === 'student' ? 'students' : 'teachers'; // fixed values, not user input
  const rows = await query('SELECT * FROM ' + table + ' WHERE id = ?', [req.auth.ownerId]);
  res.json({ meta: meta(req), data: rows[0] });
}));

// Teacher: list every student  (optional ?search=name)
app.get('/api/students', checkKey, allowRoles('teacher'), spendRequest, route(async function (req, res) {
  const pattern = '%' + String(req.query.search || '').trim() + '%';
  const rows = await query('SELECT id, name, department, semester FROM students WHERE name LIKE ? ORDER BY id', [pattern]);
  res.json({ meta: meta(req), data: rows });
}));

// Student (own id only) or teacher (any id): one student's information
app.get('/api/students/:id', checkKey, allowRoles('student', 'teacher'), ownRecordOnly, spendRequest, route(async function (req, res) {
  const rows = await query('SELECT id, name, department, semester FROM students WHERE id = ?', [req.studentId]);
  if (!rows.length) return res.status(404).json({ message: 'Not found: no student with id ' + req.studentId });
  res.json({ meta: meta(req), data: rows[0] });
}));

// Student (own id only) or teacher (any id): one student's marks
app.get('/api/students/:id/marks', checkKey, allowRoles('student', 'teacher'), ownRecordOnly, spendRequest, route(async function (req, res) {
  const students = await query('SELECT id, name, department, semester FROM students WHERE id = ?', [req.studentId]);
  if (!students.length) return res.status(404).json({ message: 'Not found: no student with id ' + req.studentId });
  const marks = await query(
    'SELECT course, midterm, sessional, final_exam, (midterm + sessional + final_exam) AS total ' +
    'FROM marks WHERE student_id = ? ORDER BY course', [req.studentId]);
  res.json({ meta: meta(req), student: students[0], data: marks });
}));

// Teacher: the marks of ALL students  (optional ?search=name&course=name)
app.get('/api/marks', checkKey, allowRoles('teacher'), spendRequest, route(async function (req, res) {
  let sql =
    'SELECT s.id AS student_id, s.name, m.course, m.midterm, m.sessional, m.final_exam, ' +
    '(m.midterm + m.sessional + m.final_exam) AS total ' +
    'FROM marks m JOIN students s ON s.id = m.student_id WHERE s.name LIKE ?';
  const values = ['%' + String(req.query.search || '').trim() + '%'];
  if (req.query.course) { sql += ' AND m.course = ?'; values.push(String(req.query.course)); }
  const rows = await query(sql + ' ORDER BY s.id, m.course', values);
  res.json({ meta: meta(req), data: rows });
}));

// ---------------------------------------------------------------------
//  6. ADMIN ROUTES  (all need the admin key)
// ---------------------------------------------------------------------

// Numbers for the overview page
app.get('/api/admin/summary', checkAdmin, route(async function (req, res) {
  const totals = await query(
    "SELECT " +
    "(SELECT COUNT(*) FROM students) AS students, " +
    "(SELECT COUNT(*) FROM teachers) AS teachers, " +
    "(SELECT COUNT(*) FROM api_keys WHERE status = 'active') AS activeKeys, " +
    "(SELECT COUNT(*) FROM api_keys WHERE status = 'revoked') AS revokedKeys, " +
    "(SELECT COUNT(*) FROM api_logs WHERE DATE(created_at) = CURDATE()) AS requestsToday, " +
    "(SELECT COUNT(*) FROM api_logs WHERE DATE(created_at) = CURDATE() AND status_code >= 400) AS rejectedToday");
  const codes = await query('SELECT status_code, COUNT(*) AS total FROM api_logs GROUP BY status_code ORDER BY status_code');
  res.json({ data: totals[0], statusCodes: codes });
}));

// View students (with how many active keys each has)
app.get('/api/admin/students', checkAdmin, route(async function (req, res) {
  const rows = await query(
    "SELECT s.id, s.name, s.department, s.semester, " +
    "(SELECT COUNT(*) FROM api_keys k WHERE k.student_id = s.id AND k.status = 'active') AS activeKeys " +
    "FROM students s ORDER BY s.id");
  res.json({ data: rows });
}));

// View teachers
app.get('/api/admin/teachers', checkAdmin, route(async function (req, res) {
  const rows = await query(
    "SELECT t.id, t.name, t.department, t.course, " +
    "(SELECT COUNT(*) FROM api_keys k WHERE k.teacher_id = t.id AND k.status = 'active') AS activeKeys " +
    "FROM teachers t ORDER BY t.name");
  res.json({ data: rows });
}));

// View keys with usage and status
app.get('/api/admin/keys', checkAdmin, route(async function (req, res) {
  const rows = await query(
    "SELECT k.id, k.api_key AS apiKey, IF(k.student_id IS NULL, 'teacher', 'student') AS role, " +
    "COALESCE(k.student_id, k.teacher_id) AS ownerId, COALESCE(s.name, t.name) AS ownerName, " +
    "k.request_limit AS requestLimit, k.requests_used AS requestsUsed, k.status, " +
    "k.created_at AS createdAt, k.last_used_at AS lastUsedAt " +
    "FROM api_keys k LEFT JOIN students s ON s.id = k.student_id LEFT JOIN teachers t ON t.id = k.teacher_id " +
    "ORDER BY k.id DESC");
  res.json({ data: rows });
}));

function readLimit(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : null;
}

// Generate a key for one student or teacher, with a request limit
app.post('/api/admin/keys', checkAdmin, route(async function (req, res) {
  const role = req.body.role;
  const ownerId = Number(req.body.ownerId);
  const limit = readLimit(req.body.requestLimit);
  if (role !== 'student' && role !== 'teacher') {
    return res.status(400).json({ message: 'Bad request: role must be "student" or "teacher"' });
  }
  if (!Number.isInteger(ownerId) || ownerId < 1) {
    return res.status(400).json({ message: 'Bad request: choose a valid owner' });
  }
  if (limit === null) {
    return res.status(400).json({ message: 'Bad request: request limit must be a whole number from 1 to 100000' });
  }
  const table = role === 'student' ? 'students' : 'teachers';
  const column = role === 'student' ? 'student_id' : 'teacher_id';
  const owner = await query('SELECT id, name FROM ' + table + ' WHERE id = ?', [ownerId]);
  if (!owner.length) return res.status(404).json({ message: 'Not found: that ' + role + ' does not exist' });
  const existing = await query("SELECT id FROM api_keys WHERE " + column + " = ? AND status = 'active'", [ownerId]);
  if (existing.length) {
    return res.status(409).json({ message: owner[0].name + ' already has an active key. Revoke it first.' });
  }
  const newKey = (role === 'student' ? 'stu_' : 'tea_') + crypto.randomBytes(12).toString('hex');
  const result = await query(
    'INSERT INTO api_keys (api_key, ' + column + ', request_limit) VALUES (?, ?, ?)', [newKey, ownerId, limit]);
  res.status(201).json({
    message: 'API key generated for ' + owner[0].name,
    data: { id: result.insertId, apiKey: newKey, role: role, ownerName: owner[0].name, requestLimit: limit }
  });
}));

// Update the request limit of a key
app.put('/api/admin/keys/:id/limit', checkAdmin, route(async function (req, res) {
  const limit = readLimit(req.body.requestLimit);
  if (limit === null) {
    return res.status(400).json({ message: 'Bad request: request limit must be a whole number from 1 to 100000' });
  }
  const result = await query('UPDATE api_keys SET request_limit = ? WHERE id = ?', [limit, req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found: no such key' });
  res.json({ message: 'Request limit updated to ' + limit });
}));

// Start the count again from zero
app.put('/api/admin/keys/:id/reset', checkAdmin, route(async function (req, res) {
  const result = await query('UPDATE api_keys SET requests_used = 0 WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found: no such key' });
  res.json({ message: 'Usage reset to 0' });
}));

// Revoke a key (it stays in the table so its history is kept)
app.put('/api/admin/keys/:id/revoke', checkAdmin, route(async function (req, res) {
  const result = await query("UPDATE api_keys SET status = 'revoked' WHERE id = ?", [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found: no such key' });
  res.json({ message: 'Key revoked. It can no longer be used.' });
}));

// Latest 100 requests
app.get('/api/admin/logs', checkAdmin, route(async function (req, res) {
  const rows = await query(
    "SELECT l.id, l.role, l.method, l.endpoint, l.status_code AS statusCode, l.created_at AS createdAt, " +
    "COALESCE(s.name, t.name) AS ownerName " +
    "FROM api_logs l LEFT JOIN api_keys k ON k.id = l.api_key_id " +
    "LEFT JOIN students s ON s.id = k.student_id LEFT JOIN teachers t ON t.id = k.teacher_id " +
    "ORDER BY l.id DESC LIMIT 100");
  res.json({ data: rows });
}));

// ---------------------------------------------------------------------
//  7. ERROR HANDLING
// ---------------------------------------------------------------------
app.use('/api', function (req, res) {
  res.status(404).json({ message: 'Not found: ' + req.method + ' ' + req.originalUrl });
});

app.use(function (err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Bad request: the JSON body is not valid' });
  }
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Server error: check that MySQL is running and database.sql was imported' });
});

// ---------------------------------------------------------------------
//  8. START
// ---------------------------------------------------------------------
app.listen(PORT, function () {
  console.log('CampusPass - University API Access Management');
  console.log('  Open      : http://localhost:' + PORT);
  console.log('  Admin     : http://localhost:' + PORT + '/admin   (admin key: ' + ADMIN_KEY + ')');
  db.query('SELECT (SELECT COUNT(*) FROM students) AS s, (SELECT COUNT(*) FROM teachers) AS t, (SELECT COUNT(*) FROM api_keys) AS k', function (err, rows) {
    if (err) {
      console.log('  Database  : NOT READY -> start MySQL in XAMPP and import database.sql (' + err.code + ')');
    } else {
      console.log('  Database  : campuspass_db OK (' + rows[0].s + ' students, ' + rows[0].t + ' teachers, ' + rows[0].k + ' keys)');
    }
  });
});
