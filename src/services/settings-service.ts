import { SettingsRepository } from '../repositories/settings-repository';

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
      projectContributorTemplates: data.projectContributorTemplates ? JSON.parse(data.projectContributorTemplates) : []
    };
  }

  async updateSettings(data: any) {
    const { availableFunctions, meetingTypes, meetingLocations, projectContributorTemplates, ...rest } = data;

    const payload: any = { ...rest };
    if (availableFunctions) payload.availableFunctions = JSON.stringify(availableFunctions);
    if (meetingTypes) payload.meetingTypes = JSON.stringify(meetingTypes);
    if (meetingLocations) payload.meetingLocations = JSON.stringify(meetingLocations);
    if (projectContributorTemplates) payload.projectContributorTemplates = JSON.stringify(projectContributorTemplates);

    return await this.repo.update(payload);
  }
}
