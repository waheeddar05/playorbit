import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.playorbit.app",
        sha256_cert_fingerprints: [
          "9E:36:AB:FE:BE:02:39:73:14:60:F3:B9:AD:1D:7D:92:5F:3B:D1:F0:4F:18:4F:52:E8:DC:2B:FE:83:48:8D:3D",
        ],
      },
    },
  ]);
}
