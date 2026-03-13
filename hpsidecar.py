#!/usr/bin/env python3
"""
HousePanel Python sidecar server.
Runs as a long-lived HTTP process and accepts POST requests.
returns JSON so HousePanel can safely route selected tile actions here.
"""

from __future__ import annotations

import argparse
import json
import os
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import error, request
from urllib.parse import parse_qs, urlencode
from openai import OpenAI

GLB = {}
CTX_LOCK = threading.Lock()
AI_CONTEXT: dict[str, list[dict[str, Any]]] = {}
CONTEXT_VERSION: dict[str, int] = {}

DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
DEFAULT_CONTEXT_KEY = "global"
DEFAULT_CONTEXT_LIMIT = 25
MAX_TOOL_STEPS = 4
CHAT_CONTEXT = {}
# CHAT_CONTEXT_VERSION: dict[str, int] = {}

# exclude the subid and value fields since they will be combined into a single activity context field
DEFAULT_EVENT_FIELD_NAMES: dict[str, str] = {
    "userid": "userid",
    "hubid": "hubid",
    "deviceid": "deviceid",
    "devicetype": "devicetype",
    "devicename": "devicename",
    "activity": "activity"
}

# filter values and filter types are for flagging important events in the context for the AI model
FILTER_VALUES = ["on", "open", "present", "absent", "unlocked", "locked"]
FILTER_TYPES = ["hsm","mode","thermostat"]

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _get_configdata() -> dict[str, Any]:
    cfg_path = Path(__file__).resolve().parent / "housepanel.cfg"
    try:
        with cfg_path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
    
def _get_python_port_from_cfg(default_port: int = 38401) -> int:
    global GLB
    try:
        cfg_port = GLB.get("pythonport")
        if cfg_port is None:
            cfg_port = default_port
            GLB["pythonport"] = cfg_port
        return int(cfg_port)
    except Exception:
        return default_port


def _get_openai_api_key() -> str | None:
    global GLB
    key = GLB.get("openai_api_key")
    if isinstance(key, str) and key.strip():
        GLB["openai_api_key"] = key.strip()
        return key.strip()
    env_key = os.getenv("OPENAI_API_KEY")
    if isinstance(env_key, str) and env_key.strip():
        GLB["openai_api_key"] = env_key.strip()
        return env_key.strip()
    return None


def _get_context_limit(limit_type: str = "ai_context_limit") -> int:
    global GLB
    try:
        raw = GLB.get(limit_type) or os.getenv(limit_type.upper()) or DEFAULT_CONTEXT_LIMIT
        parsed = int(raw)
        return max(1, parsed)
    except Exception:
        return DEFAULT_CONTEXT_LIMIT


def _debug5_enabled() -> bool:
    raw = GLB.get("debug5", False)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw != 0
    if isinstance(raw, str):
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    return False

def _normalize_event(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = {}

    # Fall back to common HousePanel-like fields if event wasn't supplied.
    for source_name, target_name in DEFAULT_EVENT_FIELD_NAMES.items():
        if source_name in payload and target_name not in normalized:
            normalized[target_name] = payload[source_name]

    # create a context for the activity and value if they exist in the payload
    activity = payload.get("activity")
    value = payload.get("value")
    if isinstance(activity, str) and activity:
        normalized[activity] = value

    # add field for the most important events for the AI model to easily find them
    if (payload.get("value") and payload.get("value") in FILTER_VALUES) or (payload.get("devicetype") and payload.get("devicetype") in FILTER_TYPES):
        normalized["important_event"] = True

    # create a timestamp for the event
    normalized["received_at"] = _utc_now()
    return normalized

def _append_context_event(context_key: str, event: dict[str, Any]) -> int:
    limit = _get_context_limit()
    with CTX_LOCK:
        if context_key not in AI_CONTEXT:
            AI_CONTEXT[context_key] = []
        events = AI_CONTEXT[context_key]

        # check if the most recent event in the context is the same device and activity as this new event, and if so update that event instead of appending a new one to avoid duplicates in the context for the AI model
        # we do this by looking at the activity value in the event
        if events:
            last_event = events[-1]
            activity = event.get("activity")
            if (
                last_event.get("deviceid") == event.get("deviceid")
                and last_event.get(activity) == event.get(activity)
            ):
                last_event.update(event)
                # CONTEXT_VERSION[context_key] = CONTEXT_VERSION.get(context_key, 0) + 1
                if _debug5_enabled():
                    print(f"Context {context_key} updated by merging with last event: {event}. Total events in context: {len(events)}")
                return len(events)

        events.append(event)
        if len(events) > limit:
            del events[0 : len(events) - limit]
        # CONTEXT_VERSION[context_key] = CONTEXT_VERSION.get(context_key, 0) + 1

        if _debug5_enabled():
            print(f"Context {context_key} updated with event: {event}. Total events in context: {len(events)}")
        return len(events)

def _update_motion_context(context_key: str, event: dict[str, Any], deviceid: str) -> int:
    # because we keep only one event per motion sensor, this limit can be higher than the main context limit to give the AI model more relevant motion history
    # it should be greater than the number of motion sensors you have, but if you only want to track a few it can be set lower
    limit = _get_context_limit("ai_motion_limit")
    with CTX_LOCK:
        if context_key not in AI_CONTEXT:
            AI_CONTEXT[context_key] = []
        events = AI_CONTEXT[context_key]

        # only keep one active motion event per deviceid in the context to avoid noise, and include in that event the number of motion activities detected
        # look for an existing event for this deviceid in the context and get the activity count if it exists then remove it so we can add the updated event to the end of the list
        # to keep the most recent activity for each motion sensor at the end of the list for easier processing by the AI model
        activity_count = 0
        for e in events:
            if e.get("deviceid") == deviceid:
                e_count = e.get("activity_count", 1)
                activity_count = max(activity_count, e_count)
                events.remove(e)

        # update count only if the motion is active
        # we want to keep the count of how many times motion was detected for the AI model to understand the level of activity, 
        # but we only want to increment that count when motion is active, not when it becomes inactive
        # also note that the event uses the motion key based on the activity field value
        if event.get("motion") and event.get("motion") == "active":
            event["activity_count"] = activity_count + 1

        events.append(event)

        # trim the motion events if we are at the limit after adding the new event
        if len(events) > limit:
            del events[0 : len(events) - limit]
        # CONTEXT_VERSION[context_key] = CONTEXT_VERSION.get(context_key, 0) + 1

        if _debug5_enabled():
            print(f"Motion context {context_key} updated with event: {event}. Total events in context: {len(events)}")
        return len(events)


def _get_context_events(context_key: str) -> list[dict[str, Any]]:
    with CTX_LOCK:
        return list(AI_CONTEXT.get(context_key, []))


def _context_to_text(context_events: list[dict[str, Any]]) -> str:
    if not context_events:
        return "(no smart-home context received yet)"
    lines: list[str] = []
    for idx, event in enumerate(context_events, start=1):
        if isinstance(event, dict):
            filtered_event = {k: v for k, v in event.items() if k not in {"last_prompt", "last_response"}}
        else:
            filtered_event = event
        lines.append(f"{idx}. {json.dumps(filtered_event, ensure_ascii=True)}")
    return "\n".join(lines)


def _extract_text_from_openai_response(data: dict[str, Any]) -> str:
    direct = data.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    output = data.get("output", [])
    if isinstance(output, list):
        parts: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content", [])
            if not isinstance(content, list):
                continue
            for piece in content:
                if not isinstance(piece, dict):
                    continue
                if piece.get("type") == "output_text":
                    text = piece.get("text")
                    if isinstance(text, str) and text:
                        parts.append(text)
        if parts:
            return "\n".join(parts).strip()

    return ""


def _to_dict(obj: Any) -> dict[str, Any]:
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        dumped = obj.model_dump()
        if isinstance(dumped, dict):
            return dumped
    if hasattr(obj, "dict"):
        dumped = obj.dict()
        if isinstance(dumped, dict):
            return dumped
    return {}


def _extract_function_calls(data: dict[str, Any]) -> list[dict[str, Any]]:
    output = data.get("output", [])
    if not isinstance(output, list):
        return []
    calls: list[dict[str, Any]] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        if item.get("type") != "function_call":
            continue
        calls.append(
            {
                "call_id": item.get("call_id"),
                "name": item.get("name"),
                "arguments": item.get("arguments", "{}"),
            }
        )
    return calls


def _is_hub_action_enabled() -> bool:
    raw = GLB.get("call_hub_action", False)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw != 0
    if isinstance(raw, str):
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _get_hub_context(context_key: str) -> dict[str, Any] | None:
    with CTX_LOCK:
        hub_ctx = GLB.get(context_key)
        return hub_ctx


def _call_hubitat_endpoint(*, hubendpt: str, accesstoken: str, api_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not hubendpt or not accesstoken:
        return {"ok": False, "error": "Hub endpoint or access token missing"}

    base_url = f"{hubendpt.rstrip('/')}/{api_name.lstrip('/')}"
    url = f"{base_url}?access_token={accesstoken}"
    payload["access_token"] = accesstoken  # include access token in payload for easier processing in Hubitat apps if needed
    body_payload = dict(payload)
    data = urlencode(body_payload).encode("utf-8")

    if _debug5_enabled():
        print(f"Calling Hubitat endpoint {url} with payload: {body_payload} and data: {data}")
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = {"raw": raw}
            return {"ok": True, "result": parsed}
    except error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        return {"ok": False, "error": f"Hub HTTP {e.code}", "detail": detail}
    except Exception as e:
        return {"ok": False, "error": f"Hub request failed: {e}"}


def _tool_hub_query(context_key: str, arguments: dict[str, Any]) -> dict[str, Any]:
    hub_ctx = _get_hub_context(context_key)

    if _debug5_enabled():
        print(f"\n\nTool hub_query called with context_key: {context_key}, arguments: {arguments}, hub_ctx: {hub_ctx}\n\n")

    if not hub_ctx:
        return {"ok": False, "error": "Hub context missing. Initialize with ai-init first."}

    swid = str(arguments.get("swid", "all"))
    swtype = str(arguments.get("swtype", "all"))
    payload: dict[str, Any] = {"swid": swid, "swtype": swtype}
    return _call_hubitat_endpoint(
        hubendpt=str(hub_ctx.get("hubendpt", "")),
        accesstoken=str(hub_ctx.get("accesstoken", "")),
        api_name="doquery",
        payload=payload,
    )


def _tool_hub_action(context_key: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if not _is_hub_action_enabled():
        return {"ok": False, "error": "hub_action is disabled. Set GLB['call_hub_action']=True to enable."}

    hub_ctx = _get_hub_context(context_key)
    if not hub_ctx:
        return {"ok": False, "error": "Hub context missing. Initialize with ai-init first."}

    swid = arguments.get("swid")
    if swid is None:
        return {"ok": False, "error": "swid is required for hub_action"}

    swvalue = arguments.get("swvalue")
    if swvalue is None or swvalue == "":
        swvalue = arguments.get("command", "")

    payload: dict[str, Any] = {
        "swid": str(swid),
        "swtype": str(arguments.get("swtype", "auto")),
        "swattr": str(arguments.get("swattr", "")),
        "swvalue": swvalue,
        "subid": str(arguments.get("subid", "")),
    }
    return _call_hubitat_endpoint(
        hubendpt=str(hub_ctx.get("hubendpt", "")),
        accesstoken=str(hub_ctx.get("accesstoken", "")),
        api_name="doaction",
        payload=payload,
    )


def _dispatch_tool_call(context_key: str, name: str, arguments_raw: str) -> dict[str, Any]:
    try:
        arguments = json.loads(arguments_raw) if arguments_raw else {}
    except json.JSONDecodeError:
        return {"ok": False, "error": "Invalid JSON arguments passed to function tool"}

    if not isinstance(arguments, dict):
        return {"ok": False, "error": "Function arguments must be a JSON object"}

    if name == "hub_query":
        if _debug5_enabled():
            print(f"Dispatching tool call: {name} with arguments: {arguments}")
        return _tool_hub_query(context_key, arguments)
    if name == "hub_action":
        if _debug5_enabled():
            print(f"Dispatching tool call: {name} with arguments: {arguments}")
        return _tool_hub_action(context_key, arguments)
    return {"ok": False, "error": f"Unsupported tool name: {name}"}


def _call_openai_with_context( *, api_key: str, model: str, prompt: str, context_key: str, motion_key: str, instructions: str ) -> dict[str, Any]:
    if not api_key:
        api_key = _get_openai_api_key()
        if not api_key:
            return {"ok": False, "error": "Missing API key: set openai_api_key in housepanel.cfg or OPENAI_API_KEY env var"}

    context_events = _get_context_events(context_key)
    context_text = _context_to_text(context_events)

    # if motion key is provided, get those events and include them in the context text with a clear header so the AI model can understand 
    # that they are motion events and separate from the main context
    if len(motion_key) > 0:
        motion_events = _get_context_events(motion_key)
        if motion_events:
            motion_text = _context_to_text(motion_events)
            context_text += f"\n\nMotion Events:\n{motion_text}"

    client = OpenAI(api_key=api_key)
    # main_ver = CONTEXT_VERSION.get(context_key, 0)
    # motion_ver = CONTEXT_VERSION.get(motion_key, 0)
    # combined_context_version = (main_ver * 1_000_000) + motion_ver
    # previous_response_id = None
    # if CHAT_CONTEXT_VERSION.get(context_key) == combined_context_version:
    #     previous_response_id = CHAT_CONTEXT.get(context_key, None)

    previous_response_id = CHAT_CONTEXT.get(context_key, None)
    user_text = f"{prompt}\n\nSmart-home context:\n{context_text}"
    user_content = [{"type": "input_text", "text": user_text}]
    tools = [
        {
            "type": "function",
            "name": "hub_query",
            "description": "Query the smart hub for current device or home status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "swid": {"type": "string", "description": "Device ID or 'all' for all devices."},
                    "swtype": {"type": "string", "description": "HousePanel device type or 'all'/'auto'."},
                },
                "required": ["swid"],
                "additionalProperties": False,
            },
        }
    ]
    if _is_hub_action_enabled():
        tools.append(
            {
                "type": "function",
                "name": "hub_action",
                "description": "Invoke a smart hub device action.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "swid": {"type": "string", "description": "Device ID to control."},
                        "swtype": {"type": "string", "description": "HousePanel device type (or 'auto')."},
                        "swattr": {"type": "string", "description": "Optional attribute that isn't used when swvalue is provided."},
                        "swvalue": {"description": "Value or command to send to the device."},
                        "subid": {"type": "string", "description": "Sub-field/action for the tile."},
                    },
                    "required": ["swid", "swvalue"],
                    "additionalProperties": False,
                },
            }
        )

    response_params = dict(
        model= model,
        instructions=instructions,
        tools=tools,
        input=[{"role": "user", "content": user_content}]
    )

    # add reasoning effort hint for models that support it
    if (model.startswith("gpt-5") or model.startswith("gpt-4")) and not model.endswith("-mini"):
        response_params["reasoning"] = {"effort": "low"}

    if previous_response_id:
        response_params["previous_response_id"] = previous_response_id

    if _debug5_enabled():
        print(f"Sending OpenAI request with params: {response_params}")
    try:
        response = client.responses.create(**response_params)
        steps = 0
        while steps < MAX_TOOL_STEPS:
            response_data = _to_dict(response)
            function_calls = _extract_function_calls(response_data)
            if not function_calls:
                break

            tool_output_items: list[dict[str, Any]] = []
            for call in function_calls:
                call_id = call.get("call_id")
                name = str(call.get("name", ""))
                args_raw = str(call.get("arguments", "{}"))
                if not call_id:
                    continue
                output = _dispatch_tool_call(context_key, name, args_raw)
                tool_output_items.append(
                    {
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": json.dumps(output, ensure_ascii=True),
                    }
                )

            if not tool_output_items:
                break

            tool_response_params = dict(
                model=model,
                previous_response_id=response.id,
                input=tool_output_items,
            )

            # add reasoning effort hint for models that support it
            if (model.startswith("gpt-5") or model.startswith("gpt-4")) and not model.endswith("-mini"):
                tool_response_params["reasoning"] = {"effort": "low"}

            response = client.responses.create(**tool_response_params)
            steps += 1

        CHAT_CONTEXT[context_key] = response.id
        # CHAT_CONTEXT_VERSION[context_key] = combined_context_version
        text = _extract_text_from_openai_response(_to_dict(response))
        return {"status": "ok", "response": text}

    except Exception as e:
        print(f"OpenAI request failed: {e}")
        return {"status": "error", "response": f"OpenAI request failed: {e}"}

def _init_ai_context(api_key, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    global GLB
    userid = payload.get("userid") or 0
    hubid = payload.get("hubid") or "unknown"
    hubname = payload.get("hubname") or "unknown"
    hubtype = payload.get("hubtype") or "unknown"
    accesstoken = payload.get("hubaccess") or "unknown"
    hubendpt = payload.get("hubendpt") or "unknown"

    if _debug5_enabled():
        print(f"\n\nInitializing AI context for userid: {userid}, hubid: {hubid}, hubname: {hubname}, hubtype: {hubtype}, hubendpt: {hubendpt}")

    # return error and do nothing if not a Hubitat hub
    if hubtype.lower() != "hubitat":
        return 400, {"status": "error", "response": f"Unsupported hub type: {hubtype}. Only 'Hubitat' is supported for AI context initialization."}
    
    # grab other info for the context
    # store hub credentials in a local global list for later use in API calls by the AI model, but do not include them in the context sent to the AI model for security reasons
    context_key = f"hubid_{hubid}|user_{userid}"
    motion_key = f"hubid_{hubid}|user_{userid}|motion"
    with CTX_LOCK:
        if context_key not in AI_CONTEXT:
            AI_CONTEXT[context_key] = []
        if motion_key not in AI_CONTEXT:
            AI_CONTEXT[motion_key] = []
        # CONTEXT_VERSION[context_key] = 0
        # CONTEXT_VERSION[motion_key] = 0
        hub_ctx = {"hubname": hubname, "accesstoken": accesstoken, "hubendpt": hubendpt, "hubid": hubid, "userid": userid}

        # set a hub specific context key
        GLB[context_key] = hub_ctx
    CHAT_CONTEXT.pop(context_key, None)
    # CHAT_CONTEXT_VERSION.pop(context_key, None)

    # set the context string based on the device name and state

    model = GLB.get("openai_model", DEFAULT_OPENAI_MODEL)
    result = _call_openai_with_context(
        api_key= api_key,
        model=model,
        prompt=f"This is an initial smart home request for actions and questions later by userid = {userid}, for the home named {hubname} and hubid = {hubid}",
        context_key=context_key,
        motion_key=motion_key,
        instructions=f"You are a smart-home assistant. Your job is to assist with smart-home related tasks and questions. This is an initial request to set up your context about the user's home and hub. Remember the home name ({hubname}) and hubid ({hubid}) for future questions. Do not respond to the user, just acknowledge that you have stored the context."
    )
    return 200, {"status": result.get("status", "ok"), "response": result.get("response", "")}

def _update_ai_context(payload) -> tuple[int, dict[str, Any]]:
    global GLB
    userid = payload.get("userid")
    hubid = payload.get("hubid")
    if userid is None or hubid is None:
        return 400, {"status": "error", "response": "Missing userid or hubid in payload."}
    
    # update the AI context with this new event
    normalized_event = _normalize_event(payload)

    # keep separate context for motion sensors to avoid noise in the main context for the AI model, and to give the most relevant context to the AI model when motion activity is detected
    if payload.get("activity") == "motion" and payload.get("deviceid"):
        context_key = f"hubid_{hubid}|user_{userid}|motion"
        _update_motion_context(context_key, normalized_event, payload.get("deviceid"))
    else:
        context_key = f"hubid_{hubid}|user_{userid}"
        _append_context_event(context_key, normalized_event)

    return 200, {"status": "ok", "response": "Context updated successfully.", "context_key": context_key}

def _reset_motion_context(payload) -> tuple[int, dict[str, Any]]:
    global GLB
    userid = payload.get("userid")
    hubid = payload.get("hubid")
    if userid is None or hubid is None:
        return 400, {"status": "error", "response": "Missing userid or hubid in payload."}

    context_key = f"hubid_{hubid}|user_{userid}|motion"
    with CTX_LOCK:
        if context_key not in AI_CONTEXT:
            AI_CONTEXT[context_key] = []
        events = AI_CONTEXT[context_key]

        # reset the motion event counters to zero
        # this is called every time mode turns to night but can be invoked by the user too
        for e in events:
            e["activity_count"] = 0

        return 200, {"status": "ok", "response": f"Reset {len(events)} motion contexts.", "context_key": context_key}

def _handle_ai_request(api_key, payload) -> tuple[int, dict[str, Any]]:
    global GLB
    userid = payload.get("userid")
    hubid = payload.get("hubid")
    prompt = payload.get("prompt", "What is the status of the home?")

    if userid is None or hubid is None:
        return 400, {"status": "error", "response": "Missing userid or hubid in payload."}
    
    context_key = f"hubid_{hubid}|user_{userid}"
    motion_key = f"hubid_{hubid}|user_{userid}|motion"

    # implement precaution from calling multiple times within the same context update loop by checking if the prompt is the same as the most recent prompt in the context, and if so return an error to avoid potential infinite loops of context updates triggering AI requests triggering more context updates
    # we check the last two events in the context to allow for one context update after the AI response without blocking new AI requests, since the context update and AI request could come in in either order depending on timing
    context_events = _get_context_events(context_key)
    if context_events:
        last_event = context_events[-1]
        last_prompt = last_event.get("last_prompt")
        if last_prompt == prompt:
            return 200, {"status": "ok", "response": last_event.get("last_response", "Your previous request with the same prompt is still being processed. Please wait for the response before sending another request with the same prompt.")}
    else:
        last_event = None
        last_prompt = None

    model = GLB.get("openai_model", DEFAULT_OPENAI_MODEL)
    result = _call_openai_with_context(
        api_key= api_key,
        model=model,
        prompt=prompt,
        context_key=context_key,
        motion_key= motion_key,
        instructions="You are a smart-home assistant. Your job is to use the provided context to assist with smart-home related tasks and questions."
    )

    if result.get("status") == "error":
        return 500, {"status": "error", "response": result.get("response", "Unknown error from OpenAI")}

    if last_event and last_prompt == prompt:
        last_event["last_prompt"] = prompt
        last_event["last_response"] = result.get("response", "")
        
    return 200, {"status": result.get("status", "ok"), "response": result.get("response", "")}

class HPPythonHandler(BaseHTTPRequestHandler):
    server_version = "HousePanelPython/0.1"

    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # Allow calls from the Node-served HousePanel UI on another port.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _read_payload(self) -> Any:
        length_str = self.headers.get("Content-Length", "0")
        try:
            length = int(length_str)
        except ValueError:
            length = 0

        raw = self.rfile.read(length) if length > 0 else b""
        if not raw:
            return {}

        ctype = self.headers.get("Content-Type", "")
        text = raw.decode("utf-8", errors="replace")

        if "application/json" in ctype:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"_raw": text}

        if "application/x-www-form-urlencoded" in ctype:
            parsed = parse_qs(text, keep_blank_values=True)
            # Flatten single-item lists for convenience.
            flat: dict[str, Any] = {}
            for key, values in parsed.items():
                flat[key] = values[0] if len(values) == 1 else values
            return flat

        return {"_raw": text}

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"status": "ok"})

    def do_POST(self) -> None:
        payload = self._read_payload()
        if not isinstance(payload, dict):
            print(f"Unexpected payload type: {type(payload)}")
            return
        
        api = payload.get("api", "unknown")
        api_key = _get_openai_api_key()

        if not api_key:
            print("\nNo OpenAI API key configured. Set openai_api_key in housepanel.cfg or OPENAI_API_KEY env var.")
            self._send_json(500, {"status": "error", "response": "No OpenAI API key configured."})
            return

        # handle AI payloads
        print(f"\nReceived api = {api} request with payload: {payload}")
        if api == "ai-context":
            status, body = _update_ai_context(payload)
            self._send_json(status, body)
            return
        
        elif api in ("ai-init", "initialize"):
            status, body = _init_ai_context(api_key, payload)
            self._send_json(status, body)
            return
        
        elif api == "ai-request":
            status, body = _handle_ai_request(api_key, payload)
            self._send_json(status, body)
            return

        elif api == "ai-motion-reset":
            status, body = _reset_motion_context(payload)
            self._send_json(status, body)
            return
                
        else:
            print(f"\nReceived unrecognized api request = {api} with payload: {payload}")
            self._send_json(500, {"status": "error", "response": f"Unrecognized api request: {api}"})

    def do_GET(self) -> None:
        self._send_json(
            200,
            {
                "status": "ok",
                "service": "hpserver.py",
                "timestamp": _utc_now(),
                "response": "Use POST for HousePanel action calls.",
            },
        )

    def log_message(self, fmt: str, *args: Any) -> None:
        # Keep console output compact and timestamped.
        print(f"[{_utc_now()}] {self.client_address[0]} - {fmt % args}")


def main() -> None:
    global GLB
    GLB = _get_configdata()
    default_port = _get_python_port_from_cfg()

    parser = argparse.ArgumentParser(description="HousePanel Python sidecar server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument(
        "--port",
        type=int,
        default=default_port,
        help=f"Bind port (default: {default_port}, from housepanel.cfg pythonport)",
    )
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), HPPythonHandler)
    print(f"hpserver.py listening on http://{args.host}:{args.port}")
    try:
        print("hpserver.py starting...")
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("hpserver.py stopped")

if __name__ == "__main__":
    main()
