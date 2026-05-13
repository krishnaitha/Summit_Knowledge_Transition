import { Badge } from '@/components/ui/badge';

function getConfidence(similarity?: number): {
  label: string;
  variant: 'success' | 'warning' | 'neutral';
} {
  if (similarity == null) return { label: 'Unknown', variant: 'neutral' };
  if (similarity >= 0.5) return { label: 'High', variant: 'success' };
  if (similarity >= 0.35) return { label: 'Medium', variant: 'warning' };
  return { label: 'Low', variant: 'neutral' };
}

export function SourceTag({
  documentName,
  similarity,
}: {
  documentName: string;
  similarity?: number;
}) {
  const { label, variant } = getConfidence(similarity);
  const pct = similarity != null ? `${(similarity * 100).toFixed(0)}%` : '?';
  return (
    <Badge variant={variant}>
      {documentName} · {label} ({pct})
    </Badge>
  );
}
