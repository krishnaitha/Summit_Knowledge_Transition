'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';

interface SubmitButtonProps extends ButtonProps {
  /** Text shown while the form action is in flight. Defaults to the button's children. */
  loadingText?: string;
}

export function SubmitButton({ children, loadingText, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled}>
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {loadingText ?? children}
        </>
      ) : children}
    </Button>
  );
}
