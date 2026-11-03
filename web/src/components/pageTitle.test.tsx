import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BarTitle, BarTitleContext } from './pageTitle';
import { Page } from './ui';

describe('large titles', () => {
  let report: ((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined;

  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          report = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  /** A bar and a screen, wired the way Layout wires them. */
  function Screen() {
    const [title, setTitle] = useState<string | null>(null);
    return (
      <BarTitleContext.Provider value={setTitle}>
        <header>
          <BarTitle title={title} />
        </header>
        <Page title="My bookings">
          <p>Coming up</p>
        </Page>
      </BarTitleContext.Provider>
    );
  }
  const inBar = () => document.querySelector('header span span');
  const scrolled = (top: number, visible: boolean) =>
    act(() => report?.([{ isIntersecting: visible, boundingClientRect: { top } as DOMRectReadOnly }]));

  it('shows the title small in the bar once the large one has scrolled under it', () => {
    render(<Screen />);
    expect(screen.getByRole('heading', { level: 1, name: 'My bookings' })).toBeInTheDocument();
    expect(inBar()).toHaveTextContent('');

    scrolled(-40, false);
    expect(inBar()).toHaveTextContent('My bookings');
    expect(inBar()).toHaveClass('opacity-100');
    // Only the page's own heading is read out.
    expect(screen.getAllByRole('heading', { name: 'My bookings' })).toHaveLength(1);
  });

  it('fades it out, without blanking it first, when the large title comes back', () => {
    render(<Screen />);
    scrolled(-40, false);
    scrolled(80, true);
    expect(inBar()).toHaveTextContent('My bookings');
    expect(inBar()).toHaveClass('opacity-0');
  });

  it('leaves the bar alone for a title merely below the screen, never yet scrolled past', () => {
    render(<Screen />);
    scrolled(900, false);
    expect(inBar()).toHaveTextContent('');
  });
});
