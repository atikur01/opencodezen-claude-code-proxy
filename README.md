# OpenCodeZen Claude Proxy

An Anthropic API compatible proxy that forwards requests to the OpenCodeZen (OpenAI-compatible) API. This allows you to use OpenCodeZen models with tools and clients designed for Anthropic's Claude API.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18.x or higher recommended)
- An OpenCodeZen API Key

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd opencodezen-claude-proxy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Create a `.env` file in the root directory by copying the example:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your details:
   - `OPENAI_API_KEY`: Your OpenCodeZen API key.
   - `PORT`: The port you want the proxy to run on (default is 3456).
   - `OPENAI_MODEL`: The target model to use (e.g., `mimo-v2.5-free`).
   - `OPENAI_BASE_URL`: The base URL for the API (default is `https://opencode.ai/zen/v1`).

## Running the Project

### Development Mode
Runs the server with auto-reload on file changes:
```bash
npm run dev
```

### Production Mode
Starts the server normally:
```bash
npm start
```

## Client Configuration (e.g., Cline, Roo Code)

To use this proxy with AI coding assistants that support the Claude API, use the following settings:

- **API Provider**: Anthropic (or Custom/OpenAI compatible if using the Base URL)
- **Base URL**: `http://localhost:3456`
- **Model ID**: `mimo-v2.5-free`
- **API Key**: `sk-any-string` (The proxy uses the key defined in your `.env` file, but some clients require a non-empty string here).

### Example Environment Variables
If you are configuring via environment variables:
```env
ANTHROPIC_BASE_URL=http://localhost:3456
ANTHROPIC_MODEL=mimo-v2.5-free
ANTHROPIC_API_KEY=sk-any-string
```

## Usage

Once the server is running, you can point your Claude-compatible clients to:
`http://localhost:3456/v1/messages`

The proxy will translate the Anthropic-formatted request into an OpenAI-compatible request for OpenCodeZen and return the response in Anthropic's format.
