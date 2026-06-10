'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { updateLlmRuntimeConfigAction } from '@/app/actions/admin';
import { SubmitButton } from '@/components/ui/submit-button';
import type {
  LlmProvider,
  LlmRuntimeConfig,
  MaskedLlmRuntimeSecrets,
} from '@/lib/llm/runtime-config';

interface ModelSwitcherFormProps {
  config: LlmRuntimeConfig;
  maskedSecrets: MaskedLlmRuntimeSecrets;
  envProvider: string;
  envCopilotModel: string;
}

function providerLabel(provider: LlmProvider): string {
  if (provider === 'copilot') return 'Copilot Proxy';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'azure-openai') return 'Azure OpenAI';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'mistral') return 'Mistral';
  if (provider === 'ollama') return 'Ollama';
  return 'Groq';
}

function providerModelSummary(provider: LlmProvider, config: LlmRuntimeConfig): string {
  if (provider === 'groq') return `chat: ${config.groqChatModel}, quiz: ${config.groqQuizModel}`;
  if (provider === 'copilot') return config.copilotModel;
  if (provider === 'openai') return config.openAiModel;
  if (provider === 'azure-openai') return config.azureOpenAiDeployment || 'not set';
  if (provider === 'anthropic') return config.anthropicModel;
  if (provider === 'mistral') return config.mistralModel;
  return config.ollamaModel;
}

export function ModelSwitcherForm(props: ModelSwitcherFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>(props.config.provider);
  const isInitialRender = useRef(true);

  const providers = useMemo<LlmProvider[]>(
    () => ['groq', 'copilot', 'openai', 'azure-openai', 'anthropic', 'mistral', 'ollama'],
    [],
  );

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    const section = document.getElementById(`provider-section-${selectedProvider}`);
    if (!section) return;

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedProvider]);

  return (
    <form action={updateLlmRuntimeConfigAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="llm_provider" className="text-sm font-medium text-slate-800">
          Active Provider
        </label>
        <select
          id="llm_provider"
          name="llm_provider"
          value={selectedProvider}
          onChange={(event) => setSelectedProvider(event.target.value as LlmProvider)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {providerLabel(provider)}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Current Models
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {providers.map((provider) => (
            <div
              key={`summary-${provider}`}
              className={`rounded-lg border px-3 py-2 text-sm ${
                provider === selectedProvider
                  ? 'border-brand-300 bg-brand-50 text-brand-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <p className="font-medium">{providerLabel(provider)}</p>
              <p className="text-xs opacity-80">{providerModelSummary(provider, props.config)}</p>
            </div>
          ))}
        </div>
      </div>

      {selectedProvider === 'groq' ? (
        <div id="provider-section-groq" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="groq_chat_model" className="text-sm font-medium text-slate-800">
                Groq Chat Model
              </label>
              <input
                id="groq_chat_model"
                name="groq_chat_model"
                defaultValue={props.config.groqChatModel}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="llama-3.3-70b-versatile"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="groq_quiz_model" className="text-sm font-medium text-slate-800">
                Groq Quiz Model
              </label>
              <input
                id="groq_quiz_model"
                name="groq_quiz_model"
                defaultValue={props.config.groqQuizModel}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="llama-3.1-8b-instant"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="groq_api_key" className="text-sm font-medium text-slate-800">
                Groq API Key
              </label>
              <input
                id="groq_api_key"
                name="groq_api_key"
                type="password"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Enter new Groq key"
              />
              <p className="text-xs text-slate-600">
                Current: {props.maskedSecrets.groqApiKeyMasked}
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="clear_groq_api_key" value="true" />
                Clear stored Groq key
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="groq_quiz_api_key" className="text-sm font-medium text-slate-800">
                Groq Quiz API Key
              </label>
              <input
                id="groq_quiz_api_key"
                name="groq_quiz_api_key"
                type="password"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Optional separate quiz key"
              />
              <p className="text-xs text-slate-600">
                Current: {props.maskedSecrets.groqQuizApiKeyMasked}
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="clear_groq_quiz_api_key" value="true" />
                Clear stored Groq quiz key
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProvider === 'copilot' ? (
        <div id="provider-section-copilot" className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="copilot_model" className="text-sm font-medium text-slate-800">
              Copilot Model
            </label>
            <input
              id="copilot_model"
              name="copilot_model"
              defaultValue={props.config.copilotModel}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="google/gemini-3.5-flash"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="copilot_proxy_token" className="text-sm font-medium text-slate-800">
                Copilot Proxy Token
              </label>
              <input
                id="copilot_proxy_token"
                name="copilot_proxy_token"
                type="password"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Enter new token"
              />
              <p className="text-xs text-slate-600">
                Current: {props.maskedSecrets.copilotProxyTokenMasked}
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="clear_copilot_proxy_token" value="true" />
                Clear stored token
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="copilot_base_url" className="text-sm font-medium text-slate-800">
                Copilot Base URL
              </label>
              <input
                id="copilot_base_url"
                name="copilot_base_url"
                defaultValue={props.maskedSecrets.copilotBaseUrl}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="https://models.github.ai/inference/chat/completions"
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedProvider === 'openai' ? (
        <div id="provider-section-openai" className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="openai_model" className="text-sm font-medium text-slate-800">
              OpenAI Model
            </label>
            <input
              id="openai_model"
              name="openai_model"
              defaultValue={props.config.openAiModel}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="gpt-4o-mini"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="openai_api_key" className="text-sm font-medium text-slate-800">
                OpenAI API Key
              </label>
              <input
                id="openai_api_key"
                name="openai_api_key"
                type="password"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Enter OpenAI key"
              />
              <p className="text-xs text-slate-600">
                Current: {props.maskedSecrets.openAiApiKeyMasked}
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="clear_openai_api_key" value="true" />
                Clear stored OpenAI key
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="openai_base_url" className="text-sm font-medium text-slate-800">
                OpenAI Base URL
              </label>
              <input
                id="openai_base_url"
                name="openai_base_url"
                defaultValue={props.maskedSecrets.openAiBaseUrl}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="https://api.openai.com/v1/chat/completions"
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedProvider === 'azure-openai' ? (
        <div id="provider-section-azure-openai" className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="azure_openai_deployment" className="text-sm font-medium text-slate-800">
              Azure OpenAI Deployment
            </label>
            <input
              id="azure_openai_deployment"
              name="azure_openai_deployment"
              defaultValue={props.config.azureOpenAiDeployment}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="gpt-4o-mini-deployment"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="azure_openai_api_key" className="text-sm font-medium text-slate-800">
                Azure OpenAI API Key
              </label>
              <input
                id="azure_openai_api_key"
                name="azure_openai_api_key"
                type="password"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Enter Azure OpenAI key"
              />
              <p className="text-xs text-slate-600">
                Current: {props.maskedSecrets.azureOpenAiApiKeyMasked}
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="clear_azure_openai_api_key" value="true" />
                Clear stored Azure OpenAI key
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="azure_openai_endpoint" className="text-sm font-medium text-slate-800">
                Azure OpenAI Endpoint
              </label>
              <input
                id="azure_openai_endpoint"
                name="azure_openai_endpoint"
                defaultValue={props.maskedSecrets.azureOpenAiEndpoint}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="https://your-resource.openai.azure.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="azure_openai_api_version"
              className="text-sm font-medium text-slate-800"
            >
              Azure OpenAI API Version
            </label>
            <input
              id="azure_openai_api_version"
              name="azure_openai_api_version"
              defaultValue={props.maskedSecrets.azureOpenAiApiVersion}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="2024-10-21"
            />
          </div>
        </div>
      ) : null}

      {selectedProvider === 'anthropic' ? (
        <div id="provider-section-anthropic" className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="anthropic_model" className="text-sm font-medium text-slate-800">
              Anthropic Model
            </label>
            <input
              id="anthropic_model"
              name="anthropic_model"
              defaultValue={props.config.anthropicModel}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="claude-3-5-sonnet-latest"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="anthropic_api_key" className="text-sm font-medium text-slate-800">
                Anthropic API Key
              </label>
              <input
                id="anthropic_api_key"
                name="anthropic_api_key"
                type="password"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Enter Anthropic key"
              />
              <p className="text-xs text-slate-600">
                Current: {props.maskedSecrets.anthropicApiKeyMasked}
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="clear_anthropic_api_key" value="true" />
                Clear stored Anthropic key
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="anthropic_base_url" className="text-sm font-medium text-slate-800">
                Anthropic Base URL
              </label>
              <input
                id="anthropic_base_url"
                name="anthropic_base_url"
                defaultValue={props.maskedSecrets.anthropicBaseUrl}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="https://api.anthropic.com/v1/messages"
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedProvider === 'mistral' ? (
        <div id="provider-section-mistral" className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="mistral_model" className="text-sm font-medium text-slate-800">
              Mistral Model
            </label>
            <input
              id="mistral_model"
              name="mistral_model"
              defaultValue={props.config.mistralModel}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="mistral-small-latest"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="mistral_api_key" className="text-sm font-medium text-slate-800">
                Mistral API Key
              </label>
              <input
                id="mistral_api_key"
                name="mistral_api_key"
                type="password"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Enter Mistral key"
              />
              <p className="text-xs text-slate-600">
                Current: {props.maskedSecrets.mistralApiKeyMasked}
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="clear_mistral_api_key" value="true" />
                Clear stored Mistral key
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="mistral_base_url" className="text-sm font-medium text-slate-800">
                Mistral Base URL
              </label>
              <input
                id="mistral_base_url"
                name="mistral_base_url"
                defaultValue={props.maskedSecrets.mistralBaseUrl}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="https://api.mistral.ai/v1/chat/completions"
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedProvider === 'ollama' ? (
        <div id="provider-section-ollama" className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="ollama_model" className="text-sm font-medium text-slate-800">
              Ollama Model
            </label>
            <input
              id="ollama_model"
              name="ollama_model"
              defaultValue={props.config.ollamaModel}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="llama3.1:8b"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="ollama_base_url" className="text-sm font-medium text-slate-800">
              Ollama Base URL
            </label>
            <input
              id="ollama_base_url"
              name="ollama_base_url"
              defaultValue={props.maskedSecrets.ollamaBaseUrl}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="http://localhost:11434/api/chat"
            />
            <p className="text-xs text-slate-600">
              Ollama is local/keyless by default; API key is not required.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Runtime reads database settings first, then falls back to environment variables.
        <p className="mt-2 text-xs text-amber-800">
          Current env defaults: LLM_PROVIDER={props.envProvider}, COPILOT_MODEL=
          {props.envCopilotModel}
        </p>
      </div>

      <SubmitButton loadingText="Saving...">Save Runtime Settings</SubmitButton>
    </form>
  );
}
