import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ProviderName } from '@shared/providers/constants';
import type { LobsterAIRequestCapability } from '@shared/providers/lobsterAIRequestOptions';
import type { ModelRuntimeProfile } from '@shared/providers/modelRuntimeProfiles';
import type { ModelThinkingConfig } from '@shared/providers/modelThinking';

import { defaultConfig, getProviderDisplayName } from '../../config';
import { resolveOpenClawModelRef } from '../../utils/openclawModelRef';

export interface Model {
  id: string;
  name: string;
  provider?: string; //  
  providerKey?: string; //   key 
  openClawProviderId?: string; // OpenClaw runtime provider id
  runtimeProfile?: ModelRuntimeProfile; //  
  supportsImage?: boolean;
  supportsVideo?: boolean;
  supportsThinking?: boolean;
  thinkingConfig?: ModelThinkingConfig;
  requestCapabilities?: LobsterAIRequestCapability[];
  supportsToolCalling?: boolean;
  agenticReady?: boolean;
  contextWindow?: number;
  maxTokens?: number;
  isServerModel?: boolean; //  
  serverApiFormat?: string; //   API   ("openai" | "anthropic")
  explicitContextCache?: boolean; //  
  description?: string; //  
  costMultiplier?: number; //   (1.0= )
  moreModel?: boolean; //  “ ” 
  accessible?: boolean; // false =  
  restrictionHint?: string; //   " / " 
}

function isServerModelIdentity(model: Pick<Model, 'providerKey' | 'isServerModel'>): boolean {
  return model.isServerModel === true || model.providerKey === ProviderName.LobsteraiServer;
}

export function getModelIdentityKey(model: Pick<Model, 'id' | 'providerKey' | 'isServerModel'>): string {
  return `${model.providerKey ?? ''}::${model.id}`;
}

export function isSameModelIdentity(
  modelA: Pick<Model, 'id' | 'providerKey' | 'isServerModel'>,
  modelB: Pick<Model, 'id' | 'providerKey' | 'isServerModel'>
): boolean {
  if (modelA.id !== modelB.id) {
    return false;
  }
  if (isServerModelIdentity(modelA) !== isServerModelIdentity(modelB)) {
    return false;
  }
  if (modelA.providerKey && modelB.providerKey) {
    return modelA.providerKey === modelB.providerKey;
  }
  //   providerKey   id  
  return true;
}


const NON_LLM_SERVICE_IDS = new Set([
  'tinyfish',
  'tinyfish-web-agent',
  'tinyfish-squad',
  'firecrawl',
  'harvey',
]);

export function isNonLlmServiceEntry(model: Pick<Model, 'id' | 'name' | 'providerKey'>): boolean {
  const idLower = (model.id || '').trim().toLowerCase();
  const nameLower = (model.name || '').trim().toLowerCase();
  const provLower = (model.providerKey || '').trim().toLowerCase();
  if (NON_LLM_SERVICE_IDS.has(idLower) || NON_LLM_SERVICE_IDS.has(provLower)) {
    return true;
  }
  if (idLower.includes('tinyfish') || nameLower.includes('tinyfish') || nameLower.includes('web agent')) {
    return true;
  }
  return false;
}

function isModelAccessible(model: Model | undefined): model is Model {
  return !!model && model.accessible !== false;
}

function selectPreferredAccessibleModel(
  allAvailableModels: Model[],
  currentModel: Model,
): Model {
  const matchedModel = allAvailableModels.find(m => isSameModelIdentity(m, currentModel));
  if (isModelAccessible(matchedModel)) {
    return matchedModel;
  }
  return allAvailableModels.find(isModelAccessible) ?? matchedModel ?? allAvailableModels[0] ?? currentModel;
}

//   providers  
function buildInitialModels(): Model[] {
  const models: Model[] = [];
  if (defaultConfig.providers) {
    Object.entries(defaultConfig.providers).forEach(([providerName, config]) => {
      if (config.enabled && config.models) {
        config.models.forEach(model => {
          models.push({
            id: model.id,
            name: model.name,
            provider: getProviderDisplayName(providerName, config),
            providerKey: providerName,
            supportsImage: model.supportsImage ?? false,
          });
        });
      }
    });
  }
  const filtered = models.filter(m => !isNonLlmServiceEntry(m));
  return filtered.length > 0 ? filtered : defaultConfig.model.availableModels.filter(m => !isNonLlmServiceEntry(m));
}

//  
export let availableModels: Model[] = buildInitialModels();
const defaultModelProvider = defaultConfig.model.defaultModelProvider;

interface ModelState {
  defaultSelectedModel: Model;
  selectedModelByAgent: Record<string, Model>;
  availableModels: Model[];
}

/**
 * Resolve the effective selected model for a given agent.
 *
 * Resolution chain:
 *   1. Per-agent user override from selectedModelByAgent map
 *   2. Agent's configured model string (resolved via resolveOpenClawModelRef)
 *   3. App-level defaultSelectedModel
 */
export function selectAgentSelectedModel(
  modelState: ModelState,
  agentId: string,
  agentModelRef: string,
): Model {
  const override = modelState.selectedModelByAgent[agentId];
  const trimmed = agentModelRef.trim();
  if (trimmed) {
    const resolved = resolveOpenClawModelRef(trimmed, modelState.availableModels);
    if (resolved && isModelAccessible(resolved)) {
      if (!isModelAccessible(override)) return resolved;
      return isSameModelIdentity(override, resolved) ? override : resolved;
    }
  }
  if (isModelAccessible(override)) return override;
  if (isModelAccessible(modelState.defaultSelectedModel)) {
    return modelState.defaultSelectedModel;
  }
  return modelState.availableModels.find(isModelAccessible) ?? modelState.defaultSelectedModel;
}

/**
 * Re-match each per-agent selected model against the current available models.
 * Removes entries that no longer match any available model.
 */
function syncSelectedModelByAgent(
  selectedModelByAgent: Record<string, Model>,
  allAvailableModels: Model[],
): void {
  for (const agentId of Object.keys(selectedModelByAgent)) {
    const agentModel = selectedModelByAgent[agentId];
    const matched = allAvailableModels.find(m => isSameModelIdentity(m, agentModel));
    if (isModelAccessible(matched)) {
      selectedModelByAgent[agentId] = matched;
    } else {
      delete selectedModelByAgent[agentId];
    }
  }
}

const initialState: ModelState = {
  //   config  
  defaultSelectedModel: availableModels.find(
    model => model.id === defaultConfig.model.defaultModel
      && (!defaultModelProvider || model.providerKey === defaultModelProvider)
  ) || availableModels[0],
  selectedModelByAgent: {},
  availableModels: availableModels,
};

const modelSlice = createSlice({
  name: 'model',
  initialState,
  reducers: {
    setSelectedModel: (state, action: PayloadAction<{ agentId: string; model: Model }>) => {
      if (action.payload.model.accessible === false) return;
      state.selectedModelByAgent[action.payload.agentId] = action.payload.model;
    },
    setDefaultSelectedModel: (state, action: PayloadAction<Model>) => {
      if (action.payload.accessible === false) return;
      state.defaultSelectedModel = action.payload;
    },
    clearAgentSelectedModel: (state, action: PayloadAction<string>) => {
      delete state.selectedModelByAgent[action.payload];
    },
    setAvailableModels: (state, action: PayloadAction<Model[]>) => {
      //   setServerModels  
      const serverModels = state.availableModels.filter(m => m.isServerModel && !isNonLlmServiceEntry(m));
      state.availableModels = [...serverModels, ...action.payload.filter(m => !isNonLlmServiceEntry(m))];
      //   availableModels
      availableModels = state.availableModels;
      //   defaultSelectedModel
      if (state.availableModels.length > 0) {
        state.defaultSelectedModel = selectPreferredAccessibleModel(
          state.availableModels,
          state.defaultSelectedModel,
        );
      }
      //   per-agent  
      syncSelectedModelByAgent(state.selectedModelByAgent, state.availableModels);
    },
    setServerModels: (state, action: PayloadAction<Model[]>) => {
      //  
      const userModels = state.availableModels.filter(m => !m.isServerModel && !isNonLlmServiceEntry(m));
      state.availableModels = [...action.payload.filter(m => !isNonLlmServiceEntry(m)), ...userModels];
      availableModels = state.availableModels;
      //   defaultSelectedModel  accessible  
      if (state.availableModels.length > 0) {
        state.defaultSelectedModel = selectPreferredAccessibleModel(
          state.availableModels,
          state.defaultSelectedModel,
        );
      }
      //   per-agent  
      syncSelectedModelByAgent(state.selectedModelByAgent, state.availableModels);
    },
    clearServerModels: (state) => {
      state.availableModels = state.availableModels.filter(m => !m.isServerModel);
      availableModels = state.availableModels;
      //   defaultSelectedModel  
      if (state.defaultSelectedModel.isServerModel && state.availableModels.length > 0) {
        state.defaultSelectedModel = state.availableModels.find(isModelAccessible)
          ?? state.defaultSelectedModel;
      }
      //   per-agent  
      syncSelectedModelByAgent(state.selectedModelByAgent, state.availableModels);
    },
  },
});

export const {
  setSelectedModel,
  setDefaultSelectedModel,
  clearAgentSelectedModel,
  setAvailableModels,
  setServerModels,
  clearServerModels,
} = modelSlice.actions;
export default modelSlice.reducer;
