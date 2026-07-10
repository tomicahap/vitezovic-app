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
      startTime: m.start_time,
      endTime: m.end_time,
      location: m.location,
      minutes: m.minutes,
      status: m.status || 'scheduled',
      nextMeetingDate: m.next_meeting_date,
      nextMeetingTime: m.next_meeting_time,
      nextMeetingLocation: m.next_meeting_location,
      chairperson: m.chairperson,
      minuteTaker: m.minute_taker,
      youtubeUrl: m.youtube_url || m.youtubeUrl,
      createdBy: m.created_by,
    };

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
      'extraordinary': 'Izvanredna sjednica' // Handle legacy if any
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
      const meetingParticipants = participants
        .filter(p => p.meetingId === r.id)
        .map(p => p.memberId);
      
      return this.parseMeeting({
        ...r,
        attendee_ids: meetingParticipants
      });
    });
  }

  async getMeeting(id: number) {
    const meeting = await this.repo.findById(id);
    if (!meeting) return null;
    
    const participants = await this.repo.getParticipants(id);
    return this.parseMeeting({
      ...meeting,
      participants: participants.map(p => p.member),
      attendee_ids: participants.map(p => p.member.id)
    });
  }

  async createNewMeeting(data: any) {
    const { attendee_ids, ...meetingData } = data;
    const serialized = this.serializeMeeting(meetingData);
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
