
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'app.db');
console.log('Connecting to:', dbPath);

try {
  const db = new Database(dbPath);
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  console.log('Settings row:', settings);
} catch (e) {
  console.error('Error:', e);
}
