import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StaffPitchAssignment } from '@/components/admin/StaffPitchAssignment';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StaffPitchAssignment', () => {
  it('lets an admin assign a pitch and saves it on the membership', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ metadata: { pitchAssignments: ['NATURAL_TURF'] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StaffPitchAssignment metadata={null} endpoint="/api/admin/centers/c1/members/m1" />);
    expect(screen.getByText('Not assigned to a pitch yet')).toBeInTheDocument();

    const turf = screen.getByRole('button', { name: /Natural turf/ });
    expect(turf).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(turf);

    await waitFor(() => expect(turf).toHaveAttribute('aria-pressed', 'true'));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/centers/c1/members/m1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ pitchAssignments: ['NATURAL_TURF'] }),
    }));
    expect(screen.getByRole('button', { name: /Indoor \(Astro-turf nets\)/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reverts and shows the error when the save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Admin required' }),
    }));

    render(
      <StaffPitchAssignment
        metadata={{ pitchAssignments: ['INDOOR_ASTRO'] }}
        endpoint="/api/admin/centers/c1/members/m1"
      />,
    );
    const indoor = screen.getByRole('button', { name: /Indoor/ });
    expect(indoor).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(indoor);

    expect(await screen.findByText('Admin required')).toBeInTheDocument();
    expect(indoor).toHaveAttribute('aria-pressed', 'true');
  });

  it('is read-only without an endpoint and hidden when unassigned', () => {
    const { rerender, container } = render(<StaffPitchAssignment metadata={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<StaffPitchAssignment metadata={{ pitchAssignments: ['NATURAL_TURF'] }} />);
    expect(screen.getByRole('button', { name: /Natural turf/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Indoor/ })).not.toBeInTheDocument();
  });
});
