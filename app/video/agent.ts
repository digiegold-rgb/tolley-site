import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "video",
  title: "Tolley.io Video",
  purpose: "AI video generation studio — Wan2.2 + F5-TTS + ComfyUI pipeline running on DGX Spark with cloud Modal fallback; credits from $0.50.",
  url: "/video",
  schemaType: "SoftwareApplication",
  jsonEndpoints: ["/api/video/public"],
  leadEndpoint: "/api/email-capture",
  leadSource: "video",
  shareEndpoint: "/api/share",
  mcpTools: ["get_subsite_info"],
  category: "product",
  status: "auth",
  pricing: [
    { unit: "per credit", amount: 0.50, currency: "USD" },
    { unit: "monthly", amount: 19, currency: "USD", notes: "Subscription pack" }
  ],
  actions: [
    {
      verb: "request_video_trial",
      description: "Get demo credits for the video studio.",
      fields: {
        use_case: { type: "string", required: false }
      }
    }
  ]
};
