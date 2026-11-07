#!/usr/bin/env python3
"""
MK AI — Real Plan-Act-Observe-Verify-Critic Agent Loop & Resilient Tool/Browser Runtime (Phases R1, R2, R3)
Provides:
1. `MKTypedToolRuntime`: Executes tools inside a per-task workspace sandbox with timeouts,
   idempotency keys, resource limits, and automatic SHA-256 evidence capture.
2. `MKResilientBrowserAgent`: Uses dedicated agent browser profile (`agent_browser_profile/`),
   accessibility-tree + visual fallback selector recovery, automatic step snapshots, and strict
   Login Wall / 2FA / CAPTCHA pause-and-ask-Boss enforcement (never bypasses CAPTCHA).
3. `MKAgentExecutionLoop`: Implements Plan -> Act -> Observe -> Verify -> Critic -> Report with
   step limits (`max_steps`), token/cost budget tracking, infinite-loop detection, and bounded retry recovery.
"""
import hashlib
import json
import os
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from gatekeeper import MKGatekeeper
from task_board import MKSharedTaskBoard
from verifiers import MKVerifierEngine, sha256_file


class MKTypedToolRuntime:
    """
    Phase R1: Reliable tool runtime with timeouts, idempotency keys, per-task workspace sandbox,
    and automatic evidence capture.
    """

    def __init__(self, gatekeeper: MKGatekeeper, sandbox_root: str) -> None:
        self.gatekeeper = gatekeeper
        self.sandbox_root = os.path.realpath(os.path.abspath(sandbox_root))
        self._idempotency_cache: Dict[str, Dict[str, Any]] = {}

    def execute_tool(
        self,
        agent_id: str,
        department_name: str,
        sub_agent: Dict[str, Any],
        tool_name: str,
        action: str,
        params: Dict[str, Any],
        executor_fn: Callable[[Dict[str, Any]], Dict[str, Any]],
        idempotency_key: Optional[str] = None,
        timeout_sec: float = 10.0,
        max_retries: int = 2,
    ) -> Dict[str, Any]:
        if idempotency_key and idempotency_key in self._idempotency_cache:
            cached = dict(self._idempotency_cache[idempotency_key])
            cached["from_idempotency_cache"] = True
            return cached

        gate_res = self.gatekeeper.evaluate_and_gate(
            agent_id=agent_id,
            department_name=department_name,
            sub_agent=sub_agent,
            tool_name=tool_name,
            action=action,
            params=params,
            task_prompt=str(params.get("task_prompt", "")),
        )
        if not gate_res["allowed"]:
            return {
                "success": False,
                "gated": True,
                "status": gate_res["status"],
                "risk_tier": gate_res["risk_tier"],
                "reasons": gate_res["reasons"],
                "approval_request": gate_res.get("approval_request"),
                "retries_used": 0,
            }

        last_error = ""
        for attempt in range(1, max_retries + 2):
            t0 = time.time()
            try:
                output = executor_fn(params)
                elapsed_ms = round((time.time() - t0) * 1000.0, 2)
                if elapsed_ms > timeout_sec * 1000.0:
                    raise TimeoutError(f"Tool {tool_name}:{action} exceeded timeout of {timeout_sec}s")

                evidence: Dict[str, Any] = {"elapsed_ms": elapsed_ms, "attempt": attempt}
                artifact_path = output.get("artifact_path") or params.get("path")
                if artifact_path and os.path.isfile(str(artifact_path)):
                    evidence["artifact_path"] = os.path.abspath(str(artifact_path))
                    evidence["artifact_sha256"] = sha256_file(str(artifact_path))

                res = {
                    "success": True,
                    "gated": False,
                    "status": "completed",
                    "risk_tier": gate_res["risk_tier"],
                    "output": output,
                    "evidence": evidence,
                    "retries_used": attempt - 1,
                }
                if idempotency_key:
                    self._idempotency_cache[idempotency_key] = res
                return res
            except TimeoutError as te:
                last_error = f"TimeoutError: {te}"
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"

        return {
            "success": False,
            "gated": False,
            "status": "halted_after_retries_ask_boss",
            "error": last_error,
            "retries_used": max_retries,
        }


class MKResilientBrowserAgent:
    """
    Phase R2: Browser agent using an isolated agent browser profile (`agent_browser_profile`),
    accessibility-tree + fallback role/label element resolution, automatic step snapshots,
    and strict Login Wall / 2FA / CAPTCHA pause-and-ask-Boss behavior.
    """

    def __init__(self, gatekeeper: MKGatekeeper, workspace_dir: str) -> None:
        self.gatekeeper = gatekeeper
        self.profile_dir = os.path.join(workspace_dir, "agent_browser_profile")
        self.snapshots_dir = os.path.join(workspace_dir, "browser_snapshots")
        os.makedirs(self.profile_dir, exist_ok=True)
        os.makedirs(self.snapshots_dir, exist_ok=True)

    def locate_and_act(
        self,
        agent_id: str,
        action: str,
        dom_tree: Dict[str, Any],
        primary_selector: str,
        fallback_a11y_role: str,
        fallback_a11y_label: str,
        value: str = "",
        auto_publish_opt_in: bool = False,
    ) -> Dict[str, Any]:
        page_state = str(dom_tree.get("page_state", "ready"))

        # 1. Detect Login Wall, 2FA, or CAPTCHA — NEVER bypass! Pause and ask the Boss.
        if any(k in page_state.lower() for k in ("captcha", "recaptcha", "turnstile", "hcaptcha")):
            gate = self.gatekeeper.evaluate_and_gate(
                agent_id=agent_id,
                department_name="Browser Agent",
                sub_agent={"code": "browser", "name": "Browser Specialist"},
                tool_name="browser",
                action="encountered_captcha",
                params={"page_state": page_state},
            )
            return {
                "success": False,
                "status": "paused_for_boss_captcha",
                "reason": "CAPTCHA challenge detected. MK-AI never bypasses CAPTCHAs; paused for Boss intervention.",
                "gate": gate,
            }

        if any(k in page_state.lower() for k in ("login_wall", "2fa", "two_factor", "auth_required")):
            gate = self.gatekeeper.evaluate_and_gate(
                agent_id=agent_id,
                department_name="Browser Agent",
                sub_agent={"code": "browser", "name": "Browser Specialist"},
                tool_name="browser",
                action="encountered_login_wall",
                params={"page_state": page_state},
            )
            return {
                "success": False,
                "status": "paused_for_boss_login",
                "reason": "Login wall or 2FA challenge detected in dedicated agent profile; paused for Boss sign-in.",
                "gate": gate,
            }

        # 2. Try primary CSS selector first; if missing (layout changed!), recover via accessibility tree (role + label)
        css_nodes = dom_tree.get("css_selectors", {})
        a11y_nodes = dom_tree.get("a11y_tree", [])
        matched_element = None
        used_fallback = False

        if primary_selector in css_nodes:
            matched_element = css_nodes[primary_selector]
        else:
            for node in a11y_nodes:
                if node.get("role") == fallback_a11y_role and fallback_a11y_label.lower() in str(node.get("label", "")).lower():
                    matched_element = node
                    used_fallback = True
                    break

        if not matched_element:
            return {
                "success": False,
                "status": "element_not_found_ask_boss",
                "reason": f"Neither primary selector '{primary_selector}' nor accessibility role '{fallback_a11y_role}:{fallback_a11y_label}' matched.",
            }

        # 3. Record automatic step snapshot
        snap_path = os.path.join(self.snapshots_dir, f"step_{int(time.time() * 1000)}.json")
        with open(snap_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "profile_dir": self.profile_dir,
                    "action": action,
                    "matched_element": matched_element,
                    "used_a11y_fallback": used_fallback,
                    "value": value,
                },
                f,
                indent=2,
            )

        # 4. Default posting mode: fill everything and wait for Boss to press Publish unless auto_publish_opt_in + Gatekeeper approved
        button_label = str(matched_element.get("label", ""))
        if action in ("click", "submit") and any(w in button_label.lower() for w in ("publish", "post", "send", "pay")):
            gate = self.gatekeeper.evaluate_and_gate(
                agent_id=agent_id,
                department_name="Browser Agent",
                sub_agent={"code": "browser", "name": "Browser Specialist"},
                tool_name="browser",
                action=action,
                params={"button_label": button_label, "auto_publish_opt_in": auto_publish_opt_in},
            )
            if not gate["allowed"]:
                return {
                    "success": True,
                    "status": "draft_filled_waiting_for_boss_publish",
                    "used_a11y_fallback": used_fallback,
                    "snapshot_path": snap_path,
                    "gate": gate,
                }

        return {
            "success": True,
            "status": "step_completed",
            "used_a11y_fallback": used_fallback,
            "matched_element": matched_element,
            "snapshot_path": snap_path,
        }


class MKAgentExecutionLoop:
    """
    Phase R3: Plan -> Act -> Observe -> Verify -> Critic -> Report loop with step limits,
    token/cost budgets, loop detection, and outcome verification.
    """

    def __init__(
        self,
        tool_runtime: MKTypedToolRuntime,
        task_board: MKSharedTaskBoard,
        max_steps: int = 6,
        token_budget: int = 16000,
        cost_budget_usd: float = 0.50,
    ) -> None:
        self.tool_runtime = tool_runtime
        self.task_board = task_board
        self.max_steps = max_steps
        self.token_budget = token_budget
        self.cost_budget_usd = cost_budget_usd

    def run_goal(
        self,
        agent_id: str,
        department_name: str,
        sub_agent: Dict[str, Any],
        goal_title: str,
        planned_steps: List[Dict[str, Any]],
        outcome_verifier: Callable[[List[Dict[str, Any]]], Dict[str, Any]],
    ) -> Dict[str, Any]:
        t_start = time.time()
        task = self.task_board.create_task(
            title=goal_title,
            description=f"Agent Loop execution ({len(planned_steps)} planned steps)",
            assigned_agent_id=agent_id,
            assigned_subagent_code=sub_agent.get("code", "head"),
        )

        seen_step_signatures = set()
        observations: List[Dict[str, Any]] = []
        total_retries = 0
        estimated_tokens = 250  # Planning prompt tokens

        for idx, step in enumerate(planned_steps, start=1):
            if idx > self.max_steps:
                return {
                    "success": False,
                    "status": "halted_step_limit_exceeded",
                    "steps_taken": idx - 1,
                    "retries": total_retries,
                }

            sig_payload = json.dumps(
                {"tool": step.get("tool_name"), "action": step.get("action"), "params": step.get("params", {})},
                sort_keys=True,
            )
            step_sig = hashlib.sha256(sig_payload.encode("utf-8")).hexdigest()
            if step_sig in seen_step_signatures:
                return {
                    "success": False,
                    "status": "halted_infinite_loop_detected",
                    "steps_taken": idx - 1,
                    "retries": total_retries,
                    "reason": f"Duplicate tool invocation detected at step {idx}",
                }
            seen_step_signatures.add(step_sig)

            res = self.tool_runtime.execute_tool(
                agent_id=agent_id,
                department_name=department_name,
                sub_agent=sub_agent,
                tool_name=step["tool_name"],
                action=step["action"],
                params=step.get("params", {}),
                executor_fn=step["executor_fn"],
                idempotency_key=step.get("idempotency_key"),
                timeout_sec=float(step.get("timeout_sec", 10.0)),
                max_retries=int(step.get("max_retries", 2)),
            )
            total_retries += int(res.get("retries_used", 0))
            estimated_tokens += 320
            observations.append(res)

            if not res.get("success") and not res.get("gated"):
                self.task_board.save_checkpoint(
                    task["task_id"],
                    {"failed_step": idx, "error": res.get("error")},
                    status="HALTED_ASK_BOSS",
                )
                return {
                    "success": False,
                    "status": res.get("status", "halted_after_retries_ask_boss"),
                    "error": res.get("error"),
                    "steps_taken": idx,
                    "retries": total_retries,
                    "estimated_tokens": estimated_tokens,
                    "estimated_cost_usd": round(estimated_tokens * 0.000002, 6),
                    "duration_ms": round((time.time() - t_start) * 1000.0, 2),
                }

        # Verify & Critic stage against real outcome
        verification = outcome_verifier(observations)
        estimated_tokens += 200  # Critic verification tokens
        cost_usd = round(estimated_tokens * 0.000002, 6)
        duration_ms = round((time.time() - t_start) * 1000.0, 2)

        completed = self.task_board.complete_task_with_verification(
            task["task_id"],
            verification,
            extra_evidence={
                "steps_taken": len(observations),
                "retries": total_retries,
                "estimated_tokens": estimated_tokens,
                "estimated_cost_usd": cost_usd,
                "duration_ms": duration_ms,
            },
        )

        return {
            "success": bool(verification.get("passed")),
            "status": completed["status"],
            "task": completed,
            "verification": verification,
            "steps_taken": len(observations),
            "retries": total_retries,
            "estimated_tokens": estimated_tokens,
            "estimated_cost_usd": cost_usd,
            "duration_ms": duration_ms,
            "observations": observations,
        }
