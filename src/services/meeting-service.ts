import { MeetingRepository } from '../repositories/meeting-repository';

export class MeetingService {
  private repo: MeetingRepository;

  constructor() {
    this.repo = new MeetingRepository();
  }

  private serializeMeeting(m: any) {
    if (!m) return m;
    
    // UI Label -> DB Key
    const typeMap: Record<string, string> = {
      'Opća sjednica': 'general',
      'Sjednica uprave': 'board',
      'Posebni odbor': 'committee',
      'Radionica': 'workshop',
      'Izvanredna sjednica': 'emergency'
    };

    const res: any = {
      title: m.title,
      type: typeMap[m.type] || m.type || 'general',
      date: m.date,
      startTime: m.start_time !== undefined ? m.start_time : m.startTime,
      endTime: m.end_time !== undefined ? m.end_time : m.endTime,
      location: m.location,
      minutes: m.minutes,
      status: m.status || 'scheduled',
      nextMeetingDate: m.next_meeting_date !== undefined ? m.next_meeting_date : m.nextMeetingDate,
      nextMeetingTime: m.next_meeting_time !== undefined ? m.next_meeting_time : m.nextMeetingTime,
      nextMeetingLocation: m.next_meeting_location !== undefined ? m.next_meeting_location : m.nextMeetingLocation,
      chairperson: m.chairperson,
      minuteTaker: m.minute_taker !== undefined ? m.minute_taker : m.minuteTaker,
      youtubeUrl: m.youtube_url !== undefined ? m.youtube_url : m.youtubeUrl,
      createdBy: m.created_by !== undefined ? m.created_by : m.createdBy,
    };

    if (m.notification_sent_at !== undefined || m.notificationSentAt !== undefined) {
      res.notificationSentAt = m.notification_sent_at !== undefined ? m.notification_sent_at : m.notificationSentAt;
    }
    if (m.notification_recipients !== undefined || m.notificationRecipients !== undefined) {
      const nr = m.notification_recipients !== undefined ? m.notification_recipients : m.notificationRecipients;
      res.notificationRecipients = typeof nr === 'string' ? nr : JSON.stringify(nr || []);
    }

    // Ensure JSON fields are strings
    res.agenda = typeof m.agenda === 'string' ? m.agenda : JSON.stringify(m.agenda || []);
    res.attachments = typeof m.attachments === 'string' ? m.attachments : JSON.stringify(m.attachments || []);
    res.nextMeetingAgenda = typeof m.next_meeting_agenda === 'string' ? m.next_meeting_agenda : JSON.stringify(m.next_meeting_agenda || []);

    return res;
  }

  private parseMeeting(m: any) {
    if (!m) return m;

    // DB Key -> UI Label
    const reverseTypeMap: Record<string, string> = {
      'general': 'Opća sjednica',
      'board': 'Sjednica uprave',
      'committee': 'Posebni odbor',
      'workshop': 'Radionica',
      'emergency': 'Izvanredna sjednica',
      'extraordinary': 'Izvanredna sjednica'
    };

    let agenda = [];
    let nextMeetingAgenda = [];
    let attachments = [];

    try { agenda = typeof m.agenda === 'string' ? JSON.parse(m.agenda || '[]') : (m.agenda || []); } catch (e) {}
    try { nextMeetingAgenda = typeof m.nextMeetingAgenda === 'string' ? JSON.parse(m.nextMeetingAgenda || '[]') : (m.nextMeetingAgenda || []); } catch (e) {}
    try { attachments = typeof m.attachments === 'string' ? JSON.parse(m.attachments || '[]') : (m.attachments || []); } catch (e) {}

    return {
      ...m,
      type: reverseTypeMap[m.type] || m.type,
      start_time: m.startTime || m.start_time,
      end_time: m.endTime || m.end_time,
      next_meeting_date: m.nextMeetingDate || m.next_meeting_date,
      next_meeting_time: m.nextMeetingTime || m.next_meeting_time,
      next_meeting_location: m.nextMeetingLocation || m.next_meeting_location,
      chairperson: m.chairperson,
      minute_taker: m.minuteTaker || m.minute_taker,
      created_by: m.createdBy || m.created_by,
      youtube_url: m.youtubeUrl || m.youtube_url,
      notification_sent_at: m.notificationSentAt || m.notification_sent_at || null,
      notification_recipients: m.notificationRecipients || m.notification_recipients || null,
      agenda,
      next_meeting_agenda: nextMeetingAgenda,
      attachments,
      attendee_ids: m.attendee_ids || []
    };
  }

  async getAllMeetings() {
    const rows = await this.repo.findAll();
    const participants = await this.repo.getAllParticipants();
    
    return rows.map(r => {
      const fromAttendance = participants
        .filter(p => p.meetingId === r.id)
        .map(p => p.memberId);

      let fromColumn: number[] = [];
      if ((r as any).attendeeIds) {
        try {
          const parsed = JSON.parse((r as any).attendeeIds);
          if (Array.isArray(parsed)) fromColumn = parsed.map(Number).filter(Boolean);
        } catch {}
      }

      const mergedAttendees = Array.from(new Set([...fromAttendance, ...fromColumn]));
      
      return this.parseMeeting({
        ...r,
        attendee_ids: mergedAttendees
      });
    });
  }

  async getMeeting(id: number) {
    const meeting = await this.repo.findById(id);
    if (!meeting) return null;
    
    const participants = await this.repo.getParticipants(id);
    const fromAttendance = participants.map(p => p.member.id);
    let fromColumn: number[] = [];
    if ((meeting as any).attendeeIds) {
      try {
        const parsed = JSON.parse((meeting as any).attendeeIds);
        if (Array.isArray(parsed)) fromColumn = parsed.map(Number).filter(Boolean);
      } catch {}
    }
    const mergedAttendees = Array.from(new Set([...fromAttendance, ...fromColumn]));

    return this.parseMeeting({
      ...meeting,
      participants: participants.map(p => p.member),
      attendee_ids: mergedAttendees
    });
  }

  async createNewMeeting(data: any) {
    const { attendee_ids, ...meetingData } = data;
    const serialized = this.serializeMeeting(meetingData);
    if (attendee_ids && Array.isArray(attendee_ids)) {
      serialized.attendeeIds = JSON.stringify(attendee_ids);
    }
    const id = await this.repo.insert(serialized);
    
    if (id && attendee_ids && Array.isArray(attendee_ids)) {
      for (const memberId of attendee_ids) {
        await this.repo.addParticipant(id, memberId);
      }
    }
    
    return id;
  }

  async updateMeeting(id: number, data: any) {
    const { attendee_ids, ...meetingData } = data;
    const serialized = this.serializeMeeting(meetingData);
    if (attendee_ids && Array.isArray(attendee_ids)) {
      serialized.attendeeIds = JSON.stringify(attendee_ids);
    }
    await this.repo.update(id, serialized);
    
    if (attendee_ids && Array.isArray(attendee_ids)) {
      await this.repo.clearParticipants(id);
      for (const memberId of attendee_ids) {
        await this.repo.addParticipant(id, memberId);
      }
    }
    
    return true;
  }

  async deleteMeeting(id: number) {
    return await this.repo.delete(id);
  }
}
