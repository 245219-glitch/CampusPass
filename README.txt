UNIVERSITY API ACCESS MANAGEMENT SYSTEM  (FSD Lab 07)
=====================================================
Stack: HTML + CSS + jQuery AJAX | Node.js + Express | MySQL (XAMPP)

FOLDER LAYOUT
  database.sql        MySQL tables + sample data (import this once)
  server.js           The whole backend: middleware + every API endpoint
  public/             The website (served by Node.js, no Apache needed)
    index.html          Home
    settings.html       Students/teachers save their API key here
    student.html        Student portal (own marks only)
    teacher.html        Teacher portal (all students, all marks)
    admin.html          Admin panel (opens at /admin)
    css/style.css       All styling
    js/common.js        Shared AJAX helper + small UI parts
    js/*.js             One script per page
  node_modules/       Already installed, so it works with NO internet
  START_SERVER.bat    Double-click to start (Windows)

HOW TO RUN  (5 steps)
  1. Open XAMPP Control Panel and START MySQL.  (Apache is not needed.)
  2. Open http://localhost/phpmyadmin  ->  Import  ->  Choose File:
     database.sql  ->  Go.   It creates the database "campuspass_db".
  3. Open this folder in a terminal (or Command Prompt) and run:
         node server.js
     or just double-click START_SERVER.bat.
     You should see:  Database : campuspass_db OK (34 students, 1 teachers, 4 keys)
  4. Open  http://localhost:3100   in the browser.
  5. Admin panel:  http://localhost:3100/admin
     Admin API key (predefined in server.js):  admin-key-789

  If node_modules is missing, run:  npm install   (needs internet once).
  If your MySQL has a password, change it in server.js (section 1).

DEMO KEYS (already in database.sql)
  student-key-123       Student 1 (Tehreem Malik), limit 10
  student-key-124       Student 2 (Hania), limit 10
  student-key-revoked   Student 3 (Aima), REVOKED  -> shows HTTP 403
  teacher-key-456       Teacher, limit 30
  admin-key-789         Administrator (in server.js, not in the database)

WHAT TO SHOW IN THE DEMO VIDEO  (matches the 8 requirements)
  1. Database      phpMyAdmin: students, teachers, marks, api_keys, api_logs
  2. Admin panel   /admin -> sign in -> Overview, Students, Teachers tabs
                   API keys tab: Generate key, Edit limit, Reset usage, Revoke
  3. Settings      /settings -> paste a generated key -> Save key
  4. Student       /student shows only own marks.  Press
                   "Open another student's marks" -> 403 Forbidden.
     Teacher       /teacher shows all students, search, all marks, averages.
  5. Header keys   F12 -> Network -> click a request -> x-api-key header
  6. Endpoints     see the table below
  7. Middleware    401 (no/wrong key), 403 (revoked / wrong role / other's id)
  8. Limits        Admin sets a small limit (e.g. 3), use the key until
                   429 appears, then Edit limit / Reset usage.
                   Admin -> Activity tab shows every request (api_logs table).

API ENDPOINTS  (send the key in the header:  x-api-key: <key>)
  Public
    GET  /api/health
  Student or teacher key
    GET  /api/me                       who owns this key
    GET  /api/students/:id             student: own id only | teacher: any id
    GET  /api/students/:id/marks       student: own id only | teacher: any id
  Teacher key only
    GET  /api/students?search=         all students
    GET  /api/marks?search=&course=    marks of all students
  Admin key only
    GET  /api/admin/summary            numbers for the overview
    GET  /api/admin/students           view students
    GET  /api/admin/teachers           view teachers
    GET  /api/admin/keys               keys with usage and status
    POST /api/admin/keys               generate key {role, ownerId, requestLimit}
    PUT  /api/admin/keys/:id/limit     update limit {requestLimit}
    PUT  /api/admin/keys/:id/reset     set usage back to 0
    PUT  /api/admin/keys/:id/revoke    revoke key
    GET  /api/admin/logs               latest 100 requests

STATUS CODES USED
  200 OK | 201 Created | 400 Bad request | 401 missing/invalid key
  403 revoked key, wrong role, or another student's record
  404 not found | 409 owner already has an active key
  429 request limit used up | 500 database/server error

MIDDLEWARE ORDER (server.js, section 3)
  checkKey -> allowRoles -> ownRecordOnly -> spendRequest
  A request is only counted (spendRequest) after it passed every check.
  Refused requests (401/403) never use up a limit.

SAMPLE DATA NOTES
  - Students: the 32 names from your class list plus Tehreem Malik and Hania (girls first, then boys).  Roll numbers were cut off in
    the screenshot, so the table has no roll_no column.
  - Teacher: M. Fahad Qasim (named on the lab sheet).  To add more:
        INSERT INTO teachers (name, course) VALUES ('Name', 'Course');
  - Marks are made-up SAMPLE numbers, not real results.
  - Importing database.sql again resets everything (including usage counts).

TROUBLESHOOTING
  "Database : NOT READY"   MySQL is stopped or database.sql was not imported.
  Port 3100 already in use Close the old Node window, then start again.
  429 on every request     Admin panel -> API keys -> Reset usage (or raise the limit).
  Forgot where a key is    Admin panel -> API keys -> Copy.
