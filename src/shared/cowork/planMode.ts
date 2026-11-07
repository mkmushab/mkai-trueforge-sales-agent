export const PLAN_MODE_PROMPT_MARKER = '# Plan Mode';
export const PLAN_MODE_EXECUTION_OVERRIDE_MARKER = '# Plan Mode Execution Override';

export const containsPlanModePrompt = (systemPrompt?: string): boolean =>
  Boolean(systemPrompt && /(?:^|\n)# Plan Mode(?:\r?\n|$)/.test(systemPrompt));

export const isPlanImplementationApproval = (prompt: string): boolean => {
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  if (!normalized) return false;

  const chinesePatterns = [
    /(?: | | | )(?: | | | | | | | | | )? (?: )?(?: | | | | | | )/,
    /(?: | | | )(?: )?(?: | | | | )/,
    /(?: | | | )(?: | | | | | | | )? /,
    / (?: | | | | ).*(?: | | | | | | )/,
  ];
  const englishPatterns = [
    /\b(?:implement|execute|build|apply)\s+(?:the\s+|this\s+|that\s+|approved\s+|above\s+)?plan\b/i,
    /^\s*(?:please\s+)?(?:implement|execute|build)\s+it\b/i,
    /\b(?:start|begin|proceed with|go ahead with)\s+(?:the\s+)?implementation\b/i,
    /\bgo ahead(?:\s+and)?\s+(?:implement|build|execute)\b/i,
  ];
  return [...chinesePatterns, ...englishPatterns].some((pattern) => pattern.test(normalized));
};
