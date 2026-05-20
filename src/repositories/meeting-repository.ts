import { db } from '../db/client';
import { meetings, meetingParticipants, members, attendance } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export class MeetingRepository {
  async findAll() {
    return await db.select().from(meetings).orderBy(desc(meetings.date));
  }

  async findById(id: number) {
    return await db.select().from(meetings).where(eq(meetings.id, id)).get();
  }

  async insert(data: any) {
    const result = await db.insert(meetings).values(data).returning({ id: meetings.id });
    return result[0]?.id;
  }

  async update(id: number, data: any) {
    return await db.update(meetings).set(data).where(eq(meetings.id, id));
  }

  async delete(id: number) {
    return await db.delete(meetings).where(eq(meetings.id, id));
  }

  // Relations
  async getParticipants(meetingId: number) {
    return await db.select({
      member: members
    })
    .from(attendance)
    .innerJoin(members, eq(attendance.memberId, members.id))
    .where(eq(attendance.meetingId, meetingId));
  }

  async getAllParticipants() {
    return await db.select({
      meetingId: attendance.meetingId,
      memberId: attendance.memberId
    })
    .from(attendance);
  }

  async clearParticipants(meetingId: number) {
    return await db.delete(attendance).where(eq(attendance.meetingId, meetingId));
  }

  async addParticipant(meetingId: number, memberId: number, status: 'present' | 'absent' | 'excused' = 'present') {
    return await db.insert(attendance).values({ meetingId, memberId, status: status as any });
  }
}
