import React, { useState } from 'react';
import { MKAI_DESIGN_TOKENS, SIDEBAR_DEPARTMENT_GROUPS, type DepartmentGroupItem } from '../../styles/designTokens';

export interface ResizableGroupedSidebarProps {
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onNavigateScreen: (screen: 'home' | 'sales_center' | 'live_run' | 'approvals' | 'connectors' | 'outputs' | 'credits') => void;
  activeScreen: string;
  pendingApprovalsCount: number;
}

const STATUS_DOT_COLOR: Record<DepartmentGroupItem['status'], string> = {
  idle: '#64748B',
  running: '#38BDF8',
  waiting_for_approval: '#F59E0B',
};

export const ResizableGroupedSidebar: React.FC<ResizableGroupedSidebarProps> = ({
  selectedAgentId,
  onSelectAgent,
  onNavigateScreen,
  activeScreen,
  pendingApprovalsCount,
}) => {
  const [widthPx, setWidthPx] = useState<number>(304);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <aside
      aria-label="MK-AI 8-Agent Orchestra Navigation"
      style={{ width: widthPx, minWidth: 256, maxWidth: 420, background: MKAI_DESIGN_TOKENS.colors.bgElevated }}
      className="relative flex h-full flex-col border-r border-slate-800 text-slate-100 select-none"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          <div>
            <div className="text-sm font-bold tracking-tight">MK AI v6 Orchestra</div>
            <div className="text-[10px] text-emerald-300">6 Core + Web &amp; Maps Agents</div>
          </div>
        </div>
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">Ctrl+K</span>
      </div>

      {/* Primary View Navigation */}
      <nav aria-label="Primary Views" className="grid grid-cols-2 gap-1.5 border-b border-slate-800 p-3 text-xs">
        {[
          { id: 'home', label: 'Orchestra Home' },
          { id: 'sales_center', label: 'Sales & US/IN Pricing' },
          { id: 'live_run', label: 'Web & Chrome Check' },
          { id: 'approvals', label: `Approvals (${pendingApprovalsCount})` },
          { id: 'connectors', label: 'Gmail/LI & 3 Keys' },
          { id: 'outputs', label: 'Outputs Library' },
          { id: 'credits', label: '34 GitHub Engines' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigateScreen(item.id as any)}
            className={`rounded-lg px-2.5 py-2 text-left font-medium transition ${MKAI_DESIGN_TOKENS.a11y.focusRingClass} ${
              activeScreen === item.id
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Focused 8-Agent Orchestra List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {SIDEBAR_DEPARTMENT_GROUPS.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.groupId]);
          return (
            <div key={group.groupId} className="rounded-xl border border-slate-800/80 bg-slate-900/40">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => toggleGroup(group.groupId)}
                className={`flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 ${MKAI_DESIGN_TOKENS.a11y.focusRingClass}`}
              >
                <span>{group.label} ({group.agents.length})</span>
                <span>{isCollapsed ? '+' : '−'}</span>
              </button>
              {!isCollapsed && (
                <ul className="space-y-1 px-2 pb-2">
                  {group.agents.map((agent) => {
                    const isSelected = selectedAgentId === agent.id;
                    return (
                      <li key={agent.id}>
                        <button
                          type="button"
                          title={`${agent.name} — ${agent.shortRole}`}
                          onClick={() => {
                            onSelectAgent(agent.id);
                            if (agent.id === 'mkai-02-sales') {
                              onNavigateScreen('sales_center');
                            }
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition ${MKAI_DESIGN_TOKENS.a11y.focusRingClass} ${
                            isSelected
                              ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
                              : 'text-slate-200 hover:bg-slate-800/80'
                          }`}
                        >
                          <span
                            aria-label={`Status: ${agent.status}`}
                            style={{ backgroundColor: STATUS_DOT_COLOR[agent.status] }}
                            className="h-2 w-2 shrink-0 rounded-full"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium leading-snug break-words">{agent.name}</div>
                            <div className="text-[10px] text-emerald-400/90 truncate">{agent.modelBadge}</div>
                            <div className="text-[11px] text-slate-400 truncate">{agent.shortRole}</div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        title="Click to toggle sidebar width"
        onClick={() => setWidthPx((w) => (w < 340 ? 360 : 304))}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-emerald-500/40"
      />
    </aside>
  );
};

export default ResizableGroupedSidebar;
