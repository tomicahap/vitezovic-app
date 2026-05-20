const Database = require('better-sqlite3');
const db = new Database('./data/app.db');
const tables = ['library_books', 'library_journals', 'books', 'journals'];
tables.forEach(t => {
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${t}'`).get();
  console.log(`${t} schema:`, schema);
});
