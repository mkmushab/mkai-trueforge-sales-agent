/**
 * MK AI — Unified Electron Main-Process Action Gate (`src/main/security/actionGate.ts`)
 * Single fail-closed enforcement point for all Electron tool execution paths.
 */
import crypto from 'crypto';

export type RiskTier = 'AUTO' | 'ASK' | 'DENY';

export interface ActionGateRequest {
  agentId?: string;
  departmentName?: string;
  subAgent?: { code: string; name: string };
  toolName: string;
  action: string;
  params?: Record<string, unknown>;
  taskPrompt?: string;
  taskId?: string;
  untrustedContext?: boolean;
  previewOrDiff?: string;
  approvalId?: string;
  approvalToken?: string;
}

export interface ApprovalCardPayload {
  approvalId: string;
  agentId: string;
  departmentName: string;
  toolName: string;
  action: string;
  target: string;
  reason: string;
  riskTier: RiskTier;
  actionHash: string;
  previewOrDiff: string;
  buttons: Array<'approve_once' | 'approve_task' | 'reject'>;
}

export interface ActionGateDecision {
  allowed: boolean;
  riskTier: RiskTier;
  status: string;
  actionHash: string;
  reasons: string[];
  approvalRequest?: Record<string, unknown> | null;
  approvalCard?: ApprovalCardPayload;
  auditEntry?: Record<string, unknown> | null;
}

function canonicalizeObject(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeObject);
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record)
    .filter((k) => !['approval_id', 'approval_token', 'server_verified_token', 'approved', 'bypass_gate'].includes(k))
    .sort();
  const out: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    out[k] = canonicalizeObject(record[k]);
  }
  return out;
}

export function computeActionHash(req: {
  agentId?: string;
  taskId?: string;
  toolName: string;
  action: string;
  params?: Record<string, unknown>;
  taskPrompt?: string;
}): string {
  const payload = {
    action: String(req.action || ''),
    agent_id: String(req.agentId || ''),
    params: canonicalizeObject(req.params || {}),
    task_id: String(req.taskId || ''),
    task_prompt: String(req.taskPrompt || ''),
    tool_name: String(req.toolName || ''),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

export class ActionGate {
  private readonly backendUrl: string;
  private readonly ipcSecret: string;
  private readonly timeoutMs: number;
  private onApprovalRequired: ((card: ApprovalCardPayload) => void) | null;
  private readonly consumedTokens = new Set<string>();
  private readonly registeredExecutors = new Set<string>();

  constructor(options: {
    backendUrl?: string;
    ipcSecret?: string;
    timeoutMs?: number;
    onApprovalRequired?: (card: ApprovalCardPayload) => void;
  } = {}) {
    this.backendUrl = (options.backendUrl || process.env.MK_BACKEND_URL || 'http://127.0.0.1:8765').replace(/\/+$/, '');
    this.ipcSecret = options.ipcSecret || process.env.MK_GATE_IPC_SECRET || 'mkai-local-ipc-gate-secret-2026';
    this.timeoutMs = options.timeoutMs || 3000;
    this.onApprovalRequired = options.onApprovalRequired || null;
  }

  registerExecutorPath(executorName: string): void {
    this.registeredExecutors.add(String(executorName));
  }

  setApprovalCallback(cb: (card: ApprovalCardPayload) => void): void {
    this.onApprovalRequired = cb;
  }

  private buildApprovalCard(evalResult: Record<string, any>, req: ActionGateRequest): ApprovalCardPayload {
    const apr = evalResult.approval_request || {};
    const p = req.params || {};
    const target = p.path || p.file_path || p.url || p.command || p.button_label || p.to || req.action;
    return {
      approvalId: String(apr.approval_id || ''),
      agentId: String(req.agentId || 'mkai-04-ceo'),
      departmentName: String(req.departmentName || apr.department_name || 'MK AI Department'),
      toolName: req.toolName,
      action: req.action,
      target: String(target || ''),
      reason: Array.isArray(evalResult.reasons) ? evalResult.reasons.join('; ') : String(apr.reason || 'Approval required'),
      riskTier: (evalResult.risk_tier as RiskTier) || 'ASK',
      actionHash: String(evalResult.action_hash || computeActionHash(req)),
      previewOrDiff: req.previewOrDiff || JSON.stringify(p, null, 2),
      buttons: ['approve_once', 'approve_task', 'reject'],
    };
  }

  async evaluateAction(req: ActionGateRequest): Promise<ActionGateDecision> {
    const agentId = String(req.agentId || 'mkai-04-ceo');
    const toolName = String(req.toolName || 'unknown_tool');
    const action = String(req.action || 'execute');
    const params: Record<string, unknown> = req.params ? { ...req.params } : {};
    const taskPrompt = String(req.taskPrompt || '');
    const taskId = String(req.taskId || '');

    delete params.approved;
    delete params.bypass_gate;
    delete params.skip_approval;

    const actionHash = computeActionHash({ agentId, taskId, toolName, action, params, taskPrompt });

    if (req.approvalId && req.approvalToken) {
      const replayKey = `${req.approvalId}:${req.approvalToken}`;
      if (this.consumedTokens.has(replayKey)) {
        return {
          allowed: false,
          riskTier: 'DENY',
          status: 'replay_blocked_by_action_gate',
          actionHash,
          reasons: [`Single-use approval ${req.approvalId} was already consumed and cannot be replayed`],
        };
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.backendUrl}/api/v1/gate/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MKAI-Gate-Secret': this.ipcSecret,
        },
        body: JSON.stringify({
          agent_id: agentId,
          department_name: req.departmentName || 'MK AI Department',
          sub_agent: req.subAgent || { code: 'head', name: 'Department Head' },
          tool_name: toolName,
          action,
          params,
          task_prompt: taskPrompt,
          task_id: taskId,
          untrusted_context: Boolean(req.untrustedContext),
          approval_id: req.approvalId || null,
          approval_token: req.approvalToken || null,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.status === 401 || response.status >= 500) {
        return {
          allowed: false,
          riskTier: 'DENY',
          status: 'fail_closed_backend_error',
          actionHash,
          reasons: [`Fail-closed: Gatekeeper returned HTTP ${response.status}`],
        };
      }

      const data = (await response.json()) as Record<string, any>;
      if (!data || typeof data.allowed !== 'boolean') {
        return {
          allowed: false,
          riskTier: 'DENY',
          status: 'fail_closed_invalid_payload',
          actionHash,
          reasons: ['Fail-closed: Gatekeeper returned malformed decision payload'],
        };
      }

      if (data.allowed && req.approvalId && req.approvalToken) {
        this.consumedTokens.add(`${req.approvalId}:${req.approvalToken}`);
      }

      const decision: ActionGateDecision = {
        allowed: Boolean(data.allowed),
        riskTier: (data.risk_tier as RiskTier) || (data.allowed ? 'AUTO' : 'DENY'),
        status: String(data.status || (data.allowed ? 'allowed' : 'denied')),
        actionHash: String(data.action_hash || actionHash),
        reasons: Array.isArray(data.reasons) ? data.reasons : [],
        approvalRequest: data.approval_request || null,
        auditEntry: data.audit_entry || null,
      };

      if (decision.riskTier === 'ASK' && !decision.allowed) {
        decision.approvalCard = this.buildApprovalCard(data, req);
        this.onApprovalRequired?.(decision.approvalCard);
      }

      return decision;
    } catch (error) {
      clearTimeout(timer);
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        allowed: false,
        riskTier: 'DENY',
        status: 'fail_closed_unreachable',
        actionHash,
        reasons: [`Fail-closed: Python Gatekeeper unreachable or timed out (${errMsg})`],
      };
    }
  }

  async executeWithGate<T>(
    req: ActionGateRequest,
    executorFn: () => Promise<T> | T,
  ): Promise<{ executed: boolean; gateDecision: ActionGateDecision; result: T | null }> {
    const decision = await this.evaluateAction(req);
    if (!decision.allowed) {
      return {
        executed: false,
        gateDecision: decision,
        result: null,
      };
    }
    const output = await executorFn();
    return {
      executed: true,
      gateDecision: decision,
      result: output,
    };
  }
}

export const defaultActionGate = new ActionGate();
