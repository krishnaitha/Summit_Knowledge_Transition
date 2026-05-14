import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SourceTag } from '@/components/chat/source-tag';

describe('SourceTag', () => {
  it('renders the document name', () => {
    render(<SourceTag documentName="React Hooks Guide" similarity={0.8} />);
    expect(screen.getByText(/react hooks guide/i)).toBeDefined();
  });

  it('shows "High" confidence and success variant for similarity >= 0.50', () => {
    render(<SourceTag documentName="Doc A" similarity={0.5} />);
    const badge = screen.getByText(/doc a/i).closest('span')!;
    expect(screen.getByText(/high/i)).toBeDefined();
    expect(badge.className).toContain('text-emerald-700');
  });

  it('shows "High" confidence for similarity above 0.50', () => {
    render(<SourceTag documentName="Doc" similarity={0.92} />);
    expect(screen.getByText(/high/i)).toBeDefined();
  });

  it('shows "Medium" confidence and warning variant for similarity in [0.35, 0.50)', () => {
    render(<SourceTag documentName="Doc B" similarity={0.42} />);
    expect(screen.getByText(/medium/i)).toBeDefined();
    const badge = screen.getByText(/doc b/i).closest('span')!;
    expect(badge.className).toContain('text-amber-700');
  });

  it('shows "Low" confidence and neutral variant for similarity below 0.35', () => {
    render(<SourceTag documentName="Doc C" similarity={0.2} />);
    expect(screen.getByText(/low/i)).toBeDefined();
    const badge = screen.getByText(/doc c/i).closest('span')!;
    expect(badge.className).toContain('text-slate-700');
  });

  it('shows "Unknown" and neutral variant when similarity is undefined', () => {
    render(<SourceTag documentName="Doc D" />);
    expect(screen.getByText(/unknown/i)).toBeDefined();
  });

  it('shows the similarity as a percentage rounded to 0 decimals', () => {
    render(<SourceTag documentName="X" similarity={0.736} />);
    expect(screen.getByText(/74%/)).toBeDefined();
  });

  it('shows "?" for the percentage when similarity is undefined', () => {
    render(<SourceTag documentName="X" />);
    expect(screen.getByText(/\?/)).toBeDefined();
  });

  it('shows exact boundary 0.35 as Medium', () => {
    render(<SourceTag documentName="Boundary" similarity={0.35} />);
    expect(screen.getByText(/medium/i)).toBeDefined();
  });
});
