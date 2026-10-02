"""
ArithResponseSerializer — Custom Langflow component
Role : Build the v1 response envelope and return a Chat-Output-compatible Message.
Spec : Langflow-Architecture-Arith.md §14, §15

One class used on every output branch (PROBLEM, SUPPORT, TRANSFER, FALLBACK, ERROR).
Set `response_type` dropdown to match the branch.

Status / source mapping (spec §15):
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

_SCHEMA_VERSION = "1"

_STATUS_MAP = {
    "PROBLEM_PLAN": ("OK", "DETERMINISTIC"),
    "TRANSFER_PLAN": ("OK", "DETERMINISTIC"),
    "SUPPORT_PLAN_AI": ("OK", "AI_VALIDATED"),
    "SUPPORT_PLAN_FALLBACK": ("FALLBACK", "DETERMINISTIC"),
    "ERROR": ("ERROR", "DETERMINISTIC"),
}


class ArithResponseSerializer(Component):
    display_name = "Arith Response Serializer"
    description = (
        "Builds the v1 response envelope and emits a JSON Message to Chat Output. "
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
        response_type = self.response_type
        status, source = _STATUS_MAP.get(response_type, ("ERROR", "DETERMINISTIC"))

        # --- Strip internal timing/routing keys from the outbound payload ---
        _internal_keys = {
            k for k in plan if k.startswith("_")
        }
        for k in _internal_keys:
            plan.pop(k, None)

        envelope = {
            "schema_version": _SCHEMA_VERSION,
            "request_id": plan.get("request_id", ""),
            "session_id": plan.get("session_id", ""),
            "status": status,
            "source": source,
            "event_type": _resolve_event_type(response_type),
            "payload": plan,
        }

        serialized = json.dumps(envelope, ensure_ascii=False, separators=(",", ":"))
        elapsed = round((time.monotonic() - t_start) * 1000, 2)

        self.log(
            f"[Serializer] type={response_type} status={status} source={source} "
            f"request_id={envelope['request_id']} ms={elapsed}"
        )
        return Message(text=serialized)


def _resolve_event_type(response_type: str) -> str:
    mapping = {
        "PROBLEM_PLAN": "PROBLEM_PLAN",
        "TRANSFER_PLAN": "TRANSFER_PLAN",
        "SUPPORT_PLAN_AI": "SUPPORT_PLAN",
        "SUPPORT_PLAN_FALLBACK": "SUPPORT_PLAN",
        "ERROR": "ERROR_RESPONSE",
    }
    return mapping.get(response_type, "UNKNOWN")
