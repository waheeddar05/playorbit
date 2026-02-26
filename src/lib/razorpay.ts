import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from './prisma';

let razorpayInstance: Razorpay | null = null;

export function getRazorpayInstance(): Razorpay {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

/**
 * Check if payment gateway is enabled via admin Policy table.
 * Default: disabled (so existing behavior is preserved until admin enables it).
 */
export async function isPaymentEnabled(): Promise<boolean> {
  try {
    const policy = await prisma.policy.findUnique({
      where: { key: 'PAYMENT_GATEWAY_ENABLED' },
    });
    return policy?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * Check if payment is required for slot bookings.
 * When false, bookings can proceed without payment (walk-in / cash mode).
 */
export async function isSlotPaymentRequired(): Promise<boolean> {
  try {
    const policy = await prisma.policy.findUnique({
      where: { key: 'SLOT_PAYMENT_REQUIRED' },
    });
    return policy?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * Check if payment is required for package purchases.
 */
export async function isPackagePaymentRequired(): Promise<boolean> {
  try {
    const policy = await prisma.policy.findUnique({
      where: { key: 'PACKAGE_PAYMENT_REQUIRED' },
    });
    return policy?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * Create a Razorpay order
 */
export async function createRazorpayOrder(params: {
  amount: number; // in rupees
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const razorpay = getRazorpayInstance();
  const amountInPaise = Math.round(params.amount * 100);

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: params.currency || 'INR',
    receipt: params.receipt,
    notes: params.notes || {},
  });

  return order;
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw new Error('RAZORPAY_KEY_SECRET not configured');

  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');

  return expectedSignature === params.signature;
}

/**
 * Initiate a refund on Razorpay
 */
export async function initiateRefund(params: {
  paymentId: string;
  amount?: number; // in rupees, omit for full refund
  notes?: Record<string, string>;
}) {
  const razorpay = getRazorpayInstance();
  const refundParams: Record<string, unknown> = {};

  if (params.amount) {
    refundParams.amount = Math.round(params.amount * 100); // Convert to paise
  }
  if (params.notes) {
    refundParams.notes = params.notes;
  }

  const refund = await razorpay.payments.refund(params.paymentId, refundParams);
  return refund;
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPaymentDetails(paymentId: string) {
  const razorpay = getRazorpayInstance();
  return razorpay.payments.fetch(paymentId);
}
