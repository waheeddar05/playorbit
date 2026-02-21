'use client';

/**
 * Shared dark gradient background used across all pages.
 * Extracted to avoid duplicating the same background divs everywhere.
 */
export function PageBackground() {
  return (
    <>
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0a1628] via-[#132240] to-[#0d1f3c]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(212,168,67,0.05),transparent_60%)]" />
    </>
  );
}
