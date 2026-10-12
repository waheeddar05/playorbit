import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

let pathname = '/slots';
let center = { isSidearmSpecialistAtCurrentCenter: false, isCoachAtCurrentCenter: false };

vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/lib/current-user', () => ({ useCurrentUser: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/center-context', () => ({ useCenter: () => center }));
vi.mock('@/lib/marketplace-status', () => ({
  useMarketplaceStatus: () => ({ enabled: true, comingSoon: false, loading: false }),
}));

const { default: BottomNav } = await import('../BottomNav');

function bar() {
  return within(screen.getByRole('navigation'));
}

describe('BottomNav', () => {
  it('keeps exactly five tabs: Book Slot, Bookings, Packages, Store, More', () => {
    pathname = '/slots';
    center = { isSidearmSpecialistAtCurrentCenter: true, isCoachAtCurrentCenter: true };
    render(<BottomNav />);

    const labels = [...bar().getAllByRole('link'), ...bar().getAllByRole('button')].map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Book Slot', 'Bookings', 'Packages', 'Store', 'More']);
  });

  it('puts profile, wallet, alerts and role pages behind More', () => {
    pathname = '/slots';
    center = { isSidearmSpecialistAtCurrentCenter: true, isCoachAtCurrentCenter: false };
    render(<BottomNav />);

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(bar().getByRole('button', { name: 'More' }));

    const sheet = within(screen.getByRole('dialog'));
    const hrefs = sheet.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/profile', '/wallet', '/notifications', '/centers', '/sidearm']));
    expect(hrefs).not.toContain('/coach');
  });

  it('marks More active on a page that lives behind it', () => {
    pathname = '/wallet';
    center = { isSidearmSpecialistAtCurrentCenter: false, isCoachAtCurrentCenter: false };
    render(<BottomNav />);

    expect(bar().getByRole('button', { name: 'More' }).className).toContain('text-accent');
    expect(bar().getByRole('link', { name: 'Book Slot' }).className).not.toContain('text-accent');
  });
});
