const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'app.db');
const db = new Database(dbPath);

console.log('Votes Table Info:');
const info = db.prepare('PRAGMA table_info(votes)').all();
console.table(info);

try {
  const sample = db.prepare('SELECT * FROM votes LIMIT 1').get();
  console.log('Sample row:', sample);
} catch (e) {
  console.log('Error selecting from votes:', e.message);
}
