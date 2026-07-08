import config from "../../config.js";
import { convertRequest } from "./request-converter.js";
import {
  convertResponse,
  buildStreamEvents,
  createStreamState,
} from "./response-converter.js";

function resolveModel(anthropicModel) {
  return config.openaiModel;
}

async function handleNonStreaming(req, res) {
  const targetModel = resolveModel(req.body.model);
  const openAiBody = convertRequest(req.body, targetModel);

  const url = `${config.openaiBaseUrl}/chat/completions`;

  const openAiRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify(openAiBody),
  });

  if (!openAiRes.ok) {
    const errorText = await openAiRes.text();
    console.error(`OpenAI-compatible API error ${openAiRes.status}:`, errorText);
    return res.status(openAiRes.status).json({
      type: "error",
      error: {
        type: "api_error",
        message: `OpenAI API returned ${openAiRes.status}: ${errorText}`,
      },
    });
  }

  const openAiData = await openAiRes.json();
  const anthropicResponse = convertResponse(openAiData, req.body.model || "claude-sonnet-4-20250514");

  res.json(anthropicResponse);
}

async function handleStreaming(req, res) {
  const targetModel = resolveModel(req.body.model);
  const openAiBody = convertRequest(req.body, targetModel);

  const url = `${config.openaiBaseUrl}/chat/completions`;

  const openAiRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify(openAiBody),
  });

  if (!openAiRes.ok) {
    const errorText = await openAiRes.text();
    console.error(`OpenAI-compatible API error ${openAiRes.status}:`, errorText);
    return res.status(openAiRes.status).json({
      type: "error",
      error: {
        type: "api_error",
        message: `OpenAI API returned ${openAiRes.status}: ${errorText}`,
      },
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const state = createStreamState(req.body.model || "claude-sonnet-4-20250514");
  const reader = openAiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") continue;

        let chunk;
        try {
          chunk = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        const events = buildStreamEvents(chunk, state);
        for (const event of events) {
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
      }
    }

    if (!state.ended) {
      if (state.activeBlock) {
        res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: state.activeBlock.index })}\n\n`);
      }
      const hasToolUse = Object.keys(state.knownToolCalls).length > 0;
      const outputTokens = state.usage?.completion_tokens || 0;
      res.write(`event: message_delta\ndata: ${JSON.stringify({
        type: "message_delta",
        delta: { stop_reason: hasToolUse ? "tool_use" : "end_turn", stop_sequence: null },
        usage: { output_tokens: outputTokens }
      })}\n\n`);
      res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
    }
  } catch (err) {
    console.error("Stream processing error:", err);
  } finally {
    res.end();
  }
}

export async function messagesHandler(req, res) {
  try {
    if (req.body.stream) {
      await handleStreaming(req, res);
    } else {
      await handleNonStreaming(req, res);
    }
  } catch (err) {
    console.error("Messages handler error:", err);
    res.status(500).json({
      type: "error",
      error: {
        type: "api_error",
        message: err.message,
      },
    });
  }
}
