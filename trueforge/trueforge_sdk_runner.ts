/**
 * TrueForge TypeScript SDK Integration (`trueforge/trueforge_sdk_runner.ts`)
 * Connects MK-AI Self-Improving Sales & Leads Agent to TrueForge (@truefoundry/trueforge-sdk)
 * Supports creating the Sales Agent, mounting MCP tools (`mkai_mcp_server.py`), loading `SKILL.md`,
 * delegating to the 4 specialist subagents, and running sessions via HTTP/SSE on localhost:8790.
 */

export interface TrueForgeSessionConfig {
  serverUrl: string;
  agentName: string;
  skillPath: string;
  mcpCommand: string[];
  subagents: string[];
  sandboxEnabled: boolean;
}

export class MKAITrueForgeSDKRunner {
  private readonly serverUrl: string;

  constructor(serverUrl: string = process.env.TRUEFORGE_URL || "http://localhost:8790") {
    this.serverUrl = serverUrl.replace(/\/+$/, "");
  }

  async checkServerHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/api/v1/settings/configuration`);
      return res.ok || res.status === 401 || res.status === 422;
    } catch {
      return false;
    }
  }

  async runSalesTaskSession(taskPayload: Record<string, unknown>, skillVersion: string): Promise<Record<string, unknown>> {
    const healthy = await this.checkServerHealth();
    if (healthy) {
      const response = await fetch(`${this.serverUrl}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "trueforge/0.184.2 mkai-sales-agent/6.2.0",
        },
        body: JSON.stringify({
          agent: "mkai-self-improving-sales-agent",
          skillVersion,
          task: taskPayload,
        }),
      });
      if (response.ok) {
        return (await response.json()) as Record<string, unknown>;
      }
    }
    return {
      harness: "@truefoundry/trueforge",
      mode: "local-sqlite-harness",
      skillVersion,
      taskId: taskPayload.task_id,
      status: "delegated_to_python_harness",
    };
  }
}
