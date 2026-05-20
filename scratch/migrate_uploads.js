const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('./data/app.db');
const oldDir = path.join(process.cwd(), 'public', 'uploads', 'meetings');
const newDir = path.join(process.cwd(), 'data', 'doc');

if (!fs.existsSync(newDir)) {
  fs.mkdirSync(newDir, { recursive: true });
}

// Move files
if (fs.existsSync(oldDir)) {
  const files = fs.readdirSync(oldDir);
  files.forEach(file => {
    const oldPath = path.join(oldDir, file);
    const newPath = path.join(newDir, file);
    console.log(`Moving ${file} to ${newDir}`);
    fs.renameSync(oldPath, newPath);
  });
}

function updateAttachments(table) {
  const rows = db.prepare(`SELECT id, attachments FROM ${table}`).all();
  rows.forEach(row => {
    if (row.attachments) {
      try {
        let attachments = JSON.parse(row.attachments);
        let changed = false;
        if (Array.isArray(attachments)) {
          attachments = attachments.map(a => {
            if (a.url && a.url.startsWith('/uploads/meetings/')) {
              a.url = a.url.replace('/uploads/meetings/', '/api/uploads/');
              changed = true;
            }
            return a;
          });
        }
        if (changed) {
          db.prepare(`UPDATE ${table} SET attachments = ? WHERE id = ?`).run(JSON.stringify(attachments), row.id);
          console.log(`Updated attachments for ${table} ID ${row.id}`);
        }
      } catch (e) {
        console.error(`Error parsing attachments for ${table} ID ${row.id}:`, e);
      }
    }
  });
}

const tables = ['meetings', 'lectures', 'library_books', 'library_journals', 'projects'];
tables.forEach(updateAttachments);

db.close();
console.log('Migration complete.');
