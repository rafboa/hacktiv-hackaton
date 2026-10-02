"""
ArithRequestGateway — Custom Langflow component
Role : Parse, validate, sanitise, and route incoming domain requests.
Spec : Langflow-Architecture-Arith.md §2, §5, §17
"""

import json
import time
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Data


SUPPORTED_SCHEMA_VERSIONS = {"1"}
SUPPORTED_EVENTS = {"PROBLEM_REQUESTED", "SUPPORT_REQUESTED", "TRANSFER_REQUESTED"}


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
        Output(display_name="PROBLEM_REQUESTED", name="problem_out", method="route_problem"),
        Output(display_name="SUPPORT_REQUESTED", name="support_out", method="route_support"),
        Output(display_name="TRANSFER_REQUESTED", name="transfer_out", method="route_transfer"),
        Output(display_name="INVALID", name="invalid_out", method="route_invalid"),
    ]

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    def _parse_and_validate(self) -> tuple[dict | None, Data | None]:
        """Return (clean_request, None) on success or (None, error_data) on failure."""
        raw = (self.raw_input or "").strip()
        t_start = time.monotonic()

        try:
            req = json.loads(raw)
        except json.JSONDecodeError as exc:
            return None, self._error("INVALID_JSON", str(exc))

        schema_version = str(req.get("schema_version", ""))
        if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
            return None, self._error(
                "UNSUPPORTED_SCHEMA",
                f"schema_version '{schema_version}' is not supported. Supported: {SUPPORTED_SCHEMA_VERSIONS}",
            )

        event_type = req.get("event_type", "")
        if event_type not in SUPPORTED_EVENTS:
            return None, self._error(
                "UNKNOWN_EVENT",
                f"event_type '{event_type}' is not recognised. Supported: {SUPPORTED_EVENTS}",
            )

        # Basic required field presence
        for field in ("request_id", "session_id"):
            if not req.get(field):
                return None, self._error("MISSING_FIELD", f"Required field '{field}' is absent or empty.")

        # Strip fields the backend should never receive from untrusted input
        req.pop("api_key", None)
        req.pop("child_name", None)
        req["_gateway_ms"] = round((time.monotonic() - t_start) * 1000, 2)

        self.log(
            f"[Gateway] request_id={req['request_id']} event={event_type} "
            f"session={req['session_id']} parse_ms={req['_gateway_ms']}"
        )
        return req, None

    @staticmethod
    def _error(code: str, detail: str) -> Data:
        return Data(
            data={
                "status": "ERROR",
                "source": "DETERMINISTIC",
                "error_code": code,
                "error_detail": detail,
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
        # Valid request — stop the error branch
        self.stop("invalid_out")
        return Data(data={})
