import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.playorbit.app",
        sha256_cert_fingerprints: [
          "CC:00:23:EA:96:01:79:44:C4:53:7C:53:97:B1:D4:21:EA:F1:94:E2:35:9A:0B:1C:12:3A:3E:FE:55:EE:CC:05",
        ],
      },
    },
  ]);
}
