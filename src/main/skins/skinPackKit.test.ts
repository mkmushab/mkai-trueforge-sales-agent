import { describe, expect, test } from 'vitest';

import { SkinWorkflowKind } from '../../shared/skin/constants';
import {
  SkinPackKitBundle,
  SkinPackKitId,
  SkinPackKitMetadata,
  SkinPackSkillId,
} from '../../shared/skin/kit';
import {
  buildInstalledSkinPackKitRecord,
  buildSkinPackMarketplaceKit,
} from './skinPackKit';

describe('AI Skin Designer built-in kit', () => {
  test('publishes only the bundled skin creator skill', () => {
    const kit = buildSkinPackMarketplaceKit() as {
      id: string;
      name: { en: string; zh: string };
      description: { en: string; zh: string };
      icon: string;
      version: string;
      workflowKind: string;
      tryAsking: Array<{ en: string; zh: string }>;
      skills: {
        bundle: string;
        list: Array<{
          id: string;
          name: { en: string; zh: string };
        }>;
      };
      mcpServers: unknown[];
      connectors: unknown[];
    };

    expect(kit).toMatchObject({
      id: SkinPackKitId.BuiltIn,
      name: {
        en: 'Customize LobsterAI',
        zh: 'LobsterAI  ',
      },
      description: {
        zh: '  LobsterAI  AI  ',
      },
      icon: SkinPackKitMetadata.IconUrl,
      version: SkinPackKitMetadata.Version,
      workflowKind: SkinWorkflowKind.SkinPack,
      skills: {
        bundle: SkinPackKitBundle.BuiltIn,
        list: [{
          id: SkinPackSkillId.BuiltIn,
          name: {
            en: 'AI Appearance Designer',
            zh: 'AI  ',
          },
        }],
      },
      mcpServers: [],
      connectors: [],
    });
    expect(kit.version).toBe('0.3.0');
    expect(kit.tryAsking).toHaveLength(7);
    expect(kit.tryAsking.map(prompt => prompt.zh)).toEqual([
      '  LobsterAI   { }   { }   AI   { }  { }  LobsterAI ',
      '  LobsterAI   10  ',
      '  LobsterAI  ',
      ' ',
      '  LobsterAI  ',
      '  LobsterAI  ',
      ' ',
    ]);
    expect(kit.tryAsking[0].en.match(/\{[^}]+\}/g)).toHaveLength(4);
    expect(kit.tryAsking[0].zh.match(/\{[^}]+\}/g)).toHaveLength(4);
    expect(kit.tryAsking[0].zh).not.toContain(' ');
    expect(kit.skills.list).toHaveLength(1);
  });

  test('persists the trusted workflow marker with the fixed skill id', () => {
    const record = buildInstalledSkinPackKitRecord();

    expect(record).toMatchObject({
      id: SkinPackKitId.BuiltIn,
      version: SkinPackKitMetadata.Version,
      workflowKind: SkinWorkflowKind.SkinPack,
      skills: {
        skillIds: [SkinPackSkillId.BuiltIn],
      },
      mcpServers: [],
      connectors: [],
    });
  });
});
