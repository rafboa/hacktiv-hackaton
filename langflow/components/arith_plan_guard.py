"""
ArithPlanGuard — Custom Langflow component
Role : Trust boundary between LLM and frontend.
       Validates agent structured response, injects canonical fields,
       and routes to valid_plan or invalid_plan ports.
Spec : contracts/arith-json-contract-v1.md §15, §16

Validation rules (contract §15):
  Structure : schema_version, required fields, plan_version, ≤12 steps, unique step_id, known actions
  Math       : correct_answer matches operation, destination MOVE_MARKER, GROUP_TO_TEN=10,
               object counts 0–20, accepted_answers from evaluator
  Interaction: exactly one terminal action last, no ASK_QUESTION/ASK_REASONING mid-plan
  Language   : narration ≤140 chars, no diagnostic labels, no HTML/URL/script

Two validation modes:
  AI_PLAN   — validates agent-generated SUPPORT_PLAN (checks strategy, hypothesis, etc.)
  PROBLEM   — validates deterministic PROBLEM_PLAN / TRANSFER_PLAN (checks problem fields only)
"""

import re
import time
from typing import Any
from langflow.custom import Component
from langflow.io import DataInput, DropdownInput, Output
from langflow.schema import Data


# ── Contract constants ──────────────────────────────────────────────────────

# Actions defined in contract §14
_V1_ACTIONS = frozenset(
    [
        "CLEAR_STAGE",
        "SHOW_TEXT",
        "SPEAK",
        "SHOW_OBJECTS",
        "ADD_OBJECTS",
        "REMOVE_OBJECTS",
        "MOVE_OBJECTS",
        "GROUP_TO_TEN",
        "SHOW_NUMBER_LINE",
        "PLACE_MARKER",
        "MOVE_MARKER",
        "SHOW_EQUATION",
        "HIGHLIGHT",
        "ASK_QUESTION",
        "ASK_REASONING",
        "SHOW_FEEDBACK",
    ]
)

_TERMINAL_ACTIONS = frozenset(["ASK_QUESTION", "ASK_REASONING"])
_MAX_STEPS = 12
_MAX_NARRATION_CHARS = 140

# Diagnostic/shaming language patterns (contract §15 language rules)
_FORBIDDEN_PATTERNS = [
    re.compile(r"<[a-zA-Z]", re.I),          # HTML tags
    re.compile(r"javascript\s*:", re.I),       # JS
    re.compile(r"https?://", re.I),            # URLs
    re.compile(r"\b(autis|difabel|lambat|bodoh|cacat|diagnosis)\b", re.I),  # labels
]

# Fields agent is NOT allowed to override
_CANONICAL_FIELDS = frozenset(
    [
        "request_id", "session_id", "problem_id",
        "operand_a", "operand_b", "correct_answer", "accepted_answers",
    ]
)


def _err(code: str, detail: str) -> dict:
    return {"code": code, "detail": detail}


class ArithPlanGuard(Component):
    display_name = "Plan Guard + Assembler"
    description = (
        "Validates plan, assembles canonical fields, and routes to valid or invalid branch. "
        "Set Validation Mode to AI_PLAN for agent plans, PROBLEM for deterministic plans."
    )
    icon = "shield-check"

    inputs = [
        DropdownInput(
            name="validation_mode",
            display_name="Validation Mode",
            options=["AI_PLAN", "PROBLEM"],
            value="AI_PLAN",
            info=(
                "AI_PLAN: validate agent SUPPORT_PLAN (strategy, hypothesis, actions, math). "
                "PROBLEM: validate deterministic PROBLEM/TRANSFER plan (fields, math, plan structure only)."
            ),
        ),
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
            info="Allowed strategies from TeachingStrategyCatalog — used only in AI_PLAN mode.",
            required=False,
        ),
    ]

    outputs = [
        Output(display_name="valid_plan", name="valid_plan", method="get_valid", group_outputs=True),
        Output(display_name="invalid_plan", name="invalid_plan", method="get_invalid", group_outputs=True),
    ]

    # ------------------------------------------------------------------ #
    #  Validation entry point                                              #
    # ------------------------------------------------------------------ #

    def _validate(
        self, draft: dict, canonical: dict, catalog: dict
    ) -> "tuple[dict | None, list[dict]]":
        if self.validation_mode == "PROBLEM":
            return self._validate_deterministic(draft, canonical)
        else:
            return self._validate_ai_plan(draft, canonical, catalog)

    # ------------------------------------------------------------------ #
    #  PROBLEM mode — deterministic plan validation                        #
    # ------------------------------------------------------------------ #

    def _validate_deterministic(
        self, draft: dict, canonical: dict
    ) -> "tuple[dict | None, list[dict]]":
        """Validate a deterministic PROBLEM_PLAN or TRANSFER_PLAN.

        Only checks problem fields, plan structure, math, and interaction rules.
        Does not require strategy_code or hypothesis_code (those are AI-only).
        """
        errors: list[dict] = []

        # Assemble — canonical fields always win
        assembled: dict[str, Any] = {
            **draft,
            "request_id": canonical.get("request_id", ""),
            "session_id": canonical.get("session_id", ""),
            "problem_id": canonical.get("problem_id", draft.get("problem_id", "")),
            "operand_a": canonical.get("operand_a", draft.get("operand_a")),
            "operand_b": canonical.get("operand_b", draft.get("operand_b")),
            "correct_answer": canonical.get("correct_answer", draft.get("correct_answer")),
            "accepted_answers": canonical.get(
                "accepted_answers",
                draft.get("accepted_answers", [canonical.get("correct_answer")])
            ),
        }

        # Problem field checks
        a = assembled.get("operand_a")
        b = assembled.get("operand_b")
        answer = assembled.get("correct_answer")

        if a is None or b is None:
            errors.append(_err("MISSING_OPERANDS", "operand_a and operand_b are required."))
        if answer is None:
            errors.append(_err("MISSING_ANSWER", "correct_answer is required."))
        elif a is not None and b is not None and answer != a + b:
            errors.append(
                _err("WRONG_ANSWER", f"correct_answer={answer} != {a}+{b}={a+b}.")
            )
        if answer is not None and not (0 <= answer <= 20):
            errors.append(_err("ANSWER_OUT_OF_RANGE", f"correct_answer={answer} must be 0–20."))

        # Plan structure checks (shared)
        plan_errors = _validate_plan_structure(
            assembled.get("plan", {}),
            assembled,
            supported_actions=set(canonical.get("supported_actions", [])) or None,
        )
        errors.extend(plan_errors)
        errors.extend(_check_narration(assembled.get("plan", {})))

        if errors:
            return None, errors
        return assembled, []

    # ------------------------------------------------------------------ #
    #  AI_PLAN mode — agent plan validation                                #
    # ------------------------------------------------------------------ #

    def _validate_ai_plan(
        self, draft: dict, canonical: dict, catalog: dict
    ) -> "tuple[dict | None, list[dict]]":
        """Validate an agent-generated SUPPORT_PLAN.

        Checks everything in PROBLEM mode plus strategy, hypothesis, support_level,
        allowed actions per strategy, and narration safety.
        """
        errors: list[dict] = []

        # 1. Strip and inject canonical fields
        for field in _CANONICAL_FIELDS:
            draft.pop(field, None)

        assembled: dict[str, Any] = {
            **draft,
            "request_id": canonical.get("request_id", ""),
            "session_id": canonical.get("session_id", ""),
            "demo_mode": canonical.get("demo_mode"),
            "problem_id": canonical.get("problem_id", ""),
            "operand_a": canonical.get("operand_a"),
            "operand_b": canonical.get("operand_b"),
            "correct_answer": canonical.get("correct_answer"),
            "accepted_answers": canonical.get(
                "accepted_answers", [canonical.get("correct_answer")]
            ),
        }

        # 2. Math checks
        a = assembled.get("operand_a")
        b = assembled.get("operand_b")
        answer = assembled.get("correct_answer")
        if a is not None and b is not None and answer is not None and answer != a + b:
            errors.append(_err("WRONG_ANSWER", f"correct_answer={answer} != {a}+{b}={a+b}."))
        if answer is not None and not (0 <= answer <= 20):
            errors.append(_err("ANSWER_OUT_OF_RANGE", f"correct_answer={answer} must be 0–20."))

        # 3. strategy_code in catalog
        allowed_strategies = catalog.get("allowed_strategies", [])
        strategy_code = assembled.get("strategy_code", "")
        allowed_codes = {s["strategy_code"] for s in allowed_strategies}
        chosen_entry = next(
            (s for s in allowed_strategies if s["strategy_code"] == strategy_code), None
        )

        if not strategy_code:
            errors.append(_err("MISSING_STRATEGY_CODE", "strategy_code is absent or empty."))
        elif strategy_code not in allowed_codes:
            errors.append(
                _err(
                    "STRATEGY_NOT_IN_CATALOG",
                    f"strategy_code '{strategy_code}' not in catalog {allowed_codes}.",
                )
            )

        # 4. hypothesis_code
        if not assembled.get("hypothesis_code"):
            errors.append(_err("MISSING_HYPOTHESIS", "hypothesis_code is absent or empty."))

        # 5. support_level 1–3
        support_level = assembled.get("support_level")
        if not isinstance(support_level, int) or support_level not in (1, 2, 3):
            errors.append(
                _err("INVALID_SUPPORT_LEVEL", f"support_level must be 1–3; got: {support_level}")
            )

        # 6. Plan structure, including allowed actions per strategy
        plan_errors = _validate_plan_structure(
            assembled.get("plan", {}), assembled,
            allowed_actions=set(chosen_entry["allowed_actions"]) if chosen_entry else None,
            supported_actions=set(canonical.get("supported_actions", [])) or None,
        )
        errors.extend(plan_errors)

        # 7. Number-line math simulation for NUMBER_LINE_COUNT_ON
        if strategy_code == "NUMBER_LINE_COUNT_ON" and chosen_entry and not errors:
            sim_errors = _simulate_number_line(
                assembled.get("plan", {}), canonical, chosen_entry.get("constraints", {})
            )
            errors.extend(sim_errors)

        # 8. Narration safety
        narration_errors = _check_narration(assembled.get("plan", {}))
        errors.extend(narration_errors)
        errors.extend(_check_learning_state_patch(assembled.get("learning_state_patch")))

        if errors:
            return None, errors
        return assembled, []

    # ------------------------------------------------------------------ #
    #  Port methods                                                        #
    # ------------------------------------------------------------------ #

    def _run_validation(self) -> "tuple[dict | None, list[dict]]":
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
        self.log(
            f"[PlanGuard:{self.validation_mode}] VALID "
            f"strategy={assembled.get('strategy_code', 'n/a')} ms={assembled['_guard_ms']}"
        )
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
            "request_id": canonical.get("request_id", ""),
            "session_id": canonical.get("session_id", ""),
            "demo_mode": canonical.get("demo_mode"),
            "supported_actions": canonical.get("supported_actions", []),
            "problem_id": canonical.get("problem_id", ""),
            "operand_a": canonical.get("operand_a"),
            "operand_b": canonical.get("operand_b"),
            "correct_answer": canonical.get("correct_answer"),
            "accepted_answers": canonical.get("accepted_answers", []),
            "support_level": canonical.get("support_level", 1),
            "_guard_ms": round((time.monotonic() - t_start) * 1000, 2),
        }
        self.log(
            f"[PlanGuard:{self.validation_mode}] INVALID "
            f"errors={[e['code'] for e in errors]} repair_count={repair_count} ms={result['_guard_ms']}"
        )
        return Data(data=result)


# ── Shared plan validation helpers ─────────────────────────────────────────

def _validate_plan_structure(
    plan: Any,
    assembled: dict,
    allowed_actions: set | None = None,
    supported_actions: set | None = None,
) -> list[dict]:
    """Shared plan structure checks (contract §15 Structure + Interaction)."""
    errors: list[dict] = []

    if not isinstance(plan, dict):
        errors.append(_err("INVALID_PLAN", "plan must be a dict."))
        return errors

    steps: list[dict] = plan.get("steps", [])
    if not isinstance(steps, list) or not steps:
        errors.append(_err("EMPTY_PLAN", "Plan has no steps."))
        return errors

    if len(steps) > _MAX_STEPS:
        errors.append(_err("TOO_MANY_STEPS", f"Plan has {len(steps)} steps; max is {_MAX_STEPS}."))

    # Unique step_id — blank step_id is also invalid
    step_ids = [s.get("step_id") for s in steps if isinstance(s, dict)]
    non_empty_ids = [sid for sid in step_ids if sid]
    if len(non_empty_ids) < len(step_ids):
        errors.append(_err("EMPTY_STEP_ID", "All steps must have a non-empty step_id."))
    if len(step_ids) != len(set(step_ids)):
        errors.append(_err("DUPLICATE_STEP_IDS", "step_id values must be unique within a plan."))

    # plan_version
    if plan.get("plan_version") != 1:
        errors.append(_err("UNSUPPORTED_PLAN_VERSION",
                           f"plan_version must be 1; got {plan.get('plan_version')}."))

    # Track marker position across steps for MOVE_MARKER destination validation.
    # marker_positions: marker_id → current value (set by PLACE_MARKER, updated by MOVE_MARKER)
    marker_positions: dict[str, int] = {}

    # Action validation
    terminal_indices: list[int] = []
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            errors.append(_err("INVALID_STEP", f"step[{i}] is not an object."))
            continue

        action = step.get("action", "")
        params = step.get("params", {}) if isinstance(step.get("params"), dict) else {}

        # Unknown action
        if action not in _V1_ACTIONS:
            errors.append(_err("UNKNOWN_ACTION", f"step[{i}] action '{action}' is not a v1 action."))
            continue

        # Not in strategy's allowed_actions
        if allowed_actions is not None and action not in allowed_actions:
            errors.append(
                _err("ACTION_NOT_IN_STRATEGY",
                     f"step[{i}] action '{action}' not allowed by strategy.")
            )

        # Not in client_capabilities.supported_actions
        if supported_actions is not None and action not in supported_actions:
            errors.append(
                _err("ACTION_NOT_SUPPORTED",
                     f"step[{i}] action '{action}' not in client_capabilities.supported_actions.")
            )

        if action in _TERMINAL_ACTIONS:
            terminal_indices.append(i)

        # Track marker state for position-aware validation
        if action == "PLACE_MARKER":
            mid = params.get("marker_id", "")
            val = params.get("value")
            if isinstance(val, (int, float)) and mid:
                marker_positions[mid] = int(val)
        elif action == "MOVE_MARKER":
            mid = params.get("marker_id", "")
            # Use tracked position if available, else fall back to operand_a
            current_pos = marker_positions.get(mid, assembled.get("operand_a", 0))
            move_errors = _check_move_marker(i, params, current_pos)
            errors.extend(move_errors)
            # Update tracked position with new destination if check passed
            destination = params.get("destination")
            if isinstance(destination, int) and not move_errors:
                marker_positions[mid] = destination
            continue  # skip _check_action_params for MOVE_MARKER (already handled above)

        # Validate required params per action (excluding MOVE_MARKER handled above)
        param_errors = _check_action_params(i, action, params, assembled)
        errors.extend(param_errors)

    # Terminal action must be last and there must be exactly one
    if not terminal_indices:
        errors.append(_err("MISSING_TERMINAL_ACTION",
                           "Plan must end with exactly one ASK_QUESTION or ASK_REASONING."))
    elif len(terminal_indices) > 1:
        errors.append(_err("MULTIPLE_TERMINAL_ACTIONS",
                           f"Plan has {len(terminal_indices)} terminal actions; max is 1."))
    elif terminal_indices[0] != len(steps) - 1:
        errors.append(_err("TERMINAL_NOT_LAST",
                           f"Terminal action is at step[{terminal_indices[0]}], must be last (step[{len(steps)-1}])."))

    return errors


def _check_move_marker(i: int, params: dict, current_pos: int) -> list[dict]:
    """Validate MOVE_MARKER params using the caller-supplied current marker position."""
    errors: list[dict] = []
    for f in ("line_id", "marker_id", "direction", "step_size", "steps", "destination", "show_each_jump"):
        if f not in params:
            errors.append(_err("MISSING_PARAM",
                               f"step[{i}] action 'MOVE_MARKER' missing required param '{f}'."))
    direction = params.get("direction", "FORWARD")
    step_size = params.get("step_size", 1)
    n_steps = params.get("steps", 0)
    destination = params.get("destination")
    if isinstance(destination, int) and isinstance(n_steps, int) and isinstance(step_size, int):
        delta = n_steps * step_size
        expected = current_pos + (delta if direction == "FORWARD" else -delta)
        if expected != destination:
            errors.append(
                _err("MOVE_MARKER_DESTINATION_WRONG",
                     f"step[{i}] MOVE_MARKER: pos={current_pos} dir={direction} "
                     f"step_size={step_size} steps={n_steps} → expected {expected}, got {destination}.")
            )
    return errors


def _check_action_params(i: int, action: str, params: dict, assembled: dict) -> list[dict]:
    """Check required parameters for each action type (contract §14)."""
    errors: list[dict] = []

    def req(field: str) -> None:
        if field not in params:
            errors.append(_err("MISSING_PARAM",
                               f"step[{i}] action '{action}' missing required param '{field}'."))

    if action == "CLEAR_STAGE":
        req("targets")

    elif action in ("SHOW_TEXT", "SPEAK"):
        req("text")
        text = params.get("text", "")
        if isinstance(text, str) and len(text) > _MAX_NARRATION_CHARS:
            errors.append(_err("TEXT_TOO_LONG",
                               f"step[{i}] action '{action}' text exceeds {_MAX_NARRATION_CHARS} chars."))

    elif action in ("SHOW_OBJECTS", "ADD_OBJECTS"):
        for f in ("group_id", "count", "appearance"):
            req(f)
        count = params.get("count", 0)
        if not isinstance(count, int) or not (0 <= count <= 20):
            errors.append(_err("COUNT_OUT_OF_RANGE",
                               f"step[{i}] action '{action}' count={count} must be 0–20."))

    elif action == "REMOVE_OBJECTS":
        for f in ("group_id", "count"):
            req(f)

    elif action in ("MOVE_OBJECTS",):
        for f in ("from_group", "to_group", "count"):
            req(f)

    elif action == "GROUP_TO_TEN":
        for f in ("source_group", "target_group", "count"):
            req(f)

    elif action == "SHOW_NUMBER_LINE":
        for f in ("line_id", "min", "max"):
            req(f)

    elif action == "PLACE_MARKER":
        for f in ("line_id", "marker_id", "value"):
            req(f)
        value = params.get("value")
        line_min = params.get("min", 0)
        line_max = params.get("max", 20)
        if isinstance(value, (int, float)) and not (line_min <= value <= line_max):
            errors.append(_err("MARKER_OUT_OF_RANGE",
                               f"step[{i}] PLACE_MARKER value={value} outside line [{line_min},{line_max}]."))

    elif action == "SHOW_EQUATION":
        for f in ("expression", "emphasis"):
            req(f)

    elif action == "HIGHLIGHT":
        for f in ("target_id", "style"):
            req(f)

    elif action == "ASK_QUESTION":
        for f in ("question_id", "prompt", "answer_type", "accepted_answers", "answer_range", "allowed_input_modes"):
            req(f)

    elif action == "ASK_REASONING":
        for f in ("question_id", "prompt", "options", "allow_voice", "allow_skip"):
            req(f)
        # Must not force voice-only input
        if params.get("allow_voice") and not params.get("allow_skip") and not params.get("options"):
            errors.append(_err("VOICE_ONLY_INPUT",
                               f"step[{i}] ASK_REASONING must provide non-voice alternative."))

    elif action == "SHOW_FEEDBACK":
        for f in ("feedback_type", "text"):
            req(f)
        ft = params.get("feedback_type", "")
        if ft not in ("POSITIVE", "NEUTRAL", "SUPPORTIVE"):
            errors.append(_err("INVALID_FEEDBACK_TYPE",
                               f"step[{i}] SHOW_FEEDBACK feedback_type='{ft}' must be POSITIVE|NEUTRAL|SUPPORTIVE."))

    return errors


def _simulate_number_line(plan: dict, canonical: dict, constraints: dict) -> list[dict]:
    """Simulate MOVE_MARKER steps and verify final position matches correct_answer."""
    errors: list[dict] = []
    steps = plan.get("steps", [])
    position = canonical.get("operand_a", 0)
    expected = canonical.get("correct_answer")
    max_steps = constraints.get("max_steps", 12)
    step_size = constraints.get("step_size", 1)
    total_moves = 0

    for step in steps:
        if step.get("action") == "MOVE_MARKER":
            p = step.get("params", {})
            n = int(p.get("steps", 1))
            direction = p.get("direction", "FORWARD")
            total_moves += n
            if direction == "FORWARD":
                position += n * step_size
            else:
                position -= n * step_size

    if total_moves > max_steps:
        errors.append(_err("MATH_TOO_MANY_MOVES",
                           f"Number line total moves={total_moves} exceeds max_steps={max_steps}."))
    if total_moves > 0 and expected is not None and position != expected:
        errors.append(_err("MATH_WRONG_ANSWER",
                           f"Number line simulation ended at {position}, expected {expected}."))
    return errors


def _check_narration(plan: dict) -> list[dict]:
    """Validate narration text (contract §15 language rules)."""
    errors: list[dict] = []
    steps = plan.get("steps", [])
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            continue
        narration = step.get("narration")
        if not isinstance(narration, dict):
            continue
        text = narration.get("text", "")
        if not isinstance(text, str):
            continue
        if len(text) > _MAX_NARRATION_CHARS:
            errors.append(_err("NARRATION_TOO_LONG",
                               f"step[{i}] narration.text exceeds {_MAX_NARRATION_CHARS} chars."))
        for pattern in _FORBIDDEN_PATTERNS:
            if pattern.search(text):
                errors.append(_err("FORBIDDEN_CONTENT",
                                   f"step[{i}] narration contains forbidden content matching {pattern.pattern}."))
                break
    return errors


def _check_learning_state_patch(patch: Any) -> list[dict]:
    errors: list[dict] = []
    if not isinstance(patch, dict):
        return [_err("INVALID_LEARNING_STATE_PATCH", "learning_state_patch must be an object.")]

    allowed_keys = {"support_level", "observations_to_append", "effective_visuals_to_add"}
    extra_keys = set(patch) - allowed_keys
    if extra_keys:
        errors.append(_err(
            "INVALID_LEARNING_STATE_PATCH",
            f"learning_state_patch contains unsupported keys: {sorted(extra_keys)}.",
        ))

    support_level = patch.get("support_level")
    if not isinstance(support_level, int) or support_level not in (0, 1, 2, 3):
        errors.append(_err(
            "INVALID_LEARNING_STATE_PATCH",
            "learning_state_patch.support_level must be an integer from 0 to 3.",
        ))

    observations = patch.get("observations_to_append")
    if not isinstance(observations, list) or any(
        not isinstance(item, dict) or not isinstance(item.get("code"), str) or
        not isinstance(item.get("scope"), str)
        for item in observations
    ):
        errors.append(_err(
            "INVALID_LEARNING_STATE_PATCH",
            "learning_state_patch.observations_to_append must contain code/scope objects.",
        ))

    visuals = patch.get("effective_visuals_to_add")
    if not isinstance(visuals, list) or any(not isinstance(item, str) for item in visuals):
        errors.append(_err(
            "INVALID_LEARNING_STATE_PATCH",
            "learning_state_patch.effective_visuals_to_add must be a string array.",
        ))
    return errors
