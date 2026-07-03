// API endpoints for the Action Cam dashboard.

// Cloudflare tunnel — always reachable (remote), but buffers large raw video.
export const API = process.env.NEXT_PUBLIC_ACTION_API || "https://action-api.tolley.io";

// Direct WireGuard path to the DGX over Tailscale — valid HTTPS, full LAN speed,
// no Cloudflare middleman. Reachable only when this device is on the tailnet
// (i.e. at home / on VPN). We probe it on load and prefer it for video streaming.
export const LAN_API = process.env.NEXT_PUBLIC_ACTION_API_LAN || "https://gx10-adc6.taile5cde9.ts.net:8443";
