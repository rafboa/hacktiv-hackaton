"""
ArithResponseSerializer — Custom Langflow component
Role : Build the v1 response envelope and return a Chat-Output-compatible Message.
Spec : contracts/arith-json-contract-v1.md §9, §10, §11, §16

One class used on every output branch (PROBLEM_PLAN, SUPPORT_PLAN_AI,
SUPPORT_PLAN_FALLBACK, TRANSFER_PLAN, ERROR).
Set `response_type` dropdown to match the branch.

Status / source mapping (contract §9):
  PROBLEM/TRANSFER deterministik valid  → status=OK,       source=DETERMINISTIC
  Support agent lolos validator          → status=OK,       source=AI_VALIDATED
  Repair lolos validator                 → status=OK,       source=AI_VALIDATED
  Agent/repair gagal, fallback berhasil → status=FALLBACK,  source=DETERMINISTIC
  Seluruh server path gagal              → status=ERROR,    source=DETERMINISTIC
"""

import json
import time
from langflow.custom import Component
from langflow.io import DataInput, DropdownInput, Output
from langflow.schema import Data, Message

_SCHEMA_VERSION = "1.0"

# Maps response_type label → (status, source, response_type value)
_STATUS_MAP: dict[str, tuple[str, str, str]] = {
    "PROBLEM_PLAN":          ("OK",       "DETERMINISTIC", "PROBLEM_PLAN"),
    "TRANSFER_PLAN":         ("OK",       "DETERMINISTIC", "TRANSFER_PLAN"),
    "SUPPORT_PLAN_AI":       ("OK",       "AI_VALIDATED",  "SUPPORT_PLAN"),
    "SUPPORT_PLAN_FALLBACK": ("FALLBACK", "DETERMINISTIC", "SUPPORT_PLAN"),
    "ERROR":                 ("ERROR",    "DETERMINISTIC", "ERROR"),
}

# Internal keys that must never reach the browser
_INTERNAL_KEY_PREFIXES = ("_",)


def _is_internal(key: str) -> bool:
    return any(key.startswith(p) for p in _INTERNAL_KEY_PREFIXES)


class ArithResponseSerializer(Component):
    display_name = "Arith Response Serializer"
    description = (
        "Builds the v1 response envelope (contract §9) and emits a JSON Message to Chat Output. "
        "One instance per branch; set Response Type to match."
    )
    icon = "package"

    inputs = [
        DropdownInput(
            name="response_type",
            display_name="Response Type",
            options=list(_STATUS_MAP.keys()),
            value="PROBLEM_PLAN",
            info="Branch this serializer is on.",
        ),
        DataInput(
            name="plan_data",
            display_name="Plan Data",
            info="Assembled plan from Plan Guard or Lesson Engine.",
        ),
    ]

    outputs = [
        Output(display_name="Response Message", name="message_out", method="serialize"),
    ]

    def serialize(self) -> Message:
        t_start = time.monotonic()
        plan = dict(self.plan_data.data) if self.plan_data else {}
        response_type_key = self.response_type
        status, source, response_type_value = _STATUS_MAP.get(
            response_type_key, ("ERROR", "DETERMINISTIC", "ERROR")
        )

        # Strip internal timing/routing keys
        for k in [k for k in plan if _is_internal(k)]:
            plan.pop(k, None)

        # Build the contract-compliant envelope (§9)
        envelope: dict = {
            "schema_version": _SCHEMA_VERSION,
            "request_id":     plan.get("request_id", ""),
            "session_id":     plan.get("session_id", ""),
            "response_type":  response_type_value,
            "status":         status,
            "source":         source,
            "problem_id":     plan.get("problem_id", ""),
        }

        if status == "ERROR":
            # Error branch — include structured error, null out plan fields
            envelope["problem"] = None
            envelope["inference"] = None
            envelope["plan"] = None
            envelope["learning_state_patch"] = None
            envelope["warnings"] = plan.get("warnings", [])
            envelope["error"] = plan.get("error") or {
                "code": "NO_VALID_PLAN",
                "recoverable": True,
                "user_message": "Bantuannya belum siap. Kita coba cara sederhana, ya.",
            }
        else:
            # Success / fallback branch — include problem and plan (contract §9, §10, §11)
            envelope["problem"] = _extract_problem(plan)
            envelope["inference"] = _extract_inference(plan)  # only present on SUPPORT_PLAN
            envelope["plan"] = plan.get("plan")
            envelope["learning_state_patch"] = plan.get("learning_state_patch")
            envelope["warnings"] = plan.get("warnings", [])
            envelope["error"] = None

        serialized = json.dumps(envelope, ensure_ascii=False, separators=(",", ":"))
        elapsed = round((time.monotonic() - t_start) * 1000, 2)

        self.log(
            f"[Serializer] type={response_type_key} status={status} source={source} "
            f"request_id={envelope['request_id']} ms={elapsed}"
        )
        return Message(text=serialized)


def _extract_inference(plan: dict) -> dict | None:
    """Extract inference object (contract §12) for SUPPORT_PLAN.

    The Plan Guard assembles inference fields from agent output at the top level
    of the plan dict (hypothesis_code, strategy_code, confidence, evidence_summary).
    Prefer a nested 'inference' dict if already present; fall back to reconstruction.
    """
    if isinstance(plan.get("inference"), dict):
        return plan["inference"]

    # Reconstruct from flat fields injected by Plan Guard
    hypothesis_code = plan.get("hypothesis_code")
    strategy_code = plan.get("strategy_code")
    if not hypothesis_code:
        return None

    return {
        "hypothesis_code": hypothesis_code,
        "confidence": plan.get("confidence", "MEDIUM"),
        "evidence_summary": plan.get("evidence_summary", ""),
        "strategy_code": strategy_code or "",
    }


def _extract_problem(plan: dict) -> dict | None:
    """Extract the structured problem object (contract §10) from a plan dict.

    The lesson engine stores operands as flat top-level keys; the agent path
    may store a nested 'problem' dict. Prefer the nested form; fall back to
    reconstructing from flat keys.
    """
    if isinstance(plan.get("problem"), dict):
        return plan["problem"]

    # Reconstruct from flat lesson-engine keys
    a = plan.get("operand_a")
    b = plan.get("operand_b")
    if a is None or b is None:
        return None

    return {
        "problem_id": plan.get("problem_id", ""),
        "type": "ARITHMETIC",
        "concept": plan.get("concept", "ADDITION_CROSSING_TEN"),
        "operation": plan.get("operation", "ADDITION"),
        "operands": [a, b],
        "correct_answer": plan.get("correct_answer", a + b),
        "accepted_answers": plan.get("accepted_answers", [a + b]),
        "display_text": f"{a} + {b} = ?" if plan.get("operation", "ADDITION") == "ADDITION" else f"{a} - {b} = ?",
        "number_range": plan.get("number_range", {"min": 0, "max": 20}),
    }
