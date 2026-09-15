"""
Agentic media hack — starter demo. Everything runs on ONE fal key.

  brain : any LLM via fal's OpenRouter router (OpenAI-compatible endpoint)
  hands : fal image / edit / video models, exposed as tools

The agent SEES every image it produces and decides what to do next:
accept, edit, regenerate, animate. One prompt in, one image out is not agentic.

Usage:
    export FAL_KEY=...            # https://fal.ai/dashboard/keys  (the only key you need)
    uv sync
    uv run python agent.py "A hero image for a Berlin coffee roastery: moody, warm, no people"
"""

import json
import os
import sys

import fal_client
from openai import OpenAI

# ---------------------------------------------------------------------------
# Config — swap for whatever you want to showcase.
# ---------------------------------------------------------------------------
LLM = "google/gemini-2.5-flash"       # or "anthropic/claude-sonnet-5", any OpenRouter model id
MODELS = {
    "text_to_image": "fal-ai/nano-banana-2",
    "image_edit": "fal-ai/nano-banana-pro/edit",
    "image_to_video": "minimax/h3-max/camera-controls",
}
ORBIT_TRAJECTORY = [
    {"time": 0, "azimuth": 0, "elevation": 0, "distance": 1},
    {"time": 0.104167, "azimuth": 45, "elevation": 0, "distance": 1},
    {"time": 0.208333, "azimuth": 90, "elevation": 0, "distance": 1},
    {"time": 0.3125, "azimuth": 135, "elevation": 0, "distance": 1},
    {"time": 0.416666, "azimuth": 180, "elevation": 0, "distance": 1},
    {"time": 0.520833, "azimuth": 225, "elevation": 0, "distance": 1},
    {"time": 0.625, "azimuth": 270, "elevation": 0, "distance": 1},
    {"time": 0.729166, "azimuth": 315, "elevation": 0, "distance": 1},
    {"time": 0.833333, "azimuth": 360, "elevation": 0, "distance": 1},
]
MAX_STEPS = 12
# Scene text for camera-controls: H3 gets the image prompt only, never camera language.
SCENE_BY_URL: dict[str, str] = {}
LAST_SCENE = ""


def _remember_scene(image_url: str, prompt: str) -> None:
    global LAST_SCENE
    SCENE_BY_URL[image_url] = prompt
    LAST_SCENE = prompt

llm = OpenAI(
    base_url="https://fal.run/openrouter/router/openai/v1",
    api_key="not-needed",
    default_headers={"Authorization": f"Key {os.environ.get('FAL_KEY', '')}"},
)

# ---------------------------------------------------------------------------
# fal tools — thin wrappers, each returns a dict with a URL.
# ---------------------------------------------------------------------------
def generate_image(prompt: str, aspect_ratio: str = "16:9") -> dict:
    out = fal_client.subscribe(
        MODELS["text_to_image"],
        arguments={"prompt": prompt, "aspect_ratio": aspect_ratio, "num_images": 1},
    )
    url = out["images"][0]["url"]
    _remember_scene(url, prompt)
    return {"image_url": url}


def edit_image(image_url: str, instruction: str) -> dict:
    out = fal_client.subscribe(
        MODELS["image_edit"],
        arguments={"image_urls": [image_url], "prompt": instruction, "num_images": 1},
    )
    url = out["images"][0]["url"]
    _remember_scene(url, SCENE_BY_URL.get(image_url, LAST_SCENE))
    return {"image_url": url}


def image_to_video(image_url: str) -> dict:
    # Scene only — orbit is entirely in camera_trajectory. Reuse the image prompt.
    prompt = SCENE_BY_URL.get(image_url) or LAST_SCENE
    out = fal_client.subscribe(
        MODELS["image_to_video"],
        arguments={
            "image_url": image_url,
            "prompt": prompt,
            "duration": 6,
            "prompt_expansion_mode": "balanced",
            "camera_trajectory": ORBIT_TRAJECTORY,
        },
    )
    return {"video_url": out["video"]["url"]}


TOOL_FUNCS = {
    "generate_image": generate_image,
    "edit_image": edit_image,
    "image_to_video": image_to_video,
}

TOOLS = [
    {"type": "function", "function": {
        "name": "generate_image",
        "description": "Generate a brand-new image from a text prompt.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Detailed visual prompt."},
                "aspect_ratio": {"type": "string", "enum": ["1:1", "16:9", "9:16", "4:3"]},
            },
            "required": ["prompt"],
        },
    }},
    {"type": "function", "function": {
        "name": "edit_image",
        "description": "Edit an existing image with a natural-language instruction. "
                       "Prefer this over regenerating when the image is close but needs a fix.",
        "parameters": {
            "type": "object",
            "properties": {
                "image_url": {"type": "string"},
                "instruction": {"type": "string", "description": "What to change, e.g. 'remove the person on the left'."},
            },
            "required": ["image_url", "instruction"],
        },
    }},
    {"type": "function", "function": {
        "name": "image_to_video",
        "description": "Animate a finished image into a 360° orbit clip. The camera path is fixed. "
                       "Only call once you have an image you've approved. Do not describe camera or motion.",
        "parameters": {
            "type": "object",
            "properties": {
                "image_url": {"type": "string"},
            },
            "required": ["image_url"],
        },
    }},
]

SYSTEM = """You are a creative-director agent producing media assets with fal.

Loop:
1. Read the brief. Decide what to generate.
2. Call a tool. You will then be shown the resulting image.
3. LOOK at it. Check it against the brief: subject, mood, composition, anything forbidden.
4. If it fails, either edit_image (small fix) or generate_image again (wrong direction). Say in one sentence what was wrong.
5. When an image passes, optionally animate it with image_to_video (a 360° orbit around a still subject) if the brief asks for video.
6. Stop with a short final report: what you made, what you rejected and why, and the final asset URLs.

Be decisive. Do not generate more than 4 images total. Never ask the user questions."""


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------
def run_tool(name: str, args: dict) -> dict:
    print(f"\n  ▶ {name}({json.dumps(args)[:120]})")
    try:
        result = TOOL_FUNCS[name](**args)
        print(f"  ✔ {result}")
        return result
    except Exception as e:  # keep the agent alive on a bad model call
        print(f"  ✖ {e}")
        return {"error": str(e)}


def run_agent(brief: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": f"Brief: {brief}"},
    ]

    for step in range(MAX_STEPS):
        resp = llm.chat.completions.create(model=LLM, messages=messages, tools=TOOLS, max_tokens=1500)
        msg = resp.choices[0].message
        messages.append(msg.model_dump(exclude_none=True))

        if msg.content and msg.content.strip():
            print(f"\n[{step}] {msg.content.strip()}")
        if not msg.tool_calls:
            return msg.content or ""

        images_to_show = []
        for tc in msg.tool_calls:
            result = run_tool(tc.function.name, json.loads(tc.function.arguments))
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
            if "image_url" in result:
                images_to_show.append((tc.function.name, result["image_url"]))

        # The critical part. Tool results are text-only in the OpenAI format, so we
        # follow up with a user turn that carries the actual pixels. Without this the
        # model is prompting blind; with it, it can judge and decide.
        if images_to_show:
            content = [{"type": "text", "text": "Here is what you just produced. Inspect it against the brief and decide the next step."}]
            for name, url in images_to_show:
                content.append({"type": "text", "text": f"Output of {name}: {url}"})
                content.append({"type": "image_url", "image_url": {"url": url}})
            messages.append({"role": "user", "content": content})

    return "Stopped: hit MAX_STEPS."


if __name__ == "__main__":
    brief = " ".join(sys.argv[1:]) or "A hero image for a Berlin specialty coffee roastery. Warm, moody, morning light, no people, no text."
    print(f"Brief: {brief}\nBrain: {LLM} via fal router\n")
    print("\n=== FINAL REPORT ===\n" + run_agent(brief))
