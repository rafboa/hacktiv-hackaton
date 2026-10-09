"""
setup_langflow.py — Builds the Arith flow in Langflow's canvas format and uploads it.

Usage:
    python langflow/setup_langflow.py

Requires: requests (pip install requests)

What it does:
  1. Reads the simplified flow spec in langflow/flow/arith-teaching-planner.json
  2. Asks Langflow to compile each custom component (.py) into a node schema
     via POST /api/v1/custom_component
  3. Pulls built-in node schemas (ChatInput, ChatOutput, Agent) from GET /api/v1/all
  4. Assembles React Flow nodes ("genericNode") and typed edges the canvas can render
  5. Replaces any older "arith-teaching-planner" flow, uploads the new one,
     and writes the flow ID into web/.env
"""

import copy
import json
import os
import random
import string
import sys
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
WEB_ENV = SCRIPT_DIR.parent / "web" / ".env"

# Spec node id -> component file
COMPONENT_FILES = {
    "request_gateway": "arith_request_gateway.py",
    "lesson_engine_initial": "arith_lesson_engine.py",
    "lesson_engine_transfer": "arith_lesson_engine.py",
    "lesson_engine_fallback": "arith_lesson_engine.py",
    "support_context_builder": "support_context_builder.py",
    "repair_context_builder": "support_context_builder.py",
    "strategy_catalog": "teaching_strategy_catalog.py",
    "plan_guard_pass1": "arith_plan_guard.py",
    "plan_guard_pass2": "arith_plan_guard.py",
    "plan_guard_problem": "arith_plan_guard.py",
    "plan_guard_transfer": "arith_plan_guard.py",
    "serializer_problem": "arith_response_serializer.py",
    "serializer_support": "arith_response_serializer.py",
    "serializer_transfer": "arith_response_serializer.py",
    "serializer_fallback": "arith_response_serializer.py",
    "serializer_error": "arith_response_serializer.py",
}

# Spec type -> catalog lookup key (searched across all categories)
BUILTIN_TYPES = {
    "ChatInput": "ChatInput",
    "ChatOutput": "ChatOutput",
    "Agent": "Agent",
}

# Spec names that changed in current Langflow versions
HANDLE_ALIASES = {
    ("Agent", "agent_llm"): "model",
    ("ChatInput", "store_message"): "should_store_message",
    ("ChatOutput", "store_message"): "should_store_message",
}


def auth_headers() -> dict:
    if LANGFLOW_API_KEY:
        return {"x-api-key": LANGFLOW_API_KEY}
    r = requests.get(f"{LANGFLOW_URL}/api/v1/auto_login", timeout=10)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def short_id() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=5))


def handle_str(obj: dict) -> str:
    # Langflow encodes handles as JSON with sorted keys and quotes replaced by "œ"
    return json.dumps(obj, sort_keys=True).replace('"', "œ")


def compile_custom(code: str, headers: dict) -> tuple[str, dict]:
    r = requests.post(f"{LANGFLOW_URL}/api/v1/custom_component", headers=headers,
                      json={"code": code}, timeout=60)
    if not r.ok:
        raise RuntimeError(f"custom_component failed ({r.status_code}): {r.text[:400]}")
    body = r.json()
    return body["type"], body["data"]


def find_builtin(catalog: dict, key: str) -> dict:
    for comps in catalog.values():
        if isinstance(comps, dict) and key in comps:
            return comps[key]
    raise KeyError(f"Component '{key}' not found in Langflow catalog")


def apply_spec_values(node_schema: dict, spec_template: dict, spec_type: str, warnings: list):
    tmpl = node_schema["template"]
    for field, spec_val in spec_template.items():
        if field == "code" or not isinstance(spec_val, dict) or "value" not in spec_val:
            continue
        name = HANDLE_ALIASES.get((spec_type, field), field)
        if name not in tmpl:
            warnings.append(f"{spec_type}: field '{field}' not in component, skipped")
            continue
        value = spec_val["value"]
        if name == "output_schema" and isinstance(value, list):
            value = [{"name": v["name"], "description": "", "type": v["type"],
                      "multiple": v.get("as_list", False)} for v in value]
        tmpl[name]["value"] = value


def build_nodes(spec: dict, headers: dict, warnings: list) -> dict:
    catalog = requests.get(f"{LANGFLOW_URL}/api/v1/all", headers=headers, timeout=60).json()
    compiled_cache: dict[str, tuple[str, dict]] = {}
    built = {}

    for spec_node in spec["data"]["nodes"]:
        sid, stype = spec_node["id"], spec_node["type"]

        if sid in COMPONENT_FILES:
            fname = COMPONENT_FILES[sid]
            if fname not in compiled_cache:
                code = (COMPONENTS_DIR / fname).read_text(encoding="utf-8")
                compiled_cache[fname] = compile_custom(code, headers)
                print(f"  compiled {fname} -> {compiled_cache[fname][0]}")
            ctype, schema = compiled_cache[fname]
            node_type = ctype
        elif stype in BUILTIN_TYPES:
            schema = find_builtin(catalog, BUILTIN_TYPES[stype])
            node_type = BUILTIN_TYPES[stype]
        else:
            raise KeyError(f"No schema source for node '{sid}' (type {stype})")

        schema = copy.deepcopy(schema)
        schema["display_name"] = spec_node.get("display_name", schema.get("display_name"))
        apply_spec_values(schema, spec_node.get("template", {}), stype, warnings)

        base = node_type.split(":")[-1].split("@")[0] if ":" in node_type else node_type
        node_id = f"{base}-{short_id()}"
        pos = spec_node.get("position", {"x": 0, "y": 0})
        # Spread the spec grid out so 320px-wide nodes don't overlap
        pos = {"x": pos["x"] * 1.6, "y": pos["y"] * 1.8}

        built[sid] = {
            "spec_type": stype,
            "node": {
                "id": node_id,
                "type": "genericNode",
                "position": pos,
                "positionAbsolute": pos,
                "measured": {"width": 320, "height": 240},
                "dragging": False,
                "selected": False,
                "data": {
                    "id": node_id,
                    "type": node_type,
                    "display_name": schema["display_name"],
                    "description": schema.get("description", ""),
                    "node": schema,
                },
            },
        }
    return built


def build_edges(spec: dict, built: dict, warnings: list) -> list:
    edges, seen = [], set()
    for e in spec["data"]["edges"]:
        src, tgt = built[e["source"]], built[e["target"]]
        s_node, t_node = src["node"], tgt["node"]
        out_name = HANDLE_ALIASES.get((src["spec_type"], e["sourceHandle"]), e["sourceHandle"])
        in_name = HANDLE_ALIASES.get((tgt["spec_type"], e["targetHandle"]), e["targetHandle"])

        outputs = {o["name"]: o for o in s_node["data"]["node"].get("outputs", [])}
        field = t_node["data"]["node"]["template"].get(in_name)
        if out_name not in outputs:
            warnings.append(f"edge skipped: {e['source']} has no output '{out_name}' (has {list(outputs)})")
            continue
        if not isinstance(field, dict):
            warnings.append(f"edge skipped: {e['target']} has no input '{in_name}'")
            continue

        key = (s_node["id"], out_name, t_node["id"], in_name)
        if key in seen:
            continue
        seen.add(key)

        source_handle = {
            "dataType": s_node["data"]["type"],
            "id": s_node["id"],
            "name": out_name,
            "output_types": outputs[out_name].get("types", []),
        }
        target_handle = {
            "fieldName": in_name,
            "id": t_node["id"],
            "inputTypes": field.get("input_types") or [],
            "type": field.get("type", "str"),
        }
        sh, th = handle_str(source_handle), handle_str(target_handle)
        edges.append({
            "id": f"reactflow__edge-{s_node['id']}{sh}-{t_node['id']}{th}",
            "source": s_node["id"],
            "target": t_node["id"],
            "sourceHandle": sh,
            "targetHandle": th,
            "data": {"sourceHandle": source_handle, "targetHandle": target_handle},
            "animated": False,
            "className": "",
            "selected": False,
        })

    # Langflow shows only one output per node unless outputs are grouped,
    # and silently drops edges attached to hidden outputs.
    used: dict[str, set] = {}
    for e in edges:
        used.setdefault(e["source"], set()).add(e["data"]["sourceHandle"]["name"])
    for b in built.values():
        node = b["node"]
        names = used.get(node["id"])
        if not names:
            continue
        outputs = node["data"]["node"].get("outputs", [])
        if len(names) > 1:
            for o in outputs:
                o["group_outputs"] = True
        else:
            node["data"]["selected_output"] = next(iter(names))
    return edges


def replace_existing(name: str, headers: dict):
    r = requests.get(f"{LANGFLOW_URL}/api/v1/flows/", headers=headers,
                     params={"get_all": "true"}, timeout=30)
    if not r.ok:
        return
    for f in r.json():
        if f.get("name") == name and f.get("user_id"):
            requests.delete(f"{LANGFLOW_URL}/api/v1/flows/{f['id']}", headers=headers, timeout=30)
            print(f"  removed old flow {f['id']}")


def write_env(flow_id: str):
    lines = WEB_ENV.read_text(encoding="utf-8").splitlines() if WEB_ENV.exists() else []
    lines = [l for l in lines if not l.startswith("VITE_LANGFLOW_FLOW_ID=")]
    if not any(l.startswith("VITE_LANGFLOW_BASE_URL=") for l in lines):
        lines.append(f"VITE_LANGFLOW_BASE_URL={LANGFLOW_URL}")
    lines.append(f"VITE_LANGFLOW_FLOW_ID={flow_id}")
    WEB_ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    print(f"Langflow: {LANGFLOW_URL}")
    try:
        requests.get(f"{LANGFLOW_URL}/health", timeout=5).raise_for_status()
    except Exception as exc:
        print(f"Cannot reach Langflow ({exc}). Start it with: langflow run")
        sys.exit(1)

    headers = auth_headers()
    spec = json.loads(FLOW_FILE.read_text(encoding="utf-8"))
    warnings: list[str] = []

    print("\n[1/3] Building nodes...")
    built = build_nodes(spec, headers, warnings)
    edges = build_edges(spec, built, warnings)
    print(f"  {len(built)} nodes, {len(edges)} edges")

    flow = {
        "name": spec["name"],
        "description": spec.get("description", ""),
        "data": {
            "nodes": [b["node"] for b in built.values()],
            "edges": edges,
            "viewport": {"x": 0, "y": 0, "zoom": 0.5},
        },
    }

    print("\n[2/3] Uploading...")
    replace_existing(spec["name"], headers)
    r = requests.post(f"{LANGFLOW_URL}/api/v1/flows/", headers=headers, json=flow, timeout=60)
    if not r.ok:
        print(f"ERROR {r.status_code}: {r.text[:600]}")
        sys.exit(1)
    flow_id = r.json()["id"]

    print("\n[3/3] Writing web/.env...")
    write_env(flow_id)

    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(f"  - {w}")

    print(f"\nFlow ID: {flow_id}")
    print(f"Open: {LANGFLOW_URL}/flow/{flow_id}")
    print("Configure an OpenAI-compatible provider in Langflow Settings → Model Providers.")
    print("Then select the configured model in both Agent nodes and restart the Vite dev server.")


if __name__ == "__main__":
    main()
