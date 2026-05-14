import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '@/components/ui/modal';

describe('Modal', () => {
  it('renders nothing when open is false', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.queryByText('Test')).toBeNull();
    expect(screen.queryByText('Content')).toBeNull();
  });

  it('renders the title and children when open is true', () => {
    render(
      <Modal open onClose={vi.fn()} title="Confirm Delete">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.getByText('Confirm Delete')).toBeDefined();
    expect(screen.getByText('Are you sure?')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Settings">
        <p>content</p>
      </Modal>,
    );
    // The close button is a <button> rendered via the X icon wrapper
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders a backdrop overlay when open', () => {
    const { container } = render(
      <Modal open onClose={vi.fn()} title="Dialog">
        <span>body</span>
      </Modal>,
    );
    // Backdrop is the outermost fixed-position div
    const backdrop = container.firstChild as HTMLElement;
    expect(backdrop.className).toContain('fixed');
    expect(backdrop.className).toContain('inset-0');
  });

  it('renders the title as an h3 element', () => {
    render(
      <Modal open onClose={vi.fn()} title="My Title">
        <span>content</span>
      </Modal>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'My Title' })).toBeDefined();
  });
});
