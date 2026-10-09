"""
ArithLessonEngine — Custom Langflow component
Role : Generate problem, answer, and initial/transfer/fallback plan deterministically.
Spec : contracts/arith-json-contract-v1.md §6, §8, §11, §14, §16

Three canvas instances:
  - mode INITIAL   → PROBLEM_REQUESTED branch
  - mode TRANSFER  → TRANSFER_REQUESTED branch
  - mode FALLBACK  → fallback branch from Plan Guard
"""

import random
import time
import uuid
from langflow.custom import Component
from langflow.io import DataInput, DropdownInput, Output
from langflow.schema import Data


# ---------------------------------------------------------------------------
# P0 demo seeds (contract §6, §8)
# INITIAL  → always 8 + 5  (seed mode demo)
# TRANSFER → always 9 + 4  (contract §8)
# ---------------------------------------------------------------------------
DEMO_INITIAL = (8, 5)
DEMO_TRANSFER = (9, 4)
DEMO_SCENARIO_ID = "DEMO_CROSSING_TEN_V1"

CONCEPT = "ADDITION_CROSSING_TEN"
OPERATION = "ADDITION"

# Stable IDs for demo seeds (contract §17 — same request_id → same result)
_DEMO_INITIAL_PROBLEM_ID = "problem_demo_8_plus_5"
_DEMO_TRANSFER_PROBLEM_ID = "problem_demo_9_plus_4"


# ---------------------------------------------------------------------------
# Stable plan IDs for demo seeds (contract §17 idempotency)
# Random IDs are used in non-demo mode.
# ---------------------------------------------------------------------------

_DEMO_INITIAL_PLAN_ID = "plan_initial_demo_8_plus_5"
_DEMO_TRANSFER_PLAN_ID = "plan_transfer_demo_9_plus_4"
_DEMO_FALLBACK_PLAN_IDS = {
    1: "plan_fallback_demo_L1",
    2: "plan_fallback_demo_L2",
    3: "plan_fallback_demo_L3",
}


def _plan_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Step builders — produce v1 step objects (contract §11, §14)
# ---------------------------------------------------------------------------

def _step(step_id: str, action: str, params: dict,
          narration_text: str | None = None,
          auto_play: bool = True,
          completion: str = "ANIMATION_AND_NARRATION") -> dict:
    step: dict = {
        "step_id": step_id,
        "action": action,
        "params": params,
        "narration": (
            {"text": narration_text, "auto_play": auto_play, "can_repeat": True}
            if narration_text else None
        ),
        "completion": completion,
    }
    return step


# ---------------------------------------------------------------------------
# Deterministic plan builders
# ---------------------------------------------------------------------------

def _initial_plan(a: int, b: int, problem_id: str, demo: bool = False) -> dict:
    """Plan v1 for presenting a new problem (purpose=PRESENT_PROBLEM, contract §11)."""
    return {
        "plan_id": _DEMO_INITIAL_PLAN_ID if demo else _plan_id("plan_initial"),
        "plan_version": 1,
        "purpose": "PRESENT_PROBLEM",
        "strategy": "SYMBOLIC_FIRST",
        "support_level": 0,
        "pace": "NORMAL",
        "steps": [
            _step(
                "step_001", "CLEAR_STAGE",
                {"targets": ["ALL"]},
                narration_text=None,
                completion="ANIMATION",
            ),
            _step(
                "step_002", "SHOW_EQUATION",
                {"expression": f"{a} + {b} = ?", "emphasis": [str(a), str(b)]},
                narration_text=f"Berapa hasil {a} ditambah {b}?",
                auto_play=True,
                completion="ANIMATION_AND_NARRATION",
            ),
            _step(
                "step_003", "ASK_QUESTION",
                {
                    "question_id": f"q_{problem_id}",
                    "prompt": "Pilih jawabanmu.",
                    "answer_type": "INTEGER",
                    "accepted_answers": [a + b],
                    "answer_range": {"min": 0, "max": 20},
                    "allowed_input_modes": ["BUTTONS"],
                },
                narration_text=None,
                completion="USER_INPUT",
            ),
        ],
    }


def _transfer_plan(a: int, b: int, problem_id: str, demo: bool = False) -> dict:
    """Plan v1 for a transfer problem (purpose=PRESENT_PROBLEM with transfer context)."""
    return {
        "plan_id": _DEMO_TRANSFER_PLAN_ID if demo else _plan_id("plan_transfer"),
        "plan_version": 1,
        "purpose": "PRESENT_PROBLEM",
        "strategy": "SYMBOLIC_FIRST",
        "support_level": 0,
        "pace": "NORMAL",
        "steps": [
            _step(
                "step_001", "CLEAR_STAGE",
                {"targets": ["ALL"]},
                narration_text=None,
                completion="ANIMATION",
            ),
            _step(
                "step_002", "SHOW_EQUATION",
                {"expression": f"{a} + {b} = ?", "emphasis": [str(a), str(b)]},
                narration_text=f"Sekarang coba soal baru. Berapa {a} ditambah {b}?",
                auto_play=True,
                completion="ANIMATION_AND_NARRATION",
            ),
            _step(
                "step_003", "ASK_QUESTION",
                {
                    "question_id": f"q_{problem_id}",
                    "prompt": "Pilih jawabanmu.",
                    "answer_type": "INTEGER",
                    "accepted_answers": [a + b],
                    "answer_range": {"min": 0, "max": 20},
                    "allowed_input_modes": ["BUTTONS"],
                },
                narration_text=None,
                completion="USER_INPUT",
            ),
        ],
    }


def _fallback_plan(
    a: int,
    b: int,
    support_level: int,
    demo: bool = False,
    supported_actions: list[str] | None = None,
) -> dict:
    """Safe deterministic fallback plan (contract §16) using only v1 actions.

    Level 1 → number line count-on
    Level 2 → number line count-on (slower, more guided)
    Level 3 → number line count-on (step by step with mid-check)
    All fallbacks use only actions in the supported_actions allowlist.
    """
    operand_b = b
    destination = a + b

    if support_level <= 1:
        steps = [
            _step("step_001", "CLEAR_STAGE", {"targets": ["ALL"]}, completion="ANIMATION"),
            _step("step_002", "SHOW_NUMBER_LINE",
                  {"line_id": "line_fallback", "min": 0, "max": 20},
                  completion="ANIMATION"),
            _step("step_003", "PLACE_MARKER",
                  {"line_id": "line_fallback", "marker_id": "marker_1", "value": a},
                  narration_text=f"Kita mulai dari {a}.",
                  completion="ANIMATION_AND_NARRATION"),
            _step("step_004", "MOVE_MARKER",
                  {
                      "line_id": "line_fallback",
                      "marker_id": "marker_1",
                      "direction": "FORWARD",
                      "step_size": 1,
                      "steps": operand_b,
                      "destination": destination,
                      "show_each_jump": True,
                  },
                  narration_text=f"Sekarang maju {operand_b} langkah.",
                  completion="ANIMATION_AND_NARRATION"),
            _step("step_005", "ASK_QUESTION",
                  {
                      "question_id": "fallback_q",
                      "prompt": "Kita berhenti di angka berapa?",
                      "answer_type": "INTEGER",
                      "accepted_answers": [destination],
                      "answer_range": {"min": 0, "max": 20},
                      "allowed_input_modes": ["BUTTONS"],
                  },
                  completion="USER_INPUT"),
        ]
    elif support_level == 2:
        # Split the jump at 10 if it crosses ten
        cross = (a < 10 <= destination)
        if cross:
            steps_to_ten = 10 - a
            remaining = operand_b - steps_to_ten
            steps = [
                _step("step_001", "CLEAR_STAGE", {"targets": ["ALL"]}, completion="ANIMATION"),
                _step("step_002", "SHOW_NUMBER_LINE",
                      {"line_id": "line_fallback", "min": 0, "max": 20},
                      completion="ANIMATION"),
                _step("step_003", "PLACE_MARKER",
                      {"line_id": "line_fallback", "marker_id": "marker_1", "value": a},
                      narration_text=f"Kita mulai dari {a}. {a} belum menjadi lompatan pertama.",
                      completion="ANIMATION_AND_NARRATION"),
                _step("step_004", "MOVE_MARKER",
                      {
                          "line_id": "line_fallback",
                          "marker_id": "marker_1",
                          "direction": "FORWARD",
                          "step_size": 1,
                          "steps": steps_to_ten,
                          "destination": 10,
                          "show_each_jump": True,
                      },
                      narration_text=f"Maju {steps_to_ten} langkah sampai sepuluh.",
                      completion="ANIMATION_AND_NARRATION"),
                _step("step_005", "MOVE_MARKER",
                      {
                          "line_id": "line_fallback",
                          "marker_id": "marker_1",
                          "direction": "FORWARD",
                          "step_size": 1,
                          "steps": remaining,
                          "destination": destination,
                          "show_each_jump": True,
                      },
                      narration_text=f"Lanjut {remaining} langkah lagi.",
                      completion="ANIMATION_AND_NARRATION"),
                _step("step_006", "ASK_QUESTION",
                      {
                          "question_id": "fallback_q",
                          "prompt": "Kita sekarang di angka berapa?",
                          "answer_type": "INTEGER",
                          "accepted_answers": [destination],
                          "answer_range": {"min": 0, "max": 20},
                          "allowed_input_modes": ["BUTTONS"],
                      },
                      completion="USER_INPUT"),
            ]
        else:
            steps = [
                _step("step_001", "CLEAR_STAGE", {"targets": ["ALL"]}, completion="ANIMATION"),
                _step("step_002", "SHOW_NUMBER_LINE",
                      {"line_id": "line_fallback", "min": 0, "max": 20},
                      completion="ANIMATION"),
                _step("step_003", "PLACE_MARKER",
                      {"line_id": "line_fallback", "marker_id": "marker_1", "value": a},
                      narration_text=f"Kita mulai dari {a}.",
                      completion="ANIMATION_AND_NARRATION"),
                _step("step_004", "MOVE_MARKER",
                      {
                          "line_id": "line_fallback",
                          "marker_id": "marker_1",
                          "direction": "FORWARD",
                          "step_size": 1,
                          "steps": operand_b,
                          "destination": destination,
                          "show_each_jump": True,
                      },
                      narration_text=f"Maju {operand_b} langkah satu per satu.",
                      completion="ANIMATION_AND_NARRATION"),
                _step("step_005", "ASK_QUESTION",
                      {
                          "question_id": "fallback_q",
                          "prompt": "Kita berhenti di angka berapa?",
                          "answer_type": "INTEGER",
                          "accepted_answers": [destination],
                          "answer_range": {"min": 0, "max": 20},
                          "allowed_input_modes": ["BUTTONS"],
                      },
                      completion="USER_INPUT"),
            ]
    else:  # level 3
        steps = [
            _step("step_001", "CLEAR_STAGE", {"targets": ["ALL"]}, completion="ANIMATION"),
            _step("step_002", "SHOW_EQUATION",
                  {"expression": f"{a} + {b} = ?", "emphasis": [str(a), str(b)]},
                  narration_text=f"Kita punya {a} ditambah {b}.",
                  completion="ANIMATION_AND_NARRATION"),
            _step("step_003", "SHOW_NUMBER_LINE",
                  {"line_id": "line_fallback", "min": 0, "max": 20},
                  completion="ANIMATION"),
            _step("step_004", "PLACE_MARKER",
                  {"line_id": "line_fallback", "marker_id": "marker_1", "value": a},
                  narration_text=f"Letakkan jari kamu di angka {a}.",
                  completion="ANIMATION_AND_NARRATION"),
            _step("step_005", "MOVE_MARKER",
                  {
                      "line_id": "line_fallback",
                      "marker_id": "marker_1",
                      "direction": "FORWARD",
                      "step_size": 1,
                      "steps": operand_b,
                      "destination": destination,
                      "show_each_jump": True,
                  },
                  narration_text=f"Ikuti bersama: maju {operand_b} langkah.",
                  completion="ANIMATION_AND_NARRATION"),
            _step("step_006", "ASK_QUESTION",
                  {
                      "question_id": "fallback_q",
                      "prompt": "Kita ada di angka berapa sekarang?",
                      "answer_type": "INTEGER",
                      "accepted_answers": [destination],
                      "answer_range": {"min": 0, "max": 20},
                      "allowed_input_modes": ["BUTTONS"],
                  },
                  completion="USER_INPUT"),
        ]

    supported = set(supported_actions or [])
    if supported:
        terminal_action = (
            "ASK_QUESTION" if "ASK_QUESTION" in supported else
            "ASK_REASONING" if "ASK_REASONING" in supported else None
        )
        if terminal_action is None:
            # Gateway rejects clients without any supported interaction terminal.
            terminal_action = "ASK_QUESTION"

        required_line_actions = {"SHOW_NUMBER_LINE", "PLACE_MARKER", "MOVE_MARKER"}
        if not required_line_actions.issubset(supported):
            steps = []
            if "SHOW_TEXT" in supported:
                steps.append(_step(
                    "step_001", "SHOW_TEXT",
                    {"text": "Kita hitung bersama, satu langkah demi satu langkah.", "emphasis": []},
                    narration_text="Kita hitung bersama, satu langkah demi satu langkah.",
                    completion="NARRATION",
                ))
            terminal_params = (
                {
                    "question_id": "fallback_q",
                    "prompt": "Berapakah hasilnya?",
                    "answer_type": "INTEGER",
                    "accepted_answers": [destination],
                    "answer_range": {"min": 0, "max": 20},
                    "allowed_input_modes": ["BUTTONS"],
                }
                if terminal_action == "ASK_QUESTION"
                else {
                    "question_id": "fallback_reasoning",
                    "prompt": "Bagaimana kamu menghitungnya?",
                    "options": [],
                    "allow_voice": False,
                    "allow_skip": True,
                }
            )
            steps.append(_step(
                f"step_{len(steps) + 1:03d}", terminal_action, terminal_params,
                completion="USER_INPUT",
            ))
            strategy = "GENERAL_GUIDED"
        else:
            if terminal_action == "ASK_REASONING":
                last = steps[-1]
                steps[-1] = _step(
                    last["step_id"], "ASK_REASONING",
                    {
                        "question_id": "fallback_reasoning",
                        "prompt": "Bagaimana kamu menghitungnya?",
                        "options": [],
                        "allow_voice": False,
                        "allow_skip": True,
                    },
                    completion="USER_INPUT",
                )
            steps = [step for step in steps if step["action"] in supported]
            strategy = "NUMBER_LINE_COUNT_ON"
    else:
        strategy = "NUMBER_LINE_COUNT_ON"

    return {
        "plan_id": _DEMO_FALLBACK_PLAN_IDS.get(support_level, _plan_id("plan_fallback")) if demo else _plan_id("plan_fallback"),
        "plan_version": 1,
        "purpose": "GUIDED_SUPPORT",
        "strategy": strategy,
        "support_level": support_level,
        "pace": "SLOW",
        "steps": steps,
    }


def _add_accepted(a: int, b: int) -> list[int]:
    return [a + b]


class ArithLessonEngine(Component):
    display_name = "Arith Lesson Engine"
    description = (
        "Deterministic problem/plan generator (plan v1). "
        "Set Mode to INITIAL, TRANSFER, or FALLBACK depending on the branch."
    )
    icon = "calculator"

    inputs = [
        DropdownInput(
            name="mode",
            display_name="Mode",
            options=["INITIAL", "TRANSFER", "FALLBACK"],
            value="INITIAL",
            info="INITIAL=new problem, TRANSFER=same concept new operands, FALLBACK=safe recovery plan.",
        ),
        DropdownInput(
            name="demo_seed",
            display_name="Demo Seed",
            options=["ON", "OFF"],
            value="OFF",
            info="ON → always produce spec demo operands (8+5 / 9+4). OFF → random within concept.",
        ),
        DataInput(
            name="request_data",
            display_name="Request Data",
            info="Clean request dict from Request Gateway or Plan Guard.",
        ),
    ]

    outputs = [
        Output(display_name="Problem + Plan", name="plan_out", method="build_plan"),
    ]

    # ------------------------------------------------------------------ #
    #  Operand selection                                                   #
    # ------------------------------------------------------------------ #

    def _pick_operands(
        self, mode: str, exclude_pair: tuple | None = None, demo: bool = False
    ) -> tuple[int, int]:
        if demo:
            return DEMO_INITIAL if mode == "INITIAL" else DEMO_TRANSFER

        rng = random.Random()
        for _ in range(50):
            a = rng.randint(6, 9)
            b = rng.randint(10 - a + 1, min(9, 20 - a))
            if exclude_pair and (a, b) == exclude_pair:
                continue
            if 0 <= a + b <= 20:
                return a, b
        return DEMO_INITIAL if mode == "INITIAL" else DEMO_TRANSFER

    # ------------------------------------------------------------------ #
    #  Main build method                                                   #
    # ------------------------------------------------------------------ #

    def build_plan(self) -> Data:
        t_start = time.monotonic()
        req = dict(self.request_data.data) if self.request_data else {}
        mode = self.mode
        demo_request = req.get("demo_mode") if isinstance(req.get("demo_mode"), dict) else {}
        demo = self.demo_seed == "ON" or (
            demo_request.get("enabled") is True
            and demo_request.get("scenario_id") == DEMO_SCENARIO_ID
        )

        if mode == "FALLBACK":
            support_level = int(req.get("support_level", 1))
            support_level = max(1, min(3, support_level))
            a = int(req.get("operand_a", 8))
            b = int(req.get("operand_b", 5))
            problem_id = req.get("problem_id") or f"problem_{a}_plus_{b}"

            result = {
                "request_id": req.get("request_id", ""),
                "session_id": req.get("session_id", ""),
                "demo_mode": req.get("demo_mode"),
                "supported_actions": req.get("supported_actions", []),
                "problem_id": problem_id,
                "concept": CONCEPT,
                "operation": OPERATION,
                "operand_a": a,
                "operand_b": b,
                "correct_answer": a + b,
                "accepted_answers": _add_accepted(a, b),
                "number_range": {"min": 0, "max": 20},
                "plan": _fallback_plan(
                    a, b, support_level, demo=demo,
                    supported_actions=req.get("supported_actions"),
                ),
                "learning_state_patch": {
                    "support_level": support_level,
                    "observations_to_append": [],
                    "effective_visuals_to_add": [],
                },
                "warnings": ["Fallback plan used — AI plan was invalid or timed out."],
                "_engine_mode": "FALLBACK",
                "_engine_ms": round((time.monotonic() - t_start) * 1000, 2),
            }

        elif mode == "TRANSFER":
            original_pair = (
                int(req.get("operand_a", 0)),
                int(req.get("operand_b", 0)),
            )
            a, b = self._pick_operands("TRANSFER", exclude_pair=original_pair, demo=demo)
            problem_id = (
                _DEMO_TRANSFER_PROBLEM_ID if demo
                else f"problem_{a}_plus_{b}_{uuid.uuid4().hex[:6]}"
            )

            result = {
                "request_id": req.get("request_id", ""),
                "session_id": req.get("session_id", ""),
                "demo_mode": req.get("demo_mode"),
                "supported_actions": req.get("supported_actions", []),
                "problem_id": problem_id,
                "concept": CONCEPT,
                "operation": OPERATION,
                "operand_a": a,
                "operand_b": b,
                "correct_answer": a + b,
                "accepted_answers": _add_accepted(a, b),
                "number_range": {"min": 0, "max": 20},
                "plan": _transfer_plan(a, b, problem_id, demo=demo),
                "learning_state_patch": {
                    "support_level": req.get("support_level", 0),
                    "observations_to_append": [],
                    "effective_visuals_to_add": [],
                },
                "warnings": [],
                "_engine_mode": "TRANSFER",
                "_engine_ms": round((time.monotonic() - t_start) * 1000, 2),
            }

        else:  # INITIAL
            a, b = self._pick_operands("INITIAL", demo=demo)
            problem_id = (
                _DEMO_INITIAL_PROBLEM_ID if demo
                else f"problem_{a}_plus_{b}_{uuid.uuid4().hex[:6]}"
            )

            result = {
                "request_id": req.get("request_id", ""),
                "session_id": req.get("session_id", ""),
                "demo_mode": req.get("demo_mode"),
                "supported_actions": req.get("supported_actions", []),
                "problem_id": problem_id,
                "concept": CONCEPT,
                "operation": OPERATION,
                "operand_a": a,
                "operand_b": b,
                "correct_answer": a + b,
                "accepted_answers": _add_accepted(a, b),
                "number_range": {"min": 0, "max": 20},
                "plan": _initial_plan(a, b, problem_id, demo=demo),
                "learning_state_patch": {
                    "support_level": 0,
                    "observations_to_append": [],
                    "effective_visuals_to_add": [],
                },
                "warnings": [],
                "_engine_mode": "INITIAL",
                "_engine_ms": round((time.monotonic() - t_start) * 1000, 2),
            }

        self.log(
            f"[LessonEngine] mode={mode} problem={result.get('operand_a')}+"
            f"{result.get('operand_b')}={result.get('correct_answer')} "
            f"ms={result['_engine_ms']}"
        )
        return Data(data=result)
