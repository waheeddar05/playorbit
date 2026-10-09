import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const centers = [
  { id: 'c1', name: 'ToPlay, Kharadi', shortName: 'ToPlay', city: 'Pune' },
  { id: 'c2', name: 'ABCA, Kharadi', shortName: 'ABCA', city: 'Pune' },
  { id: 'c3', name: 'Victory Sports, Lohegaon', shortName: 'Victory', city: 'Pune' },
];

vi.mock('@/lib/center-context', () => ({
  useCenter: () => ({ centers, currentCenter: centers[1], switchTo: vi.fn(), loading: false }),
}));

// The selector is imported after the mock is registered.
const { CenterSelector } = await import('../CenterSelector');

/** Pretend the dropdown, hung from the pill's right edge, starts at `left`. */
function panelStartsAt(left: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left, right: left + 220, top: 0, bottom: 0, width: 220, height: 0, x: left, y: 0, toJSON: () => ({}),
  } as DOMRect);
}

function openDropdown() {
  render(<CenterSelector compact />);
  fireEvent.click(screen.getByRole('button'));
  return screen.getByRole('listbox').parentElement!;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CenterSelector dropdown placement', () => {
  it('hangs from the right edge when there is room', () => {
    panelStartsAt(120);

    const panel = openDropdown();

    expect(panel.style.left).toBe('');
  });

  it('flips to the left edge instead of running off a phone screen', () => {
    // An admin's navbar pushes the pill left; right-aligned, the panel
    // would start ~90px off-screen and clip the center names.
    panelStartsAt(-90);

    const panel = openDropdown();

    expect(panel.style.left).toBe('0px');
    expect(panel.style.right).toBe('auto');
  });
});
