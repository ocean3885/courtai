import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getInitialAdminConfig } from './env';

const dbPath = path.resolve(process.cwd(), 'courteasy.db');

let _db: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (_db) return _db;

  _db = new Database(dbPath, { timeout: 10000 });
  _db.pragma('journal_mode = WAL');

  // 테이블 초기화
  _db.exec(`
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

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // 마이그레이션: case_documents 테이블에 changes 컬럼이 없으면 추가
  try {
    const tableInfo = _db.prepare("PRAGMA table_info(case_documents)").all() as any[];
    const hasChangesColumn = tableInfo.some(col => col.name === 'changes');
    if (!hasChangesColumn) {
      _db.exec("ALTER TABLE case_documents ADD COLUMN changes TEXT DEFAULT ''");
    }
  } catch (error) {
    console.error('Migration error:', error);
  }

  // 초기 운영자 계정 생성. 운영 배포에서 기본 계정이 생기지 않도록 환경변수를 필수로 요구합니다.
  const admin = getInitialAdminConfig();

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(admin.password, salt);

  const insertUser = _db.prepare(`
    INSERT OR IGNORE INTO users (username, password, name, role)
    VALUES (?, ?, ?, ?)
  `);

  insertUser.run(admin.username, hashedPassword, admin.name, 'ADMIN');

  return _db;
};

// Proxy to allow existing 'import db from ...' usage while deferring initialization
const dbProxy = new Proxy({} as Database.Database, {
  get(target, prop) {
    const instance = getDb();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export default dbProxy;
