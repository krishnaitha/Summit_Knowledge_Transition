import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { ModelSwitcherForm } from '@/components/admin/model-switcher-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { appEnv } from '@/lib/env';
import { requireAdmin } from '@/lib/auth';
import { getLlmRuntimeConfig, getMaskedLlmRuntimeSecrets } from '@/lib/llm/runtime-config';

export default async function AdminModelSwitcherPage() {
  await requireAdmin();
  const [config, maskedSecrets] = await Promise.all([
    getLlmRuntimeConfig(),
    getMaskedLlmRuntimeSecrets(),
  ]);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Model Switcher</span>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>LLM Runtime Settings</CardTitle>
          <p className="text-sm text-slate-500">
            Change provider-specific model and credential settings from one place. Updates apply to
            new requests immediately.
          </p>
        </CardHeader>
        <CardContent>
          <ModelSwitcherForm
            config={config}
            maskedSecrets={maskedSecrets}
            envProvider={appEnv.llmProvider}
            envCopilotModel={appEnv.copilotModel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
