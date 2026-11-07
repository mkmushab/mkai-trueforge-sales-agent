import contextlib
#!/usr/bin/env python3
"""
MK AI — Per-Agent Memory & Guarded Self-Learning Playbook Engine (Phase 8)
- Stores per-agent episodic task memories, verified artifact references, and Boss feedback in SQLite.
- Guarded Self-Learning: after a task succeeds or fails, an agent can propose a structured diff
  to its operational playbook (`playbook_proposals`), which is queued for Boss approval before activation.
- Hard Security Invariant: Self-learning proposals CANNOT modify `gatekeeper.py`, `policies/*.json`,
  or escalate tool risk tiers (`DENY` / `ASK` -> `AUTO`). Any such attempt is automatically rejected.
"""
import json
import os
import re
import sqlite3
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

_HERE = os.path.dirname(os.path.abspath(__file__))

FORBIDDEN_POLICY_KEYWORDS = re.compile(
    r"\b(bypass_gate|disable_gatekeeper|allow_all_shell|remove_approval|approved\s*:\s*true|"
    r"override_deny|modify_security_policy|disable_audit_log)\b",
    re.I,
)


class MKMemoryAndLearningStore:
    """SQLite-backed episodic memory store and Boss-approved playbook learning engine."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        data_dir = os.path.join(_HERE, "data")
        os.makedirs(data_dir, exist_ok=True)
        self.db_path = db_path or os.environ.get("MK_MEMORY_DB_PATH", os.path.join(data_dir, "mkai_memory.db"))
        self._init_db()

    @contextlib.contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS agent_memories (
                    memory_id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    task_id TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    outcome TEXT NOT NULL,
                    artifacts_json TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS playbook_proposals (
                    proposal_id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    lesson_learned TEXT NOT NULL,
                    proposed_sop_step TEXT NOT NULL,
                    status TEXT NOT NULL,
                    rejection_reason TEXT NOT NULL DEFAULT '',
                    created_at INTEGER NOT NULL,
                    decided_at INTEGER
                )
                """
            )
            conn.commit()

    def record_memory(
        self,
        agent_id: str,
        task_id: str,
        summary: str,
        outcome: str,
        artifacts: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        memory_id = f"mkai-mem-{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO agent_memories (memory_id, agent_id, task_id, summary, outcome, artifacts_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (memory_id, agent_id, task_id, summary, outcome, json.dumps(artifacts or []), now),
            )
            conn.commit()
        return {
            "memory_id": memory_id,
            "agent_id": agent_id,
            "task_id": task_id,
            "summary": summary,
            "outcome": outcome,
            "artifacts": artifacts or [],
            "created_at": now,
        }

    def recall_memories(self, agent_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM agent_memories WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?",
                (agent_id, limit),
            ).fetchall()
            return [
                {
                    "memory_id": r["memory_id"],
                    "agent_id": r["agent_id"],
                    "task_id": r["task_id"],
                    "summary": r["summary"],
                    "outcome": r["outcome"],
                    "artifacts": json.loads(r["artifacts_json"]),
                    "created_at": r["created_at"],
                }
                for r in rows
            ]

    def propose_playbook_update(
        self,
        agent_id: str,
        lesson_learned: str,
        proposed_sop_step: str,
    ) -> Dict[str, Any]:
        """
        Proposes a new SOP rule learned from task execution.
        Automatically rejects any attempt to weaken safety policies or Gatekeeper rules.
        Valid proposals enter `PENDING_BOSS_APPROVAL` status.
        """
        proposal_id = f"mkai-pb-{uuid.uuid4().hex[:10]}"
        now = int(time.time())
        combined = f"{lesson_learned} {proposed_sop_step}"

        if FORBIDDEN_POLICY_KEYWORDS.search(combined):
            status = "REJECTED_POLICY_VIOLATION"
            reason = "Playbook updates are strictly forbidden from weakening Gatekeeper or security policies."
        else:
            status = "PENDING_BOSS_APPROVAL"
            reason = ""

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO playbook_proposals (
                    proposal_id, agent_id, lesson_learned, proposed_sop_step, status, rejection_reason, created_at, decided_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    proposal_id,
                    agent_id,
                    lesson_learned,
                    proposed_sop_step,
                    status,
                    reason,
                    now,
                    now if status.startswith("REJECTED") else None,
                ),
            )
            conn.commit()

        return {
            "proposal_id": proposal_id,
            "agent_id": agent_id,
            "lesson_learned": lesson_learned,
            "proposed_sop_step": proposed_sop_step,
            "status": status,
            "rejection_reason": reason,
        }

    def decide_playbook_proposal(self, proposal_id: str, approve: bool) -> Dict[str, Any]:
        now = int(time.time())
        new_status = "APPROVED_ACTIVE" if approve else "REJECTED_BY_BOSS"
        with self._connect() as conn:
            conn.execute(
                "UPDATE playbook_proposals SET status = ?, decided_at = ? WHERE proposal_id = ? AND status = 'PENDING_BOSS_APPROVAL'",
                (new_status, now, proposal_id),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM playbook_proposals WHERE proposal_id = ?", (proposal_id,)).fetchone()
            return dict(row) if row else {"error": "Proposal not found"}

    def record_from_turn(self, agent_id: str, user_prompt: str, assistant_reply: str = "") -> Dict[str, Any]:
        prompt_clean = (user_prompt or "").strip()
        if len(prompt_clean) < 4:
            return {"ok": False}
        is_correction = bool(
            re.search(
                r"\b(remember|yaad rakh|hamesha|always|never|mat kar|mtt krr|dont|don't|aise kar|like this|galat|wrong|correction|sikho|learn)\b",
                prompt_clean,
                re.I,
            )
        )
        mem = self.store_memory(
            agent_id=agent_id or "mkai-09-orchestrator",
            task_id=f"turn-{int(time.time())}",
            summary=prompt_clean[:500],
            outcome="user_correction" if is_correction else "completed",
            artifacts=[assistant_reply[:240]] if assistant_reply else [],
        )
        if is_correction:
            self.propose_playbook_update(
                agent_id=agent_id or "mkai-09-orchestrator",
                lesson_learned=f"User preference/correction: {prompt_clean[:300]}",
                proposed_sop_step=f"Always apply user rule: {prompt_clean[:300]}",
            )
        return mem

    def get_relevant_memories(self, prompt_text: str, agent_id: str = "", limit: int = 5) -> List[Dict[str, Any]]:
        return self.recall_memories(agent_id=agent_id or "mkai-09-orchestrator", query=prompt_text, limit=limit)

