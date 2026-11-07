/**
 * QuickAction  
 *  
 */

/**
 *  JSON 
 */
export interface Prompt {
  /**   */
  id: string;
}

/**
 *  
 */
export interface LocalizedPrompt {
  /**   */
  id: string;
  /**   */
  label: string;
  /**   */
  description?: string;
  /**   */
  prompt: string;
}

/**
 *  JSON 
 */
export interface QuickAction {
  /**   */
  id: string;
  /**  Heroicons  */
  icon: string;
  /**  hex  */
  color: string;
  /**   Skill ID */
  skillMapping: string;
  /**   */
  prompts: Prompt[];
}

/**
 *  
 */
export interface LocalizedQuickAction {
  /**   */
  id: string;
  /**   */
  label: string;
  /**  Heroicons  */
  icon: string;
  /**  hex  */
  color: string;
  /**   Skill ID */
  skillMapping: string;
  /**   */
  prompts: LocalizedPrompt[];
}

/**
 *  
 */
export interface QuickActionsConfig {
  /**   */
  version: number;
  /**   */
  actions: QuickAction[];
}

/**
 *  
 */
export interface QuickActionsI18n {
  zh: QuickActionsI18nData;
  en: QuickActionsI18nData;
}

export interface QuickActionsI18nData {
  [actionId: string]: {
    label: string;
    prompts: {
      [promptId: string]: {
        label: string;
        description?: string;
        prompt: string;
      };
    };
  };
}
