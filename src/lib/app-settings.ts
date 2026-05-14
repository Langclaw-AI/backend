export const APP_SETTINGS_CHANGED_EVENT = "langclaw:settings-changed";

export type AppSettings = {
  showAgentTrace: boolean;
  showProofPanel: boolean;
  showSourceCards: boolean;
  compactAnswers: boolean;
};

export const defaultAppSettings: AppSettings = {
  showAgentTrace: true,
  showProofPanel: true,
  showSourceCards: true,
  compactAnswers: false,
};

let currentSettings: AppSettings = { ...defaultAppSettings };

export function readAppSettings() {
  return { ...currentSettings };
}

export function writeAppSettings(nextSettings: AppSettings) {
  currentSettings = { ...nextSettings };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(APP_SETTINGS_CHANGED_EVENT));
  }
}

export function updateAppSettings(patch: Partial<AppSettings>) {
  writeAppSettings({
    ...currentSettings,
    ...patch,
  });
}

export function resetAppSettings() {
  writeAppSettings(defaultAppSettings);
}
