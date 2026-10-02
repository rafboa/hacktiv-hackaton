#!/usr/bin/env node
/**
 * hacktiv-mcp-server
 *
 * MCP server for the Hacktiv Hackathon project.
 * Exposes tools for:
 *   - GitHub  : repo info, issues, PRs, file content
 *   - Langflow: trigger flows, get run status/output
 *
 * All credentials come from environment variables — never hardcoded.
 *
 * Logging: always console.error — stdout is the MCP protocol channel.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Credentials (injected via mcp.json env block) ───────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_REPO = process.env.GITHUB_REPO ?? ""; // e.g. "owner/repo"

const LANGFLOW_BASE_URL = process.env.LANGFLOW_BASE_URL ?? "http://localhost:7860";
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

async function githubGet(path: string): Promise<unknown> {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text}`);
  }
  return res.json();
}

async function langflowPost(path: string, body: unknown): Promise<unknown> {
  const url = `${LANGFLOW_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (LANGFLOW_API_KEY) headers["x-api-key"] = LANGFLOW_API_KEY;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Langflow ${res.status}: ${text}`);
  }
  return res.json();
}

async function langflowGet(path: string): Promise<unknown> {
  const url = `${LANGFLOW_BASE_URL}${path}`;
  const headers: Record<string, string> = {};
  if (LANGFLOW_API_KEY) headers["x-api-key"] = LANGFLOW_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Langflow ${res.status}: ${text}`);
  }
  return res.json();
}

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(e: unknown): { content: [{ type: "text"; text: string }]; isError: true } {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text", text: msg }], isError: true };
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "hacktiv-mcp-server",
  version: "0.1.0",
});

// ════════════════════════════════════════════════════════════════════════════════
// GITHUB TOOLS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * github-repo-info
 * Returns basic metadata for the configured repo (or any owner/repo).
 */
server.registerTool(
  "github-repo-info",
  {
    description:
      "Get basic metadata for a GitHub repository (stars, forks, description, open issues, default branch).",
    inputSchema: z.object({
      owner_repo: z
        .string()
        .optional()
        .describe(
          'Repository in "owner/repo" format. Defaults to the GITHUB_REPO env var.'
        ),
    }),
  },
  async ({ owner_repo }) => {
    try {
      const target = owner_repo ?? GITHUB_REPO;
      if (!target) throw new Error("No repository specified. Pass owner_repo or set GITHUB_REPO env var.");
      const data = await githubGet(`/repos/${target}`);
      return ok(data);
    } catch (e) {
      return err(e);
    }
  }
);

/**
 * github-list-issues
 * Lists open (or filtered) issues for the repo.
 */
server.registerTool(
  "github-list-issues",
  {
    description: "List issues for a GitHub repository.",
    inputSchema: z.object({
      owner_repo: z
        .string()
        .optional()
        .describe('Repository in "owner/repo" format. Defaults to GITHUB_REPO env var.'),
      state: z
        .enum(["open", "closed", "all"])
        .optional()
        .default("open")
        .describe("Filter by state. Default: open."),
      labels: z
        .string()
        .optional()
        .describe("Comma-separated label names to filter by."),
      per_page: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Number of results (1–100). Default: 20."),
    }),
  },
  async ({ owner_repo, state, labels, per_page }) => {
    try {
      const target = owner_repo ?? GITHUB_REPO;
      if (!target) throw new Error("No repository specified.");
      const params = new URLSearchParams({
        state: state ?? "open",
        per_page: String(per_page ?? 20),
      });
      if (labels) params.set("labels", labels);
      const data = await githubGet(`/repos/${target}/issues?${params}`);
      return ok(data);
    } catch (e) {
      return err(e);
    }
  }
);

/**
 * github-create-issue
 * Opens a new issue in the repo.
 */
server.registerTool(
  "github-create-issue",
  {
    description: "Create a new GitHub issue.",
    inputSchema: z.object({
      title: z.string().describe("Issue title."),
      body: z.string().optional().describe("Issue body (Markdown)."),
      labels: z
        .array(z.string())
        .optional()
        .describe("Labels to apply."),
      owner_repo: z
        .string()
        .optional()
        .describe('Repository in "owner/repo" format. Defaults to GITHUB_REPO env var.'),
    }),
  },
  async ({ title, body, labels, owner_repo }) => {
    try {
      const target = owner_repo ?? GITHUB_REPO;
      if (!target) throw new Error("No repository specified.");
      if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required to create issues.");
      const res = await fetch(`https://api.github.com/repos/${target}/issues`, {
        method: "POST",
        headers: { ...githubHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, labels }),
      });
      if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return ok(data);
    } catch (e) {
      return err(e);
    }
  }
);

/**
 * github-list-prs
 * Lists pull requests for the repo.
 */
server.registerTool(
  "github-list-prs",
  {
    description: "List pull requests for a GitHub repository.",
    inputSchema: z.object({
      owner_repo: z
        .string()
        .optional()
        .describe('Repository in "owner/repo" format. Defaults to GITHUB_REPO env var.'),
      state: z
        .enum(["open", "closed", "all"])
        .optional()
        .default("open")
        .describe("Filter by state. Default: open."),
      per_page: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Number of results (1–100). Default: 20."),
    }),
  },
  async ({ owner_repo, state, per_page }) => {
    try {
      const target = owner_repo ?? GITHUB_REPO;
      if (!target) throw new Error("No repository specified.");
      const params = new URLSearchParams({
        state: state ?? "open",
        per_page: String(per_page ?? 20),
      });
      const data = await githubGet(`/repos/${target}/pulls?${params}`);
      return ok(data);
    } catch (e) {
      return err(e);
    }
  }
);

/**
 * github-get-file
 * Reads the content of a file from the repo (base64-decoded).
 */
server.registerTool(
  "github-get-file",
  {
    description: "Read the contents of a file from a GitHub repository.",
    inputSchema: z.object({
      path: z.string().describe("File path within the repository (e.g. web/src/App.tsx)."),
      ref: z
        .string()
        .optional()
        .describe("Branch, tag, or commit SHA. Defaults to the repo default branch."),
      owner_repo: z
        .string()
        .optional()
        .describe('Repository in "owner/repo" format. Defaults to GITHUB_REPO env var.'),
    }),
  },
  async ({ path: filePath, ref, owner_repo }) => {
    try {
      const target = owner_repo ?? GITHUB_REPO;
      if (!target) throw new Error("No repository specified.");
      const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      const data = await githubGet(
        `/repos/${target}/contents/${filePath}${query}`
      ) as { content?: string; encoding?: string; type?: string };
      if (data.type !== "file" || !data.content) {
        return ok(data);
      }
      // Decode base64 content
      const decoded = Buffer.from(
        data.content.replace(/\n/g, ""),
        (data.encoding as BufferEncoding) ?? "base64"
      ).toString("utf-8");
      return ok({ path: filePath, ref, content: decoded });
    } catch (e) {
      return err(e);
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// LANGFLOW TOOLS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * langflow-run-flow
 * Triggers a Langflow flow by ID and returns the output.
 */
server.registerTool(
  "langflow-run-flow",
  {
    description:
      "Run a Langflow flow and return its output. Use this to invoke AI flows (e.g. a math hint generator or question generator for the learning app).",
    inputSchema: z.object({
      flow_id: z.string().describe("The Langflow flow UUID to run."),
      input_value: z
        .string()
        .describe("The user message / input text to pass into the flow."),
      input_type: z
        .enum(["chat", "text"])
        .optional()
        .default("chat")
        .describe("Input type. Default: chat."),
      output_type: z
        .enum(["chat", "text", "any"])
        .optional()
        .default("chat")
        .describe("Expected output type. Default: chat."),
      tweaks: z
        .record(z.record(z.unknown()))
        .optional()
        .describe("Optional per-component tweaks as a JSON object."),
    }),
  },
  async ({ flow_id, input_value, input_type, output_type, tweaks }) => {
    try {
      const body: Record<string, unknown> = {
        input_value,
        input_type: input_type ?? "chat",
        output_type: output_type ?? "chat",
      };
      if (tweaks) body.tweaks = tweaks;
      const data = await langflowPost(`/api/v1/run/${flow_id}`, body);
      return ok(data);
    } catch (e) {
      return err(e);
    }
  }
);

/**
 * langflow-list-flows
 * Returns user-owned (runnable) flows from the Langflow instance.
 * Template/starter flows (user_id = null) are excluded — they cannot be run via /api/v1/run/.
 */
server.registerTool(
  "langflow-list-flows",
  {
    description: "List all flows available on the Langflow instance.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const data = await langflowGet("/api/v1/flows/?get_all=true") as Array<Record<string, unknown>>;
      // Only user-owned flows can be triggered via /api/v1/run/; templates have user_id = null
      const runnable = Array.isArray(data)
        ? data
            .filter((f) => f["user_id"] != null)
            .map((f) => ({
              id: f["id"],
              name: f["name"],
              description: f["description"],
              folder_id: f["folder_id"],
              updated_at: f["updated_at"],
            }))
        : data;
      return ok(runnable);
    } catch (e) {
      return err(e);
    }
  }
);

/**
 * langflow-get-flow
 * Returns metadata and component graph for a specific flow.
 */
server.registerTool(
  "langflow-get-flow",
  {
    description: "Get metadata and the component graph for a specific Langflow flow.",
    inputSchema: z.object({
      flow_id: z.string().describe("The Langflow flow UUID."),
    }),
  },
  async ({ flow_id }) => {
    try {
      const data = await langflowGet(`/api/v1/flows/${flow_id}`);
      return ok(data);
    } catch (e) {
      return err(e);
    }
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("hacktiv-mcp-server running on stdio");
  console.error(`  GitHub repo : ${GITHUB_REPO || "(not set — pass GITHUB_REPO)"}`);
  console.error(`  Langflow URL: ${LANGFLOW_BASE_URL}`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
