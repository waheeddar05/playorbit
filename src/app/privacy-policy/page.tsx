import { Shield } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | PlayOrbit",
  description: "Privacy Policy for PlayOrbit cricket booking application",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/40 to-transparent pt-6 pb-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/20 rounded-lg">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
          </div>
          <p className="text-muted text-sm">Last updated: February 26, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 pb-12 -mt-2">
        <div className="space-y-6">
          <Section title="1. Introduction">
            PlayOrbit (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the PlayOrbit
            mobile application and website (collectively, the &quot;Service&quot;). This Privacy
            Policy explains how we collect, use, disclose, and safeguard your information when you
            use our Service to book cricket practice sessions.
          </Section>

          <Section title="2. Information We Collect">
            <p className="mb-3">We collect information that you provide directly to us:</p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-300/90 ml-2">
              <li>Name and contact information (email address, phone number)</li>
              <li>Account credentials (username, password)</li>
              <li>Booking details (date, time, session preferences)</li>
              <li>Payment information (processed securely through third-party payment processors)</li>
            </ul>
            <p className="mt-3">
              We may also automatically collect device information, usage data, and log information
              when you access our Service.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-300/90 ml-2">
              <li>Process and manage your booking reservations</li>
              <li>Send booking confirmations and reminders</li>
              <li>Communicate with you about our services</li>
              <li>Improve and optimize our Service</li>
              <li>Ensure the security of your account</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section title="4. Information Sharing">
            We do not sell, trade, or rent your personal information to third parties. We may share
            your information only in the following circumstances: with service providers who assist
            in operating our Service (e.g., payment processors, hosting providers), when required by
            law or legal process, or to protect the rights and safety of our users and the public.
          </Section>

          <Section title="5. Data Security">
            We implement appropriate technical and organizational security measures to protect your
            personal information against unauthorized access, alteration, disclosure, or destruction.
            However, no method of transmission over the Internet is 100% secure, and we cannot
            guarantee absolute security.
          </Section>

          <Section title="6. Data Retention">
            We retain your personal information for as long as your account is active or as needed to
            provide you with our Service. We may also retain certain information as required by law or
            for legitimate business purposes such as resolving disputes and enforcing agreements.
          </Section>

          <Section title="7. Your Rights">
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-300/90 ml-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of promotional communications</li>
            </ul>
          </Section>

          <Section title="8. Children&apos;s Privacy">
            Our Service is not directed to children under the age of 13. We do not knowingly collect
            personal information from children under 13. If we become aware that we have collected
            such information, we will take steps to delete it.
          </Section>

          <Section title="9. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will notify you of any changes
            by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot;
            date. Your continued use of the Service after changes constitutes acceptance of the
            revised policy.
          </Section>

          <Section title="10. Contact Us">
            If you have any questions about this Privacy Policy or our data practices, please contact
            us at:
            <p className="mt-2 text-accent font-medium">waheeddar8@gmail.com</p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.08] p-5">
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      <div className="text-slate-300/80 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
