-- ============================================================
--  CampusPass - University API Access Management  |  FSD Lab 07
--  Database : campuspass_db
--  Import   : phpMyAdmin -> Import -> choose this file -> Go
--             (it creates the database, so you do not create it first)
--  Safe to import again: it drops and rebuilds the tables.
-- ============================================================

CREATE DATABASE IF NOT EXISTS campuspass_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE campuspass_db;

DROP TABLE IF EXISTS api_logs;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS marks;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS teachers;

-- 1) STUDENTS --------------------------------------------------
CREATE TABLE students (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  department VARCHAR(60)  NOT NULL DEFAULT 'Computer Science',
  semester   VARCHAR(20)  NOT NULL DEFAULT 'BSCS VB'
);

-- 2) TEACHERS --------------------------------------------------
CREATE TABLE teachers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  department VARCHAR(60)  NOT NULL DEFAULT 'Computer Science',
  course     VARCHAR(80)  NOT NULL
);

-- 3) MARKS (one row per student per course) --------------------
--    midterm out of 30, sessional out of 20, final_exam out of 50
CREATE TABLE marks (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course     VARCHAR(80) NOT NULL,
  midterm    TINYINT UNSIGNED NOT NULL,
  sessional  TINYINT UNSIGNED NOT NULL,
  final_exam TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY one_row_per_course (student_id, course),
  CONSTRAINT fk_marks_student FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE
);

-- 4) API KEYS (each key belongs to ONE student OR ONE teacher) -
CREATE TABLE api_keys (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  api_key       VARCHAR(64) NOT NULL UNIQUE,
  student_id    INT NULL,
  teacher_id    INT NULL,
  request_limit INT UNSIGNED NOT NULL DEFAULT 10,
  requests_used INT UNSIGNED NOT NULL DEFAULT 0,
  status        ENUM('active','revoked') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at  TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_keys_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_keys_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- 5) API LOGS (every API request is recorded here) -------------
CREATE TABLE api_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  api_key_id  INT NULL,
  role        VARCHAR(10)  NOT NULL,
  method      VARCHAR(8)   NOT NULL,
  endpoint    VARCHAR(200) NOT NULL,
  status_code SMALLINT     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_time (created_at),
  CONSTRAINT fk_logs_key FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
);

-- ============================ SAMPLE DATA ====================
-- Students: the 32 names from the class list.
INSERT INTO students (name) VALUES
  ('Tehreem Malik'),
  ('Hania'),
  ('Aima'),
  ('Alishba'),
  ('Anisa Khan'),
  ('Faiqa Umar'),
  ('Hajra Noor'),
  ('Maria'),
  ('Mehwish'),
  ('Minahil Manzoor'),
  ('Nazish Nosheen Khalid'),
  ('Rabia Ashraf'),
  ('Rida Zainab'),
  ('Rubab Zehra'),
  ('Abdullah Masood'),
  ('Abdullah'),
  ('Abrar Ahmed'),
  ('Ali Haider Niazi'),
  ('Hamid Nawaz'),
  ('Hassan Maaz Ali'),
  ('Huzaifa Fazal'),
  ('Jawad Mustafa'),
  ('Malik Uzair Bin Tariq'),
  ('Mohsin Ali'),
  ('Moiz Khan'),
  ('Muhammad Ali'),
  ('Muhammad Huzaifa'),
  ('Muhammad Abdullah Tanveer'),
  ('Muhammad Bilal'),
  ('Muhammad Danish'),
  ('Muhammad Haseeb Shah'),
  ('Muhammad Junaid Javed'),
  ('Muhammad Mubashir Ali'),
  ('Muhammad Sohail Khan');

-- Teacher: the FSD lab instructor named on the lab sheet.
INSERT INTO teachers (name, course) VALUES
  ('M. Fahad Qasim', 'Full Stack Development');

-- Marks: SAMPLE values for demonstration only (not real results).
INSERT INTO marks (student_id, course, midterm, sessional, final_exam) VALUES
  (1, 'Full Stack Development', 22, 14, 39),
  (1, 'Artificial Intelligence', 20, 14, 37),
  (1, 'Operating Systems', 22, 15, 36),
  (1, 'Design and Analysis of Algorithms', 23, 15, 38),
  (1, 'Introduction to Management', 22, 14, 37),
  (2, 'Full Stack Development', 23, 14, 38),
  (2, 'Artificial Intelligence', 22, 15, 34),
  (2, 'Operating Systems', 20, 16, 39),
  (2, 'Design and Analysis of Algorithms', 23, 16, 36),
  (2, 'Introduction to Management', 20, 14, 36),
  (3, 'Full Stack Development', 23, 16, 40),
  (3, 'Artificial Intelligence', 23, 14, 40),
  (3, 'Operating Systems', 22, 15, 37),
  (3, 'Design and Analysis of Algorithms', 23, 15, 35),
  (3, 'Introduction to Management', 23, 16, 39),
  (4, 'Full Stack Development', 26, 16, 40),
  (4, 'Artificial Intelligence', 26, 16, 41),
  (4, 'Operating Systems', 22, 15, 38),
  (4, 'Design and Analysis of Algorithms', 22, 17, 43),
  (4, 'Introduction to Management', 23, 17, 40),
  (5, 'Full Stack Development', 23, 17, 41),
  (5, 'Artificial Intelligence', 24, 16, 44),
  (5, 'Operating Systems', 26, 16, 41),
  (5, 'Design and Analysis of Algorithms', 25, 16, 43),
  (5, 'Introduction to Management', 24, 16, 43),
  (6, 'Full Stack Development', 23, 15, 37),
  (6, 'Artificial Intelligence', 25, 16, 40),
  (6, 'Operating Systems', 24, 16, 43),
  (6, 'Design and Analysis of Algorithms', 23, 16, 40),
  (6, 'Introduction to Management', 25, 17, 40),
  (7, 'Full Stack Development', 29, 18, 49),
  (7, 'Artificial Intelligence', 26, 19, 48),
  (7, 'Operating Systems', 28, 18, 49),
  (7, 'Design and Analysis of Algorithms', 29, 19, 46),
  (7, 'Introduction to Management', 26, 18, 46),
  (8, 'Full Stack Development', 22, 14, 35),
  (8, 'Artificial Intelligence', 19, 13, 36),
  (8, 'Operating Systems', 23, 13, 38),
  (8, 'Design and Analysis of Algorithms', 20, 15, 37),
  (8, 'Introduction to Management', 23, 15, 37),
  (9, 'Full Stack Development', 21, 15, 38),
  (9, 'Artificial Intelligence', 24, 15, 38),
  (9, 'Operating Systems', 20, 14, 37),
  (9, 'Design and Analysis of Algorithms', 24, 16, 36),
  (9, 'Introduction to Management', 20, 15, 39),
  (10, 'Full Stack Development', 28, 17, 44),
  (10, 'Artificial Intelligence', 28, 18, 42),
  (10, 'Operating Systems', 25, 17, 47),
  (10, 'Design and Analysis of Algorithms', 25, 17, 43),
  (10, 'Introduction to Management', 28, 16, 44),
  (11, 'Full Stack Development', 22, 15, 36),
  (11, 'Artificial Intelligence', 25, 16, 41),
  (11, 'Operating Systems', 22, 15, 38),
  (11, 'Design and Analysis of Algorithms', 22, 16, 40),
  (11, 'Introduction to Management', 21, 15, 36),
  (12, 'Full Stack Development', 26, 19, 48),
  (12, 'Artificial Intelligence', 27, 19, 44),
  (12, 'Operating Systems', 28, 19, 43),
  (12, 'Design and Analysis of Algorithms', 28, 19, 46),
  (12, 'Introduction to Management', 30, 17, 48),
  (13, 'Full Stack Development', 23, 16, 36),
  (13, 'Artificial Intelligence', 23, 15, 38),
  (13, 'Operating Systems', 24, 17, 39),
  (13, 'Design and Analysis of Algorithms', 23, 15, 39),
  (13, 'Introduction to Management', 22, 17, 41),
  (14, 'Full Stack Development', 28, 17, 48),
  (14, 'Artificial Intelligence', 28, 18, 44),
  (14, 'Operating Systems', 28, 19, 46),
  (14, 'Design and Analysis of Algorithms', 29, 17, 42),
  (14, 'Introduction to Management', 27, 18, 45),
  (15, 'Full Stack Development', 22, 15, 36),
  (15, 'Artificial Intelligence', 20, 14, 34),
  (15, 'Operating Systems', 22, 13, 34),
  (15, 'Design and Analysis of Algorithms', 23, 13, 37),
  (15, 'Introduction to Management', 23, 15, 34),
  (16, 'Full Stack Development', 25, 16, 45),
  (16, 'Artificial Intelligence', 25, 16, 41),
  (16, 'Operating Systems', 24, 17, 45),
  (16, 'Design and Analysis of Algorithms', 27, 17, 39),
  (16, 'Introduction to Management', 24, 16, 40),
  (17, 'Full Stack Development', 26, 18, 42),
  (17, 'Artificial Intelligence', 27, 18, 44),
  (17, 'Operating Systems', 26, 18, 42),
  (17, 'Design and Analysis of Algorithms', 25, 17, 46),
  (17, 'Introduction to Management', 27, 18, 46),
  (18, 'Full Stack Development', 28, 17, 46),
  (18, 'Artificial Intelligence', 25, 18, 43),
  (18, 'Operating Systems', 24, 18, 42),
  (18, 'Design and Analysis of Algorithms', 28, 18, 40),
  (18, 'Introduction to Management', 27, 17, 46),
  (19, 'Full Stack Development', 24, 17, 43),
  (19, 'Artificial Intelligence', 23, 17, 39),
  (19, 'Operating Systems', 23, 16, 42),
  (19, 'Design and Analysis of Algorithms', 25, 15, 42),
  (19, 'Introduction to Management', 24, 16, 39),
  (20, 'Full Stack Development', 23, 15, 40),
  (20, 'Artificial Intelligence', 25, 17, 41),
  (20, 'Operating Systems', 23, 15, 37),
  (20, 'Design and Analysis of Algorithms', 22, 15, 40),
  (20, 'Introduction to Management', 23, 15, 43),
  (21, 'Full Stack Development', 27, 17, 43),
  (21, 'Artificial Intelligence', 27, 17, 40),
  (21, 'Operating Systems', 26, 17, 41),
  (21, 'Design and Analysis of Algorithms', 26, 15, 45),
  (21, 'Introduction to Management', 25, 18, 43),
  (22, 'Full Stack Development', 29, 19, 45),
  (22, 'Artificial Intelligence', 29, 19, 43),
  (22, 'Operating Systems', 29, 18, 43),
  (22, 'Design and Analysis of Algorithms', 27, 18, 46),
  (22, 'Introduction to Management', 27, 19, 46),
  (23, 'Full Stack Development', 23, 14, 40),
  (23, 'Artificial Intelligence', 24, 16, 39),
  (23, 'Operating Systems', 23, 16, 38),
  (23, 'Design and Analysis of Algorithms', 20, 14, 38),
  (23, 'Introduction to Management', 21, 15, 40),
  (24, 'Full Stack Development', 20, 15, 35),
  (24, 'Artificial Intelligence', 21, 15, 34),
  (24, 'Operating Systems', 23, 14, 36),
  (24, 'Design and Analysis of Algorithms', 19, 14, 32),
  (24, 'Introduction to Management', 22, 13, 33),
  (25, 'Full Stack Development', 21, 15, 33),
  (25, 'Artificial Intelligence', 20, 14, 34),
  (25, 'Operating Systems', 23, 13, 37),
  (25, 'Design and Analysis of Algorithms', 19, 14, 35),
  (25, 'Introduction to Management', 21, 15, 38),
  (26, 'Full Stack Development', 30, 18, 47),
  (26, 'Artificial Intelligence', 27, 19, 44),
  (26, 'Operating Systems', 30, 19, 49),
  (26, 'Design and Analysis of Algorithms', 29, 17, 46),
  (26, 'Introduction to Management', 27, 18, 44),
  (27, 'Full Stack Development', 24, 18, 42),
  (27, 'Artificial Intelligence', 27, 17, 41),
  (27, 'Operating Systems', 26, 17, 41),
  (27, 'Design and Analysis of Algorithms', 27, 16, 42),
  (27, 'Introduction to Management', 27, 17, 42),
  (28, 'Full Stack Development', 23, 18, 39),
  (28, 'Artificial Intelligence', 25, 16, 44),
  (28, 'Operating Systems', 24, 16, 42),
  (28, 'Design and Analysis of Algorithms', 24, 18, 43),
  (28, 'Introduction to Management', 27, 16, 40),
  (29, 'Full Stack Development', 26, 18, 44),
  (29, 'Artificial Intelligence', 28, 18, 47),
  (29, 'Operating Systems', 26, 17, 46),
  (29, 'Design and Analysis of Algorithms', 27, 17, 43),
  (29, 'Introduction to Management', 28, 17, 47),
  (30, 'Full Stack Development', 23, 16, 38),
  (30, 'Artificial Intelligence', 26, 16, 37),
  (30, 'Operating Systems', 23, 16, 39),
  (30, 'Design and Analysis of Algorithms', 22, 17, 41),
  (30, 'Introduction to Management', 23, 17, 43),
  (31, 'Full Stack Development', 29, 20, 47),
  (31, 'Artificial Intelligence', 28, 18, 45),
  (31, 'Operating Systems', 27, 20, 47),
  (31, 'Design and Analysis of Algorithms', 25, 19, 44),
  (31, 'Introduction to Management', 27, 19, 45),
  (32, 'Full Stack Development', 26, 19, 43),
  (32, 'Artificial Intelligence', 25, 17, 42),
  (32, 'Operating Systems', 28, 17, 41),
  (32, 'Design and Analysis of Algorithms', 25, 18, 43),
  (32, 'Introduction to Management', 27, 17, 46),
  (33, 'Full Stack Development', 23, 15, 40),
  (33, 'Artificial Intelligence', 24, 16, 42),
  (33, 'Operating Systems', 23, 16, 42),
  (33, 'Design and Analysis of Algorithms', 26, 17, 42),
  (33, 'Introduction to Management', 23, 16, 41),
  (34, 'Full Stack Development', 23, 16, 40),
  (34, 'Artificial Intelligence', 24, 15, 36),
  (34, 'Operating Systems', 21, 15, 35),
  (34, 'Design and Analysis of Algorithms', 24, 16, 34),
  (34, 'Introduction to Management', 22, 13, 39);

-- API keys. Admin key is NOT stored here: it is predefined in server.js.
--   student-key-123  -> student 1 (Tehreem Malik)   limit 10
--   student-key-124  -> student 2 (Hania) limit 10
--   student-key-revoked -> student 3 (Aima), already revoked (demo of HTTP 403)
--   teacher-key-456  -> teacher 1 (M. Fahad Qasim)    limit 30
INSERT INTO api_keys (api_key, student_id, teacher_id, request_limit, status) VALUES
  ('student-key-123',     1,    NULL, 10, 'active'),
  ('student-key-124',     2,    NULL, 10, 'active'),
  ('student-key-revoked', 3,    NULL, 10, 'revoked'),
  ('teacher-key-456',     NULL, 1,    30, 'active');
