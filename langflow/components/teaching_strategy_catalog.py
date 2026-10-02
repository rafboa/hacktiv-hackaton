"""
TeachingStrategyCatalog — Custom Langflow component
Role : Return valid teaching strategies for a given concept, hypothesis, and support level.
       Deterministic — no LLM involved. Called before Teaching Planner Agent.
Spec : Langflow-Architecture-Arith.md §8, §5 (node 7)

Output JSON shape:
{
  "allowed_strategies": [
    {
      "strategy_code": "...",
      "allowed_actions": [...],
      "constraints": {...}
    }
  ]
}
"""

import time
from langflow.custom import Component
from langflow.io import DataInput, Output
from langflow.schema import Data


# ---------------------------------------------------------------------------
# Catalog definition
# Key: (concept, hypothesis_code, support_level) → list of strategy entries
# Hypothesis codes and strategy codes follow contracts/arith-json-contract-v1.md
# ---------------------------------------------------------------------------

# Common action sets
_COMMON_SPEAK = ["SPEAK", "ASK_QUESTION"]
_NUMBER_LINE_ACTIONS = [
    "CLEAR_STAGE",
    "SHOW_NUMBER_LINE",
    "PLACE_MARKER",
    "MOVE_MARKER",
    *_COMMON_SPEAK,
]
_BLOCK_ACTIONS = [
    "CLEAR_STAGE",
    "SHOW_BLOCKS",
    "SPLIT_BLOCK",
    "MERGE_BLOCKS",
    *_COMMON_SPEAK,
]
_TEN_FRAME_ACTIONS = [
    "CLEAR_STAGE",
    "SHOW_TEN_FRAME",
    "FILL_TEN_FRAME",
    *_COMMON_SPEAK,
]

CATALOG: dict[tuple, list[dict]] = {
    # ---- ADDITION_CROSSING_TEN, support level 1 -------------------------
    ("ADDITION_CROSSING_TEN", "COUNTED_START_AS_FIRST_STEP", 1): [
        {
            "strategy_code": "NUMBER_LINE_COUNT_ON",
            "allowed_actions": _NUMBER_LINE_ACTIONS,
            "constraints": {"step_size": 1, "show_each_jump": True, "max_steps": 6},
        },
        {
            "strategy_code": "HIGHLIGHT_EQUATION",
            "allowed_actions": ["HIGHLIGHT_OPERANDS", *_COMMON_SPEAK],
            "constraints": {},
        },
    ],
    ("ADDITION_CROSSING_TEN", "FORGOT_TO_CROSS_TEN", 1): [
        {
            "strategy_code": "NUMBER_LINE_COUNT_ON",
            "allowed_actions": _NUMBER_LINE_ACTIONS,
            "constraints": {"step_size": 1, "show_each_jump": True, "max_steps": 6},
        },
    ],
    ("ADDITION_CROSSING_TEN", "UNKNOWN", 1): [
        {
            "strategy_code": "NUMBER_LINE_COUNT_ON",
            "allowed_actions": _NUMBER_LINE_ACTIONS,
            "constraints": {"step_size": 1, "show_each_jump": True, "max_steps": 8},
        },
    ],
    # ---- ADDITION_CROSSING_TEN, support level 2 -------------------------
    ("ADDITION_CROSSING_TEN", "COUNTED_START_AS_FIRST_STEP", 2): [
        {
            "strategy_code": "MAKE_TEN_STRATEGY",
            "allowed_actions": _TEN_FRAME_ACTIONS,
            "constraints": {"show_decomposition": True},
        },
        {
            "strategy_code": "NUMBER_LINE_COUNT_ON",
            "allowed_actions": _NUMBER_LINE_ACTIONS,
            "constraints": {"step_size": 1, "show_each_jump": True, "max_steps": 6},
        },
    ],
    ("ADDITION_CROSSING_TEN", "FORGOT_TO_CROSS_TEN", 2): [
        {
            "strategy_code": "MAKE_TEN_STRATEGY",
            "allowed_actions": _TEN_FRAME_ACTIONS,
            "constraints": {"show_decomposition": True},
        },
    ],
    ("ADDITION_CROSSING_TEN", "UNKNOWN", 2): [
        {
            "strategy_code": "MAKE_TEN_STRATEGY",
            "allowed_actions": _TEN_FRAME_ACTIONS,
            "constraints": {"show_decomposition": True},
        },
    ],
    # ---- ADDITION_CROSSING_TEN, support level 3 -------------------------
    ("ADDITION_CROSSING_TEN", "COUNTED_START_AS_FIRST_STEP", 3): [
        {
            "strategy_code": "CONCRETE_BLOCKS_FULL_DEMO",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True, "show_simpler_problem": True},
        },
    ],
    ("ADDITION_CROSSING_TEN", "FORGOT_TO_CROSS_TEN", 3): [
        {
            "strategy_code": "CONCRETE_BLOCKS_FULL_DEMO",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True, "show_simpler_problem": True},
        },
    ],
    ("ADDITION_CROSSING_TEN", "UNKNOWN", 3): [
        {
            "strategy_code": "CONCRETE_BLOCKS_FULL_DEMO",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True, "show_simpler_problem": True},
        },
    ],
}

# Wildcard fallback for hypothesis codes not explicitly mapped
_DEFAULT_STRATEGIES: dict[int, list[dict]] = {
    1: [
        {
            "strategy_code": "NUMBER_LINE_COUNT_ON",
            "allowed_actions": _NUMBER_LINE_ACTIONS,
            "constraints": {"step_size": 1, "show_each_jump": True, "max_steps": 8},
        }
    ],
    2: [
        {
            "strategy_code": "MAKE_TEN_STRATEGY",
            "allowed_actions": _TEN_FRAME_ACTIONS,
            "constraints": {"show_decomposition": True},
        }
    ],
    3: [
        {
            "strategy_code": "CONCRETE_BLOCKS_FULL_DEMO",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True, "show_simpler_problem": True},
        }
    ],
}


class TeachingStrategyCatalog(Component):
    display_name = "Teaching Strategy Catalog"
    description = (
        "Deterministic catalog node. Returns valid teaching strategies based on "
        "concept, hypothesis, and support level. Called before the Teaching Planner Agent."
    )
    icon = "book-open"

    inputs = [
        DataInput(
            name="request_data",
            display_name="Request Data",
            info="Clean request from Gateway. Must contain concept, hypothesis_code, support_level.",
        ),
    ]

    outputs = [
        Output(display_name="Allowed Strategies", name="strategies_out", method="get_strategies"),
    ]

    def get_strategies(self) -> Data:
        t_start = time.monotonic()
        req = dict(self.request_data.data) if self.request_data else {}

        concept = req.get("concept", "ADDITION_CROSSING_TEN")
        hypothesis_code = req.get("hypothesis_code", "UNKNOWN")
        support_level = int(req.get("support_level", 1))
        support_level = max(1, min(3, support_level))

        key = (concept, hypothesis_code, support_level)
        strategies = CATALOG.get(key)

        if strategies is None:
            # Try with UNKNOWN hypothesis for this concept + level
            fallback_key = (concept, "UNKNOWN", support_level)
            strategies = CATALOG.get(fallback_key, _DEFAULT_STRATEGIES.get(support_level, []))

        result = {
            "allowed_strategies": strategies,
            "concept": concept,
            "hypothesis_code": hypothesis_code,
            "support_level": support_level,
            "_catalog_ms": round((time.monotonic() - t_start) * 1000, 2),
        }

        self.log(
            f"[StrategyCatalog] concept={concept} hypothesis={hypothesis_code} "
            f"level={support_level} strategies={len(strategies)} ms={result['_catalog_ms']}"
        )
        return Data(data=result)
