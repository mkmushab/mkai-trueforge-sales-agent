import type { LocalizedText } from '../kit/constants';

export const ComputerUseKitId = {
  BuiltIn: 'computer-use',
} as const;
export type ComputerUseKitId = typeof ComputerUseKitId[keyof typeof ComputerUseKitId];

export const ComputerUseSkillId = {
  BuiltIn: 'computer-use',
} as const;
export type ComputerUseSkillId = typeof ComputerUseSkillId[keyof typeof ComputerUseSkillId];

export const ComputerUseKitBundle = {
  BuiltIn: 'https://mkai.tech/docs/computer-use',
} as const;
export type ComputerUseKitBundle =
  typeof ComputerUseKitBundle[keyof typeof ComputerUseKitBundle];

export const ComputerUseKitBundleIntegrity = {
  Sha256: '8e214e06aef9d764d13351d9739ff0049d324dedecf29fa82d8d3a39d1e9da03',
  SizeBytes: 3149,
} as const;
export type ComputerUseKitBundleIntegrity =
  typeof ComputerUseKitBundleIntegrity[keyof typeof ComputerUseKitBundleIntegrity];

export const ComputerUseKitMetadata = {
  Name: {
    en: 'Full Laptop & Desktop Autopilot (Computer Use)',
    zh: 'Full Laptop & Desktop Autopilot (Computer Use)',
  } satisfies LocalizedText,
  Description: {
    en: 'Control local Windows desktop applications, persistent Chrome profile (Port 9222), VS Code, screenshots, clicks, typing, and file system.',
    zh: 'Control local Windows desktop applications, persistent Chrome profile (Port 9222), VS Code, screenshots, clicks, typing, and file system.',
  } satisfies LocalizedText,
  SkillName: {
    en: 'Computer Use & Laptop Autopilot',
    zh: 'Computer Use & Laptop Autopilot',
  } satisfies LocalizedText,
  SkillDescription: {
    en: 'Use MK AI Computer Use tools to inspect and control Windows desktop applications and browsers.',
    zh: 'Use MK AI Computer Use tools to inspect and control Windows desktop applications and browsers.',
  } satisfies LocalizedText,
} as const;
