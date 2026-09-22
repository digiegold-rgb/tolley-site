/** Interpret a saved failure without polling a provider or submitting a retry. */
export function generationRecovery(error: string) {
  if (/exhausted balance|insufficient (?:funds|balance|credits)|balance.*(?:exhausted|depleted)/i.test(error)) {
    return { kind: "billing", title: "fal balance exhausted", guidance: "fal is the billing service for Kling and Wan. Changing between those models will not clear this balance issue. Check billing before submitting another render.", billing: true };
  }
  if (/still not found|source.*(?:missing|not found)|image.*(?:404|not found)|HTTP 404/i.test(error)) {
    return { kind: "source", title: "A source image is missing", guidance: "Choose the starting image again from your library, upload it, or replace the reference URL. Your scene text is still available to edit.", billing: false };
  }
  if (/content_policy|content checker|content.*(?:policy|flagged)|partner.*filter/i.test(error)) {
    return { kind: "content", title: "The provider rejected this content", guidance: "Review the prompt and reference images against the provider’s content rules before trying again.", billing: false };
  }
  if (/400|422|bad request|validation/i.test(error)) {
    return { kind: "input", title: "The provider could not accept this request", guidance: "Review this scene’s reference images, duration, and model settings. The provider details below may identify an unsupported value. Retrying the same request may fail again.", billing: false };
  }
  if (/dismiss or retry the failed beat|failed beat first/i.test(error)) {
    return { kind: "queue", title: "A failed scene is holding this sequence", guidance: "Review the failed scene below to see its original error. Clear its failure to return it to a draft, or retry after fixing the cause. Clearing a failure does not render or skip the scene.", billing: false };
  }
  if (/ffmpeg|last.frame extract|continuity/i.test(error)) {
    return { kind: "processing", title: "The clip needs a processing fix", guidance: "A video-processing step could not finish. Keep the completed clip and check the processing service before generating another take.", billing: false };
  }
  if (/two.factor|sign in|unauthorized|access expired/i.test(error)) {
    return { kind: "access", title: "Sign in to continue", guidance: "Use Sign in to Gen2 above and complete two-factor verification, then return to this tab.", billing: false };
  }
  return { kind: "other", title: "Generation needs attention", guidance: "Your inputs are still available. Check the details, adjust your request if needed, then try again. Each render retry submits another provider request.", billing: false };
}
