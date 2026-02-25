import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.playorbit.app",
          sha256_cert_fingerprints: [
            // TODO: Replace with your actual SHA-256 fingerprint from signing key
            "REPLACE_WITH_YOUR_SHA256_FINGERPRINT",
          ],
        },
      },
    ]
  );
}
