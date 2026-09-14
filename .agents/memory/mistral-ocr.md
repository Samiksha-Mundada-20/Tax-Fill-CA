---
name: Mistral OCR request shape
description: Provider behavior verified while wiring Tax Sathi document OCR.
---

Mistral's current OCR endpoint rejected `document_base64` for PDFs. It accepted the same base64 data URL when sent as a `document_url` document chunk.

**Why:** The first live request returned a schema validation error before OCR ran.

**How to apply:** Keep the provider adapter isolated so request-shape changes can be made without changing the document routes or review UI.