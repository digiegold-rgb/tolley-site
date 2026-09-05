# `tolley-qwen-image-edit`

Named function `qwen_image_edit`: Diffusers `QwenImageEditPlusPipeline`, `Qwen/Qwen-Image-Edit-2511`, BF16, A100-80GB.

See `docs/generate-modal.md` for secrets, Spark-first still persist, identity-ref upload, and the Vercel spawn path. Job outputs are not published to the public Blob store.

```bash
modal deploy modal/qwen_image_edit.py
```
