# LLM Provider Setup Guide

Summit KT Portal supports switchable LLM providers: **Groq** (default) and **GitHub Models** (using a Copilot-compatible token).

## Overview

- **Groq (Default)**: Free tier with generous limits, ideal for development and self-hosted deployments
- **GitHub Models**: Uses a GitHub token with `models:read` permission

## Groq Setup (Default)

### 1. Get Groq API Key

1. Visit [https://console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key

### 2. Configure Environment

Add to `.env.local`:

```bash
GROQ_API_KEY=gsk_your_key_here
# Optional: separate key for quiz generation (reduces rate limit contention)
GROQ_API_KEY_QUIZ=gsk_quiz_key_here
# Optional: explicitly set provider (defaults to groq)
LLM_PROVIDER=groq
```

### 3. Test

```bash
npm run dev
# Chat and quiz generation will use Groq
```

## GitHub Models Setup

### 1. Generate GitHub Models Token

This integration uses GitHub Models inference API (not the deprecated `/copilot/chat/completions` path).
You need a token with `models:read` permission.

**Option A: Using GitHub CLI**

```bash
gh auth refresh -h github.com -s models:read
gh auth token
```

Copy the returned token.

**Option B: Manual Token Generation**

1. Go to [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name it `copilot-proxy-token`
4. Select scopes: `models:read`
5. Generate and copy the token

### 2. Configure Environment

Add to `.env.local`:

```bash
# Switch to GitHub Models
LLM_PROVIDER=copilot

# Set the token used for GitHub Models inference
COPILOT_PROXY_TOKEN=your_token_here

# Optional override (defaults are already set in code)
# COPILOT_BASE_URL=https://models.github.ai/inference/chat/completions
# COPILOT_MODEL=openai/gpt-4.1-mini

# Keep Groq configured as fallback (optional but recommended)
GROQ_API_KEY=gsk_your_groq_key_here
```

### 3. Test

```bash
npm run dev
# Chat and quiz generation will use GitHub Models
```

Check logs to confirm provider in use:
- Groq: You'll see Groq model names (llama-3.3-70b-versatile, llama-3.1-8b-instant)
- Copilot provider: You'll see provider/model metadata associated with configured GitHub Models values

If you see `404 Not Found`, verify your endpoint is `https://models.github.ai/inference/chat/completions`.
If you see `401/403`, verify the token has `models:read` permission.

## Provider Switching

### At Runtime

Update the environment variable and restart the development server:

```bash
# Switch from Groq to GitHub Models
export LLM_PROVIDER=copilot
export COPILOT_PROXY_TOKEN=your_token
npm run dev
```

### For Production Deployment

Set environment variables in your deployment platform:

**Azure App Service**:
```bash
az webapp config appsettings set --name your-app --resource-group your-rg \
  --settings LLM_PROVIDER=copilot COPILOT_PROXY_TOKEN=your_token
```

**Docker/Containerized**:
```dockerfile
ENV LLM_PROVIDER=copilot
ENV COPILOT_PROXY_TOKEN=your_token
```

**Vercel/Next.js Hosting**:
Add to project settings under Environment Variables

## Provider Differences

| Feature | Groq | GitHub Models (LLM_PROVIDER=copilot) |
|---------|------|---------------|
| Rate Limits | 131K TPM free tier | Depends on GitHub tier |
| Models | llama-3.3-70b, llama-3.1-8b | Configurable via `COPILOT_MODEL` (default: `openai/gpt-4.1-mini`) |
| Streaming | ✅ Full streaming support | ⚠️ Buffered responses |
| Chat | ✅ | ✅ |
| Quiz Generation | ✅ (optimized) | ✅ |
| Cost | Free (within free tier) | GitHub Copilot subscription |
| Setup Complexity | Simple | Token generation required |

## Troubleshooting

### "Copilot is not configured" Error

**Cause**: `LLM_PROVIDER=copilot` but `COPILOT_PROXY_TOKEN` not set or invalid

**Fix**:
1. Verify token is valid and set in `.env.local`
2. Restart dev server
3. Check that token hasn't expired

### "Groq is not configured" Error

**Cause**: `LLM_PROVIDER=groq` (or default) but `GROQ_API_KEY` not set

**Fix**:
1. Get API key from [https://console.groq.com](https://console.groq.com)
2. Add to `.env.local`: `GROQ_API_KEY=gsk_...`
3. Restart dev server

### Rate Limit (429) Errors

**From Groq**:
- Free tier: 131K TPM limit per minute
- Solution: Use `GROQ_API_KEY_QUIZ` for separate quiz generation quotas
- Wait 60+ seconds before retrying

**From GitHub Models**:
- Depends on GitHub Copilot plan
- Solution: Check GitHub Copilot usage dashboard
- Implement exponential backoff (already built in)

### Chat/Quiz Generation Slow

**Groq**: May be rate limited. Check if first attempt shows "waiting for rate limit reset" message.

**GitHub Models provider**: Responses are buffered (not streamed) by design. Slight latency compared to Groq token streaming.

### Status Message Framing

The chat API stream interleaves status updates and content text.

- Status messages are framed with NUL delimiters: `\x00<status>\x00`
- UI parser treats text inside NUL frames as transient status
- Non-framed bytes are appended to assistant response content

This framing avoids collisions where status text can be mistaken as model output when chunks arrive partially.

## Architecture

### Request Flow

```
User Request
    ↓
app/api/chat/route.ts
app/api/jobs/worker/route.ts
    ↓
lib/llm/index.ts (Provider Router)
    ↓
    ├→ Groq? → lib/groq/chat.ts → Groq API
    └→ Copilot provider? → lib/llm/copilot.ts → GitHub Models Inference API
    ↓
Normalized Response
    ↓
Client
```

### Unified Response Format

Both providers return responses normalized to:

```typescript
interface UnifiedChatCompletion {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

This ensures UI and logic code doesn't need provider-specific handling.

## Best Practices

1. **Development**: Use Groq (free tier, no token needed)
2. **Testing**: Test with both providers to ensure compatibility
3. **Production**: Use Copilot for enterprise deployments with GitHub Copilot subscriptions
4. **Fallback**: Always configure Groq as backup in case Copilot has issues
5. **Monitoring**: Log which provider is used for each request for debugging

## Security Notes

- **Tokens**: Keep `COPILOT_PROXY_TOKEN` and `GROQ_API_KEY` secure
- **Never commit** credentials to git (use `.env.local`, `.env.production.local`)
- **Rotation**: Periodically rotate tokens in production
- **Access Control**: Restrict token creation/management to authorized personnel

## Links

- Groq Console: https://console.groq.com
- GitHub Copilot: https://github.com/features/copilot
- GitHub Settings: https://github.com/settings/tokens
- API Documentation: See `docs/ARCHITECTURE.md` for endpoint details
