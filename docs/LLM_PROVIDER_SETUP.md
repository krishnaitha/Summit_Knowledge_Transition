# LLM Provider Setup Guide

Summit KT Portal supports switchable LLM providers: **Groq** (default) and **Copilot Proxy** (token-based).

## Overview

- **Groq (Default)**: Free tier with generous limits, ideal for development and self-hosted deployments
- **Copilot Proxy**: Uses GitHub Copilot token for authentication, requires Copilot subscription

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

## Copilot Proxy Setup

### 1. Generate Copilot Proxy Token

The Copilot proxy token is a special authentication token for the GitHub Copilot API.

**Option A: Using GitHub CLI (Recommended)**

```bash
gh auth token --scope github_copilot_chat
```

Copy the returned token.

**Option B: Manual Token Generation**

1. Go to [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name it `copilot-proxy-token`
4. Select scopes: `github_copilot_chat`
5. Generate and copy the token

### 2. Configure Environment

Add to `.env.local`:

```bash
# Switch to Copilot proxy
LLM_PROVIDER=copilot

# Set the Copilot proxy token
COPILOT_PROXY_TOKEN=your_token_here

# Keep Groq configured as fallback (optional but recommended)
GROQ_API_KEY=gsk_your_groq_key_here
```

### 3. Test

```bash
npm run dev
# Chat and quiz generation will use Copilot Proxy
```

Check logs to confirm provider in use:
- Groq: You'll see Groq model names (llama-3.3-70b-versatile, llama-3.1-8b-instant)
- Copilot: You'll see "Copilot Proxy" in responses and logs

## Provider Switching

### At Runtime

Update the environment variable and restart the development server:

```bash
# Switch from Groq to Copilot
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

| Feature | Groq | Copilot Proxy |
|---------|------|---------------|
| Rate Limits | 131K TPM free tier | Depends on GitHub tier |
| Models | llama-3.3-70b, llama-3.1-8b | Claude-based (via proxy) |
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

**From Copilot**:
- Depends on GitHub Copilot plan
- Solution: Check GitHub Copilot usage dashboard
- Implement exponential backoff (already built in)

### Chat/Quiz Generation Slow

**Groq**: May be rate limited. Check if first attempt shows "waiting for rate limit reset" message.

**Copilot**: Responses are buffered (not streamed) by design. Slight latency compared to Groq streaming.

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
    └→ Copilot? → lib/llm/copilot.ts → GitHub Copilot Proxy API
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
