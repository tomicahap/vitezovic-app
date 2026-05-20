
const { DatabaseService } = require('./lib/database');
const { SettingsService } = require('./src/services/settings-service');

async function test() {
  try {
    const settings = await DatabaseService.getSettings();
    console.log('Settings from DatabaseService:', settings);
    
    const service = new SettingsService();
    const serviceSettings = await service.getSettings();
    console.log('Settings from SettingsService:', serviceSettings);
  } catch (e) {
    console.error('Test failed:', e);
  }
}

test();
