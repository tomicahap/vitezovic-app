import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';

export class SettingsRepository {
  async get() {
    return await db.select().from(settings).where(eq(settings.id, 1)).get();
  }

  async update(data: any) {
    // Handle boolean conversions for SQLite if necessary (Drizzle usually handles this, but let's be safe)
    const preparedData = { ...data };
    if (typeof data.smtpSecure === 'boolean') {
      preparedData.smtpSecure = data.smtpSecure ? 1 : 0;
    }

    return await db.update(settings).set(preparedData).where(eq(settings.id, 1));
  }
}
