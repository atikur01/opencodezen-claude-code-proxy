// Simple memory cache to hold mapping between generated Anthropic tool_use IDs
// and the thoughtSignatures returned by Gemini.
export const thoughtSignatureCache = new Map();
