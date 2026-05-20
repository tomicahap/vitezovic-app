const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'app.db');
const db = new Database(dbPath);

const rows = db.prepare('SELECT id, email, is_temp_password, password FROM members WHERE is_temp_password = 1 OR is_temp_password = \'true\'').all();
console.log('Members with temp password:', JSON.stringify(rows, null, 2));
