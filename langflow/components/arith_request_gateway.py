"""
ArithRequestGateway — Custom Langflow component
Role : Parse, validate, sanitise, and route incoming domain requests.
Spec : contracts/arith-json-contract-v1.md §5, §6, §7, §8, §16
"""

import json
import time
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Data


SUPPORTED_SCHEMA_VERSIONS = {"1", "1.0"}
SUPPORTED_EVENTS = {"PROBLEM_REQUESTED", "SUPPORT_REQUESTED", "TRANSFER_REQUESTED"}

# Fields that must never be forwarded downstream
_STRIP_FIELDS = {"api_key", "child_name", "player_name", "audio_recording"}


class ArithRequestGateway(Component):
    display_name = "Arith Request Gateway"
    description = (
        "Parses, validates, sanitises, and routes Arith domain requests. "
        "Activates exactly one output branch and stops the rest."
    )
    icon = "route"

    inputs = [
        MessageTextInput(
            name="raw_input",
            display_name="Raw JSON Input",
            info="JSON string received from Chat Input.",
        ),
    ]

    outputs = [
        Output(display_name="PROBLEM_REQUESTED", name="problem_out", method="route_problem", group_outputs=True),
        Output(display_name="SUPPORT_REQUESTED", name="support_out", method="route_support", group_outputs=True),
        Output(display_name="TRANSFER_REQUESTED", name="transfer_out", method="route_transfer", group_outputs=True),
        Output(display_name="INVALID", name="invalid_out", method="route_invalid", group_outputs=True),
    ]

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    def _parse_and_validate(self) -> "tuple[dict | None, Data | None]":
        """Return (clean_request, None) on success or (None, error_data) on failure."""
        raw = (self.raw_input or "").strip()
        t_start = time.monotonic()

        # 1. Must be valid JSON
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            return None, self._error("INVALID_REQUEST", f"JSON parse error: {exc}", "", "")

        # 2. Must be a JSON object (not array, null, string, number)
        if not isinstance(parsed, dict):
            return None, self._error(
                "INVALID_REQUEST",
                f"Request must be a JSON object; got {type(parsed).__name__}.",
                "",
                "",
            )

        req: dict = parsed

        # 3. schema_version
        schema_version = req.get("schema_version", "")
        if not isinstance(schema_version, str):
            schema_version = ""
        if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
            return None, self._error(
                "UNSUPPORTED_SCHEMA",
                f"schema_version '{schema_version}' is not supported. Supported: {sorted(SUPPORTED_SCHEMA_VERSIONS)}",
                req.get("request_id", ""),
                req.get("session_id", ""),
            )

        # 4. Required envelope fields
        for field in ("request_id", "session_id", "event_type"):
            if not isinstance(req.get(field), str) or not req[field].strip():
                request_id = req.get("request_id") if isinstance(req.get("request_id"), str) else ""
                session_id = req.get("session_id") if isinstance(req.get("session_id"), str) else ""
                return None, self._error(
                    "INVALID_REQUEST",
                    f"Required field '{field}' must be a non-empty string.",
                    request_id,
                    session_id,
                )

        # 5. event_type recognised
        event_type = req["event_type"]
        if event_type not in SUPPORTED_EVENTS:
            return None, self._error(
                "INVALID_REQUEST",
                f"event_type '{event_type}' is not recognised. Supported: {sorted(SUPPORTED_EVENTS)}",
                req["request_id"],
                req["session_id"],
            )

        demo_mode = req.get("demo_mode")
        if demo_mode is not None:
            if not isinstance(demo_mode, dict) or not isinstance(demo_mode.get("enabled"), bool):
                return None, self._error(
                    "INVALID_REQUEST",
                    "Field 'demo_mode' must contain a boolean 'enabled' value.",
                    req["request_id"],
                    req["session_id"],
                )
            if demo_mode.get("enabled") and demo_mode.get("scenario_id") != "DEMO_CROSSING_TEN_V1":
                return None, self._error(
                    "INVALID_REQUEST",
                    "Unsupported demo_mode scenario_id.",
                    req["request_id"],
                    req["session_id"],
                )

        capabilities = req.get("client_capabilities")
        if capabilities is not None:
            if not isinstance(capabilities, dict):
                return None, self._error(
                    "INVALID_REQUEST", "client_capabilities must be an object.",
                    req["request_id"], req["session_id"],
                )
            supported_actions = capabilities.get("supported_actions", [])
            if not isinstance(supported_actions, list) or not all(
                isinstance(action, str) for action in supported_actions
            ):
                return None, self._error(
                    "INVALID_REQUEST", "client_capabilities.supported_actions must be a string array.",
                    req["request_id"], req["session_id"],
                )
            if not ({"ASK_QUESTION", "ASK_REASONING"} & set(supported_actions)):
                return None, self._error(
                    "INVALID_REQUEST", "The client must support ASK_QUESTION or ASK_REASONING.",
                    req["request_id"], req["session_id"],
                )
        # 6. payload must be a dict (if present)
        if "payload" in req and not isinstance(req["payload"], dict):
            return None, self._error(
                "INVALID_REQUEST",
                "Field 'payload' must be a JSON object.",
                req["request_id"],
                req["session_id"],
            )

        # 7. Strip privacy-sensitive / forbidden fields
        for field in _STRIP_FIELDS:
            req.pop(field, None)

        # 8. Event-specific flattening for downstream components
        if event_type == "SUPPORT_REQUESTED":
            self._flatten_support(req)
        elif event_type in ("PROBLEM_REQUESTED", "TRANSFER_REQUESTED"):
            self._flatten_problem_or_transfer(req)

        req["_gateway_ms"] = round((time.monotonic() - t_start) * 1000, 2)

        self.log(
            f"[Gateway] request_id={req['request_id']} event={event_type} "
            f"session={req['session_id']} parse_ms={req['_gateway_ms']}"
        )
        return req, None

    # ------------------------------------------------------------------ #
    #  Event-specific payload flattening                                   #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _flatten_support(req: dict) -> None:
        """Flatten nested SUPPORT_REQUESTED payload into top-level convenience keys."""
        payload = req.get("payload") or {}
        problem = payload.get("problem") if isinstance(payload.get("problem"), dict) else {}
        attempt = payload.get("attempt") if isinstance(payload.get("attempt"), dict) else {}
        reasoning = attempt.get("reasoning") if isinstance(attempt.get("reasoning"), dict) else {}
        learner = req.get("learner_context") if isinstance(req.get("learner_context"), dict) else {}
        capabilities = req.get("client_capabilities") if isinstance(req.get("client_capabilities"), dict) else {}
        operands = problem.get("operands") if isinstance(problem.get("operands"), list) else []

        if len(operands) == 2:
            req.setdefault("operand_a", operands[0])
            req.setdefault("operand_b", operands[1])

        req.setdefault("problem_id", problem.get("problem_id", ""))
        req.setdefault("concept", problem.get("concept", "ADDITION_CROSSING_TEN"))
        req.setdefault("operation", problem.get("operation", "ADDITION"))
        req.setdefault("correct_answer", problem.get("correct_answer"))
        req.setdefault("student_answer", attempt.get("submitted_answer"))
        req.setdefault("attempt_number", attempt.get("attempt_number", 1))
        req.setdefault("support_level", learner.get("support_level", 1))
        req.setdefault("supported_actions", capabilities.get("supported_actions", []))

        reasoning_mode = reasoning.get("mode", "SKIPPED")
        if reasoning_mode not in {"TEXT", "VOICE", "OPTION", "SKIPPED"}:
            reasoning_mode = "SKIPPED"

        reasoning_value = (
            reasoning.get("text") if reasoning_mode == "TEXT" else
            reasoning.get("transcript") if reasoning_mode == "VOICE" else
            reasoning.get("option_code") if reasoning_mode == "OPTION" else
            None
        )
        req["reasoning_mode"] = reasoning_mode
        req["confirmed_reasoning"] = (
            reasoning_value.strip()[:500] if isinstance(reasoning_value, str) else None
        )

    @staticmethod
    def _flatten_problem_or_transfer(req: dict) -> None:
        """Flatten PROBLEM_REQUESTED / TRANSFER_REQUESTED payload into top-level keys."""
        payload = req.get("payload") or {}
        learner = req.get("learner_context") if isinstance(req.get("learner_context"), dict) else {}
        capabilities = req.get("client_capabilities") if isinstance(req.get("client_capabilities"), dict) else {}

        req.setdefault("concept", payload.get("concept", "ADDITION_CROSSING_TEN"))
        req.setdefault("operation", payload.get("operation", "ADDITION"))
        req.setdefault("purpose", payload.get("purpose", "INITIAL"))
        req.setdefault("difficulty", payload.get("difficulty", "FOUNDATION"))
        req.setdefault("exclude_problem_ids", payload.get("exclude_problem_ids", []))
        req.setdefault("number_range", payload.get("number_range", {"min": 0, "max": 20}))
        req.setdefault("support_level", learner.get("support_level", 0))
        req.setdefault("supported_actions", capabilities.get("supported_actions", []))

        # TRANSFER-specific
        if req.get("event_type") == "TRANSFER_REQUESTED":
            req.setdefault("source_problem_id", payload.get("source_problem_id", ""))
            req.setdefault("avoid_same_operands", payload.get("avoid_same_operands", True))

    # ------------------------------------------------------------------ #
    #  Error builder                                                       #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _error(code: str, detail: str, request_id: str, session_id: str) -> Data:
        return Data(
            data={
                "schema_version": "1.0",
                "request_id": request_id,
                "session_id": session_id,
                "response_type": "ERROR",
                "status": "ERROR",
                "source": "DETERMINISTIC",
                "problem_id": "",
                "problem": None,
                "inference": None,
                "plan": None,
                "learning_state_patch": None,
                "warnings": [],
                "error": {
                    "code": code,
                    "recoverable": True,
                    "user_message": "Permintaan tidak dapat diproses. Kita coba cara sederhana, ya.",
                    "detail": detail,
                },
            }
        )

    def _as_data(self, req: dict) -> Data:
        return Data(data=req)

    # ------------------------------------------------------------------ #
    #  Routing methods (one per output port)                               #
    # ------------------------------------------------------------------ #

    def route_problem(self) -> Data:
        req, err = self._parse_and_validate()
        if err or req["event_type"] != "PROBLEM_REQUESTED":
            self.stop("problem_out")
            return Data(data={})
        return self._as_data(req)

    def route_support(self) -> Data:
        req, err = self._parse_and_validate()
        if err or req["event_type"] != "SUPPORT_REQUESTED":
            self.stop("support_out")
            return Data(data={})
        return self._as_data(req)

    def route_transfer(self) -> Data:
        req, err = self._parse_and_validate()
        if err or req["event_type"] != "TRANSFER_REQUESTED":
            self.stop("transfer_out")
            return Data(data={})
        return self._as_data(req)

    def route_invalid(self) -> Data:
        req, err = self._parse_and_validate()
        if err:
            return err
        self.stop("invalid_out")
        return Data(data={})
