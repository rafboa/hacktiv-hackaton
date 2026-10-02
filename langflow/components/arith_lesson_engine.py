"""
ArithLessonEngine — Custom Langflow component
Role : Generate problem, answer, and initial/transfer/fallback plan deterministically.
Spec : Langflow-Architecture-Arith.md §6, §13, §12 (fallback table)

Three canvas instances:
  - mode INITIAL   → PROBLEM_REQUESTED branch
  - mode TRANSFER  → TRANSFER_REQUESTED branch
  - mode FALLBACK  → fallback branch from Plan Guard
"""

import random
import time
from langflow.custom import Component
from langflow.io import DataInput, DropdownInput, Output
from langflow.schema import Data


# ---------------------------------------------------------------------------
# P0 demo seeds (spec §6, §13)
# INITIAL  → always 8 + 5  (seed mode demo)
# TRANSFER → always 9 + 4  (spec §13)
# ---------------------------------------------------------------------------
DEMO_INITIAL = (8, 5)
DEMO_TRANSFER = (9, 4)

# Supported concepts (P0 only ADDITION_CROSSING_TEN)
CONCEPT = "ADDITION_CROSSING_TEN"
OPERATION = "ADDITION"

# Fallback plans per support level (spec §12)
FALLBACK_PLANS: dict[int, list[dict]] = {
    1: [
        {"action": "HIGHLIGHT_OPERANDS", "params": {}},
        {"action": "NEUTRAL_CUE", "params": {}},
        {"action": "ASK_QUESTION", "params": {"text": "Can you try again?"}},
    ],
    2: [
        {"action": "CLEAR_STAGE", "params": {}},
        {"action": "SHOW_NUMBER_LINE", "params": {"start": 0, "end": 20}},
        {"action": "PLACE_MARKER", "params": {}},
        {"action": "MOVE_MARKER", "params": {"unit_steps": True}},
        {"action": "ASK_QUESTION", "params": {"text": "What number did we land on?"}},
    ],
    3: [
        {"action": "CLEAR_STAGE", "params": {}},
        {"action": "SHOW_BLOCKS", "params": {"full_demo": True}},
        {"action": "SPEAK", "params": {"text": "Watch how we break this apart."}},
        {"action": "SHOW_SIMPLER_PROBLEM", "params": {}},
        {"action": "ASK_QUESTION", "params": {"text": "Can you solve this easier one first?"}},
    ],
}


def _add_accepted(a: int, b: int) -> list[int]:
    """Return canonical answer list for a + b."""
    return [a + b]


def _initial_plan(a: int, b: int) -> list[dict]:
    """Deterministic opening plan: show equation then ask. (spec §6)"""
    return [
        {"action": "SHOW_EQUATION", "params": {"left": a, "right": b, "operator": "+"}},
        {"action": "ASK_QUESTION", "params": {"text": "What is the answer?"}},
    ]


def _transfer_plan(a: int, b: int) -> list[dict]:
    """Deterministic transfer plan: same shape as initial."""
    return [
        {"action": "SHOW_EQUATION", "params": {"left": a, "right": b, "operator": "+"}},
        {"action": "SPEAK", "params": {"text": "Let's try a new problem with the same idea."}},
        {"action": "ASK_QUESTION", "params": {"text": "What is the answer?"}},
    ]


class ArithLessonEngine(Component):
    display_name = "Arith Lesson Engine"
    description = (
        "Deterministic problem/plan generator. "
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
            value="ON",
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

    def _pick_operands(self, mode: str, exclude_pair: tuple | None = None) -> tuple[int, int]:
        if self.demo_seed == "ON":
            return DEMO_INITIAL if mode == "INITIAL" else DEMO_TRANSFER

        # Random within crossing-ten constraint: a ∈ [6,9], b = 10-a + delta
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

        if mode == "FALLBACK":
            support_level = int(req.get("support_level", 1))
            support_level = max(1, min(3, support_level))
            # Re-use canonical problem already in req; never recompute from agent output
            a = int(req.get("operand_a", 8))
            b = int(req.get("operand_b", 5))
            plan_steps = FALLBACK_PLANS[support_level]
            result = {
                "request_id": req.get("request_id", ""),
                "session_id": req.get("session_id", ""),
                "problem_id": req.get("problem_id", ""),
                "concept": CONCEPT,
                "operation": OPERATION,
                "operand_a": a,
                "operand_b": b,
                "correct_answer": a + b,
                "accepted_answers": _add_accepted(a, b),
                "plan": {"steps": plan_steps},
                "support_level": support_level,
                "_engine_mode": "FALLBACK",
                "_engine_ms": round((time.monotonic() - t_start) * 1000, 2),
            }
        elif mode == "TRANSFER":
            # Avoid reusing the same operand pair as the original problem
            original_pair = (
                int(req.get("operand_a", 0)),
                int(req.get("operand_b", 0)),
            )
            a, b = self._pick_operands("TRANSFER", exclude_pair=original_pair)
            result = {
                "request_id": req.get("request_id", ""),
                "session_id": req.get("session_id", ""),
                "problem_id": req.get("problem_id", ""),
                "concept": CONCEPT,
                "operation": OPERATION,
                "operand_a": a,
                "operand_b": b,
                "correct_answer": a + b,
                "accepted_answers": _add_accepted(a, b),
                "plan": {"steps": _transfer_plan(a, b)},
                "_engine_mode": "TRANSFER",
                "_engine_ms": round((time.monotonic() - t_start) * 1000, 2),
            }
        else:  # INITIAL
            a, b = self._pick_operands("INITIAL")
            result = {
                "request_id": req.get("request_id", ""),
                "session_id": req.get("session_id", ""),
                "problem_id": f"p_{a}_{b}",
                "concept": CONCEPT,
                "operation": OPERATION,
                "operand_a": a,
                "operand_b": b,
                "correct_answer": a + b,
                "accepted_answers": _add_accepted(a, b),
                "plan": {"steps": _initial_plan(a, b)},
                "_engine_mode": "INITIAL",
                "_engine_ms": round((time.monotonic() - t_start) * 1000, 2),
            }

        self.log(
            f"[LessonEngine] mode={mode} problem={result.get('operand_a')}+"
            f"{result.get('operand_b')}={result.get('correct_answer')} "
            f"ms={result['_engine_ms']}"
        )
        return Data(data=result)
