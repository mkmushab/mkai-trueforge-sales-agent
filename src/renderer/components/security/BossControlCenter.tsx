import React, { useEffect, useState } from 'react';

export interface ApprovalItem {
  approval_id: string;
  department_id: string;
  department_name: string;
  tool_name: string;
  action: string;
  params: Record<string, unknown>;
  action_hash: string;
  risk_tier: string;
  reason: string;
  task_prompt: string;
  approval_token: string;
  created_at: number;
}

export interface AuditEventItem {
  seq: number;
  timestamp: number;
  agent_id: string;
  subagent_code: string;
  tool_name: string;
  action: string;
  risk_tier: string;
  decision: string;
  approver: string;
  prev_hash: string;
  entry_hash: string;
}

export const BossControlCenter: React.FC<{ backendUrl?: string; gateSecret?: string }> = ({
  backendUrl = 'http://127.0.0.1:8765',
  gateSecret = 'mkai-local-ipc-gate-secret-2026',
}) => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; message: string; entries_checked: number } | null>(null);
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<{ total_tasks: number; verified_done: number; overall_success_rate_pct: number }>({
    total_tasks: 0,
    verified_done: 0,
    overall_success_rate_pct: 0,
  });

  const refreshAll = async () => {
    try {
      const [aprRes, audRes, metRes] = await Promise.all([
        fetch(`${backendUrl}/api/v1/approvals`),
        fetch(`${backendUrl}/api/v1/audit/events`),
        fetch(`${backendUrl}/api/v1/taskboard/metrics`),
      ]);
      if (aprRes.ok) {
        const d = await aprRes.json();
        setApprovals(d.pending_approvals || []);
      }
      if (audRes.ok) {
        const d = await audRes.json();
        setAuditEvents(d.events || []);
      }
      if (metRes.ok) {
        const d = await metRes.json();
        setMetrics(d);
      }
    } catch {
      // Fail-closed indicator shown in UI if backend unreachable
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const handleDecision = async (item: ApprovalItem, decision: 'approve_once' | 'approve_task' | 'reject') => {
    await fetch(`${backendUrl}/api/v1/gate/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MKAI-Gate-Secret': gateSecret,
      },
      body: JSON.stringify({
        approval_id: item.approval_id,
        decision,
        approval_token: item.approval_token,
        scope_mode: decision === 'approve_task' ? 'task' : 'once',
      }),
    });
    await refreshAll();
  };

  const handleToggleKillSwitch = async (scope = 'global') => {
    const nextState = !killSwitchActive;
    await fetch(`${backendUrl}/api/v1/kill-switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MKAI-Gate-Secret': gateSecret,
      },
      body: JSON.stringify({
        scope,
        active: nextState,
        reason: nextState ? 'Emergency stop activated by Boss in Control Center' : 'Resumed by Boss',
      }),
    });
    setKillSwitchActive(nextState);
    await refreshAll();
  };

  const handleVerifyChain = async () => {
    const res = await fetch(`${backendUrl}/api/v1/audit/verify`);
    const data = await res.json();
    setChainStatus(data);
  };

  return (
    <div style={{ padding: 24, background: '#0b0f19', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>MK-AI Boss Control Center & Gatekeeper</h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Verified Tasks: {metrics.verified_done}/{metrics.total_tasks} ({metrics.overall_success_rate_pct}%) | Pending Approvals: {approvals.length}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => void handleVerifyChain()}
            style={{ padding: '8px 14px', borderRadius: 8, background: '#1e293b', color: '#38bdf8', border: '1px solid #38bdf8', cursor: 'pointer' }}
          >
            Verify Audit Chain
          </button>
          <button
            onClick={() => void handleToggleKillSwitch('global')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: killSwitchActive ? '#10b981' : '#ef4444',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {killSwitchActive ? 'Resume Workforce' : 'Emergency Kill Switch'}
          </button>
        </div>
      </div>

      {chainStatus && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: chainStatus.valid ? '#064e3b' : '#7f1d1d' }}>
          <strong>SHA-256 Audit Chain:</strong> {chainStatus.message} ({chainStatus.entries_checked} entries verified)
        </div>
      )}

      <h3>Pending Action-Bound Approvals ({approvals.length})</h3>
      {approvals.map((item) => (
        <div key={item.approval_id} style={{ padding: 16, marginBottom: 12, borderRadius: 10, background: '#131a2a', border: '1px solid #334155' }}>
          <div><strong>Agent:</strong> {item.department_name} ({item.department_id})</div>
          <div><strong>Tool / Action:</strong> {item.tool_name} :: {item.action} (Risk Tier: {item.risk_tier})</div>
          <div><strong>Reason:</strong> {item.reason}</div>
          <div><strong>Action Hash (SHA-256):</strong> <code>{item.action_hash}</code></div>
          <pre style={{ background: '#070a12', padding: 10, borderRadius: 6, fontSize: 12 }}>
            {JSON.stringify(item.params, null, 2)}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => void handleDecision(item, 'approve_once')}>Approve Once</button>
            <button onClick={() => void handleDecision(item, 'approve_task')}>Approve for This Task</button>
            <button onClick={() => void handleDecision(item, 'reject')}>Reject</button>
          </div>
        </div>
      ))}

      <h3>Live Tamper-Evident Audit Log</h3>
      <div style={{ maxHeight: 280, overflowY: 'auto', background: '#070a12', padding: 12, borderRadius: 8 }}>
        {auditEvents.map((ev) => (
          <div key={ev.seq} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
            <code>#{ev.seq}</code> [{ev.risk_tier}] <strong>{ev.agent_id}</strong> ({ev.tool_name}:{ev.action}) &rarr; {ev.decision} | <code>{ev.entry_hash.slice(0, 16)}…</code>
          </div>
        ))}
      </div>
    </div>
  );
};
export default BossControlCenter;
