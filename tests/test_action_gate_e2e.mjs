/**
 * MK AI — Electron ActionGate End-to-End & Code-Scan Verification Suite (`tests/test_action_gate_e2e.mjs`)
 * Runs with Node.js native test runner: `node --test tests/test_action_gate_e2e.mjs`
 * Spawns the real Python Gatekeeper server (`mkai-backend/server.py`) and tests `src/main/security/actionGate.cjs`.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const { ActionGate, computeActionHash } = require('../src/main/security/actionGate.cjs');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`Timed out waiting for backend at ${url}`);
}

test('Gap B.1 — Code Scan: Every Electron tool-execution path is wired through ActionGate', () => {
  const requiredFiles = [
    'src/main/libs/agentEngine/openclawApprovalController.ts',
    'src/main/libs/agentEngine/openclawRuntimeAdapter.ts',
    'src/main/libs/mcpBridgeServer.ts',
    'src/main/computerUse/computerUseMcpServer.ts',
    'src/main/libs/lobsterBrowserMcpServer.ts',
    'src/main/mcp/mcpRuntime.ts',
    'src/main/im/imCoworkHandler.ts',
    'src/main/im/imScheduledTaskHandler.ts',
  ];

  for (const relPath of requiredFiles) {
    const absPath = path.join(PROJECT_ROOT, relPath);
    assert.equal(fs.existsSync(absPath), true, `Missing required file: ${relPath}`);
    const content = fs.readFileSync(absPath, 'utf8');
    assert.equal(
      content.includes('defaultActionGate') && content.includes('security/actionGate'),
      true,
      `Tool executor file ${relPath} does NOT import/use defaultActionGate!`,
    );
    assert.equal(
      content.includes('registerExecutorPath('),
      true,
      `Tool executor file ${relPath} does NOT call defaultActionGate.registerExecutorPath(...)!`,
    );
  }
});

test('Gap B.2 — E2E ActionGate with Live Python Gatekeeper & Fake Tool Executor', async () => {
  const port = await getFreePort();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkai_e2e_gate_'));
  const ipcSecret = 'e2e-test-ipc-secret-998877';
  const backendUrl = `http://127.0.0.1:${port}`;

  const pyBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const serverProc = spawn(pyBin, ['mkai-backend/server.py'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      MK_BACKEND_HOST: '127.0.0.1',
      MK_BACKEND_PORT: String(port),
      MK_GATE_IPC_SECRET: ipcSecret,
      MK_APPROVAL_DB_PATH: path.join(tmpDir, 'approvals.db'),
      MK_AUDIT_DB_PATH: path.join(tmpDir, 'audit.db'),
      MK_TASKBOARD_DB_PATH: path.join(tmpDir, 'taskboard.db'),
      MK_MEMORY_DB_PATH: path.join(tmpDir, 'memory.db'),
      MK_SANDBOX_ROOT: tmpDir,
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(backendUrl);

    const surfacedCards = [];
    const gate = new ActionGate({
      backendUrl,
      ipcSecret,
      timeoutMs: 3000,
      onApprovalRequired: (card) => surfacedCards.push(card),
    });

    // 1. Safe AUTO action runs fake tool executor
    let safeCalls = 0;
    const safeFile = path.join(tmpDir, 'draft_notes.md');
    const safeRes = await gate.executeWithGate(
      {
        agentId: 'mkai-02-developer',
        toolName: 'file_write',
        action: 'write_draft',
        params: { path: safeFile },
        taskPrompt: 'Write local draft notes inside sandbox',
      },
      async () => {
        safeCalls += 1;
        return { written: safeFile };
      },
    );
    assert.equal(safeRes.executed, true);
    assert.equal(safeRes.gateDecision.riskTier, 'AUTO');
    assert.equal(safeCalls, 1);

    // 2. Hard DENY action (catastrophic shell / path escape) is blocked and never calls executor
    let denyCalls = 0;
    const denyRes = await gate.executeWithGate(
      {
        agentId: 'mkai-02-developer',
        toolName: 'shell',
        action: 'exec',
        params: { command: 'rm -rf / && cat /etc/shadow' },
      },
      async () => {
        denyCalls += 1;
        return 'should-never-run';
      },
    );
    assert.equal(denyRes.executed, false);
    assert.equal(denyRes.gateDecision.riskTier, 'DENY');
    assert.equal(denyCalls, 0);

    // 3. Risky ASK action pauses, surfaces approvalCard, and does NOT run executor while unapproved
    let askCalls = 0;
    const actionXReq = {
      agentId: 'mkai-02-developer',
      departmentName: '2. Developer Agent',
      toolName: 'git_push',
      action: 'push_branch',
      params: { repo: 'mkai/app', branch: 'main', commit: '11223344' },
      taskPrompt: 'Push commit 11223344 to main',
      previewOrDiff: 'diff --git a/app.py b/app.py\n+print("hello")',
    };

    const askRes = await gate.executeWithGate(actionXReq, async () => {
      askCalls += 1;
      return 'pushed';
    });
    assert.equal(askRes.executed, false);
    assert.equal(askRes.gateDecision.riskTier, 'ASK');
    assert.equal(askCalls, 0);
    assert.equal(surfacedCards.length, 1);

    const card = surfacedCards[0];
    assert.equal(card.agentId, 'mkai-02-developer');
    assert.equal(card.toolName, 'git_push');
    assert.deepEqual(card.buttons, ['approve_once', 'approve_task', 'reject']);
    assert.ok(card.approvalId.startsWith('mkai-apr-'));
    assert.equal(card.actionHash, computeActionHash(actionXReq));

    const approvalToken = askRes.gateDecision.approvalRequest.approval_token;

    // 4. Boss approves Action X via decideApproval
    const decideRes = await gate.decideApproval(card.approvalId, 'approve_once', approvalToken, 'once');
    assert.equal(decideRes.success, true);
    assert.equal(decideRes.status, 'approved');

    // 5. Attempting to use Action X's approval token to authorize Action Y (different commit/branch) MUST fail!
    let mismatchCalls = 0;
    const actionYReq = {
      ...actionXReq,
      params: { repo: 'mkai/app', branch: 'main', commit: 'malicious_commit_999' },
      approvalId: card.approvalId,
      approvalToken,
    };
    const mismatchRes = await gate.executeWithGate(actionYReq, async () => {
      mismatchCalls += 1;
      return 'hijacked';
    });
    assert.equal(mismatchRes.executed, false);
    assert.equal(mismatchCalls, 0);
    assert.ok(mismatchRes.gateDecision.reasons.some((r) => r.includes('Action mismatch blocked')));

    // 6. Executing the exact approved Action X succeeds ONCE
    const approvedExec1 = await gate.executeWithGate(
      {
        ...actionXReq,
        approvalId: card.approvalId,
        approvalToken,
      },
      async () => {
        askCalls += 1;
        return 'pushed-once';
      },
    );
    assert.equal(approvedExec1.executed, true);
    assert.equal(askCalls, 1);
    assert.equal(approvedExec1.result, 'pushed-once');

    // 7. Replaying the exact same approval token a second time MUST be blocked!
    const replayExec = await gate.executeWithGate(
      {
        ...actionXReq,
        approvalId: card.approvalId,
        approvalToken,
      },
      async () => {
        askCalls += 1;
        return 'replayed';
      },
    );
    assert.equal(replayExec.executed, false);
    assert.equal(askCalls, 1, 'Executor must NOT run a second time on replay!');

    // 8. Reject flow: a rejected ASK action never runs
    let rejectedCalls = 0;
    const rejectReq = {
      agentId: 'mkai-01-marketing',
      toolName: 'social_publish',
      action: 'publish_post',
      params: { channel: 'LinkedIn', postId: 'p-99' },
      taskPrompt: 'Publish post p-99 publicly on LinkedIn',
    };
    const askReject = await gate.executeWithGate(rejectReq, async () => {
      rejectedCalls += 1;
    });
    const rejectAprId = askReject.gateDecision.approvalRequest.approval_id;
    const rejectTok = askReject.gateDecision.approvalRequest.approval_token;
    const rejectDecision = await gate.decideApproval(rejectAprId, 'reject', rejectTok);
    assert.equal(rejectDecision.status, 'rejected');

    const tryRunRejected = await gate.executeWithGate(
      {
        ...rejectReq,
        approvalId: rejectAprId,
        approvalToken: rejectTok,
      },
      async () => {
        rejectedCalls += 1;
      },
    );
    assert.equal(tryRunRejected.executed, false);
    assert.equal(rejectedCalls, 0);

    // 9. Kill Switch stops all actions immediately
    await gate.setKillSwitch('global', true, 'Emergency stop test');
    let killedCalls = 0;
    const killedRes = await gate.executeWithGate(
      {
        agentId: 'mkai-02-developer',
        toolName: 'file_read',
        action: 'read',
        params: { path: safeFile },
      },
      async () => {
        killedCalls += 1;
      },
    );
    assert.equal(killedRes.executed, false);
    assert.equal(killedRes.gateDecision.riskTier, 'DENY');
    assert.equal(killedCalls, 0);
    await gate.setKillSwitch('global', false, 'Resume after test');

    // 10. Audit log recorded everything and hash chain is intact
    const chainStatus = await gate.verifyAuditChain();
    assert.equal(chainStatus.valid, true);
    assert.ok(chainStatus.entries_checked >= 8);

    // 11. Fail-Closed when backend is unreachable
    const deadGate = new ActionGate({
      backendUrl: 'http://127.0.0.1:1',
      ipcSecret,
      timeoutMs: 500,
    });
    let deadCalls = 0;
    const deadRes = await deadGate.executeWithGate(
      {
        agentId: 'mkai-02-developer',
        toolName: 'file_read',
        action: 'read',
        params: { path: safeFile },
      },
      async () => {
        deadCalls += 1;
      },
    );
    assert.equal(deadRes.executed, false);
    assert.equal(deadRes.gateDecision.riskTier, 'DENY');
    assert.equal(deadRes.gateDecision.status, 'fail_closed_unreachable');
    assert.equal(deadCalls, 0);
  } finally {
    try { serverProc.kill(); } catch {}
    await new Promise((r) => setTimeout(r, 250));
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});
