import type { CoworkMessage } from '../coworkStore';

export const DEFAULT_IM_EMPTY_REPLY = ' ';
export const UNSCHEDULED_REMINDER_FAILURE_REPLY = ' ';
export const FAILED_REMINDER_FAILURE_REPLY = ' ';

const REFERENCE_UNSCHEDULED_REMINDER_NOTE =
  'Note: I did not schedule a reminder in this turn, so this will not trigger automatically.';

const REMINDER_COMMITMENT_PATTERNS = [
  /\b(?:i\s*['’]?ll|i will)\s+(?:make sure to\s+)?(?:remember|remind|ping|follow up|follow-up|check back|circle back)\b/i,
  /\b(?:i\s*['’]?ll|i will)\s+(?:set|create|schedule)\s+(?:a\s+)?reminder\b/i,
  /(?: | | | | | ).{0,24}(?: | | | | | )/u,
  /(?:\d+\s*(?: | | | | ) | | | | ).{0,16}(?: )?(?: | | | | | )/u,
  /(?: | ).{0,12}(?: | | )?(?: | | | | ).{0,18}(?: | | )/u,
  / /u,
  / (?: )? (?: | )/u,
];

const REMINDER_NEGATION_PATTERNS = [
  /(?: | | | | | ).{0,12}(?: | | | ).{0,18}(?: | | )/u,
  /(?: | | ).{0,12}(?: | ).{0,18}(?: | )/u,
  / /u,
  /did not schedule a reminder/i,
  /failed to schedule/i,
];

const normalizeToolName = (value: unknown): string => {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

const normalizeReplyText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

export const stripThinkingBlocks = (value: string): string => {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();
};

const getToolInputAction = (message: CoworkMessage): string => {
  const toolInput = message.metadata?.toolInput;
  if (!toolInput || typeof toolInput !== 'object') {
    return '';
  }
  const action = (toolInput as Record<string, unknown>).action;
  return typeof action === 'string' ? action.trim().toLowerCase() : '';
};

const isCronAddToolUseMessage = (message: CoworkMessage): boolean => {
  if (message.type !== 'tool_use') return false;
  if (normalizeToolName(message.metadata?.toolName) !== 'cron') return false;
  return getToolInputAction(message) === 'add';
};

const extractToolResultError = (message: CoworkMessage): string | null => {
  const candidates = [
    message.metadata?.error,
    message.metadata?.toolResult,
    message.content,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = normalizeReplyText(candidate);
    if (!normalized) continue;
    if (normalized === 'Tool execution failed') continue;
    return normalized;
  }
  return null;
};

export interface IMReplyAnalysis {
  text: string;
  assistantText: string;
  attemptedCronAdds: number;
  successfulCronAdds: number;
  lastCronAddError: string | null;
  hasReminderCommitment: boolean;
  guardApplied: boolean;
}

export function hasUnbackedReminderCommitment(text: string): boolean {
  const normalized = normalizeReplyText(text).toLowerCase();
  if (!normalized) return false;
  if (normalized.includes(REFERENCE_UNSCHEDULED_REMINDER_NOTE.toLowerCase())) return false;
  if (normalized.includes(UNSCHEDULED_REMINDER_FAILURE_REPLY.toLowerCase())) return false;
  if (normalized.includes(FAILED_REMINDER_FAILURE_REPLY.toLowerCase())) return false;
  if (REMINDER_NEGATION_PATTERNS.some((pattern) => pattern.test(text))) return false;
  return REMINDER_COMMITMENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function analyzeIMReply(messages: CoworkMessage[]): IMReplyAnalysis {
  const assistantParts: string[] = [];
  const cronAddToolUseIds = new Set<string>();
  const successfulCronAddIds = new Set<string>();
  let attemptedCronAdds = 0;
  let lastCronAddError: string | null = null;

  for (const message of messages) {
    if (message.type === 'assistant' && message.content && !message.metadata?.isThinking) {
      const normalized = stripThinkingBlocks(message.content);
      if (normalized) {
        assistantParts.push(normalized);
      }
      continue;
    }

    if (isCronAddToolUseMessage(message)) {
      attemptedCronAdds += 1;
      const toolUseId = typeof message.metadata?.toolUseId === 'string' ? message.metadata.toolUseId : '';
      if (toolUseId) {
        cronAddToolUseIds.add(toolUseId);
      }
      continue;
    }

    if (message.type !== 'tool_result') continue;

    const toolUseId = typeof message.metadata?.toolUseId === 'string' ? message.metadata.toolUseId : '';
    if (!toolUseId || !cronAddToolUseIds.has(toolUseId)) continue;

    if (message.metadata?.isError) {
      lastCronAddError = extractToolResultError(message) ?? lastCronAddError;
      continue;
    }

    successfulCronAddIds.add(toolUseId);
  }

  const assistantText = assistantParts.join('\n\n') || DEFAULT_IM_EMPTY_REPLY;
  const successfulCronAdds = successfulCronAddIds.size;
  const hasReminderCommitment = hasUnbackedReminderCommitment(assistantText);
  const guardApplied = hasReminderCommitment && successfulCronAdds === 0;

  let text = assistantText;
  if (guardApplied) {
    text = lastCronAddError ? FAILED_REMINDER_FAILURE_REPLY : UNSCHEDULED_REMINDER_FAILURE_REPLY;
  } else if (assistantText === DEFAULT_IM_EMPTY_REPLY && successfulCronAdds > 0) {
    text = ' ';
  }

  return {
    text,
    assistantText,
    attemptedCronAdds,
    successfulCronAdds,
    lastCronAddError,
    hasReminderCommitment,
    guardApplied,
  };
}
