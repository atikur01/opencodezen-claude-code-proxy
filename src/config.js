import fs from "node:fs";
import path from "node:path";

// Simple helper to load .env file manually so it works on older Node.js versions
// and when running the script directly without flags (e.g. `node src/index.js`).
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        let val = trimmed.slice(index + 1).trim();
        
        // Remove surrounding quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (err) {
  console.warn("Could not read .env file automatically:", err.message);
}

const config = {
  port: parseInt(process.env.PORT || "3456", 10),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "mimo-v2.5-free",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://opencode.ai/zen/v1",
};

export default config;
