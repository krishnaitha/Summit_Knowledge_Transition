import { AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SetupPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-12">
      <Card className="w-full border border-amber-200 bg-amber-50/70">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <CardTitle>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-slate-700">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
