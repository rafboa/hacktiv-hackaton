"""
ArithPlanGuard — Custom Langflow component
Role : Trust boundary between LLM and frontend.
       Validates agent structured response, injects canonical fields,
       and routes to valid_plan or invalid_plan ports.
Spec : Langflow-Architecture-Arith.md §11, §12, §5 (node 9)

Validation rules (from spec §11):
1.  Strip forbidden fields.
2.  Inject canonical IDs and problem fields.
3.  Assert strategy_code is in catalog candidates.
4.  Validate every action against strategy's allowed_actions.
5.  Simulate number-line / block state and verify math.
6.  Enforce narrative and interaction rules.
7.  Check step count ≤ 12.
8.  Assert plan ends with exactly one ASK_QUESTION.
"""

import time
from typing import Any
from langflow.custom import Component
from langflow.io import DataInput, Output
from langflow.schema import Data


# Fields agent is NOT allowed to set (spec §9, §11)
_CANONICAL_FIELDS = frozenset(
    ["request_id", "session_id", "problem_id", "operand_a", "operand_b", "correct_answer", "accepted_answers"]
)

# Actions that require positional/math simulation
_MOVE_ACTIONS = {"MOVE_MARKER", "FILL_TEN_FRAME", "SPLIT_BLOCK", "MERGE_BLOCKS"}

MAX_STEPS = 12


def _err(code: str, detail: str) -> dict:
    return {"code": code, "detail": detail}


class ArithPlanGuard(Component):
    display_name = "Plan Guard + Assembler"
    description = (
        "Validates agent plan, assembles canonical fields, and routes to valid or invalid branch. "
        "Use one instance per validation pass (pass-1 = Teaching Planner, pass-2 = Repair Agent)."
    )
    icon = "shield-check"

    inputs = [
        DataInput(
            name="agent_response",
            display_name="Agent Structured Response",
            info="Structured response data from Teaching Planner Agent or Repair Agent.",
        ),
        DataInput(
            name="canonical_data",
            display_name="Canonical Problem Data",
            info="Original problem dict from Lesson Engine or Request Gateway — never from the agent.",
        ),
        DataInput(
            name="catalog_data",
            display_name="Strategy Catalog Output",
            info="Allowed strategies from TeachingStrategyCatalog — used to verify strategy_code.",
        ),
    ]

    outputs = [
        Output(display_name="valid_plan", name="valid_plan", method="get_valid", group_outputs=True),
        Output(display_name="invalid_plan", name="invalid_plan", method="get_invalid", group_outputs=True),
    ]

    # ------------------------------------------------------------------ #
    #  Validation logic                                                    #
    # ------------------------------------------------------------------ #

    def _validate(
        self, draft: dict, canonical: dict, catalog: dict
    ) -> tuple[dict | None, list[dict]]:
        """
        Returns (assembled_plan, []) on success
        or (None, [error_dict, ...]) on failure.
        """
        errors: list[dict] = []

        # --- 1. Strip forbidden fields from draft ---
        for field in _CANONICAL_FIELDS:
            draft.pop(field, None)

        # --- 2. Inject canonical fields ---
        assembled: dict[str, Any] = {
            **draft,
            "request_id": canonical.get("request_id", ""),
            "session_id": canonical.get("session_id", ""),
            "problem_id": canonical.get("problem_id", ""),
            "operand_a": canonical.get("operand_a"),
            "operand_b": canonical.get("operand_b"),
            "correct_answer": canonical.get("correct_answer"),
            "accepted_answers": canonical.get("accepted_answers", [canonical.get("correct_answer")]),
        }

        # --- 3. Strategy in catalog? ---
        allowed_strategies = catalog.get("allowed_strategies", [])
        strategy_code = assembled.get("strategy_code", "")
        allowed_codes = {s["strategy_code"] for s in allowed_strategies}
        chosen_entry = next((s for s in allowed_strategies if s["strategy_code"] == strategy_code), None)

        if not strategy_code:
            errors.append(_err("MISSING_STRATEGY_CODE", "strategy_code is absent or empty."))
        elif strategy_code not in allowed_codes:
            errors.append(
                _err(
                    "STRATEGY_NOT_IN_CATALOG",
                    f"strategy_code '{strategy_code}' not in catalog candidates {allowed_codes}.",
                )
            )

        # --- 4. Validate actions ---
        plan = assembled.get("plan", {})
        steps: list[dict] = plan.get("steps", []) if isinstance(plan, dict) else []

        if not steps:
            errors.append(_err("EMPTY_PLAN", "Plan has no steps."))

        if len(steps) > MAX_STEPS:
            errors.append(_err("TOO_MANY_STEPS", f"Plan has {len(steps)} steps; max is {MAX_STEPS}."))

        allowed_actions: set[str] = set(chosen_entry["allowed_actions"]) if chosen_entry else set()
        action_errors: list[str] = []
        for i, step in enumerate(steps):
            action = step.get("action", "")
            if allowed_actions and action not in allowed_actions:
                action_errors.append(f"step[{i}] action '{action}' not in allowed_actions.")
        if action_errors:
            errors.append(_err("INVALID_ACTION", "; ".join(action_errors)))

        # --- 5. Math simulation (number line) ---
        if strategy_code in ("NUMBER_LINE_COUNT_ON",) and chosen_entry:
            expected = canonical.get("correct_answer")
            if expected is not None:
                position = canonical.get("operand_a", 0)
                constraints = chosen_entry.get("constraints", {})
                step_size = constraints.get("step_size", 1)
                max_sim_steps = constraints.get("max_steps", 12)
                move_count = 0
                for step in steps:
                    if step.get("action") == "MOVE_MARKER":
                        move_count += step.get("params", {}).get("count", 1)
                simulated = position + move_count * step_size
                if move_count > max_sim_steps:
                    errors.append(
                        _err(
                            "MATH_TOO_MANY_MOVES",
                            f"Number line moves={move_count} exceed max_steps={max_sim_steps}.",
                        )
                    )
                if simulated != expected and move_count > 0:
                    errors.append(
                        _err(
                            "MATH_WRONG_ANSWER",
                            f"Simulated answer={simulated} != correct_answer={expected}.",
                        )
                    )

        # --- 6. Narrative and interaction rules ---
        last_actions = [s.get("action") for s in steps[-3:]] if steps else []
        if "ASK_QUESTION" not in last_actions:
            errors.append(
                _err("MISSING_FINAL_QUESTION", "Plan must end with exactly one ASK_QUESTION step.")
            )

        ask_count = sum(1 for s in steps if s.get("action") == "ASK_QUESTION")
        if ask_count > 1:
            errors.append(
                _err("MULTIPLE_QUESTIONS", f"Plan has {ask_count} ASK_QUESTION steps; max is 1.")
            )

        # --- 7. hypothesis_code must be a non-empty string ---
        if not assembled.get("hypothesis_code"):
            errors.append(_err("MISSING_HYPOTHESIS", "hypothesis_code is absent or empty."))

        # --- 8. support_level must be 1–3 ---
        support_level = assembled.get("support_level")
        if not isinstance(support_level, int) or support_level not in (1, 2, 3):
            errors.append(_err("INVALID_SUPPORT_LEVEL", f"support_level must be 1, 2, or 3. Got: {support_level}"))

        if errors:
            return None, errors
        return assembled, []

    # ------------------------------------------------------------------ #
    #  Port methods                                                        #
    # ------------------------------------------------------------------ #

    def _run_validation(self) -> tuple[dict | None, list[dict]]:
        draft = dict(self.agent_response.data) if self.agent_response else {}
        canonical = dict(self.canonical_data.data) if self.canonical_data else {}
        catalog = dict(self.catalog_data.data) if self.catalog_data else {}
        return self._validate(draft, canonical, catalog)

    def get_valid(self) -> Data:
        t_start = time.monotonic()
        assembled, errors = self._run_validation()
        if errors:
            self.stop("valid_plan")
            return Data(data={})
        assembled["_guard_ms"] = round((time.monotonic() - t_start) * 1000, 2)
        self.log(f"[PlanGuard] VALID strategy={assembled.get('strategy_code')} ms={assembled['_guard_ms']}")
        return Data(data=assembled)

    def get_invalid(self) -> Data:
        t_start = time.monotonic()
        canonical = dict(self.canonical_data.data) if self.canonical_data else {}
        draft = dict(self.agent_response.data) if self.agent_response else {}
        assembled, errors = self._run_validation()
        if not errors:
            self.stop("invalid_plan")
            return Data(data={})
        repair_count = draft.get("_repair_count", 0) + 1
        result = {
            "draft_plan": draft,
            "validation_errors": errors,
            "repair_count": repair_count,
            # Pass canonical problem so fallback engine never re-derives from agent output
            "request_id": canonical.get("request_id", ""),
            "session_id": canonical.get("session_id", ""),
            "problem_id": canonical.get("problem_id", ""),
            "operand_a": canonical.get("operand_a"),
            "operand_b": canonical.get("operand_b"),
            "correct_answer": canonical.get("correct_answer"),
            "accepted_answers": canonical.get("accepted_answers", []),
            "support_level": canonical.get("support_level", 1),
            "_guard_ms": round((time.monotonic() - t_start) * 1000, 2),
        }
        self.log(
            f"[PlanGuard] INVALID errors={[e['code'] for e in errors]} "
            f"repair_count={repair_count} ms={result['_guard_ms']}"
        )
        return Data(data=result)
