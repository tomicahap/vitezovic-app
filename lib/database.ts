import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db')
const dbDir = path.dirname(dbPath)

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// Initialize database
let db = new Database(dbPath)

export const ProjectsDB = {
  getAll(): any[] {
    return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all()
  },
  get(id: number): any | undefined {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  },
  insert(p: any): number {
    const cols = Object.keys(p)
    const vals = cols.map(c => `:${c}`)
    const res = db.prepare(`
      INSERT INTO projects (${cols.join(', ')})
      VALUES (${vals.join(', ')})
    `).run(p)
    return res.lastInsertRowid as number
  },
  update(id: number, p: any): void {
    const cols = Object.keys(p)
    const sets = cols.map(c => `${c}=:${c}`)
    db.prepare(`
      UPDATE projects SET ${sets.join(', ')}, updated_at=CURRENT_TIMESTAMP
      WHERE id=:id
    `).run({ ...p, id })
  },
  delete(id: number): void {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  }
}

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    birthDate TEXT,
    address TEXT,
    membershipNumber TEXT,
    registryNumber TEXT,
    joinDate TEXT,
    functions TEXT, -- JSON string array
    note TEXT,
    invitationSent INTEGER DEFAULT 0,
    is_temp_password INTEGER DEFAULT 0,
    access_rights TEXT, -- JSON
    role TEXT DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    userRole TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    userAgent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    logoUrl TEXT,
    overdueAfterDays INTEGER DEFAULT 365,
    inactiveAfterDays INTEGER DEFAULT 730,
    availableFunctions TEXT, -- JSON string
    googleDriveUrl TEXT,
    meetingTypes TEXT,    -- JSON string array
    meetingLocations TEXT, -- JSON string array
    adminBackupEmail TEXT,
    adminBackupPassword TEXT,
    vaultNotes TEXT,
    smtpHost TEXT,
    smtpPort INTEGER,
    smtpUser TEXT,
    smtpPass TEXT,
    smtpSecure INTEGER DEFAULT 1,
    smtpFrom TEXT
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    minutes TEXT,
    attendee_ids TEXT, -- JSON
    agenda TEXT,       -- JSON
    attachments TEXT,  -- JSON
    status TEXT DEFAULT 'scheduled',
    next_meeting_date TEXT,
    next_meeting_time TEXT,
    next_meeting_location TEXT,
    next_meeting_agenda TEXT, -- JSON
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'present', -- present, absent, excused
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER, -- Nullable
    title TEXT NOT NULL,
    description TEXT,
    options TEXT NOT NULL, -- JSON array of options
    target_member_ids TEXT, -- JSON
    status TEXT DEFAULT 'active', -- active, archived
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS vote_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vote_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    option_index INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vote_id) REFERENCES votes (id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
    UNIQUE(vote_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    username TEXT,
    password TEXT,
    url TEXT,
    category TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (memberId) REFERENCES members (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    email TEXT,
    phone TEXT,
    workplace TEXT,
    category TEXT,
    notes TEXT,
    website TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS useful_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS library_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broj INTEGER,
      autor TEXT,
      naslov TEXT NOT NULL,
      podnaslov TEXT,
      izdavac TEXT,
      mjesto TEXT,
      godina TEXT,
      isbn TEXT,
      uvez TEXT,
      stranice INTEGER,
      jezik TEXT DEFAULT 'Hrvatski',
      signatura TEXT,
      polica TEXT,
      napomena TEXT,
      attachments TEXT, -- JSON
      loan_member_id INTEGER,
      loan_member_name TEXT,
      loan_date TEXT,
      loan_return_date TEXT,
      loan_notes TEXT,
      rights_contacted INTEGER DEFAULT 0,
      rights_contact_date TEXT,
      rights_responded INTEGER DEFAULT 0,
      rights_response_date TEXT,
      rights_consent INTEGER DEFAULT 0,
      rights_attachment TEXT,
      is_scanned INTEGER DEFAULT 0,
      is_digitized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS library_journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broj INTEGER,
      naslov TEXT NOT NULL,
      svesci TEXT,
      podrucje TEXT,
      izdavac TEXT,
      issn TEXT,
      napomena TEXT,
      attachments TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    priority TEXT DEFAULT 'medium',
    progress INTEGER DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    lead_member_id INTEGER,
    lead_member_name TEXT,
    member_ids TEXT, -- JSON
    goals TEXT,      -- JSON
    attachments TEXT, -- JSON
    records TEXT,     -- JSON
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS external_libraries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    k_kod TEXT,
    naziv TEXT NOT NULL,
    postanski_broj TEXT,
    mjesto TEXT,
    adresa TEXT,
    email_sluzbeni TEXT,
    email_direktni TEXT,
    telefon TEXT,
    odgovorna_osoba TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS library_contact_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    library_id INTEGER NOT NULL,
    contact_date TEXT NOT NULL,
    contact_person_id INTEGER, -- CMS member id
    contact_person_name TEXT,  -- Name of person who contacted
    library_contact_person TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (library_id) REFERENCES external_libraries (id) ON DELETE CASCADE
  );

  -- Initialize default settings
  INSERT OR IGNORE INTO settings (id, overdueAfterDays, inactiveAfterDays) 
  VALUES (1, 365, 730);
`)


// Migrations
try { db.exec('ALTER TABLE meetings ADD COLUMN attendee_ids TEXT') } catch (e) {}
try { db.exec('ALTER TABLE meetings ADD COLUMN agenda TEXT') } catch (e) {}
try { db.exec('ALTER TABLE meetings ADD COLUMN attachments TEXT') } catch (e) {}
try { db.exec('ALTER TABLE meetings ADD COLUMN status TEXT DEFAULT "scheduled"') } catch (e) {}
try { db.exec('ALTER TABLE meetings ADD COLUMN next_meeting_date TEXT') } catch (e) {}
try { db.exec('ALTER TABLE meetings ADD COLUMN next_meeting_time TEXT') } catch (e) {}
try { db.exec('ALTER TABLE meetings ADD COLUMN next_meeting_location TEXT') } catch (e) {}
try { db.exec('ALTER TABLE meetings ADD COLUMN next_meeting_agenda TEXT') } catch (e) {}
try { db.exec('ALTER TABLE meetings ADD COLUMN created_by TEXT') } catch (e) {}

try { db.exec('ALTER TABLE library_books ADD COLUMN attachments TEXT') } catch (e) {}
try { db.exec('ALTER TABLE library_journals ADD COLUMN attachments TEXT') } catch (e) {}
try { db.exec('ALTER TABLE members ADD COLUMN invitationSent INTEGER DEFAULT 0') } catch (e) {}
try { db.exec('ALTER TABLE settings ADD COLUMN overdueAfterDays INTEGER DEFAULT 365') } catch (e) {}
try { db.exec('ALTER TABLE settings ADD COLUMN inactiveAfterDays INTEGER DEFAULT 730') } catch (e) {}
try { db.exec('ALTER TABLE members ADD COLUMN password TEXT') } catch (e) {}
try { db.exec('ALTER TABLE members ADD COLUMN personal_notes TEXT DEFAULT ""') } catch (e) {}
try { db.exec('ALTER TABLE members ADD COLUMN personal_todos TEXT DEFAULT "[]"') } catch (e) {}
try { db.exec('ALTER TABLE settings ADD COLUMN googleDriveUrl TEXT') } catch (e) {}
try { db.exec('ALTER TABLE settings ADD COLUMN googleServiceAccountJson TEXT') } catch (e) {}
try { db.exec('ALTER TABLE settings ADD COLUMN googleDriveFolderId TEXT') } catch (e) {}
try { db.exec('ALTER TABLE members ADD COLUMN status_clana TEXT DEFAULT "AKTIVAN"') } catch(e) {}
try { db.exec('ALTER TABLE members ADD COLUMN datum_zadnje_uplate TEXT') } catch(e) {}
try { db.exec('ALTER TABLE votes ADD COLUMN target_member_ids TEXT') } catch(e) {}
try { db.exec('ALTER TABLE votes ADD COLUMN created_by TEXT') } catch(e) {}
try {
  // Fix NOT NULL constraint on meeting_id if it exists
  const info = db.prepare('PRAGMA table_info(votes)').all();
  const meetingIdCol = info.find((c: any) => c.name === 'meeting_id') as any;
  if (meetingIdCol && meetingIdCol.notnull === 1) {
    db.exec(`
      CREATE TABLE votes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER, -- Now nullable
        title TEXT NOT NULL,
        description TEXT,
        options TEXT NOT NULL,
        target_member_ids TEXT,
        status TEXT DEFAULT 'active',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE SET NULL
      );
      INSERT INTO votes_new (id, meeting_id, title, description, options, status, created_at, target_member_ids, created_by)
      SELECT id, meeting_id, title, description, options, status, created_at, target_member_ids, created_by FROM votes;
      DROP TABLE votes;
      ALTER TABLE votes_new RENAME TO votes;
    `);
  }
} catch (e) {
  console.error('Migration error on votes table:', e);
}

// Migration for vote_results: rename option to option_index if needed
try {
  const info = db.prepare('PRAGMA table_info(vote_results)').all();
  if (info.some((c: any) => c.name === 'option')) {
    db.exec(`
      CREATE TABLE vote_results_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vote_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        option_index INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vote_id) REFERENCES votes (id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
        UNIQUE(vote_id, member_id)
      );
      INSERT INTO vote_results_new (id, vote_id, member_id, option_index, timestamp)
      SELECT id, vote_id, member_id, CAST(option AS INTEGER), timestamp FROM vote_results;
      DROP TABLE vote_results;
      ALTER TABLE vote_results_new RENAME TO vote_results;
    `);
  }
} catch (e) {
  console.error('Migration error on vote_results table:', e);
}
try { db.exec('ALTER TABLE members ADD COLUMN is_temp_password INTEGER DEFAULT 0') } catch(e) {}
try { db.exec('ALTER TABLE members ADD COLUMN access_rights TEXT') } catch(e) {}

// Lectures table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'lecture',
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      location TEXT,
      description TEXT,
      host TEXT,
      hosts TEXT, -- JSON
      attendee_ids TEXT, -- JSON
      attachments TEXT,  -- JSON
      status TEXT DEFAULT 'scheduled',
      youtube_url TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
} catch (e) {}
try { db.exec('ALTER TABLE lectures ADD COLUMN youtube_url TEXT') } catch (e) {}
try { db.exec('ALTER TABLE lectures ADD COLUMN hosts TEXT') } catch (e) {}

export interface Member {
  id: number; name: string; email: string; phone: string | null; birthDate: string | null;
  address: string | null; membershipNumber: string | null; registryNumber: string | null;
  joinDate: string | null; functions: any[]; note: string | null; invitationSent: boolean;
  is_temp_password: boolean; accessRights?: any; access_rights?: string | null;
  role: string; password?: string | null; personal_notes?: string; personal_todos?: string;
  status_clana?: string; datum_zadnje_uplate?: string; membershipStatus?: string;
  paymentStatus?: string; payments?: any[];
}

export function serializeMember(m: any): any {
  return { ...m, functions: JSON.stringify(m.functions || []), personal_todos: JSON.stringify(m.personal_todos || []), invitationSent: m.invitationSent ? 1 : 0 }
}
export function deserializeMember(m: any): any {
  if (!m) return m
  return { ...m, functions: typeof m.functions === 'string' ? JSON.parse(m.functions) : (m.functions || []), personal_todos: typeof m.personal_todos === 'string' ? JSON.parse(m.personal_todos) : (m.personal_todos || []), invitationSent: m.invitationSent === 1 }
}

export class DatabaseService {
  // Members
  static getAllMembers(): Member[] { return db.prepare('SELECT * FROM members ORDER BY name ASC').all().map(this.mapMember) }
  static getMemberNames(): {id: number, name: string}[] { return db.prepare('SELECT id, name FROM members ORDER BY name ASC').all() as {id: number, name: string}[] }
  static getMemberById(id: number): Member | undefined { const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id); return row ? this.mapMember(row) : undefined }
  static createMember(m: any): number { return db.prepare('INSERT INTO members (name, email, phone, birthDate, address, membershipNumber, registryNumber, joinDate, note) VALUES (?,?,?,?,?,?,?,?,?)').run(m.name, m.email, m.phone, m.birthDate, m.address, m.membershipNumber, m.registryNumber, m.joinDate, m.note).lastInsertRowid as number }
  static insertMember(m: any): number { return this.createMember(m) }
  static getMember(id: number): Member | undefined { return this.getMemberById(id) }
  static updateMember(id: number, m: any): void {
    const cur = this.getMemberById(id); if (!cur) return
    db.prepare('UPDATE members SET name=?,email=?,phone=?,birthDate=?,address=?,membershipNumber=?,registryNumber=?,joinDate=?,functions=?,note=?,invitationSent=?,is_temp_password=?,access_rights=?,role=?,password=?,personal_notes=?,personal_todos=?,status_clana=?,datum_zadnje_uplate=? WHERE id=?').run(m.name??cur.name,m.email??cur.email,m.phone===undefined?cur.phone:m.phone,m.birthDate===undefined?cur.birthDate:m.birthDate,m.address===undefined?cur.address:m.address,m.membershipNumber===undefined?cur.membershipNumber:m.membershipNumber,m.registryNumber===undefined?cur.registryNumber:m.registryNumber,m.joinDate===undefined?cur.joinDate:m.joinDate,m.functions?JSON.stringify(m.functions):JSON.stringify(cur.functions),m.note===undefined?cur.note:m.note,m.invitationSent!==undefined?(m.invitationSent?1:0):cur.invitationSent?1:0,m.is_temp_password!==undefined?(m.is_temp_password?1:0):cur.is_temp_password?1:0,m.access_rights?JSON.stringify(m.access_rights):cur.access_rights,m.role??cur.role,m.password===undefined?cur.password:m.password,m.personal_notes===undefined?cur.personal_notes:m.personal_notes,m.personal_todos===undefined?cur.personal_todos:m.personal_todos,m.status_clana===undefined?cur.status_clana:m.status_clana,m.datum_zadnje_uplate===undefined?cur.datum_zadnje_uplate:m.datum_zadnje_uplate,id)
  }
  static deleteMember(id: number): void { db.prepare('DELETE FROM members WHERE id = ?').run(id) }
  private static mapMember(row: any): Member {
    const s = db.prepare('SELECT overdueAfterDays, inactiveAfterDays FROM settings WHERE id = 1').get() as any
    const p = db.prepare('SELECT * FROM payments WHERE memberId = ? ORDER BY date DESC').all(row.id) as any[]
    const last = p.length ? new Date(p[0].date) : null; const now = new Date()
    let ms = 'active', ps = 'none'
    if (last) { const d = Math.ceil(Math.abs(now.getTime()-last.getTime())/(1000*3600*24)); if (d>(s?.inactiveAfterDays??730)) ms='inactive'; if (d>(s?.overdueAfterDays??365)) ps='overdue'; else ps='paid' }
    return { ...row, invitationSent: row.invitationSent === 1, functions: row.functions?JSON.parse(row.functions):[], membershipStatus: ms, paymentStatus: ps, payments: p }
  }

  // Payments
  static addPayment(mId: number, p: any): number { const rs = db.prepare('INSERT INTO payments (memberId, date, amount, note) VALUES (?,?,?,?)').run(mId, p.date, p.amount, p.note); db.prepare('UPDATE members SET datum_zadnje_uplate=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(p.date, mId); return rs.lastInsertRowid as number }
  
  // Settings
  static getSettings(): any { return db.prepare('SELECT * FROM settings WHERE id = 1').get() }
  static updateSettings(s: any): void { const cols = Object.keys(s); const sets = cols.map(c => `${c}=:${c}`); db.prepare(`UPDATE settings SET ${sets.join(',')} WHERE id=1`).run(s) }
  
  // Lectures
  static getAllLectures(): any[] { return db.prepare('SELECT * FROM lectures ORDER BY date DESC').all() }
  static getLecture(id: number): any { return db.prepare('SELECT * FROM lectures WHERE id = ?').get(id) }
  static insertLecture(l: any): number { 
    if (l.hosts && typeof l.hosts !== 'string') l.hosts = JSON.stringify(l.hosts)
    const cols = Object.keys(l); const vals = cols.map(c => `:${c}`); return db.prepare(`INSERT INTO lectures (${cols.join(',')}) VALUES (${vals.join(',')})`).run(l).lastInsertRowid as number 
  }
  static updateLecture(id: number, l: any): void { 
    if (l.hosts && typeof l.hosts !== 'string') l.hosts = JSON.stringify(l.hosts)
    const cols = Object.keys(l); const sets = cols.map(c => `${c}=:${c}`); db.prepare(`UPDATE lectures SET ${sets.join(',')} WHERE id=:id`).run({ ...l, id }) 
  }
  static deleteLecture(id: number): void { db.prepare('DELETE FROM lectures WHERE id = ?').run(id) }

  // Logs
  static getLogs(limit: number = 1000): any[] { return db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?').all(limit) }
  static insertLog(l: any): number { const cols = Object.keys(l); const vals = cols.map(c => `:${c}`); return db.prepare(`INSERT INTO activity_logs (${cols.join(',')}) VALUES (${vals.join(',')})`).run(l).lastInsertRowid as number }
  static clearLogs(): void { db.prepare('DELETE FROM activity_logs').run() }

  // Meetings (Bridge)
  static getAllMeetings(): any[] { return MeetingsDB.getAll() }
  static getMeeting(id: number): any { return MeetingsDB.getById(id) }
  static insertMeeting(m: any): number { return MeetingsDB.insert(m) }
  static updateMeeting(id: number, m: any): void { MeetingsDB.update(id, m) }
  static deleteMeeting(id: number): void { MeetingsDB.delete(id) }

  // Polls / Voting
  static getPolls(status?: string): any[] { 
    let sql = 'SELECT * FROM votes'
    if (status) sql += ` WHERE status = '${status}'`
    sql += ' ORDER BY created_at DESC'
    return db.prepare(sql).all()
  }
  
  private static parsePollTargets(targetStr: any): any {
    if (!targetStr) return "all"
    if (typeof targetStr !== 'string') return targetStr
    
    try {
      const parsed = JSON.parse(targetStr)
      if (typeof parsed === 'string') {
        return this.parsePollTargets(parsed)
      }
      return parsed
    } catch (e) {
      return targetStr
    }
  }

  static getPollsForMember(memberId: number): any[] {
    const polls = db.prepare('SELECT * FROM votes').all()
    return polls.filter((p: any) => {
      const targets = this.parsePollTargets(p.target_member_ids)
      const mid = Number(memberId)
      return targets === "all" || (Array.isArray(targets) && targets.some((id: any) => Number(id) === mid))
    })
  }
  static getActivePollsForMember(memberId: number): any[] {
    const polls = db.prepare("SELECT * FROM votes WHERE (status = 'active' OR status = 'open')").all()
    return polls.filter((p: any) => {
      // Check if member is a target
      const targets = this.parsePollTargets(p.target_member_ids)
      const mid = Number(memberId)
      const isTarget = targets === "all" || (Array.isArray(targets) && targets.some((id: any) => Number(id) === mid))
      
      console.log(`[DB] Poll ${p.id} target check for member ${memberId}: isTarget=${isTarget}, targets=${JSON.stringify(targets)}`)

      if (!isTarget) return false
      
      // Check if member already voted
      const hasVoted = this.hasMemberVoted(p.id, memberId)
      console.log(`[DB] Poll ${p.id} vote check for member ${memberId}: hasVoted=${hasVoted}`)
      return !hasVoted
    })
  }
  static getPoll(id: number): any { return db.prepare('SELECT * FROM votes WHERE id = ?').get(id) }
  static insertPoll(p: any): number { return VotesDB.insert(p) }
  static updatePoll(id: number, p: any): void {
    const sets = Object.keys(p).map(c => `${c}=:${c}`)
    // Special handling for stringification if needed
    if (p.options && typeof p.options !== 'string') p.options = JSON.stringify(p.options)
    if (p.target_member_ids && typeof p.target_member_ids !== 'string') p.target_member_ids = JSON.stringify(p.target_member_ids)
    db.prepare(`UPDATE votes SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=:id`).run({ ...p, id })
  }
  static deletePoll(id: number): void { VotesDB.delete(id) }
  static hasMemberVoted(pollId: number, memberId: number): boolean {
    const res = db.prepare('SELECT id FROM vote_results WHERE vote_id = ? AND member_id = ?').get(pollId, memberId)
    return !!res
  }
  static insertVote(pollId: number, memberId: number, optionIndex: number): void {
    VoteResultsDB.vote(pollId, memberId, optionIndex)
  }
  static getVotesForPoll(pollId: number): any[] {
    return VoteResultsDB.getForVote(pollId)
  }

  // Backup methods
  static getDatabasePath() {
    return dbPath
  }

  static listBackups() {
    const backupDir = path.join(process.cwd(), 'data', 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
      return []
    }
    const files = fs.readdirSync(backupDir)
    return files
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f))
        return {
          name: f,
          size: stat.size,
          createdAt: stat.birthtime.toISOString()
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  static async backupDatabase() {
    const backupDir = path.join(process.cwd(), 'data', 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const backupName = `backup_${timestamp}_${Date.now()}.db`
    const backupPath = path.join(backupDir, backupName)
    
    fs.copyFileSync(dbPath, backupPath)
    return backupPath
  }
}

export function serializeActivityLog(l: any): any { return { ...l, details: typeof l.details === 'object' ? JSON.stringify(l.details) : l.details } }
export function deserializeActivityLog(l: any): any {
  if (!l) return l
  let details = l.details
  if (details && (details.startsWith('{') || details.startsWith('['))) { try { details = JSON.parse(details) } catch (e) {} }
  return { ...l, details }
}

function parseLib(it: any) { if (!it) return it; return { ...it, attachments: it.attachments ? JSON.parse(it.attachments) : [] } }

export const LibraryDB = {
  getJournal(id: number): any { return parseLib(db.prepare('SELECT * FROM library_journals WHERE id = ?').get(id)) },
  getAllJournals(s?: string): any[] { const q = s ? db.prepare('SELECT * FROM library_journals WHERE naslov LIKE :s OR napomena LIKE :s ORDER BY id DESC').all({ s: `%${s}%` }) : db.prepare('SELECT * FROM library_journals ORDER BY id DESC').all(); return q.map(parseLib) },
  insertJournal(d: any): number { const data = { ...d, attachments: JSON.stringify(d.attachments || []) }; const cols = Object.keys(data); const vals = cols.map(c => `:${c}`); return db.prepare(`INSERT INTO library_journals (${cols.join(',')}) VALUES (${vals.join(',')})`).run(data).lastInsertRowid as number },
  updateJournal(id: number, d: any): void { const data = { ...d, attachments: JSON.stringify(d.attachments || []) }; const cols = Object.keys(data); const sets = cols.map(c => `${c}=:${c}`); db.prepare(`UPDATE library_journals SET ${sets.join(',')} WHERE id=:id`).run({ ...data, id }) },
  deleteJournal(id: number): void { db.prepare('DELETE FROM library_journals WHERE id = ?').run(id) },
  getBook(id: number): any { return parseLib(db.prepare('SELECT * FROM library_books WHERE id = ?').get(id)) },
  getAllBooks(s?: string, l?: boolean): any[] { let sql = 'SELECT * FROM library_books'; const w: string[] = []; const p: any = {}; if (s) { w.push('(naslov LIKE :s OR autor LIKE :s OR napomena LIKE :s)'); p.s = `%${s}%` }; if (l) { w.push('loan_member_name IS NOT NULL AND loan_member_name != ""') }; if (w.length) sql += ' WHERE ' + w.join(' AND '); return db.prepare(sql + ' ORDER BY naslov ASC').all(p).map(parseLib) },
  insertBook(d: any): number { const data = { ...d, attachments: JSON.stringify(d.attachments || []) }; const cols = Object.keys(data); const vals = cols.map(c => `:${c}`); return db.prepare(`INSERT INTO library_books (${cols.join(',')}) VALUES (${vals.join(',')})`).run(data).lastInsertRowid as number },
  updateBook(id: number, d: any): void { const data = { ...d, attachments: JSON.stringify(d.attachments || []) }; const cols = Object.keys(data); const sets = cols.map(c => `${c}=:${c}`); db.prepare(`UPDATE library_books SET ${sets.join(',')} WHERE id=:id`).run({ ...data, id }) },
  deleteBook(id: number): void { db.prepare('DELETE FROM library_books WHERE id = ?').run(id) }
}

export const ContactsDB = { getAll(): any[] { return db.prepare('SELECT * FROM contacts ORDER BY name ASC').all() }, insert(c: any): number { const cols = Object.keys(c); const vals = cols.map(v => `:${v}`); return db.prepare(`INSERT INTO contacts (${cols.join(',')}) VALUES (${vals.join(',')})`).run(c).lastInsertRowid as number }, update(id: number, c: any): void { const cols = Object.keys(c); const sets = cols.map(v => `${v}=:${v}`); db.prepare(`UPDATE contacts SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=:id`).run({ ...c, id }) }, delete(id: number): void { db.prepare('DELETE FROM contacts WHERE id = ?').run(id) } }
export const LinksDB = { getAll(): any[] { return db.prepare('SELECT * FROM useful_links ORDER BY title ASC').all() }, insert(l: any): number { const cols = Object.keys(l); const vals = cols.map(v => `:${v}`); return db.prepare(`INSERT INTO useful_links (${cols.join(',')}) VALUES (${vals.join(',')})`).run(l).lastInsertRowid as number }, update(id: number, l: any): void { const cols = Object.keys(l); const sets = cols.map(v => `${v}=:${v}`); db.prepare(`UPDATE useful_links SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=:id`).run({ ...l, id }) }, delete(id: number): void { db.prepare('DELETE FROM useful_links WHERE id = ?').run(id) } }
export const ActivityLogDB = { getAll(): any[] { return db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 1000').all() }, insert(log: any): number { const cols = Object.keys(log); const vals = cols.map(v => `:${v}`); return db.prepare(`INSERT INTO activity_logs (${cols.join(',')}) VALUES (${vals.join(',')})`).run(log).lastInsertRowid as number } }
export const MeetingsDB = {
  getAll(): any[] { return db.prepare('SELECT * FROM meetings ORDER BY date DESC').all() },
  getById(id: number): any { return db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) },
  insert(m: any): number { const cols = Object.keys(m); const vals = cols.map(v => `:${v}`); return db.prepare(`INSERT INTO meetings (${cols.join(',')}) VALUES (${vals.join(',')})`).run(m).lastInsertRowid as number },
  update(id: number, m: any): void { const cols = Object.keys(m); const sets = cols.map(v => `${v}=:${v}`); db.prepare(`UPDATE meetings SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=:id`).run({ ...m, id }) },
  delete(id: number): void { db.prepare('DELETE FROM meetings WHERE id = ?').run(id) }
}
export const AttendanceDB = { getForMeeting(mId: number): any[] { return db.prepare('SELECT * FROM attendance WHERE meeting_id = ?').all(mId) }, set(mId: number, mbId: number, s: string): void { db.prepare('INSERT INTO attendance (meeting_id, member_id, status) VALUES (?,?,?) ON CONFLICT(meeting_id, member_id) DO UPDATE SET status=excluded.status').run(mId, mbId, s) } }
export const VaultDB = { getAll(): any[] { return db.prepare('SELECT * FROM vault ORDER BY title ASC').all() }, insert(a: any): number { const cols = Object.keys(a); const vals = cols.map(v => `:${v}`); return db.prepare(`INSERT INTO vault (${cols.join(',')}) VALUES (${vals.join(',')})`).run(a).lastInsertRowid as number }, update(id: number, a: any): void { const cols = Object.keys(a); const sets = cols.map(v => `${v}=:${v}`); db.prepare(`UPDATE vault SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=:id`).run({ ...a, id }) }, delete(id: number): void { db.prepare('DELETE FROM vault WHERE id = ?').run(id) } }
export const VotesDB = { 
  getForMeeting(mId: number): any[] { return db.prepare('SELECT * FROM votes WHERE meeting_id = ? ORDER BY created_at DESC').all(mId) }, 
  insert(v: any): number { 
    const data = { 
      ...v, 
      options: typeof v.options !== 'string' ? JSON.stringify(v.options) : v.options,
      target_member_ids: JSON.stringify(v.target_member_ids)
    };
    const cols = Object.keys(data); 
    const vals = cols.map(v => `:${v}`); 
    return db.prepare(`INSERT INTO votes (${cols.join(',')}) VALUES (${vals.join(',')})`).run(data).lastInsertRowid as number 
  }, 
  close(id: number): void { db.prepare("UPDATE votes SET status = 'archived' WHERE id = ?").run(id) }, 
  delete(id: number): void { 
    console.log(`[DB] Deleting vote_results for vote_id: ${id}`)
    db.prepare('DELETE FROM vote_results WHERE vote_id = ?').run(id)
    console.log(`[DB] Deleting vote with id: ${id}`)
    db.prepare('DELETE FROM votes WHERE id = ?').run(id) 
  } 
}
export const VoteResultsDB = { 
  getForVote(vId: number): any[] { 
    return db.prepare(`
      SELECT vr.*, m.name as member_name 
      FROM vote_results vr 
      JOIN members m ON vr.member_id = m.id 
      WHERE vr.vote_id = ?
    `).all(vId) 
  }, 
  vote(vId: number, mbId: number, oIdx: number): void { 
    db.prepare('INSERT INTO vote_results (vote_id, member_id, option_index) VALUES (?,?,?) ON CONFLICT(vote_id, member_id) DO UPDATE SET option_index=excluded.option_index').run(vId, mbId, oIdx) 
  } 
}

export const ExternalLibrariesDB = {
  getAll(): any[] { 
    return db.prepare(`
      SELECT el.*, 
             MAX(lcl.contact_date) as last_contact_date, 
             COUNT(lcl.id) as contact_count 
      FROM external_libraries el 
      LEFT JOIN library_contact_logs lcl ON el.id = lcl.library_id 
      GROUP BY el.id 
      ORDER BY el.naziv ASC
    `).all() 
  },
  getById(id: number): any { return db.prepare('SELECT * FROM external_libraries WHERE id = ?').get(id) },
  insert(l: any): number {
    const cols = Object.keys(l);
    const vals = cols.map(v => `:${v}`);
    return db.prepare(`INSERT INTO external_libraries (${cols.join(',')}) VALUES (${vals.join(',')})`).run(l).lastInsertRowid as number
  },
  update(id: number, l: any): void {
    const cols = Object.keys(l);
    const sets = cols.map(v => `${v}=:${v}`);
    db.prepare(`UPDATE external_libraries SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=:id`).run({ ...l, id })
  },
  delete(id: number): void { db.prepare('DELETE FROM external_libraries WHERE id = ?').run(id) },
  
  getContactLogs(libraryId: number): any[] {
    return db.prepare('SELECT * FROM library_contact_logs WHERE library_id = ? ORDER BY contact_date DESC').all(libraryId)
  },
  insertContactLog(log: any): number {
    const cols = Object.keys(log);
    const vals = cols.map(v => `:${v}`);
    return db.prepare(`INSERT INTO library_contact_logs (${cols.join(',')}) VALUES (${vals.join(',')})`).run(log).lastInsertRowid as number
  },
  deleteContactLog(id: number): void {
    db.prepare('DELETE FROM library_contact_logs WHERE id = ?').run(id)
  }
}
