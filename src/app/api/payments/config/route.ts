import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/payments/config - Public endpoint for payment config
export async function GET() {
  try {
    const policies = await prisma.policy.findMany({
      where: {
        key: {
          in: [
            'PAYMENT_GATEWAY_ENABLED',
            'SLOT_PAYMENT_REQUIRED',
            'PACKAGE_PAYMENT_REQUIRED',
          ],
        },
      },
    });

    const config: Record<string, string> = {};
    for (const p of policies) config[p.key] = p.value;

    return NextResponse.json({
      paymentEnabled: config['PAYMENT_GATEWAY_ENABLED'] === 'true',
      slotPaymentRequired: config['SLOT_PAYMENT_REQUIRED'] === 'true',
      packagePaymentRequired: config['PACKAGE_PAYMENT_REQUIRED'] === 'true',
      razorpayKeyId: config['PAYMENT_GATEWAY_ENABLED'] === 'true'
        ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ''
        : '',
    });
  } catch (error) {
    console.error('Payment config error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment config' }, { status: 500 });
  }
}
