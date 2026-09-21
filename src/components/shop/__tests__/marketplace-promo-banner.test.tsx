import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MarketplaceStatus } from '@/lib/marketplace';
import type { MarketplaceStatusState } from '@/lib/marketplace-status';

const statusMock = vi.fn<() => MarketplaceStatusState>();

vi.mock('@/lib/marketplace-status', () => ({
  useMarketplaceStatus: () => statusMock(),
}));

// The banner is imported after the mock is registered.
const { MarketplacePromoBanner } = await import('../MarketplacePromoBanner');

const bat: MarketplaceStatus['featured'][number] = {
  id: 'prod_kis',
  name: 'KIS M&H 7000',
  category: 'BAT',
  categoryLabel: 'Cricket Bats',
  brand: 'KIS',
  sku: 'KIS-M7000-KW',
  description: null,
  price: 6500,
  mrp: null,
  discountPercent: null,
  stockQty: null,
  inStock: true,
  isActive: true,
  isFeatured: true,
  displayOrder: 0,
  sizes: ['SH'],
  specs: [],
  images: [],
  primaryImage: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function state(overrides: Partial<MarketplaceStatusState> & { featured?: MarketplaceStatus['featured'] }): MarketplaceStatusState {
  const { featured = [bat], ...rest } = overrides;
  const status: MarketplaceStatus = {
    enabled: rest.enabled ?? true,
    comingSoon: rest.comingSoon ?? true,
    launchNote: '',
    pickupNote: '',
    enquiryPhone: null,
    productCount: featured.length,
    featured,
  };
  return {
    status: rest.loading ? null : status,
    loading: false,
    enabled: true,
    comingSoon: true,
    refresh: async () => {},
    ...rest,
  };
}

beforeEach(() => statusMock.mockReset());

describe('MarketplacePromoBanner — the store card on /slots', () => {
  it('is a link to the bat, with its live price and the pre-book state, and has no dismiss control', () => {
    statusMock.mockReturnValue(state({ comingSoon: true }));
    render(<MarketplacePromoBanner />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/shop/prod_kis');
    expect(link).toHaveTextContent('KIS M&H 7000');
    expect(link).toHaveTextContent('₹6,500');
    expect(link).toHaveTextContent(/pre-book/i);
    // The old strip had an X that hid it for good; a launch wants it seen every visit.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText(/dismiss/i)).toBeNull();
  });

  it('says the store is open, and reads "Shop", once pre-launch is over', () => {
    statusMock.mockReturnValue(state({ comingSoon: false }));
    render(<MarketplacePromoBanner />);
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent(/now open/i);
    expect(link).toHaveTextContent(/shop/i);
    expect(link).not.toHaveTextContent(/pre-book/i);
  });

  it('renders while the status is still loading, without a price or a state pill', () => {
    statusMock.mockReturnValue(state({ loading: true }));
    render(<MarketplacePromoBanner />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/shop');
    expect(link).toHaveTextContent('KIS M&H 7000');
    expect(link).not.toHaveTextContent('₹');
    expect(link).not.toHaveTextContent(/now open/i);
  });

  it('renders nothing when the store is switched off', () => {
    statusMock.mockReturnValue(state({ enabled: false }));
    const { container } = render(<MarketplacePromoBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('falls back to /shop when no product is featured yet', () => {
    statusMock.mockReturnValue(state({ featured: [] }));
    render(<MarketplacePromoBanner />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/shop');
  });
});
