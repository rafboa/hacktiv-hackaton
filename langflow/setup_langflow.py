"""
setup_langflow.py — Uploads Arith components + flow to a running Langflow instance.

Usage:
    python langflow/setup_langflow.py

Requires: requests (pip install requests)

What it does:
  1. Reads all 6 component .py files from langflow/components/
  2. Embeds the code into the flow JSON (replaces placeholder comments)
  3. Uploads the flow to Langflow via POST /api/v1/flows/
  4. Prints the flow UUID — paste it into web/.env as VITE_LANGFLOW_FLOW_ID
"""

import json
import sys
import os
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package required. Run: pip install requests")
    sys.exit(1)

LANGFLOW_URL = os.environ.get("LANGFLOW_BASE_URL", "http://localhost:7860")
LANGFLOW_API_KEY = os.environ.get("LANGFLOW_API_KEY", "")

SCRIPT_DIR = Path(__file__).parent
COMPONENTS_DIR = SCRIPT_DIR / "components"
FLOW_FILE = SCRIPT_DIR / "flow" / "arith-teaching-planner.json"

# Map: component filename -> list of node IDs that use it
COMPONENT_MAP = {
    "arith_request_gateway.py": ["request_gateway"],
    "arith_lesson_engine.py": ["lesson_engine_initial", "lesson_engine_transfer", "lesson_engine_fallback"],
    "support_context_builder.py": ["support_context_builder", "repair_context_builder"],
    "teaching_strategy_catalog.py": ["strategy_catalog"],
    "arith_plan_guard.py": ["plan_guard_pass1", "plan_guard_pass2", "plan_guard_problem", "plan_guard_transfer"],
    "arith_response_serializer.py": [
        "serializer_problem", "serializer_support", "serializer_transfer",
        "serializer_fallback", "serializer_error",
    ],
}


def read_component(filename: str) -> str:
    path = COMPONENTS_DIR / filename
    if not path.exists():
        print(f"  WARNING: {path} not found")
        return ""
    return path.read_text(encoding="utf-8")


def embed_code_in_flow(flow_data: dict) -> dict:
    """Replace placeholder code comments with actual component source."""
    node_code: dict[str, str] = {}

    for filename, node_ids in COMPONENT_MAP.items():
        code = read_component(filename)
        if not code:
            continue
        for nid in node_ids:
            node_code[nid] = code

    for node in flow_data.get("data", {}).get("nodes", []):
        nid = node.get("id")
        if nid in node_code:
            if "template" not in node:
                node["template"] = {}
            if "code" not in node["template"]:
                node["template"]["code"] = {}
            node["template"]["code"]["value"] = node_code[nid]

    return flow_data


def get_auth_token() -> str:
    """Get auth token via auto_login or API key."""
    if LANGFLOW_API_KEY:
        return LANGFLOW_API_KEY

    try:
        r = requests.get(f"{LANGFLOW_URL}/api/v1/auto_login", timeout=5)
        if r.ok:
            data = r.json()
            token = data.get("access_token", "")
            if token:
                return token
    except Exception:
        pass
    return ""


def get_headers(token: str) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def check_health() -> bool:
    try:
        r = requests.get(f"{LANGFLOW_URL}/health", timeout=5)
        return r.ok
    except Exception as e:
        print(f"Cannot reach Langflow at {LANGFLOW_URL}: {e}")
        return False


def upload_flow(flow_data: dict, token: str) -> str:
    """Upload flow via Langflow API. Returns flow UUID."""
    headers = get_headers(token)

    # Check if a flow with this name already exists
    try:
        r = requests.get(f"{LANGFLOW_URL}/api/v1/flows/", headers=headers, timeout=10)
        if r.ok:
            existing = r.json()
            if isinstance(existing, list):
                for f in existing:
                    if f.get("name") == flow_data.get("name") and f.get("user_id"):
                        flow_id = f["id"]
                        print(f"  Flow '{flow_data['name']}' already exists (id: {flow_id})")
                        # Update it
                        r2 = requests.patch(
                            f"{LANGFLOW_URL}/api/v1/flows/{flow_id}",
                            headers=headers,
                            json=flow_data,
                            timeout=30,
                        )
                        if r2.ok:
                            print(f"  Updated existing flow.")
                            return flow_id
                        else:
                            print(f"  Update failed ({r2.status_code}), creating new flow...")
    except Exception:
        pass

    # Create new flow
    r = requests.post(
        f"{LANGFLOW_URL}/api/v1/flows/",
        headers=headers,
        json=flow_data,
        timeout=30,
    )
    if not r.ok:
        print(f"ERROR uploading flow: {r.status_code} {r.text[:500]}")
        sys.exit(1)

    result = r.json()
    return result.get("id", "")


def main():
    print("=" * 60)
    print("  Arith Langflow Setup")
    print("=" * 60)
    print(f"\n  Langflow URL: {LANGFLOW_URL}")

    # 1. Health check
    print("\n[1/5] Checking Langflow health...")
    if not check_health():
        print("  FAILED — Is Langflow running? Start it with: langflow run")
        sys.exit(1)
    print("  OK")

    # 2. Get auth token
    print("\n[2/5] Authenticating...")
    token = get_auth_token()
    if token:
        print(f"  Token acquired ({len(token)} chars)")
    else:
        print("  WARNING: No token — upload may fail if auth is required")

    # 3. Read flow JSON
    print("\n[3/5] Reading flow definition...")
    if not FLOW_FILE.exists():
        print(f"  ERROR: {FLOW_FILE} not found")
        sys.exit(1)
    flow_data = json.loads(FLOW_FILE.read_text(encoding="utf-8"))
    print(f"  Flow: {flow_data.get('name')}")
    print(f"  Nodes: {len(flow_data.get('data', {}).get('nodes', []))}")
    print(f"  Edges: {len(flow_data.get('data', {}).get('edges', []))}")

    # 4. Embed component code
    print("\n[4/5] Embedding component code...")
    for filename in COMPONENT_MAP:
        code = read_component(filename)
        status = f"{len(code)} bytes" if code else "MISSING"
        print(f"  {filename}: {status}")
    flow_data = embed_code_in_flow(flow_data)

    # 5. Upload
    print("\n[5/5] Uploading flow to Langflow...")
    flow_id = upload_flow(flow_data, token)

    print("\n" + "=" * 60)
    print("  DONE!")
    print(f"  Flow ID: {flow_id}")
    print()
    print("  Next steps:")
    print(f"  1. Open Langflow UI: {LANGFLOW_URL}")
    print(f"  2. Find flow 'arith-teaching-planner' in My Flows")
    print(f"  3. Set your DeepSeek API key in the DeepSeek node")
    print(f"  4. Add this to web/.env:")
    print(f"     VITE_LANGFLOW_FLOW_ID={flow_id}")
    print(f"  5. Restart the Vite dev server")
    print("=" * 60)


if __name__ == "__main__":
    main()
