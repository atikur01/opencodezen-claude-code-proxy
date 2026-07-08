import crypto from "node:crypto";

function generateId(prefix = "msg") {
  return `${prefix}_${crypto.randomBytes(16).toString("hex").slice(0, 24)}`;
}

function mapFinishReason(reason, hasToolUse) {
  if (hasToolUse) return "tool_use";
  const mapping = {
    stop: "end_turn",
    length: "max_tokens",
    tool_calls: "tool_use",
    content_filter: "end_turn"
  };
  return mapping[reason] || "end_turn";
}

export function convertResponse(openAiResponse, model) {
  const choice = openAiResponse.choices?.[0];
  const message = choice?.message;
  const contentBlocks = [];

  if (message?.reasoning) {
    contentBlocks.push({ type: "thinking", thinking: message.reasoning });
  }

  if (message?.content) {
    contentBlocks.push({ type: "text", text: message.content });
  }

  if (Array.isArray(message?.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch (err) {
        parsedArgs = {};
      }
      contentBlocks.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.function.name,
        input: parsedArgs
      });
    }
  }

  if (contentBlocks.length === 0) {
    contentBlocks.push({ type: "text", text: "" });
  }

  const hasToolUse = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0;
  const stopReason = mapFinishReason(choice?.finish_reason, hasToolUse);

  return {
    id: openAiResponse.id || generateId("msg"),
    type: "message",
    role: "assistant",
    content: contentBlocks,
    model: model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: openAiResponse.usage?.prompt_tokens || 0,
      output_tokens: openAiResponse.usage?.completion_tokens || 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    }
  };
}

export function buildStreamEvents(openAiChunk, state) {
  if (state.ended) return [];
  const events = [];

  if (openAiChunk.usage) {
    state.usage = openAiChunk.usage;
  }

  if (!state.started) {
    state.started = true;
    state.messageId = openAiChunk.id || generateId("msg");

    events.push({
      type: "message_start",
      message: {
        id: state.messageId,
        type: "message",
        role: "assistant",
        content: [],
        model: state.model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: openAiChunk.usage?.prompt_tokens || 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      }
    });

    events.push({ type: "ping" });
  }

  const choice = openAiChunk.choices?.[0];
  const delta = choice?.delta;

  if (delta) {
    if (delta.reasoning !== undefined && delta.reasoning !== null && delta.reasoning !== "") {
      if (!state.activeBlock || state.activeBlock.type !== "thinking") {
        if (state.activeBlock) {
          events.push({
            type: "content_block_stop",
            index: state.activeBlock.index
          });
        }
        const thinkingIndex = state.blockIndex++;
        state.activeBlock = { type: "thinking", index: thinkingIndex };
        events.push({
          type: "content_block_start",
          index: thinkingIndex,
          content_block: { type: "thinking", thinking: "" }
        });
      }

      events.push({
        type: "content_block_delta",
        index: state.activeBlock.index,
        delta: { type: "thinking_delta", thinking: delta.reasoning }
      });
    }

    if (delta.content !== undefined && delta.content !== null && delta.content !== "") {
      if (!state.activeBlock || state.activeBlock.type !== "text") {
        if (state.activeBlock) {
          events.push({
            type: "content_block_stop",
            index: state.activeBlock.index
          });
        }
        const textIndex = state.blockIndex++;
        state.activeBlock = { type: "text", index: textIndex };
        events.push({
          type: "content_block_start",
          index: textIndex,
          content_block: { type: "text", text: "" }
        });
      }

      events.push({
        type: "content_block_delta",
        index: state.activeBlock.index,
        delta: { type: "text_delta", text: delta.content }
      });
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const toolCall of delta.tool_calls) {
        const openAiIdx = toolCall.index;
        if (openAiIdx === undefined) continue;

        if (state.knownToolCalls[openAiIdx] === undefined) {
          if (state.activeBlock) {
            events.push({
              type: "content_block_stop",
              index: state.activeBlock.index
            });
          }
          const toolIndex = state.blockIndex++;
          const toolUseId = toolCall.id || generateId("toolu");
          const toolName = toolCall.function?.name || "";

          state.knownToolCalls[openAiIdx] = {
            id: toolUseId,
            name: toolName,
            index: toolIndex
          };

          state.activeBlock = {
            type: "tool_use",
            index: toolIndex,
            id: toolUseId,
            name: toolName,
            openAiIdx
          };

          events.push({
            type: "content_block_start",
            index: toolIndex,
            content_block: {
              type: "tool_use",
              id: toolUseId,
              name: toolName,
              input: {}
            }
          });
        } else if (!state.activeBlock || state.activeBlock.openAiIdx !== openAiIdx) {
          if (state.activeBlock) {
            events.push({
              type: "content_block_stop",
              index: state.activeBlock.index
            });
          }
          const known = state.knownToolCalls[openAiIdx];
          state.activeBlock = {
            type: "tool_use",
            index: known.index,
            id: known.id,
            name: known.name,
            openAiIdx
          };
        }

        if (toolCall.function?.arguments) {
          events.push({
            type: "content_block_delta",
            index: state.activeBlock.index,
            delta: {
              type: "input_json_delta",
              partial_json: toolCall.function.arguments
            }
          });
        }
      }
    }
  }

  const finishReason = choice?.finish_reason;
  if (finishReason !== undefined && finishReason !== null) {
    if (state.activeBlock) {
      events.push({
        type: "content_block_stop",
        index: state.activeBlock.index
      });
      state.activeBlock = null;
    }

    const hasToolUse = Object.keys(state.knownToolCalls).length > 0;
    const stopReason = mapFinishReason(finishReason, hasToolUse);
    const outputTokens = state.usage?.completion_tokens || openAiChunk.usage?.completion_tokens || 0;

    events.push({
      type: "message_delta",
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: outputTokens }
    });

    events.push({ type: "message_stop" });
    state.ended = true;
  }

  return events;
}

export function createStreamState(model) {
  return {
    started: false,
    ended: false,
    messageId: null,
    model,
    blockIndex: 0,
    activeBlock: null,
    knownToolCalls: {}
  };
}
