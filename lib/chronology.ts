/**
 * LJETOPIS DRUŠTVA - Sustav za automatsko generiranje detaljne kronologije rada društva.
 * Analizira entitete poput članova, projekata, sjednica i uplate te ih slaže u kronološki niz s bogatim detaljima.
 */

export interface ChronologyEvent {
  date: Date;
  type: 'Member' | 'Project' | 'Meeting' | 'Payment' | 'Lecture' | 'Library' | 'Other';
  description: string;
  originalEntity: any;
}

/**
 * Pomoćna funkcija za normalizaciju različitih formata datuma u JS Date objekt.
 */
export function normalizeDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  
  const dateStr = String(dateVal).trim();
  
  // Format DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}\.?$/.test(dateStr)) {
    const parts = dateStr.split('.');
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
  }
  
  // Format Month Year (npr. "12 Oct 2018")
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return null;
}

/**
 * Pomoćna funkcija za micanje HTML tagova iz teksta.
 */
function stripHtml(html?: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
}

/**
 * Glavna funkcija za generiranje kronologije.
 */
export function generateChronology(data: {
  members?: any[];
  projects?: any[];
  meetings?: any[];
  lectures?: any[];
  books?: any[];
  payments?: { memberName: string; amount: number; date: string }[];
}): string {
  const events: ChronologyEvent[] = [];
  const memberMap = new Map((data.members || []).map(m => [m.id, m.name]));

  // 1. Obrada Članova
  if (data.members) {
    data.members.forEach(m => {
      const date = normalizeDate(m.joinDate);
      if (date) {
        events.push({
          date,
          type: 'Member',
          description: `Gospodin/Gospođa ${m.name} pristupa društvu kao novi član.`,
          originalEntity: m
        });
      }
    });
  }

  // 2. Obrada Projekata
  if (data.projects) {
    data.projects.forEach(p => {
      const date = normalizeDate(p.start_date || p.created_at);
      if (date) {
        let desc = `Pokrenut je novi projekt: "${p.title}".`;
        if (p.description) desc += `\n    Cilj: ${p.description}`;
        if (p.lead_member_name) desc += `\n    Voditelj: ${p.lead_member_name}`;
        desc += `\n    Trenutni napredak: ${p.progress}% [Status: ${p.status === 'active' ? 'Aktivan' : 'Dovršen'}]`;
        
        events.push({
          date,
          type: 'Project',
          description: desc,
          originalEntity: p
        });
      }
    });
  }

  // 3. Obrada Sjednica (DETALJNO)
  if (data.meetings) {
    data.meetings.forEach(m => {
      const date = normalizeDate(m.date);
      if (date) {
        let desc = `Održana je sjednica: "${m.title}" (${m.type}).`;
        if (m.location) desc += `\n    Lokacija: ${m.location}`;
        
        // Dnevni red
        let agendaArr: any[] = [];
        if (m.agenda) {
          try {
            agendaArr = typeof m.agenda === 'string' ? JSON.parse(m.agenda) : m.agenda;
          } catch (e) {
            console.warn("Failed to parse agenda for meeting", m.id);
          }
        }

        if (Array.isArray(agendaArr) && agendaArr.length > 0) {
          desc += `\n    Dnevni red:\n      - ` + agendaArr.map((a: any) => a.text || a).join('\n      - ');
        }
        
        // Zapisnik (ukratko)
        if (m.minutes) {
          const cleanMinutes = stripHtml(m.minutes);
          const snippet = cleanMinutes.length > 200 ? cleanMinutes.substring(0, 200) + "..." : cleanMinutes;
          desc += `\n    Sažetak rasprave: ${snippet}`;
        }
        
        // Prisutni
        let attendeeIds: number[] = [];
        if (m.attendee_ids) {
          try {
            attendeeIds = typeof m.attendee_ids === 'string' ? JSON.parse(m.attendee_ids) : m.attendee_ids;
          } catch (e) {
            console.warn("Failed to parse attendee_ids for meeting", m.id);
          }
        }

        if (Array.isArray(attendeeIds) && attendeeIds.length > 0) {
          const names = attendeeIds.map((id: number) => memberMap.get(id) || "Nepoznati član").join(', ');
          desc += `\n    Prisutni: ${names}`;
        }

        events.push({
          date,
          type: 'Meeting',
          description: desc,
          originalEntity: m
        });
      }
    });
  }

  // 4. Obrada Predavanja (DETALJNO)
  if (data.lectures) {
    data.lectures.forEach(l => {
      const date = normalizeDate(l.date);
      if (date) {
        let desc = `Održano je predavanje: "${l.title}".`;
        if (l.location) desc += `\n    Lokacija: ${l.location}`;
        if (l.host) desc += `\n    Domaćin/Predavač: ${l.host}`;
        if (l.description) desc += `\n    Opis: ${l.description}`;
        
        // Prisutni
        let lectureAttendees: number[] = [];
        if (l.attendee_ids) {
          try {
            lectureAttendees = typeof l.attendee_ids === 'string' ? JSON.parse(l.attendee_ids) : l.attendee_ids;
          } catch (e) {
            console.warn("Failed to parse attendee_ids for lecture", l.id);
          }
        }

        if (Array.isArray(lectureAttendees) && lectureAttendees.length > 0) {
          const names = lectureAttendees.map((id: number) => memberMap.get(id) || "Nepoznati član").join(', ');
          desc += `\n    Prisustvovalo članova: ${names}`;
        }

        events.push({
          date,
          type: 'Lecture',
          description: desc,
          originalEntity: l
        });
      }
    });
  }

  // 5. Obrada Knjižnice (Nove knjige)
  if (data.books) {
    data.books.forEach(b => {
      // Pretpostavljamo da knjige bez 'addedDate' koristimo 'createdAt' ako postoji, 
      // ili ih stavljamo pod godinu izdanja kao "prijem u arhiv"
      const date = normalizeDate(b.godina + "-01-01"); // Minimalni info
      if (date) {
        events.push({
          date,
          type: 'Library',
          description: `U knjižnicu je zaprimljeno novo djelo: "${b.naslov}" (Autor: ${b.autor || 'N/A'}). Izdavač: ${b.izdavac || 'N/A'}.`,
          originalEntity: b
        });
      }
    });
  }

  // 6. Obrada uplate članarina
  if (data.payments) {
    data.payments.forEach(p => {
      const date = normalizeDate(p.date);
      if (date) {
        events.push({
          date,
          type: 'Payment',
          description: `Zabilježena uplata članarine od strane: ${p.memberName} (${p.amount} €).`,
          originalEntity: p
        });
      }
    });
  }

  // Sortiranje
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (events.length === 0) return "Još nema zabilježenih događaja u ljetopisu.";

  let output = "LJETOPIS RADA DRUŠTVA - DETALJNI IZVJEŠTAJ\n";
  output += "================================================\n\n";

  let currentYear = -1;

  events.forEach(e => {
    const year = e.date.getFullYear();
    if (year !== currentYear) {
      currentYear = year;
      output += `\n\n>>> GODINA ${year}. <<<\n` + "-".repeat(20) + "\n";
    }

    const day = String(e.date.getDate()).padStart(2, '0');
    const month = String(e.date.getMonth() + 1).padStart(2, '0');
    const dateStr = `${day}.${month}.`;

    output += `\n[${dateStr}] ${e.description}\n`;
  });

  return output;
}
