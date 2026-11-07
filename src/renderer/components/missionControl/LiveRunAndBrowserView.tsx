import React, { useState } from 'react';
import { MKAI_DESIGN_TOKENS } from '../../styles/designTokens';

export interface RunStepItem {
  id: string;
  toolName: string;
  durationMs: number;
  status: 'completed' | 'running' | 'waiting_for_approval' | 'error';
  detail: string;
}

export interface EvidenceItem {
  claim: string;
  url: string;
  httpStatus: number;
}

export interface ResultCardItem {
  title: string;
  subtitle: string;
  statusBadge?: string;
  evidenceUrl: string;
  fields: Record<string, string>;
}

export const LiveRunAndBrowserView: React.FC<{ backendUrl?: string }> = ({
  backendUrl = 'http://127.0.0.1:8765',
}) => {
  const [browserStatus, setBrowserStatus] = useState<'running' | 'paused' | 'takeover_user' | 'stopped'>('running');
  const [activeDomain, setActiveDomain] = useState<string>('internshala.com');
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0);

  const steps: RunStepItem[] = [
    { id: 'step-1', toolName: 'agent_reach_doctor', durationMs: 140, status: 'completed', detail: 'Verified read-only web, RSS, GitHub, and Reddit channels.' },
    { id: 'step-2', toolName: 'maps_leads_search', durationMs: 620, status: 'completed', detail: 'Queried dental clinics in Dwarka, Delhi (limit=10).' },
    { id: 'step-3', toolName: 'firecrawl_scrape', durationMs: 890, status: 'completed', detail: 'Extracted clinic specialties and verified contact emails from source pages.' },
    { id: 'step-4', toolName: 'harvey_stage_draft', durationMs: 210, status: 'waiting_for_approval', detail: 'Staged 3 outreach drafts (<75 words each) in Approvals Inbox (nothing sent).' },
  ];

  const results: ResultCardItem[] = [
    {
      title: 'Dwarka Sector 4 Dental Studio #1',
      subtitle: 'Outreach Draft Staged (31 words) — Waiting for Approval',
      statusBadge: 'waiting_for_approval',
      evidenceUrl: 'https://dwarkadental1.in',
      fields: {
        Contact: 'care@dwarkadental1.in',
        Observation: 'Same-day CBCT 3D Dental Implants in Sector 4, Dwarka',
        HTTP_Status: '200 OK',
      },
    },
    {
      title: 'Dwarka Sector 5 Dental Studio #2',
      subtitle: 'Outreach Draft Staged (29 words) — Waiting for Approval',
      statusBadge: 'waiting_for_approval',
      evidenceUrl: 'https://dwarkadental2.in',
      fields: {
        Contact: 'care@dwarkadental2.in',
        Observation: 'Invisalign Clear Aligners program in Sector 5, Dwarka',
        HTTP_Status: '200 OK',
      },
    },
    {
      title: 'Dwarka Sector 11 Clinic #8',
      subtitle: 'Legitimately Excluded from Email Outreach',
      statusBadge: 'no public email',
      evidenceUrl: 'https://dwarkadental8.in',
      fields: {
        Contact: 'no public email',
        Observation: 'Phone appointments only; zero fabricated email',
        HTTP_Status: '200 OK',
      },
    },
  ];

  const sendBrowserControl = async (action: 'pause' | 'resume' | 'take_over' | 'stop') => {
    const mapState: Record<typeof action, typeof browserStatus> = {
      pause: 'paused',
      resume: 'running',
      take_over: 'takeover_user',
      stop: 'stopped',
    };
    setBrowserStatus(mapState[action]);
    try {
      await fetch(`${backendUrl}/api/v1/browser/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch {
      // Local state updated even if backend is offline
    }
  };

  const handleKeyDownTimeline = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedStepIdx((i) => Math.min(steps.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedStepIdx((i) => Math.max(0, i - 1));
    }
  };

  return (
    <div
      data-testid="mkai-live-run-view"
      className="grid h-full grid-cols-12 gap-4 bg-[#0B0F19] p-4 text-slate-100"
    >
      {/* Left Column (3 cols): Step Timeline with Keyboard Navigation */}
      <section
        aria-label="Step Timeline"
        onKeyDown={handleKeyDownTimeline}
        className="col-span-3 flex flex-col rounded-xl border border-slate-800 bg-[#111827] p-4"
      >
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Step Timeline ({steps.length})
        </h2>
        <p className="mt-1 text-xs text-slate-400">Use Up/Down arrows to navigate tool calls</p>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {steps.map((st, idx) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStepIdx(idx)}
              className={`w-full rounded-lg border p-3 text-left text-xs transition ${MKAI_DESIGN_TOKENS.a11y.focusRingClass} ${
                selectedStepIdx === idx
                  ? 'border-emerald-500/60 bg-emerald-500/10'
                  : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between font-mono font-semibold text-emerald-300">
                <span>{st.toolName}</span>
                <span className="text-slate-400">{st.durationMs}ms</span>
              </div>
              <div className="mt-1 text-slate-300">{st.detail}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-amber-300">{st.status}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Center Column (5 cols): Typed Result Cards with Evidence Links */}
      <section
        aria-label="Structured Result Cards"
        className="col-span-5 flex flex-col rounded-xl border border-slate-800 bg-[#111827] p-4 overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Verified Result Cards & Evidence
          </h2>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            Confidence: 0.94
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {results.map((card, i) => (
            <article key={i} className="rounded-xl border border-slate-800 bg-[#131A2A] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">{card.title}</h3>
                  <p className="text-xs text-slate-400">{card.subtitle}</p>
                </div>
                {card.statusBadge && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    {card.statusBadge}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(card.fields).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-900/70 p-2">
                    <dt className="text-[10px] uppercase text-slate-400">{k}</dt>
                    <dd className="font-medium text-slate-200">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 text-xs">
                <span className="text-slate-400">Primary Source Evidence:</span>
                <a
                  href={card.evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`font-mono text-sky-400 underline ${MKAI_DESIGN_TOKENS.a11y.focusRingClass}`}
                >
                  {card.evidenceUrl}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Right Column (4 cols): Live Browser Panel with Domain Banner & Controls */}
      <section
        aria-label="Live Headed Browser Session"
        className="col-span-4 flex flex-col rounded-xl border border-slate-800 bg-[#111827] p-4"
      >
        <div className="flex items-center justify-between rounded-lg bg-emerald-950/60 border border-emerald-500/40 px-3 py-2">
          <div className="text-xs font-semibold text-emerald-300">
            Domain Banner: <span className="font-mono underline">{activeDomain}</span>
          </div>
          <span className="text-[11px] uppercase tracking-wider text-sky-300">{browserStatus}</span>
        </div>

        {/* Browser Controls: Pause, Resume, Take over, Stop */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { id: 'pause', label: 'Pause' },
            { id: 'resume', label: 'Resume' },
            { id: 'take_over', label: 'Take over' },
            { id: 'stop', label: 'Stop' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => void sendBrowserControl(btn.id as any)}
              className={`rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 ${MKAI_DESIGN_TOKENS.a11y.focusRingClass}`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex-1 rounded-xl border border-slate-800 bg-[#070A12] p-3 text-xs">
          <div className="font-mono text-[11px] text-slate-400">
            Profile: ~/.mkai/browser-profile (Headed Mode)
          </div>
          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/90 p-3">
            {browserStatus === 'takeover_user' ? (
              <p className="text-amber-300 font-medium">
                User Take-Over Active: Agent is paused waiting for your manual interaction in the visible browser window. Click &quot;Resume&quot; when ready.
              </p>
            ) : (
              <p className="text-slate-300">
                Mirrored Live Step Snapshot — Page Cap: 3/5 visited | Rate Limit: Human-like delay active | Credential Typing: Blocked by policy.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LiveRunAndBrowserView;
