"""
TeachingStrategyCatalog — Custom Langflow component
Role : Return valid teaching strategies for a given concept, hypothesis, and support level.
       Deterministic — no LLM involved. Called before Teaching Planner Agent.
Spec : contracts/arith-json-contract-v1.md §12, §14

Action names follow contract §14 exactly (v1 names).
Strategies are filtered against client_capabilities.supported_actions if provided.

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
# Common action sets — v1 action names only (contract §14)
# ---------------------------------------------------------------------------

_COMMON_NARRATION = ["SPEAK", "SHOW_FEEDBACK"]
_TERMINAL = ["ASK_QUESTION"]

_NUMBER_LINE_ACTIONS = [
    "CLEAR_STAGE",
    "SHOW_NUMBER_LINE",
    "PLACE_MARKER",
    "MOVE_MARKER",
    "SHOW_EQUATION",
    "HIGHLIGHT",
    *_COMMON_NARRATION,
    *_TERMINAL,
]

_BLOCK_ACTIONS = [
    "CLEAR_STAGE",
    "SHOW_OBJECTS",
    "ADD_OBJECTS",
    "REMOVE_OBJECTS",
    "MOVE_OBJECTS",
    "GROUP_TO_TEN",
    "SHOW_EQUATION",
    *_COMMON_NARRATION,
    *_TERMINAL,
]

_SYMBOLIC_ACTIONS = [
    "CLEAR_STAGE",
    "SHOW_EQUATION",
    "HIGHLIGHT",
    *_COMMON_NARRATION,
    *_TERMINAL,
]

# ---------------------------------------------------------------------------
# Catalog definition
# Key: (concept, hypothesis_code, support_level) → list of strategy entries
# Hypothesis codes follow contract §12.
# ---------------------------------------------------------------------------

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
            "allowed_actions": _SYMBOLIC_ACTIONS,
            "constraints": {},
        },
    ],
    ("ADDITION_CROSSING_TEN", "OPERATION_CONFUSION", 1): [
        {
            "strategy_code": "COMBINE_BLOCK_GROUPS",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"show_each_group": True},
        },
        {
            "strategy_code": "NUMBER_LINE_COUNT_ON",
            "allowed_actions": _NUMBER_LINE_ACTIONS,
            "constraints": {"step_size": 1, "show_each_jump": True, "max_steps": 8},
        },
    ],
    ("ADDITION_CROSSING_TEN", "CROSSING_TEN_DIFFICULTY", 1): [
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
            "strategy_code": "MAKE_TEN_WITH_BLOCKS",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"show_decomposition": True, "target_ten": True},
        },
        {
            "strategy_code": "NUMBER_LINE_COUNT_ON",
            "allowed_actions": _NUMBER_LINE_ACTIONS,
            "constraints": {"step_size": 1, "show_each_jump": True, "max_steps": 6},
        },
    ],
    ("ADDITION_CROSSING_TEN", "OPERATION_CONFUSION", 2): [
        {
            "strategy_code": "MAKE_TEN_WITH_BLOCKS",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"show_decomposition": True, "target_ten": True},
        },
    ],
    ("ADDITION_CROSSING_TEN", "CROSSING_TEN_DIFFICULTY", 2): [
        {
            "strategy_code": "MAKE_TEN_WITH_BLOCKS",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"show_decomposition": True, "target_ten": True},
        },
        {
            "strategy_code": "NUMBER_LINE_COUNT_ON",
            "allowed_actions": _NUMBER_LINE_ACTIONS,
            "constraints": {"step_size": 1, "show_each_jump": True, "max_steps": 6},
        },
    ],
    ("ADDITION_CROSSING_TEN", "UNKNOWN", 2): [
        {
            "strategy_code": "MAKE_TEN_WITH_BLOCKS",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"show_decomposition": True, "target_ten": True},
        },
    ],
    # ---- ADDITION_CROSSING_TEN, support level 3 -------------------------
    ("ADDITION_CROSSING_TEN", "COUNTED_START_AS_FIRST_STEP", 3): [
        {
            "strategy_code": "CONCRETE_TO_VISUAL",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True},
        },
    ],
    ("ADDITION_CROSSING_TEN", "OPERATION_CONFUSION", 3): [
        {
            "strategy_code": "CONCRETE_TO_VISUAL",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True},
        },
    ],
    ("ADDITION_CROSSING_TEN", "CROSSING_TEN_DIFFICULTY", 3): [
        {
            "strategy_code": "CONCRETE_TO_VISUAL",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True},
        },
    ],
    ("ADDITION_CROSSING_TEN", "UNKNOWN", 3): [
        {
            "strategy_code": "CONCRETE_TO_VISUAL",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True},
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
            "strategy_code": "MAKE_TEN_WITH_BLOCKS",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"show_decomposition": True, "target_ten": True},
        }
    ],
    3: [
        {
            "strategy_code": "CONCRETE_TO_VISUAL",
            "allowed_actions": _BLOCK_ACTIONS,
            "constraints": {"full_demo": True},
        }
    ],
}


class TeachingStrategyCatalog(Component):
    display_name = "Teaching Strategy Catalog"
    description = (
        "Deterministic catalog node. Returns valid teaching strategies based on "
        "concept, hypothesis, and support level. Filters by client_capabilities.supported_actions."
    )
    icon = "book-open"

    inputs = [
        DataInput(
            name="request_data",
            display_name="Request Data",
            info="Clean request from Gateway. Must contain concept, hypothesis_code, support_level, supported_actions.",
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

        # Client capability filter
        supported_actions: set[str] = set(req.get("supported_actions", []))

        key = (concept, hypothesis_code, support_level)
        strategies = CATALOG.get(key)

        if strategies is None:
            # Try with UNKNOWN hypothesis for this concept + level
            fallback_key = (concept, "UNKNOWN", support_level)
            strategies = CATALOG.get(fallback_key, _DEFAULT_STRATEGIES.get(support_level, []))

        # Filter strategies by client capabilities — remove any strategy whose
        # required actions are not all in supported_actions.
        # If no strategy survives, offer a terminal-only generic strategy when
        # the client can collect an answer. Never advertise a visual action that
        # the client did not declare.
        if supported_actions:
            filtered = [
                s for s in strategies
                if all(a in supported_actions for a in s["allowed_actions"])
            ]
            if filtered:
                strategies = filtered
            else:
                terminal = next(
                    (a for a in ("ASK_QUESTION", "ASK_REASONING") if a in supported_actions),
                    None,
                )
                if terminal is None:
                    strategies = []
                else:
                    minimal_actions = [
                        action for action in (
                            "CLEAR_STAGE", "SHOW_TEXT", "SPEAK", "SHOW_EQUATION",
                            "SHOW_FEEDBACK", terminal,
                        )
                        if action in supported_actions
                    ]
                    strategies = [{
                        "strategy_code": "GENERAL_GUIDED",
                        "allowed_actions": minimal_actions,
                        "constraints": {"visuals": "optional", "max_steps": 4},
                    }]

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
