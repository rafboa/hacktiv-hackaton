import json
import sys
import types
import unittest
from pathlib import Path


COMPONENTS = Path(__file__).resolve().parents[1] / "components"
sys.path.insert(0, str(COMPONENTS))


class _Input:
    def __init__(self, *args, **kwargs):
        pass


class _Component:
    def stop(self, *_args, **_kwargs):
        pass

    def log(self, *_args, **_kwargs):
        pass


class _Data:
    def __init__(self, data=None):
        self.data = data or {}


langflow = types.ModuleType("langflow")
langflow.__path__ = []
custom = types.ModuleType("langflow.custom")
custom.Component = _Component
io = types.ModuleType("langflow.io")
io.DataInput = io.DropdownInput = io.MessageTextInput = io.Output = _Input
schema = types.ModuleType("langflow.schema")
schema.Data = _Data
sys.modules.setdefault("langflow", langflow)
sys.modules.setdefault("langflow.custom", custom)
sys.modules.setdefault("langflow.io", io)
sys.modules.setdefault("langflow.schema", schema)

import arith_lesson_engine as lesson_engine
import arith_plan_guard as plan_guard
import arith_request_gateway as request_gateway


def _step(step_id, action, params):
    return {"step_id": step_id, "action": action, "params": params}


def _line_plan(second_destination=13):
    return {
        "plan_version": 1,
        "steps": [
            _step("line", "SHOW_NUMBER_LINE", {"line_id": "line_1", "min": 0, "max": 20}),
            _step("place", "PLACE_MARKER", {
                "line_id": "line_1", "marker_id": "marker_1", "value": 8,
            }),
            _step("move_1", "MOVE_MARKER", {
                "line_id": "line_1", "marker_id": "marker_1", "direction": "FORWARD",
                "step_size": 1, "steps": 2, "destination": 10, "show_each_jump": True,
            }),
            _step("move_2", "MOVE_MARKER", {
                "line_id": "line_1", "marker_id": "marker_1", "direction": "FORWARD",
                "step_size": 1, "steps": 3, "destination": second_destination, "show_each_jump": True,
            }),
            _step("ask", "ASK_QUESTION", {
                "question_id": "q1", "prompt": "Di angka berapa kita berhenti?",
                "answer_type": "INTEGER", "accepted_answers": [13],
                "answer_range": {"min": 0, "max": 20}, "allowed_input_modes": ["BUTTONS"],
            }),
        ],
    }


class ContractFixTests(unittest.TestCase):
    @staticmethod
    def _gateway_request(**overrides):
        request = {
            "schema_version": "1.0",
            "request_id": "req_1",
            "session_id": "session_1",
            "event_type": "PROBLEM_REQUESTED",
        }
        request.update(overrides)
        gateway = request_gateway.ArithRequestGateway()
        gateway.raw_input = json.dumps(request)
        return gateway._parse_and_validate()

    def test_gateway_accepts_capabilities_without_demo_mode(self):
        request, error = self._gateway_request(client_capabilities={
            "supported_actions": ["SHOW_NUMBER_LINE", "ASK_QUESTION"],
        })
        self.assertIsNone(error)
        self.assertEqual(request["supported_actions"], ["SHOW_NUMBER_LINE", "ASK_QUESTION"])

    def test_gateway_rejects_unknown_demo_scenario_without_capabilities(self):
        request, error = self._gateway_request(demo_mode={
            "enabled": True,
            "scenario_id": "UNKNOWN_DEMO",
        })
        self.assertIsNone(request)
        self.assertEqual(error.data["error"]["code"], "INVALID_REQUEST")

    def test_gateway_requires_terminal_action_capability(self):
        request, error = self._gateway_request(client_capabilities={
            "supported_actions": ["SHOW_NUMBER_LINE"],
        })
        self.assertIsNone(request)
        self.assertEqual(error.data["error"]["code"], "INVALID_REQUEST")

    def test_gateway_rejects_non_object_json(self):
        gateway = request_gateway.ArithRequestGateway()
        gateway.raw_input = "[]"
        request, error = gateway._parse_and_validate()
        self.assertIsNone(request)
        self.assertEqual(error.data["error"]["code"], "INVALID_REQUEST")

    def test_cumulative_marker_position_accepts_8_to_10_to_13(self):
        errors = plan_guard._validate_plan_structure(
            _line_plan(), {"operand_a": 8, "operand_b": 5, "correct_answer": 13}
        )
        self.assertEqual(errors, [])

    def test_cumulative_marker_position_rejects_wrong_second_destination(self):
        errors = plan_guard._validate_plan_structure(
            _line_plan(second_destination=12),
            {"operand_a": 8, "operand_b": 5, "correct_answer": 13},
        )
        self.assertIn("MOVE_MARKER_DESTINATION_WRONG", {error["code"] for error in errors})

    def test_minimal_fallback_uses_only_declared_actions(self):
        plan = lesson_engine._fallback_plan(
            8, 5, 1, demo=True, supported_actions=["SHOW_TEXT", "ASK_QUESTION"]
        )
        self.assertEqual(plan["strategy"], "GENERAL_GUIDED")
        self.assertTrue(all(step["action"] in {"SHOW_TEXT", "ASK_QUESTION"} for step in plan["steps"]))
        self.assertEqual(plan["steps"][-1]["action"], "ASK_QUESTION")

    def test_learning_state_patch_rejects_unapproved_fields(self):
        errors = plan_guard._check_learning_state_patch({
            "support_level": 1,
            "observations_to_append": [],
            "effective_visuals_to_add": [],
            "learner_name": "not allowed",
        })
        self.assertIn("INVALID_LEARNING_STATE_PATCH", {error["code"] for error in errors})


if __name__ == "__main__":
    unittest.main()
