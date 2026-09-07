/**
 * GET /api/generate/jobs/:id/media?i=0
 *
 * Alias of the gated image route. Same library PIN gate, same bytes — named so
 * `<video src>` is obviously a media URL. Serves video/mp4 with Range.
 */

export { GET, dynamic, maxDuration, runtime } from "../image/route";
