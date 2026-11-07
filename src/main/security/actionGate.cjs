/**
 * MK AI — Unified Electron Main-Process Action Gate (`src/main/security/actionGate.cjs`)
 * Single fail-closed enforcement point for all Electron tool execution paths:
 * - Shell / Command execution (`openclawApprovalController`, `openclawRuntimeAdapter`)
 * - File read / write / delete (`openclawRuntimeAdapter`)
 * - Browser control (`mcpBridgeServer`, `lobsterBrowserMcpServer`)
 * - Desktop Computer Use (`computerUseMcpServer`)
 * - MCP tools (`mcpRuntime`, `mcpBridgeServer`)
 * - IM & Scheduled Task triggers (`imCoworkHandler`, `imScheduledTaskHandler`)
 *
 * Security Guarantees:
 * 1. Consults Python Gatekeeper (`POST /api/v1/gate/evaluate`) over loopback with `X-MKAI-Gate-Secret`.
 * 2. Fail Closed: If backend is unreachable, times out, returns malformed JSON, or kill switch is active -> DENY.
 * 3. Action-Bound Single-Use Approvals: Binds every approval to `SHA256(agentId || taskId || toolName || action || canonicalParams)`.
 *    Approval for Action X can NEVER authorize Action Y, and each single-use token is consumed upon execution.
 */
'use strict';

const crypto = require('node:crypto');

function canonicalizeObject(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeObject);
  }
  const sortedKeys = Object.keys(value)
    .filter((k) => !['approval_id', 'approval_token', 'server_verified_token', 'approved', 'bypass_gate'].includes(k))
    .sort();
  const out = {};
  for (const k of sortedKeys) {
    out[k] = canonicalizeObject(value[k]);
  }
  return out;
}

function computeActionHash({ agentId = '', taskId = '', toolName = '', action = '', params = {}, taskPrompt = '' }) {
  const payload = {
    action: String(action || ''),
    agent_id: String(agentId || ''),
    params: canonicalizeObject(params || {}),
    task_id: String(taskId || ''),
    task_prompt: String(taskPrompt || ''),
    tool_name: String(toolName || ''),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

class ActionGate {
  constructor(options = {}) {
    this.backendUrl = (options.backendUrl || process.env.MK_BACKEND_URL || 'http://127.0.0.1:8765').replace(/\/+$/, '');
    this.ipcSecret = options.ipcSecret || process.env.MK_GATE_IPC_SECRET || 'mkai-local-ipc-gate-secret-2026';
    this.timeoutMs = options.timeoutMs || 3000;
    this.onApprovalRequired = options.onApprovalRequired || null;
    this.consumedTokens = new Set();
    this.registeredExecutors = new Set();
  }

  registerExecutorPath(executorName) {
    this.registeredExecutors.add(String(executorName));
  }

  buildApprovalCard(evalResult, req) {
    const apr = evalResult.approval_request || {};
    const target =
      req.params?.path ||
      req.params?.file_path ||
      req.params?.url ||
      req.params?.command ||
      req.params?.button_label ||
      req.params?.to ||
      req.action;
    return {
      approvalId: apr.approval_id || '',
      agentId: req.agentId || 'mkai-04-ceo',
      departmentName: req.departmentName || apr.department_name || 'MK AI Department',
      toolName: req.toolName,
      action: req.action,
      target: String(target || ''),
      reason: (evalResult.reasons || []).join('; ') || apr.reason || 'High-risk action requires Boss confirmation',
      riskTier: evalResult.risk_tier || 'ASK',
      actionHash: evalResult.action_hash || computeActionHash(req),
      previewOrDiff: req.previewOrDiff || JSON.stringify(req.params || {}, null, 2),
      buttons: ['approve_once', 'approve_task', 'reject'],
    };
  }

  async evaluateAction(req) {
    const agentId = String(req.agentId || 'mkai-04-ceo');
    const toolName = String(req.toolName || 'unknown_tool');
    const action = String(req.action || 'execute');
    const params = req.params && typeof req.params === 'object' ? { ...req.params } : {};
    const taskPrompt = String(req.taskPrompt || '');
    const taskId = String(req.taskId || '');

    // Strip any client-side bypass flags
    delete params.approved;
    delete params.bypass_gate;
    delete params.skip_approval;

    const actionHash = computeActionHash({ agentId, taskId, toolName, action, params, taskPrompt });

    // Local replay guard before even hitting backend
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

      const data = await response.json();
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

      const result = {
        allowed: Boolean(data.allowed),
        riskTier: data.risk_tier || (data.allowed ? 'AUTO' : 'DENY'),
        status: data.status || (data.allowed ? 'allowed' : 'denied'),
        actionHash: data.action_hash || actionHash,
        reasons: data.reasons || [],
        approvalRequest: data.approval_request || null,
        auditEntry: data.audit_entry || null,
      };

      if (result.riskTier === 'ASK' && !result.allowed) {
        result.approvalCard = this.buildApprovalCard(data, req);
        if (typeof this.onApprovalRequired === 'function') {
          this.onApprovalRequired(result.approvalCard);
        }
      }

      return result;
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

  async executeWithGate(req, executorFn) {
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

  async decideApproval(approvalId, decision, approvalToken, scopeMode = 'once') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/gate/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MKAI-Gate-Secret': this.ipcSecret,
        },
        body: JSON.stringify({
          approval_id: approvalId,
          decision,
          approval_token: approvalToken,
          scope_mode: scopeMode,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return await response.json();
    } catch (error) {
      clearTimeout(timer);
      return {
        success: false,
        error: `Fail-closed: unable to reach Gatekeeper decision endpoint (${error instanceof Error ? error.message : String(error)})`,
      };
    }
  }

  async setKillSwitch(scope = 'global', active = true, reason = 'Emergency stop triggered from UI') {
    const response = await fetch(`${this.backendUrl}/api/v1/kill-switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MKAI-Gate-Secret': this.ipcSecret,
      },
      body: JSON.stringify({ scope, active, reason }),
    });
    return await response.json();
  }

  async verifyAuditChain() {
    const response = await fetch(`${this.backendUrl}/api/v1/audit/verify`);
    return await response.json();
  }
}

const defaultActionGate = new ActionGate();

module.exports = {
  ActionGate,
  computeActionHash,
  defaultActionGate,
};
