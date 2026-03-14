import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { VideoHero } from "@/components/video/video-hero";
import { VideoGenerator } from "@/components/video/video-generator";
import { VideoCredits } from "@/components/video/video-credits";
import { VideoModels } from "@/components/video/video-models";
import { VideoHistory } from "@/components/video/video-history";
import { VideoUseCases } from "@/components/video/video-use-cases";
import { VideoFaq } from "@/components/video/video-faq";

export default async function VideoPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/video");
  }

  return (
    <main className="relative z-10 min-h-screen">
      <VideoHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="video-enter" style={{ "--enter-delay": "0.05s" } as React.CSSProperties}>
          <VideoGenerator />
        </div>
        <div id="credits" className="video-enter scroll-mt-8" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <VideoCredits />
        </div>
        <div className="video-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <VideoModels />
        </div>
        <div className="video-enter" style={{ "--enter-delay": "0.18s" } as React.CSSProperties}>
          <VideoHistory />
        </div>
        <div className="video-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <VideoUseCases />
        </div>
        <div className="video-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <VideoFaq />
        </div>
      </div>
    </main>
  );
}
