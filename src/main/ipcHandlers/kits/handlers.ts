import crypto from 'crypto';
import { app, BrowserWindow, ipcMain } from 'electron';
import extractZip from 'extract-zip';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

import {
  ComputerUseKitBundle,
  ComputerUseKitBundleIntegrity,
  ComputerUseKitId,
} from '../../../shared/computerUse/constants';
import type {
  InstalledKitRecord,
  KitSkillMetadata,
  KitStoreKey,
  LocalizedText,
} from '../../../shared/kit/constants';
import { KitStoreKey as KitStoreKeyValue } from '../../../shared/kit/constants';
import {
  buildComputerUseMarketplaceKit,
  buildInstalledComputerUseKitRecord,
  getInstalledKitsMap,
  isComputerUseKitSupportedPlatform,
  removeComputerUseSkillArtifacts,
} from '../../computerUse/computerUseKit';
import {
  installComputerUseRuntime,
  uninstallComputerUseRuntime,
} from '../../computerUse/computerUseRuntime';
import { cpRecursiveSync } from '../../fsCompat';
import { OpenClawConfigImpact } from '../../libs/openclawConfigImpact';
import type { SkillManager } from '../../skills/skillManager';
import { createSkinPackKitLifecycle } from '../../skins/skinPackKitLifecycle';
import type { SqliteStore } from '../../sqliteStore';

const KITS_INSTALLED_KEY: KitStoreKey = KitStoreKeyValue.Installed;
const SKILLS_DIR_NAME = 'SKILLs';
const SKILL_FILE_NAME = 'SKILL.md';

function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 60000 }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadBuffer(res.headers.location).then(resolve, reject);
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed (HTTP ${res.statusCode})`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

export interface KitHandlerDeps {
  getStore: () => SqliteStore;
  getKitStoreUrl: () => string;
  getSkillManager: () => SkillManager;
  syncOpenClawConfig: (options: {
    reason: string;
    restartGatewayIfRunning?: boolean;
    expectedImpact?: OpenClawConfigImpact;
  }) => Promise<{ success: boolean; changed: boolean; error?: string }>;
}

function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

type InstalledKitsMap = Record<string, InstalledKitRecord>;

const normalizeCapabilityList = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
);

const normalizeLocalizedText = (value: unknown): string | LocalizedText | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const en = typeof record.en === 'string' ? record.en.trim() : '';
  const zh = typeof record.zh === 'string' ? record.zh.trim() : '';
  if (!en && !zh) return undefined;
  return {
    en: en || zh,
    zh: zh || en,
  };
};

const normalizeKitSkillMetadataList = (value: unknown): Map<string, KitSkillMetadata> => {
  const metadata = new Map<string, KitSkillMetadata>();
  if (!Array.isArray(value)) return metadata;

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) continue;

    const name = normalizeLocalizedText(record.name);
    const description = normalizeLocalizedText(record.description);
    metadata.set(id, {
      id,
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
    });
  }

  return metadata;
};

function getSkillsRoot(): string {
  return path.resolve(app.getPath('userData'), SKILLS_DIR_NAME);
}

function ensureSkillsRoot(): string {
  const root = getSkillsRoot();
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

function normalizeFolderName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'skill';
}

function normalizeWindowsAttrs(targetDir: string): void {
  if (process.platform !== 'win32') return;
  const { spawnSync } = require('child_process');
  const escapedPath = targetDir.replace(/"/g, '""');
  spawnSync('cmd.exe', ['/d', '/s', '/c', `attrib -r -s -h "${escapedPath}" /s /d`], {
    stdio: 'pipe',
    windowsHide: true,
    timeout: 10000,
  });
}

function collectSkillDirs(source: string): string[] {
  const resolved = path.resolve(source);

  // Direct SKILL.md at root
  if (fs.existsSync(path.join(resolved, SKILL_FILE_NAME))) {
    return [resolved];
  }

  // Check skills/ subdirectory
  const nestedRoot = path.join(resolved, 'skills');
  if (fs.existsSync(nestedRoot) && fs.statSync(nestedRoot).isDirectory()) {
    const dirs = listSkillDirs(nestedRoot);
    if (dirs.length > 0) return dirs;
  }

  // Check SKILLs/ subdirectory
  const nestedRoot2 = path.join(resolved, SKILLS_DIR_NAME);
  if (fs.existsSync(nestedRoot2) && fs.statSync(nestedRoot2).isDirectory()) {
    const dirs = listSkillDirs(nestedRoot2);
    if (dirs.length > 0) return dirs;
  }

  // Direct children
  return listSkillDirs(resolved);
}

function listSkillDirs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .sort((a, b) => a.localeCompare(b))
    .map(entry => path.join(root, entry))
    .filter(entryPath => {
      try {
        return fs.statSync(entryPath).isDirectory()
          && fs.existsSync(path.join(entryPath, SKILL_FILE_NAME));
      } catch {
        return false;
      }
    });
}

function notifySkillsChanged(): void {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('skills:changed');
    }
  });
}

export function registerKitHandlers(deps: KitHandlerDeps): void {
  const { getStore, getKitStoreUrl, getSkillManager, syncOpenClawConfig } = deps;
  const skinPackKitLifecycle = createSkinPackKitLifecycle({
    getStore,
    getSkillManager,
    notifySkillsChanged,
    syncOpenClawConfig,
  });

  const buildMkAiPowerMarketplaceKits = (): Record<string, unknown>[] => [
    {
      id: 'mkai-stealth-web-scraper-kit',
      name: {
        en: 'Stealth Web Scraper & Crawler (Firecrawl + Browser-Use + Scrapling)',
        zh: 'Stealth Web Scraper & Crawler (Firecrawl + Browser-Use + Scrapling)',
      },
      description: {
        en: '95% AI / 5% Human invisible Chrome web agent. Crawls any website silently in the background and pops up on screen ONLY when first-time login, signup, or a hard CAPTCHA requires your click.',
        zh: '95% AI / 5% Human invisible Chrome web agent. Crawls any website silently in the background and pops up on screen ONLY when first-time login, signup, or a hard CAPTCHA requires your click.',
      },
      icon: 'https://mkai.tech/assets/web-scraper-kit.svg',
      author: 'MK AI',
      version: '5.0.0',
      tryAsking: [
        {
          en: 'Crawl all product pages and pricing from target website in invisible Chrome and export to Excel',
          zh: 'Crawl all product pages and pricing from target website in invisible Chrome and export to Excel',
        },
        {
          en: 'Open Chrome once so I can log in, then silently scrape my dashboard leads in the background',
          zh: 'Open Chrome once so I can log in, then silently scrape my dashboard leads in the background',
        },
      ],
      skills: {
        bundle: 'builtin://mkai-stealth-web-scraper-kit',
        list: [
          {
            id: 'web-search',
            name: { en: 'Stealth Web Crawler (Firecrawl + Scrapling)', zh: 'Stealth Web Crawler (Firecrawl + Scrapling)' },
            description: { en: 'Adaptive DOM & full-site markdown crawler with invisible Chrome session reuse.', zh: 'Adaptive DOM & full-site markdown crawler with invisible Chrome session reuse.' },
          },
          {
            id: 'playwright',
            name: { en: 'Browser-Use 95/5 Human-in-the-Loop Agent', zh: 'Browser-Use 95/5 Human-in-the-Loop Agent' },
            description: { en: 'Runs headless/background browser tasks and surfaces window only on Login/CAPTCHA.', zh: 'Runs headless/background browser tasks and surfaces window only on Login/CAPTCHA.' },
          },
        ],
      },
      mcpServers: [{ id: 'playwright-browser-mcp', name: 'Browser-Use & Playwright MCP', description: 'Stealth Chrome CDP Port 9222' }],
      connectors: [],
    },
    {
      id: 'mkai-three-ai-council-kit',
      name: {
        en: '3-AI Super-Bridge (ChatGPT + Claude + Gemini + JSON Prompt Compiler)',
        zh: '3-AI Super-Bridge (ChatGPT + Claude + Gemini + JSON Prompt Compiler)',
      },
      description: {
        en: 'Converts your simple Hindi/Hinglish/English request into a structured JSON Super-Prompt and dispatches it to ChatGPT (Canva/DALL-E), Claude (Artifacts/MCP), and Gemini (Workspace Skills) via your laptop.',
        zh: 'Converts your simple Hindi/Hinglish/English request into a structured JSON Super-Prompt and dispatches it to ChatGPT (Canva/DALL-E), Claude (Artifacts/MCP), and Gemini (Workspace Skills) via your laptop.',
      },
      icon: 'https://mkai.tech/assets/three-ai-bridge.svg',
      author: 'MK AI',
      version: '5.0.0',
      tryAsking: [
        {
          en: 'Compile a JSON Super-Prompt for a luxury brand banner and send it to ChatGPT Canva & Gemini Image Studio',
          zh: 'Compile a JSON Super-Prompt for a luxury brand banner and send it to ChatGPT Canva & Gemini Image Studio',
        },
        {
          en: 'Use Claude Code + Gemini + ChatGPT together to build and verify a full-stack dashboard',
          zh: 'Use Claude Code + Gemini + ChatGPT together to build and verify a full-stack dashboard',
        },
      ],
      skills: {
        bundle: 'builtin://mkai-three-ai-council-kit',
        list: [
          {
            id: 'create-plan',
            name: { en: 'JSON Super-Prompt Architect', zh: 'JSON Super-Prompt Architect' },
            description: { en: 'Compiles rough Hinglish/English ideas into zero-waste structured JSON prompts for ChatGPT, Claude, and Gemini.', zh: 'Compiles rough Hinglish/English ideas into zero-waste structured JSON prompts for ChatGPT, Claude, and Gemini.' },
          },
          {
            id: 'canvas-design',
            name: { en: 'ChatGPT Canva + Gemini + Claude Connector Bridge', zh: 'ChatGPT Canva + Gemini + Claude Connector Bridge' },
            description: { en: 'Controls external AI web sessions and local CLIs to generate banners, code, and designs.', zh: 'Controls external AI web sessions and local CLIs to generate banners, code, and designs.' },
          },
        ],
      },
      mcpServers: [],
      connectors: [],
    },
    {
      id: 'mkai-github-repo-installer-kit',
      name: {
        en: '1-Click GitHub Repository Installer & Adapter Kit',
        zh: '1-Click GitHub Repository Installer & Adapter Kit',
      },
      description: {
        en: 'Paste any GitHub repository URL (e.g. firecrawl, browser-use, Scrapling, or any custom tool) to automatically clone, wire, and expose it as a live tool for all 30 MK AI Agents.',
        zh: 'Paste any GitHub repository URL (e.g. firecrawl, browser-use, Scrapling, or any custom tool) to automatically clone, wire, and expose it as a live tool for all 30 MK AI Agents.',
      },
      icon: 'https://mkai.tech/assets/github-kit.svg',
      author: 'MK AI',
      version: '5.0.0',
      tryAsking: [
        {
          en: 'Install https://github.com/D4Vinci/Scrapling and https://github.com/browser-use/browser-use into my workspace engines',
          zh: 'Install https://github.com/D4Vinci/Scrapling and https://github.com/browser-use/browser-use into my workspace engines',
        },
      ],
      skills: {
        bundle: 'builtin://mkai-github-repo-installer-kit',
        list: [
          {
            id: 'local-tools',
            name: { en: '1-Click GitHub Repo Cloner & Skill Builder', zh: '1-Click GitHub Repo Cloner & Skill Builder' },
            description: { en: 'Clones any GitHub repo into engines/ and registers it with the 30-Agent workforce.', zh: 'Clones any GitHub repo into engines/ and registers it with the 30-Agent workforce.' },
          },
        ],
      },
      mcpServers: [],
      connectors: [],
    },
    {
      id: 'mkai-studio-pdf-ppt-reel-kit',
      name: {
        en: 'MKAI.tech PDF/PPT Maker & Website-to-Reel Video Studio Kit',
        zh: 'MKAI.tech PDF/PPT Maker & Website-to-Reel Video Studio Kit',
      },
      description: {
        en: 'Connects directly to mkai.tech PDF/PPT generators and KabirVerse 3D Video Studio to turn any website or tool into a 9:16 vertical MP4 Reel, pitch deck, or executive PDF.',
        zh: 'Connects directly to mkai.tech PDF/PPT generators and KabirVerse 3D Video Studio to turn any website or tool into a 9:16 vertical MP4 Reel, pitch deck, or executive PDF.',
      },
      icon: 'https://mkai.tech/assets/studio-kit.svg',
      author: 'MK AI',
      version: '5.0.0',
      tryAsking: [
        {
          en: 'Visit https://mkai.tech, inspect its tools, and create a 20-second 9:16 launch reel MP4 and PPTX deck',
          zh: 'Visit https://mkai.tech, inspect its tools, and create a 20-second 9:16 launch reel MP4 and PPTX deck',
        },
      ],
      skills: {
        bundle: 'builtin://mkai-studio-pdf-ppt-reel-kit',
        list: [
          {
            id: 'mkai-video-producer',
            name: { en: 'Website-to-Reel Video Producer', zh: 'Website-to-Reel Video Producer' },
            description: { en: 'Scrapes live website features, writes Hinglish/English script, and renders 9:16 MP4 reel.', zh: 'Scrapes live website features, writes Hinglish/English script, and renders 9:16 MP4 reel.' },
          },
          {
            id: 'pptx',
            name: { en: 'MKAI.tech PPTX & PDF Studio Bridge', zh: 'MKAI.tech PPTX & PDF Studio Bridge' },
            description: { en: 'Generates designer-grade presentations and PDFs via MKAI.tech and local engines.', zh: 'Generates designer-grade presentations and PDFs via MKAI.tech and local engines.' },
          },
        ],
      },
      mcpServers: [],
      connectors: [],
    },
  ];

  const getAdditionalBuiltInKits = (): Record<string, unknown>[] => [
    ...(isComputerUseKitSupportedPlatform() ? [buildComputerUseMarketplaceKit()] : []),
    ...buildMkAiPowerMarketplaceKits(),
  ];


  // Fetch kit store catalog from overmind
  ipcMain.handle('kits:fetchStore', async () => {
    const url = getKitStoreUrl();
    console.log(`[KitStore] fetching from: ${url}`);
    try {
      const https = await import('https');
      const data = await new Promise<string>((resolve, reject) => {
        const req = https.get(url, { timeout: 10000 }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => { body += chunk; });
          res.on('end', () => resolve(body));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      });
      return {
        success: true,
        data: skinPackKitLifecycle.appendToStoreResponse(data, getAdditionalBuiltInKits()),
      };
    } catch (error) {
      console.error('[KitStore] fetch failed:', error);
      return {
        success: true,
        data: skinPackKitLifecycle.buildOfflineStoreResponse(getAdditionalBuiltInKits()),
        warning: error instanceof Error ? error.message : 'Failed to fetch kit store',
      };
    }
  });

  // List installed kits
  ipcMain.handle('kits:listInstalled', () => {
    try {
      const map = getStore().get<InstalledKitsMap>(KITS_INSTALLED_KEY) ?? {};
      return { success: true, installed: map };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list installed kits' };
    }
  });

  // Install a kit
  ipcMain.handle('kits:install', async (_event, params: {
    kitId: string;
    bundleUrl: string;
    version: string;
    skillListIds: string[];
    skillList?: KitSkillMetadata[];
    mcpServers?: unknown[] | null;
    connectors?: unknown[] | null;
  }) => {
    const { kitId, bundleUrl, version, skillListIds: _skillListIds } = params;
    const isComputerUseKit = kitId === ComputerUseKitId.BuiltIn;
    console.log(`[KitStore] Installing kit "${kitId}" v${version} from ${bundleUrl}`);

    let tempRoot: string | null = null;
    let skillWatchingStopped = false;
    let skillWatchingRestarted = false;
    try {
      if (isComputerUseKit && bundleUrl !== ComputerUseKitBundle.BuiltIn) {
        throw new Error('Computer Use kit bundle URL does not match the built-in catalog entry');
      }
      if (isComputerUseKit && !isComputerUseKitSupportedPlatform()) {
        throw new Error('Computer Use kit is only available on Windows x64.');
      }
      const skinPackInstallResult = await skinPackKitLifecycle.installIfHandled({ kitId, bundleUrl });
      if (skinPackInstallResult !== undefined) {
        return skinPackInstallResult;
      }

      if (isComputerUseKit || String(bundleUrl || '').startsWith('builtin://') || String(kitId || '').startsWith('mkai-')) {
        const installedIds = Array.isArray(_skillListIds) && _skillListIds.length > 0
          ? _skillListIds
          : isComputerUseKit
            ? [ComputerUseKitId.BuiltIn]
            : ['local-tools'];
        const stateMap = getStore().get<Record<string, { enabled: boolean }>>('skills_state') ?? {};
        for (const sid of installedIds) {
          stateMap[sid] = { enabled: true };
        }
        getStore().set('skills_state', stateMap);
        const installedMap = getInstalledKitsMap(getStore());
        const sourceSkillMeta = normalizeKitSkillMetadataList(params.skillList);
        const metaObj: Record<string, KitSkillMetadata> = {};
        sourceSkillMeta.forEach((v, k) => { metaObj[k] = v; });
        installedMap[kitId] = isComputerUseKit
          ? buildInstalledComputerUseKitRecord(installedIds, metaObj)
          : {
              id: kitId,
              version: version || '5.0.0',
              installedAt: Date.now(),
              skills: { skillIds: installedIds, metadata: metaObj },
              mcpServers: normalizeCapabilityList(params.mcpServers),
              connectors: normalizeCapabilityList(params.connectors),
            };
        getStore().set(KITS_INSTALLED_KEY, installedMap);
        notifySkillsChanged();
        return { success: true, skillIds: installedIds };
      }

      // 1. Download zip
      tempRoot = fs.mkdtempSync(path.join(app.getPath('temp'), 'lobsterai-kit-'));
      const buffer = await downloadBuffer(bundleUrl);
      if (isComputerUseKit) {
        if (buffer.length !== ComputerUseKitBundleIntegrity.SizeBytes) {
          throw new Error('Computer Use kit bundle size verification failed');
        }
        if (sha256Buffer(buffer) !== ComputerUseKitBundleIntegrity.Sha256) {
          throw new Error('Computer Use kit bundle checksum verification failed');
        }
      }
      const zipPath = path.join(tempRoot, 'kit-bundle.zip');
      const extractRoot = path.join(tempRoot, 'extracted');
      fs.writeFileSync(zipPath, buffer);
      fs.mkdirSync(extractRoot, { recursive: true });

      // 2. Extract
      await extractZip(zipPath, { dir: extractRoot });

      // Handle single-directory wrapper (e.g. zip contains one root folder)
      let sourceRoot = extractRoot;
      const extractedEntries = fs.readdirSync(extractRoot)
        .map(entry => path.join(extractRoot, entry))
        .filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
      if (extractedEntries.length === 1) {
        sourceRoot = extractedEntries[0];
      }

      // 3. Discover skill directories
      const skillDirs = collectSkillDirs(sourceRoot);
      if (skillDirs.length === 0) {
        throw new Error('No skills found in kit bundle (no SKILL.md detected)');
      }

      if (isComputerUseKit) {
        const runtimeResult = await installComputerUseRuntime();
        if (!runtimeResult.success) {
          throw new Error(runtimeResult.error || 'Computer Use runtime installation failed');
        }
      }

      const skillManager = getSkillManager();
      skillManager.stopWatching();
      skillWatchingStopped = true;
      if (isComputerUseKit) {
        removeComputerUseSkillArtifacts(getStore());
      }

      // 4. Copy skills to user SKILLs directory
      const root = ensureSkillsRoot();
      const installedSkillIds: string[] = [];
      const installedSkillMetadata: Record<string, KitSkillMetadata> = {};
      const sourceSkillMetadata = normalizeKitSkillMetadataList(params.skillList);

      for (const skillDir of skillDirs) {
        const folderName = normalizeFolderName(path.basename(skillDir));
        let targetDir = path.resolve(root, folderName);
        let suffix = 1;
        while (fs.existsSync(targetDir)) {
          targetDir = path.resolve(root, `${folderName}-${suffix}`);
          suffix += 1;
        }
        cpRecursiveSync(skillDir, targetDir);
        normalizeWindowsAttrs(targetDir);
        const installedSkillId = path.basename(targetDir);
        installedSkillIds.push(installedSkillId);

        const sourceSkillId = path.basename(skillDir);
        const metadata = sourceSkillMetadata.get(sourceSkillId) ?? sourceSkillMetadata.get(folderName);
        if (metadata?.name || metadata?.description) {
          installedSkillMetadata[installedSkillId] = {
            id: installedSkillId,
            ...(metadata.name ? { name: metadata.name } : {}),
            ...(metadata.description ? { description: metadata.description } : {}),
          };
        }
      }

      // 5. Enable installed skills
      const stateMap = getStore().get<Record<string, { enabled: boolean }>>('skills_state') ?? {};
      for (const skillId of installedSkillIds) {
        stateMap[skillId] = { enabled: true };
      }
      getStore().set('skills_state', stateMap);

      // 6. Persist kit installation record
      const installedMap = getInstalledKitsMap(getStore());
      installedMap[kitId] = isComputerUseKit
        ? buildInstalledComputerUseKitRecord(installedSkillIds, installedSkillMetadata)
        : {
          id: kitId,
          version,
          installedAt: Date.now(),
          skills: installedSkillIds.length > 0
            ? {
              skillIds: installedSkillIds,
              ...(Object.keys(installedSkillMetadata).length > 0 ? { metadata: installedSkillMetadata } : {}),
            }
            : null,
          mcpServers: normalizeCapabilityList(params.mcpServers),
          connectors: normalizeCapabilityList(params.connectors),
      };
      getStore().set(KITS_INSTALLED_KEY, installedMap);

      if (isComputerUseKit) {
        const syncResult = await syncOpenClawConfig({
          reason: 'computer-use-kit-installed',
          restartGatewayIfRunning: true,
          expectedImpact: OpenClawConfigImpact.Restart,
        });
        if (!syncResult.success) {
          throw new Error(syncResult.error || 'OpenClaw config sync failed after Computer Use install');
        }
      }

      // 7. Notify after all installation work and Computer Use config sync are complete.
      skillManager.startWatching();
      skillWatchingRestarted = true;
      notifySkillsChanged();

      console.log(`[KitStore] Kit "${kitId}" installed successfully with skills: ${installedSkillIds.join(', ')}`);
      return { success: true, skillIds: installedSkillIds };
    } catch (error) {
      console.error(`[KitStore] Install failed for kit "${kitId}":`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Kit installation failed' };
    } finally {
      // Cleanup temp
      if (tempRoot) {
        try {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        } catch { /* ignore cleanup errors */ }
      }
      if (skillWatchingStopped && !skillWatchingRestarted) {
        try {
          getSkillManager().startWatching();
        } catch (error) {
          console.warn('[KitStore] failed to restart skill watcher after install:', error);
        }
      }
    }
  });

  // Uninstall a kit
  ipcMain.handle('kits:uninstall', async (_event, kitId: string) => {
    console.log(`[KitStore] Uninstalling kit "${kitId}"`);
    let skillWatchingStopped = false;
    let skillWatchingRestarted = false;
    try {
      const skinPackUninstallResult = await skinPackKitLifecycle.uninstallIfHandled(kitId);
      if (skinPackUninstallResult !== undefined) {
        return skinPackUninstallResult;
      }

      const installedMap = getInstalledKitsMap(getStore());
      const kitRecord = installedMap[kitId];
      if (!kitRecord) {
        return { success: false, error: `Kit "${kitId}" is not installed` };
      }

      const skillManager = getSkillManager();
      skillManager.stopWatching();
      skillWatchingStopped = true;

      // Delete skill directories
      const root = getSkillsRoot();
      const stateMap = getStore().get<Record<string, { enabled: boolean }>>('skills_state') ?? {};

      for (const skillId of kitRecord.skills?.skillIds ?? []) {
        const skillDir = path.resolve(root, skillId);
        if (fs.existsSync(skillDir)) {
          try {
            fs.rmSync(skillDir, { recursive: true, force: true });
          } catch (err) {
            console.warn(`[KitStore] Failed to delete skill dir "${skillId}":`, err);
          }
        }
        delete stateMap[skillId];
      }

      // Update skills state
      getStore().set('skills_state', stateMap);

      // Remove kit record
      delete installedMap[kitId];
      getStore().set(KITS_INSTALLED_KEY, installedMap);

      if (kitId === ComputerUseKitId.BuiltIn) {
        removeComputerUseSkillArtifacts(getStore());
        await uninstallComputerUseRuntime();
        const syncResult = await syncOpenClawConfig({
          reason: 'computer-use-kit-uninstalled',
          restartGatewayIfRunning: true,
          expectedImpact: OpenClawConfigImpact.Restart,
        });
        if (!syncResult.success) {
          throw new Error(syncResult.error || 'OpenClaw config sync failed after Computer Use uninstall');
        }
      }
      // Notify
      skillManager.startWatching();
      skillWatchingRestarted = true;
      notifySkillsChanged();

      console.log(`[KitStore] Kit "${kitId}" uninstalled successfully`);
      return { success: true };
    } catch (error) {
      console.error(`[KitStore] Uninstall failed for kit "${kitId}":`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Kit uninstallation failed' };
    } finally {
      if (skillWatchingStopped && !skillWatchingRestarted) {
        try {
          getSkillManager().startWatching();
        } catch (error) {
          console.warn('[KitStore] failed to restart skill watcher after uninstall:', error);
        }
      }
    }
  });
}
