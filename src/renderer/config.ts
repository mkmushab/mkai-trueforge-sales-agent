import { type ProviderConfig, ProviderRegistry } from '@shared/providers';

import {
  type BrowserWebAccessConfig,
  defaultBrowserWebAccessConfig,
} from '../shared/browserWebAccess/constants';
import {
  defaultNotificationSettings,
  type NotificationSettings,
} from '../shared/notifications/constants';

export const ShortcutAction = {
  NewChat: 'newChat',
  Search: 'search',
  Settings: 'settings',
  SendMessage: 'sendMessage',
  ShowShortcuts: 'showShortcuts',
  FocusPrompt: 'focusPrompt',
  StopCurrentTask: 'stopCurrentTask',
  ToggleSidebar: 'toggleSidebar',
  ToggleArtifacts: 'toggleArtifacts',
  PreviousAgent: 'previousAgent',
  NextAgent: 'nextAgent',
  ShowCurrentAgentTasks: 'showCurrentAgentTasks',
  CollapseCurrentAgentTasks: 'collapseCurrentAgentTasks',
  OpenAgentTask1: 'openAgentTask1',
  OpenAgentTask2: 'openAgentTask2',
  OpenAgentTask3: 'openAgentTask3',
  OpenAgentTask4: 'openAgentTask4',
  OpenAgentTask5: 'openAgentTask5',
  OpenAgentTask6: 'openAgentTask6',
  OpenAgentTask7: 'openAgentTask7',
  OpenAgentTask8: 'openAgentTask8',
  OpenAgentTask9: 'openAgentTask9',
  OpenCowork: 'openCowork',
  OpenScheduledTasks: 'openScheduledTasks',
  OpenKits: 'openKits',
  OpenSkills: 'openSkills',
  OpenMcp: 'openMcp',
  OpenSettingsGeneral: 'openSettingsGeneral',
  OpenSettingsAppearance: 'openSettingsAppearance',
  OpenSettingsAgentEngine: 'openSettingsAgentEngine',
  OpenSettingsModel: 'openSettingsModel',
  OpenSettingsIm: 'openSettingsIm',
  OpenSettingsBrowser: 'openSettingsBrowser',
  OpenSettingsEmail: 'openSettingsEmail',
  OpenSettingsMemory: 'openSettingsMemory',
  OpenSettingsDreaming: 'openSettingsDreaming',
  OpenSettingsPlugins: 'openSettingsPlugins',
  OpenSettingsShortcuts: 'openSettingsShortcuts',
  OpenSettingsAbout: 'openSettingsAbout',
} as const;

export type ShortcutAction = typeof ShortcutAction[keyof typeof ShortcutAction];

export type ShortcutConfig = Record<ShortcutAction, string> & {
  [key: string]: string | undefined;
};

export const FontPreferences = {
  UiFontSizeDefault: 15,
  UiFontSizeMin: 11,
  UiFontSizeMax: 16,
  CodeFontSizeDefault: 14,
  CodeFontSizeMin: 8,
  CodeFontSizeMax: 24,
} as const;

// Bump to force-reset every stored uiFontSize / codeFontSize to the current
// default one more time. hydrateStoredConfig persists the applied versions, so
// each version resets at most once and later user choices survive upgrades.
export const UI_FONT_SIZE_MIGRATION_VERSION = 1;
export const CODE_FONT_SIZE_MIGRATION_VERSION = 1;

export const normalizeFontPreference = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numericValue)));
};

export const resolveArtifactAutoPreviewEnabled = (value: unknown): boolean => value !== false;

//  
export interface AppConfig {
  // API  
  api: {
    key: string;
    baseUrl: string;
  };
  //  
  model: {
    availableModels: Array<{
      id: string;
      name: string;
      supportsImage?: boolean;
      supportsVideo?: boolean;
      supportsThinking?: boolean;
      contextWindow?: number;
      maxTokens?: number;
    }>;
    defaultModel: string;
    defaultModelProvider?: string;
  };
  providers?: Record<string, ProviderConfig>;
  providerModelMigrationVersions?: Record<string, number>;
  //  
  theme: 'light' | 'dark' | 'system';
  // Optional for configs created before exact default theme persistence was introduced.
  themeId?: string;
  // UI  
  uiFontSize?: number;
  //   UI  (  UI_FONT_SIZE_MIGRATION_VERSION)
  uiFontSizeMigrationVersion?: number;
  //  
  codeFontSize?: number;
  //  (  CODE_FONT_SIZE_MIGRATION_VERSION)
  codeFontSizeMigrationVersion?: number;
  //  
  language: 'zh' | 'en';
  //  
  useSystemProxy: boolean;
  //   Artifact  
  artifactAutoPreviewEnabled?: boolean;
  //   SQLite  
  sqliteAutoBackupEnabled?: boolean;
  //  
  usageAnalyticsEnabled?: boolean;
  //  
  notificationSettings?: NotificationSettings;
  //  
  browserWebAccess: BrowserWebAccessConfig;
  //   ( )
  language_initialized?: boolean;
  //  
  app: {
    port: number;
    isDevelopment: boolean;
    testMode?: boolean;
  };
  //  
  shortcuts?: ShortcutConfig;
}

const buildDefaultProviders = (): AppConfig['providers'] => {
  const providers: Record<string, ProviderConfig> = {};

  for (const id of ProviderRegistry.providerIds) {
    const def = ProviderRegistry.get(id)!;
    providers[id] = {
      enabled: false,
      apiKey: '',
      baseUrl: def.defaultBaseUrl,
      apiFormat: def.defaultApiFormat,
      ...(def.codingPlanSupported ? { codingPlanEnabled: false } : {}),
      models: def.defaultModels.map(m => ({ ...m })),
    };
  }

  providers['custom_0'] = {
    displayName: 'MK Main Engine (GPT-OSS-120B)',
    enabled: true,
    apiKey: '',
    baseUrl: 'https://api.generalcompute.com/v1',
    apiFormat: 'openai',
    models: [
      {
        id: 'gpt-oss-120b',
        name: 'MK Main · GPT-OSS-120B',
        supportsImage: true,
        supportsThinking: true,
        supportsToolCalling: true,
        contextWindow: 128000,
      },
    ],
  };
  providers['custom_1'] = {
    displayName: 'MK Heavy Engine (DeepSeek V3.2)',
    enabled: true,
    apiKey: '',
    baseUrl: 'https://api.generalcompute.com/v1',
    apiFormat: 'openai',
    models: [
      {
        id: 'deepseek-v3.2',
        name: 'MK Heavy · DeepSeek V3.2',
        supportsImage: false,
        supportsThinking: true,
        supportsToolCalling: true,
        contextWindow: 128000,
      },
    ],
  };
  providers['custom_2'] = {
    displayName: 'MK Fast Engine (Gemma 4 31B)',
    enabled: true,
    apiKey: '',
    baseUrl: 'https://api.generalcompute.com/v1',
    apiFormat: 'openai',
    models: [
      {
        id: 'gemma-4-31B-it',
        name: 'MK Fast · Gemma 4 31B',
        supportsImage: true,
        supportsThinking: false,
        supportsToolCalling: true,
        contextWindow: 128000,
      },
    ],
  };

  return providers;
};

//  
export const defaultConfig: AppConfig = {
  api: {
    key: '',
    baseUrl: 'https://api.generalcompute.com/v1',
  },
  model: {
    availableModels: [
      { id: 'gpt-oss-120b', name: 'MK Main · GPT-OSS-120B', supportsImage: true, supportsThinking: true, contextWindow: 128000 },
      { id: 'deepseek-v3.2', name: 'MK Heavy · DeepSeek V3.2', supportsImage: false, supportsThinking: true, contextWindow: 128000 },
      { id: 'gemma-4-31B-it', name: 'MK Fast · Gemma 4 31B', supportsImage: true, supportsThinking: false, contextWindow: 128000 },
    ],
    defaultModel: 'gpt-oss-120b',
    defaultModelProvider: 'custom_0',
  },
  providers: buildDefaultProviders(),
  theme: 'dark',
  uiFontSize: FontPreferences.UiFontSizeDefault,
  uiFontSizeMigrationVersion: UI_FONT_SIZE_MIGRATION_VERSION,
  codeFontSize: FontPreferences.CodeFontSizeDefault,
  codeFontSizeMigrationVersion: CODE_FONT_SIZE_MIGRATION_VERSION,
  language: 'en',
  language_initialized: true,
  useSystemProxy: false,
  artifactAutoPreviewEnabled: true,
  sqliteAutoBackupEnabled: false,
  usageAnalyticsEnabled: true,
  notificationSettings: defaultNotificationSettings,
  browserWebAccess: defaultBrowserWebAccessConfig,
  app: {
    port: 3000,
    isDevelopment: process.env.NODE_ENV === 'development',
    // Default to production (official) services. Source-launched dev builds run
    // with NODE_ENV=development, but must not auto-target the internal-only test
    // endpoints (*.inner.mkai.tech) — external/open-source users can't reach
    // them. Flip test mode via the hidden switch in Settings → About when the
    // internal endpoints are actually needed.
    testMode: false,
  },
  shortcuts: {
    [ShortcutAction.NewChat]: 'CommandOrControl+N',
    [ShortcutAction.Search]: 'CommandOrControl+F',
    [ShortcutAction.Settings]: 'CommandOrControl+,',
    [ShortcutAction.SendMessage]: 'Enter',
    [ShortcutAction.ShowShortcuts]: 'CommandOrControl+/',
    [ShortcutAction.FocusPrompt]: 'CommandOrControl+K',
    [ShortcutAction.StopCurrentTask]: 'CommandOrControl+.',
    [ShortcutAction.ToggleSidebar]: 'CommandOrControl+B',
    [ShortcutAction.ToggleArtifacts]: 'CommandOrControl+Shift+B',
    [ShortcutAction.PreviousAgent]: '',
    [ShortcutAction.NextAgent]: '',
    [ShortcutAction.ShowCurrentAgentTasks]: '',
    [ShortcutAction.CollapseCurrentAgentTasks]: '',
    [ShortcutAction.OpenAgentTask1]: '',
    [ShortcutAction.OpenAgentTask2]: '',
    [ShortcutAction.OpenAgentTask3]: '',
    [ShortcutAction.OpenAgentTask4]: '',
    [ShortcutAction.OpenAgentTask5]: '',
    [ShortcutAction.OpenAgentTask6]: '',
    [ShortcutAction.OpenAgentTask7]: '',
    [ShortcutAction.OpenAgentTask8]: '',
    [ShortcutAction.OpenAgentTask9]: '',
    [ShortcutAction.OpenCowork]: 'CommandOrControl+1',
    [ShortcutAction.OpenScheduledTasks]: 'CommandOrControl+2',
    [ShortcutAction.OpenKits]: 'CommandOrControl+3',
    [ShortcutAction.OpenSkills]: 'CommandOrControl+4',
    [ShortcutAction.OpenMcp]: 'CommandOrControl+5',
    [ShortcutAction.OpenSettingsGeneral]: '',
    [ShortcutAction.OpenSettingsAppearance]: '',
    [ShortcutAction.OpenSettingsAgentEngine]: '',
    [ShortcutAction.OpenSettingsModel]: '',
    [ShortcutAction.OpenSettingsIm]: '',
    [ShortcutAction.OpenSettingsBrowser]: '',
    [ShortcutAction.OpenSettingsEmail]: '',
    [ShortcutAction.OpenSettingsMemory]: '',
    [ShortcutAction.OpenSettingsDreaming]: '',
    [ShortcutAction.OpenSettingsPlugins]: '',
    [ShortcutAction.OpenSettingsShortcuts]: '',
    [ShortcutAction.OpenSettingsAbout]: '',
  }
};

//  
export const CONFIG_KEYS = {
  APP_CONFIG: 'app_config',
  AUTH: 'auth_state',
  CONVERSATIONS: 'conversations',
  PROVIDERS_EXPORT_KEY: 'providers_export_key',
  SKILLS: 'skills',
};

//  
export const EN_PRIORITY_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
// Provider lists derived from ProviderRegistry — single source of truth
export const CHINA_PROVIDERS = [...ProviderRegistry.idsByRegion('china')] as const;
export const GLOBAL_PROVIDERS = ProviderRegistry.idsByRegion('global');

export const getVisibleProviders = (language: 'zh' | 'en'): readonly string[] => {
  if (language === 'zh') {
    return [...CHINA_PROVIDERS];
  }
  return ProviderRegistry.idsForEnLocale();
};

/**
 *   provider key  custom_0, custom_1, ... 
 */
export const isCustomProvider = (key: string): boolean => key.startsWith('custom_');

/**
 *   custom_N key   custom_0 → "Custom0" 
 */
export const getCustomProviderDefaultName = (key: string): string => {
  const suffix = key.replace('custom_', '');
  return `Custom${suffix}`;
};

/**
 *   provider   provider   displayName 
 *   provider   key 
 */
export const getProviderDisplayName = (
  providerKey: string,
  providerConfig?: { displayName?: string },
): string => {
  if (isCustomProvider(providerKey)) {
    const name = providerConfig && typeof providerConfig.displayName === 'string'
      ? providerConfig.displayName
      : '';
    return name || getCustomProviderDefaultName(providerKey);
  }
  const def = ProviderRegistry.get(providerKey);
  if (def) return def.label;
  return providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
};
