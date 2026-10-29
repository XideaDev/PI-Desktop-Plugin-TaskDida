export interface SoundAlertSettings {
  enabled: boolean;
  soundTheme: 'built-in' | 'custom';
  volume: number; // 0 - 100
  playOnSuccess: boolean;
  playOnError: boolean;
  playOnNotify: boolean;
  playOnSubagent: boolean;
  overrideHostBeep: boolean; // 是否接管并替换系统自带蜂鸣声
  onlyWhenBlurred: boolean;
  debounceSeconds: number;
  customSoundSuccess?: string;
  customSoundError?: string;
  customSoundNotify?: string;
}

export const DEFAULT_SETTINGS: SoundAlertSettings = {
  enabled: true,
  soundTheme: 'built-in',
  volume: 80,
  playOnSuccess: true,
  playOnError: true,
  playOnNotify: true,
  playOnSubagent: false,
  overrideHostBeep: true,
  onlyWhenBlurred: false,
  debounceSeconds: 2.0,
  customSoundSuccess: '',
  customSoundError: '',
  customSoundNotify: ''
};
