import { Router } from "express";
import config from "../../config.js";

const router = Router();

function buildModelObject(id) {
  return {
    id,
    type: "model",
    display_name: id,
    created_at: "2025-01-01T00:00:00Z",
    context_window: config.maxInputTokens,
    max_input_tokens: config.maxInputTokens,
    max_output_tokens: config.maxOutputTokens,
    max_tokens: config.maxOutputTokens,
  };
}

router.get("/v1/models", (_req, res) => {
  const model = buildModelObject(config.openaiModel);
  res.json({
    data: [model],
    has_more: false,
    first_id: config.openaiModel,
    last_id: config.openaiModel,
  });
});

router.get("/v1/models/:modelId", (req, res) => {
  res.json(buildModelObject(req.params.modelId));
});

export default router;
