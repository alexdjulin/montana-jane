# Agentic media hack — starter

One key. Everything below runs on your `FAL_KEY` from https://fal.ai/dashboard/keys.

```bash
export FAL_KEY=...
uv sync
uv run python agent.py "A hero image for a Berlin coffee roastery: moody, warm, no people"
```

## Rule to win a prize

Your agent must chain at least two fal model calls where the second depends on the
output of the first, and must make at least one decision no human scripted.
"Prompt → image → done" does not qualify.

## Three ways to touch fal

**1. fal MCP in your IDE** — explore models, check schemas and pricing, run inference from Claude Code / Cursor / Windsurf.
(Not Claude Desktop or claude.ai yet — no OAuth support.)

```bash
claude mcp add --transport http fal-ai https://mcp.fal.ai/mcp \
  --header "Authorization: Bearer $FAL_KEY"
```

Then ask: *"recommend a model to turn a product photo into a lifestyle shot and tell me the price."*

**2. genmedia CLI** — generate images and video from the terminal, with style profiles.

```bash
curl https://genmedia.sh/install -fsS | bash
genmedia setup
```

**3. The API** — this repo. An LLM (via fal's OpenRouter router) uses fal media models as tools.

```bash
export FAL_KEY=...
uv sync
uv run python agent.py "Your brief here"
```

## Extending it

Add a tool in `agent.py`: write a wrapper that calls `fal_client.subscribe(...)`, add it to
`TOOL_FUNCS`, and describe it in `TOOLS`. Use the MCP `get_model_schema` tool to get the exact
argument names for any endpoint. Ideas: text-to-speech, upscaling, background removal, lip sync.

Change the brain by editing `LLM` — any OpenRouter model id works
(`google/gemini-2.5-flash`, `anthropic/claude-sonnet-5`, ...). Pick one that supports
tool calling and image input.
