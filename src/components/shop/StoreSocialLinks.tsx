'use client';

import { Instagram, MessageCircle } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/marketplace';
import { INSTAGRAM_URL } from '@/lib/client-constants';

interface StoreSocialLinksProps {
  /** WhatsApp digits with country code, or null when the store has no number (hides that link). */
  enquiryPhone: string | null;
  /** The prefilled WhatsApp text. */
  message: string;
  className?: string;
}

/**
 * The two places a customer can carry the conversation on: a WhatsApp
 * question to the store, and the PlayOrbit Instagram, where the launch
 * is being posted. The WhatsApp link only renders with a configured
 * number — there is deliberately no fallback to a center's phone.
 */
export function StoreSocialLinks({ enquiryPhone, message, className = '' }: StoreSocialLinksProps) {
  const whatsApp = buildWhatsAppLink(enquiryPhone, message);
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {whatsApp && (
        <a
          href={whatsApp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.98]"
        >
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
          Ask us on WhatsApp
        </a>
      )}
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.98]"
      >
        <Instagram className="w-3.5 h-3.5" aria-hidden="true" />
        Follow the launch on Instagram
      </a>
    </div>
  );
}
