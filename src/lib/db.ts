import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

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


  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    category TEXT,
    is_favorite INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS repayment_plan_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    creditors TEXT NOT NULL,
    monthly_available INTEGER NOT NULL,
    months INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS creditor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS case_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creditor_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    source_snapshot TEXT NOT NULL,
    changes TEXT DEFAULT '',
    html_preview TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creditor_id) REFERENCES creditor(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS standard_median_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    household_size INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, household_size)
  );

`);

// 마이그레이션: case_documents 테이블에 changes 컬럼이 없으면 추가
try {
  const tableInfo = db.prepare("PRAGMA table_info(case_documents)").all() as any[];
  const hasChangesColumn = tableInfo.some(col => col.name === 'changes'); 
  if (!hasChangesColumn) {
    db.exec("ALTER TABLE case_documents ADD COLUMN changes TEXT DEFAULT ''");
    console.log('Added "changes" column to case_documents table.');
  }
} catch (error) {
  console.error('Migration error:', error);
}


// 초기 운영자 계정 생성 (환경변수 또는 기본값 사용)
const adminUsername = process.env.ADMIN_USERNAME || 'courteasy';
const adminPassword = process.env.ADMIN_PASSWORD || 'qwer1234';

// 비밀번호 해싱
const salt = bcrypt.genSaltSync(10);
const hashedPassword = bcrypt.hashSync(adminPassword, salt);

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, password, name, role)
  VALUES (?, ?, ?, ?)
`);

insertUser.run(adminUsername, hashedPassword, '운영자', 'ADMIN');

export default db;
