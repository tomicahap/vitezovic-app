const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'app.db');

if (!fs.existsSync(dbPath)) {
  console.log('Database does not exist. Please run the app first to initialize tables.');
  process.exit(1);
}

const db = new Database(dbPath);

const logs = [
  {
    id: 'l1',
    userId: 'admin-1',
    userName: 'Admin',
    userRole: 'admin',
    action: 'LOGIN',
    details: 'Prijava u sustav uspješna.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  {
    id: 'l2',
    userId: 'admin-1',
    userName: 'Admin',
    userRole: 'admin',
    action: 'CREATE_MEMBER',
    details: 'Dodan novi član: Ivan Horvat.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString()
  },
  {
    id: 'l3',
    userId: 'admin-1',
    userName: 'Admin',
    userRole: 'admin',
    action: 'UPDATE_SETTING',
    details: 'Promijenjena tema sustava u Archivist Premium.',
    timestamp: new Date().toISOString()
  }
];

const insertLog = db.prepare(`
  INSERT INTO activity_logs (id, userId, userName, userRole, action, details, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  for (const log of logs) {
    try {
      insertLog.run(log.id, log.userId, log.userName, log.userRole, log.action, log.details, log.timestamp);
    } catch (e) {
      console.log(`Skipping log ${log.id} (already exists or error)`);
    }
  }
})();

console.log('Seed successful: 3 activity logs added.');
db.close();
