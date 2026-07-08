import express from "express";
import config from "./config.js";
import messagesRouter from "./features/messages/messages.router.js";
import modelsRouter from "./features/models/models.router.js";

const app = express();

app.use(express.json({ limit: "50mb" }));

app.use(messagesRouter);
app.use(modelsRouter);

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    proxy: "opencodezen-claude-proxy",
    model: config.openaiModel,
  });
});

app.listen(config.port, () => {
  console.log(`OpenAI → Anthropic proxy running on http://localhost:${config.port}`);
  console.log(`Target model: ${config.openaiModel}`);
  console.log(`API Key configured: ${config.openaiApiKey ? "yes" : "NO — set OPENAI_API_KEY"}`);
});
