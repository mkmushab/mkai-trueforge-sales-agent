import type {
  InstalledKitRecord,
  KitSkillMetadata,
} from '../../shared/kit/constants';
import {
  SkinPackKitBundle,
  SkinPackKitId,
  SkinPackKitMetadata,
  SkinPackSkillId,
} from '../../shared/skin/kit';

const SKIN_CREATOR_SKILL_METADATA: KitSkillMetadata = {
  id: SkinPackSkillId.BuiltIn,
  name: {
    en: 'MK AI Brand & Workspace Studio',
    zh: 'MK AI Brand & Workspace Studio',
  },
  description: {
    en: 'Customizes MK AI workspace themes, executive brand palettes, emblems, and dark/light studio layouts.',
    zh: 'Customizes MK AI workspace themes, executive brand palettes, emblems, and dark/light studio layouts.',
  },
};

const SKIN_PACK_STARTER_PROMPT = {
  en: 'Design an executive MK AI workspace theme using {primary and accent colors} tailored for {industry or team workflow}.',
  zh: 'Design an executive MK AI workspace theme using {primary and accent colors} tailored for {industry or team workflow}.',
};

export function buildSkinPackMarketplaceKit(): Record<string, unknown> {
  return {
    id: SkinPackKitId.BuiltIn,
    name: {
      en: 'MK AI Brand & Workspace Studio',
      zh: 'MK AI Brand & Workspace Studio',
    },
    description: {
      en: 'Customize your MK AI workspace with executive brand colors, dark command-center themes, and custom emblems.',
      zh: 'Customize your MK AI workspace with executive brand colors, dark command-center themes, and custom emblems.',
    },
    icon: SkinPackKitMetadata.IconUrl,
    author: 'MK AI',
    version: SkinPackKitMetadata.Version,
    workflowKind: SkinPackKitMetadata.WorkflowKind,
    tryAsking: [
      SKIN_PACK_STARTER_PROMPT,
      {
        en: 'Switch MK AI into a deep-blue Enterprise Command Center theme for coding, market intelligence, and 30-agent orchestration',
        zh: 'Switch MK AI into a deep-blue Enterprise Command Center theme for coding, market intelligence, and 30-agent orchestration',
      },
    ],
    skills: {
      bundle: SkinPackKitBundle.BuiltIn,
      list: [SKIN_CREATOR_SKILL_METADATA],
    },
    mcpServers: [],
    connectors: [],
  };
}

export function buildInstalledSkinPackKitRecord(): InstalledKitRecord {
  return {
    id: SkinPackKitId.BuiltIn,
    version: SkinPackKitMetadata.Version,
    installedAt: Date.now(),
    workflowKind: SkinPackKitMetadata.WorkflowKind,
    skills: {
      skillIds: [SkinPackSkillId.BuiltIn],
      metadata: {
        [SkinPackSkillId.BuiltIn]: SKIN_CREATOR_SKILL_METADATA,
      },
    },
    mcpServers: [],
    connectors: [],
  };
}
