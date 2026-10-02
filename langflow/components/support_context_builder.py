"""
SupportContextBuilder — Custom Langflow component
Role : Build the input context sent to Teaching Planner Agent.
       In REPAIR mode it also wraps a failed draft with its validation errors.
Spec : Langflow-Architecture-Arith.md §7, §10, §12
"""

import json
import time
from langflow.custom import Component
from langflow.io import DataInput, DropdownInput, Output
from langflow.schema import Data


# Fields the agent is explicitly forbidden from receiving (spec §7)
_AGENT_BLACKLIST = frozenset(
    [
        "child_name",
        "audio_recording",
        "chat_history",
        "api_key",
        "internet_access",
        "vector_db_access",
        "run_code",
        "_gateway_ms",
        "_engine_ms",
        "_catalog_ms",
        "_guard_ms",
        "_serializer_ms",
    ]
)

# Agent rules injected verbatim (spec §10)
AGENT_RULES = [
    "You are a teaching planner, not a calculator and not a diagnostic tool.",
    "Treat problem and correct_answer as immutable facts you cannot change.",
    "Build a hypothesis only from evidence in the current attempt.",
    "If evidence is insufficient use hypothesis_code=UNKNOWN and a general strategy.",
    "Choose exactly one strategy from the strategy_candidates list provided.",
    "Use only actions from the chosen strategy's allowed_actions that are also in supported_actions.",
    "Maximum 12 steps; one primary instruction per step.",
    "End the support plan with exactly one guided question.",
    "Never request voice input as the only available option.",
    "Never use diagnostic labels or shaming language.",
    "Output Structured Response only — no additional prose.",
]


class SupportContextBuilder(Component):
    display_name = "Support Context Builder"
    description = (
        "Assembles teaching context for the Planning Agent. "
        "Mode=SUPPORT for first attempt; Mode=REPAIR to include draft + validation errors."
    )
    icon = "wrench"

    inputs = [
        DropdownInput(
            name="mode",
            display_name="Mode",
            options=["SUPPORT", "REPAIR"],
            value="SUPPORT",
            info="SUPPORT=first agent call; REPAIR=include failed draft and error codes.",
        ),
        DataInput(
            name="request_data",
            display_name="Request Data",
            info="Clean request from Gateway.",
        ),
        DataInput(
            name="catalog_data",
            display_name="Strategy Catalog Output",
            info="Allowed strategies from TeachingStrategyCatalog node.",
        ),
        DataInput(
            name="failed_plan_data",
            display_name="Failed Plan Data (REPAIR only)",
            info="Plan Guard invalid output containing draft + error codes.",
            required=False,
        ),
    ]

    outputs = [
        Output(display_name="Agent Context", name="context_out", method="build_context"),
    ]

    # ------------------------------------------------------------------ #
    #  Helpers                                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _clean(d: dict) -> dict:
        """Remove blacklisted keys from a copy of d."""
        return {k: v for k, v in d.items() if k not in _AGENT_BLACKLIST}

    # ------------------------------------------------------------------ #
    #  Main build method                                                   #
    # ------------------------------------------------------------------ #

    def build_context(self) -> Data:
        t_start = time.monotonic()
        req = self._clean(dict(self.request_data.data) if self.request_data else {})
        catalog = dict(self.catalog_data.data) if self.catalog_data else {}
        mode = self.mode

        # Fields agent is allowed to receive (spec §7)
        agent_context: dict = {
            "concept": req.get("concept"),
            "operation": req.get("operation"),
            "operand_a": req.get("operand_a"),
            "operand_b": req.get("operand_b"),
            "correct_answer": req.get("correct_answer"),
            "student_answer": req.get("student_answer"),
            "confirmed_reasoning": req.get("confirmed_reasoning"),
            "attempt_number": req.get("attempt_number", 1),
            "support_level": req.get("support_level", 1),
            "supported_actions": req.get("supported_actions", []),
            "recent_observations": req.get("recent_observations", []),
            # Strategy candidates from catalog
            "strategy_candidates": catalog.get("allowed_strategies", []),
            # Pedagogy rules
            "rules": AGENT_RULES,
        }

        if mode == "REPAIR":
            failed = dict(self.failed_plan_data.data) if self.failed_plan_data else {}
            agent_context["repair_context"] = {
                "failed_draft": failed.get("draft_plan"),
                "validation_errors": failed.get("validation_errors", []),
                "repair_count": failed.get("repair_count", 1),
                "instruction": (
                    "Fix ONLY the issues listed in validation_errors. "
                    "Do not change problem, operands, or correct_answer. "
                    "Do not change hypothesis_code unless the error explicitly states it is unsupported."
                ),
            }

        agent_context["_context_mode"] = mode
        agent_context["_context_ms"] = round((time.monotonic() - t_start) * 1000, 2)

        self.log(
            f"[ContextBuilder] mode={mode} concept={agent_context.get('concept')} "
            f"strategies={len(agent_context['strategy_candidates'])} ms={agent_context['_context_ms']}"
        )
        return Data(data=agent_context)
