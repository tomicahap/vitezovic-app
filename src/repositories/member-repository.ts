import { db } from '../db/client';
import { members } from '../db/schema';
import { eq, asc, sql } from 'drizzle-orm';

export class MemberRepository {
  async findAll() {
    return await db.select().from(members).orderBy(asc(members.name));
  }

  async findById(id: number) {
    return await db.select().from(members).where(eq(members.id, id)).get();
  }
  
  async findByEmail(email: string) {
    if (!email) return null;
    return await db.select()
      .from(members)
      .where(eq(sql`lower(${members.email})`, email.toLowerCase()))
      .get();
  }

  async insert(data: any) {
    const result = await db.insert(members).values(data).returning({ id: members.id });
    return result[0]?.id;
  }

  async update(id: number, data: any) {
    return await db.update(members).set(data).where(eq(members.id, id));
  }

  async delete(id: number) {
    return await db.delete(members).where(eq(members.id, id));
  }
}
