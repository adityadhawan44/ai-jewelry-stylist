# AuraWear AI Jewelry Stylist

A beauty-tech MVP for jewelry recommendations based on outfit photo, occasion, body geometry hints, and style goals.

## Required key right now

- `OPENAI_API_KEY`

This is the only key needed for the current real AI analysis flow.

## Optional later

- `MediaPipe` for precise face, ear, neck, shoulder, and wrist landmarks. The Web package itself does not require a cloud API key if you host the task assets locally.
- `Segment Anything` for stronger masking and jewelry placement. Self-hosted open-source usage does not require a cloud API key.
- A diffusion or image-editing provider only if you want true generative try-on or inpainting later.

## Local setup

1. Copy `.env.example` to `.env`
2. Put your real `OPENAI_API_KEY` in `.env`
3. Run:

```bash
npm install
npm run dev:full
```

## Important note

I did not extract any key from an ID document or personal file. API keys must be created from the provider account and kept private.
