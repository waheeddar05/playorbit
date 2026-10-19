import { describe, it, expect, vi } from 'vitest';

const refundMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    center: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ctr_test',
        name: 'Test Center',
        razorpayKeyId: 'rzp_test_key',
        razorpayKeySecret: 'secret',
        razorpayWebhookSecret: null,
      }),
    },
  },
}));
vi.mock('@/lib/policy', () => ({ isPolicyEnabled: vi.fn() }));
vi.mock('razorpay', () => ({
  default: class {
    payments = { refund: refundMock };
  },
}));

import { initiateRefund, RazorpayApiError } from '../razorpay';

/** The SDK rejects with this plain object, not an Error. */
function sdkRejection(description: string) {
  refundMock.mockImplementation(async () => {
    throw { statusCode: 400, error: { code: 'BAD_REQUEST_ERROR', description } };
  });
}

const refund400 = () =>
  initiateRefund({ centerId: 'ctr_test', paymentId: 'pay_x', amount: 400 }).catch((e) => e);

describe('initiateRefund error handling', () => {
  it("turns the SDK's plain-object rejection into an Error carrying Razorpay's description", async () => {
    // Exactly what the SDK threw on 17 Oct 2026 for the ABCA account.
    sdkRejection(
      'Your account does not have enough balance to carry out the refund operation. You can add funds to your account from your Razorpay dashboard or capture new payments.',
    );

    const err = await refund400();

    expect(err).toBeInstanceOf(RazorpayApiError);
    expect(err.message).toMatch(/does not have enough balance/);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST_ERROR');
    expect(err.isInsufficientBalance).toBe(true);
  });

  it('does not flag other Razorpay rejections as insufficient balance', async () => {
    sdkRejection('The refund amount provided is greater than amount captured');

    const err = await refund400();

    expect(err).toBeInstanceOf(RazorpayApiError);
    expect(err.message).toBe('The refund amount provided is greater than amount captured');
    expect(err.isInsufficientBalance).toBe(false);
  });

  it('sends the amount in paise and returns the refund on success', async () => {
    refundMock.mockResolvedValue({ id: 'rfnd_1' });

    const refund = await initiateRefund({ centerId: 'ctr_test', paymentId: 'pay_x', amount: 400 });

    expect(refund).toEqual({ id: 'rfnd_1' });
    expect(refundMock).toHaveBeenLastCalledWith('pay_x', { amount: 40000 });
  });
});
