Production OCR integration

This project supports pluggable OCR providers. By default you can set `OCR_PROVIDER=ocr_space` to use OCR.Space API for production-quality OCR. For local development use `OCR_PROVIDER=mock` which will read `.txt` sidecar files in `uploads/` when available.

Configuration (.env):

- `OCR_PROVIDER` — `ocr_space` or `mock`.
- `OCR_API_KEY` or `OCR_SPACE_API_KEY` — API key for OCR.Space (keep secret, do not commit).
- `STORAGE_PROVIDER` — `s3` or `local` (same as existing storage settings).

Notes:
- Uploaded files are validated server-side for file type and size in `src/pages/api/patient/documents/index.ts`.
- OCR runs in the background via `src/scripts/processJobs.ts` and failures are recorded on the `DocumentProcessing` model.
- OCR results are stored as plain text for downstream extraction; the extraction pipeline must remain conservative and not invent diagnoses.

Provider implementation:
- `src/lib/ocr.ts` contains the abstraction. It supports `mock` and `ocr_space` providers. The OCR.Space implementation sends the file as a base64 payload to the OCR.Space API and returns concatenated parsed text.

Security:
- API keys must be set in server-side environment variables and are never exposed to the client.

If you want a different provider (Google Vision, AWS Textract), implement a new branch in `src/lib/ocr.ts` and keep the same `runOCR(url)` signature.
