import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useEffect } from 'react';
import { CenterProvider, useCenter } from '../center-context';

const CENTERS = [
  { id: 'ctr_a', slug: 'a', name: 'Center A' },
  { id: 'ctr_b', slug: 'b', name: 'Center B' },
];

let mounts = 0;
let switchTo: (id: string) => Promise<boolean> = async () => false;

function Page() {
  const ctx = useCenter();
  useEffect(() => { switchTo = ctx.switchTo; }, [ctx.switchTo]);
  // Stands in for a page whose data fetch runs once on mount.
  useEffect(() => { mounts += 1; }, []);
  return <p>current: {ctx.currentCenter?.name ?? 'none'}</p>;
}

describe('CenterProvider.switchTo', () => {
  const reload = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mounts = 0;
    fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/centers/me') {
        return new Response(JSON.stringify({ user: null, centers: CENTERS, currentCenterId: 'ctr_a' }));
      }
      if (url === '/api/centers/select') return new Response(JSON.stringify({ centerId: 'ctr_b' }));
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    reload.mockReset();
  });

  it('switches in place and remounts pages instead of reloading', async () => {
    render(<CenterProvider><Page /></CenterProvider>);
    await screen.findByText('current: Center A');
    // Loading the first center must not count as a switch.
    expect(mounts).toBe(1);

    let ok = false;
    await act(async () => { ok = await switchTo('ctr_b'); });

    expect(ok).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('current: Center B')).toBeTruthy());
    expect(mounts).toBe(2);
    // Centers aren't refetched — only the selection changed.
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/centers/me')).toHaveLength(1);
  });

  it('stays on the current center when the server refuses the switch', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/centers/me'
        ? new Response(JSON.stringify({ user: null, centers: CENTERS, currentCenterId: 'ctr_a' }))
        : new Response(JSON.stringify({ error: 'Center is inactive' }), { status: 400 }),
    );
    render(<CenterProvider><Page /></CenterProvider>);
    await screen.findByText('current: Center A');

    let ok = true;
    await act(async () => { ok = await switchTo('ctr_b'); });

    expect(ok).toBe(false);
    expect(screen.getByText('current: Center A')).toBeTruthy();
    expect(mounts).toBe(1);
  });
});
