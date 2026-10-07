# `tolley-qwen-image-edit`

Named function `qwen_image_edit`: Diffusers `QwenImageEditPlusPipeline`, `Qwen/Qwen-Image-Edit-2511`, BF16, A100-80GB.

See `docs/generate-modal.md` for secrets, Spark-first still persist, identity-ref upload, and the Vercel spawn path. Job outputs are not published to the public Blob store.

```bash
modal deploy modal/qwen_image_edit.py
```

## Shop Video Batch

`tolley-shop-videos` is the separate cloud-only product-video app for Growth HQ. Deploy with `modal deploy modal/shop_videos.py`. It uses fal.ai or a dedicated Modal L40S motion function, then CPU FFmpeg for eight-second exports. It reuses the existing cached Wan image/model volume with explicit memory, process supervision and a serial GPU queue. Spark runs no video inference in this workflow. See [Shop Video Batch](../docs/shop-video-batch.md) for setup, billing estimates, TikTok handoff, validation and interrupted-job recovery.
