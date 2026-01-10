import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'courteasy.db');
const db = new Database(dbPath);

// 테이블 초기화
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'USER',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rehabilitation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    creditor_data TEXT,
    plan_data TEXT,
    memo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 초기 운영자 계정 생성 (아이디: courteasy, 비번: qwer1234)
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, password, name, role)
  VALUES (?, ?, ?, ?)
`);

const hashedPassword = '$2b$10$/POXb2jbXeaC1Tnzx5bnjuB3exLvbrzIe5KeKx5O0V9w2pgBi6YKW';
insertUser.run('courteasy', hashedPassword, '운영자', 'ADMIN');

export default db;
