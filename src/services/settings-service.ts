import { SettingsRepository } from '../repositories/settings-repository';
import { cleanCredential } from '../../lib/backup';

export class SettingsService {
  private repo: SettingsRepository;

  constructor() {
    this.repo = new SettingsRepository();
  }

  async getSettings() {
    const data = await this.repo.get();
    if (!data) return null;

    // Post-processing JSON fields
    return {
      ...data,
      availableFunctions: data.availableFunctions ? JSON.parse(data.availableFunctions) : [],
      meetingTypes: data.meetingTypes ? JSON.parse(data.meetingTypes) : [],
      meetingLocations: data.meetingLocations ? JSON.parse(data.meetingLocations) : [],
      smtpSecure: data.smtpSecure === 1,
      requirePaymentToBeActive: data.requirePaymentToBeActive === 1,
      maintenanceMode: data.maintenanceMode === 1,
      adminInactivityEnabled: data.adminInactivityEnabled === 1,
      adminInactivityDays: typeof data.adminInactivityDays === 'number' && data.adminInactivityDays > 0 ? data.adminInactivityDays : 30,
      lastAdminLoginAt: data.lastAdminLoginAt ?? null,
      adminInactivityAlertSentAt: data.adminInactivityAlertSentAt ?? null,
      projectContributorTemplates: data.projectContributorTemplates ? JSON.parse(data.projectContributorTemplates) : [],
      adminPersonalTodos: data.adminPersonalTodos
        ? (() => {
            try {
              return typeof data.adminPersonalTodos === 'string'
                ? JSON.parse(data.adminPersonalTodos)
                : data.adminPersonalTodos;
            } catch {
              return [];
            }
          })()
        : [],
    };
  }

  async updateSettings(data: any) {
    const { availableFunctions, meetingTypes, meetingLocations, projectContributorTemplates, adminPersonalTodos, ...rest } = data;

    const payload: any = { ...rest };
    // Never overwrite real stored asset data URLs with synthetic proxy URLs
    for (const key of ['logoUrl', 'paymentSlipUrl', 'paymentQrUrl'] as const) {
      if (typeof payload[key] === 'string' && payload[key].startsWith('/api/settings/asset?')) {
        delete payload[key];
      }
    }
    if (typeof payload.maintenanceMode === 'boolean') {
      payload.maintenanceMode = payload.maintenanceMode ? 1 : 0;
    }
    if (typeof payload.adminInactivityEnabled === 'boolean') {
      payload.adminInactivityEnabled = payload.adminInactivityEnabled ? 1 : 0;
    }
    if (typeof payload.requirePaymentToBeActive === 'boolean') {
      payload.requirePaymentToBeActive = payload.requirePaymentToBeActive ? 1 : 0;
    }
    if (availableFunctions) payload.availableFunctions = JSON.stringify(availableFunctions);
    if (meetingTypes) payload.meetingTypes = JSON.stringify(meetingTypes);
    if (meetingLocations) payload.meetingLocations = JSON.stringify(meetingLocations);
    if (projectContributorTemplates) payload.projectContributorTemplates = JSON.stringify(projectContributorTemplates);
    if (adminPersonalTodos !== undefined) {
      payload.adminPersonalTodos = typeof adminPersonalTodos === 'string' ? adminPersonalTodos : JSON.stringify(adminPersonalTodos || []);
    }

    // Sanitize Dropbox credentials if present
    if (payload.dropboxAppKey !== undefined) {
      payload.dropboxAppKey = cleanCredential(payload.dropboxAppKey) || null;
    }
    if (payload.dropboxAppSecret !== undefined) {
      payload.dropboxAppSecret = cleanCredential(payload.dropboxAppSecret) || null;
    }
    if (payload.dropboxRefreshToken !== undefined) {
      payload.dropboxRefreshToken = cleanCredential(payload.dropboxRefreshToken) || null;
    }
    if (payload.dropboxFolderPath !== undefined) {
      payload.dropboxFolderPath = payload.dropboxFolderPath?.trim() || null;
    }

    return await this.repo.update(payload);
  }
}
