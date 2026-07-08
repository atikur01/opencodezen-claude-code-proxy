function convertMessages(anthropicMessages, system) {
  const messages = [];

  if (system) {
    let systemText = "";
    if (typeof system === "string") {
      systemText = system;
    } else if (Array.isArray(system)) {
      systemText = system
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }
    if (systemText) {
      messages.push({ role: "system", content: systemText });
    }
  }

  for (const msg of anthropicMessages) {
    const role = msg.role;

    if (typeof msg.content === "string") {
      messages.push({ role, content: msg.content });
    } else if (Array.isArray(msg.content)) {
      const textAndImages = [];
      const toolCalls = [];
      const toolResults = [];

      for (const block of msg.content) {
        if (block.type === "text") {
          textAndImages.push({ type: "text", text: block.text });
        } else if (block.type === "image") {
          if (block.source?.type === "base64") {
            textAndImages.push({
              type: "image_url",
              image_url: {
                url: `data:${block.source.media_type};base64,${block.source.data}`
              }
            });
          }
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input || {})
            }
          });
        } else if (block.type === "tool_result") {
          let contentStr = "";
          if (typeof block.content === "string") {
            contentStr = block.content;
          } else if (Array.isArray(block.content)) {
            contentStr = block.content
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("\n");
          }
          toolResults.push({
            role: "tool",
            tool_call_id: block.tool_use_id,
            content: contentStr
          });
        }
      }

      if (role === "assistant") {
        const openAiMsg = { role: "assistant" };
        if (textAndImages.length > 0) {
          openAiMsg.content = textAndImages.length === 1 && textAndImages[0].type === "text"
            ? textAndImages[0].text
            : textAndImages;
        }
        if (toolCalls.length > 0) {
          openAiMsg.tool_calls = toolCalls;
        }
        messages.push(openAiMsg);
      } else if (role === "user") {
        if (textAndImages.length > 0) {
          messages.push({
            role: "user",
            content: textAndImages.length === 1 && textAndImages[0].type === "text"
              ? textAndImages[0].text
              : textAndImages
          });
        }
        if (toolResults.length > 0) {
          messages.push(...toolResults);
        }
      }
    }
  }

  return messages;
}

function convertTools(anthropicTools) {
  if (!anthropicTools || anthropicTools.length === 0) return undefined;

  return anthropicTools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.input_schema || { type: "object", properties: {} }
    }
  }));
}

export function convertRequest(anthropicBody, targetModel) {
  const openAiRequest = {
    model: targetModel,
    messages: convertMessages(anthropicBody.messages || [], anthropicBody.system),
    stream: !!anthropicBody.stream,
  };

  if (anthropicBody.max_tokens !== undefined) {
    openAiRequest.max_tokens = anthropicBody.max_tokens;
  }
  if (anthropicBody.temperature !== undefined) {
    openAiRequest.temperature = anthropicBody.temperature;
  }
  if (anthropicBody.top_p !== undefined) {
    openAiRequest.top_p = anthropicBody.top_p;
  }
  if (anthropicBody.stop_sequences) {
    openAiRequest.stop = anthropicBody.stop_sequences;
  }

  const tools = convertTools(anthropicBody.tools);
  if (tools) {
    openAiRequest.tools = tools;
  }

  return openAiRequest;
}
