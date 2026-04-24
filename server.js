import express from 'express'
import OpenAI from 'openai'
import { buildStylistFallback } from './src/lib/stylistLogic.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'

app.use(express.json({ limit: '20mb' }))

function extractJson(text) {
  const raw = (text || '').trim()
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error('Model response did not contain valid JSON.')
    }
    return JSON.parse(match[0])
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model,
  })
})

app.post('/api/style-analysis', async (req, res) => {
  const { imageDataUrl, imageMeta, context } = req.body || {}
  const fallback = buildStylistFallback({ imageMeta, context })

  if (!imageDataUrl || !context) {
    return res.status(400).json({
      ...fallback,
      usedAi: false,
      error: 'imageDataUrl and context are required.',
    })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      ...fallback,
      usedAi: false,
      narrative:
        'No OpenAI key is configured yet, so the app is using the local stylist engine instead of server-side vision analysis.',
    })
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const prompt = `
You are a premium jewelry stylist for Indian fashion, weddings, and luxury occasion wear.
Analyze the uploaded outfit photo and return JSON only.

Required JSON shape:
{
  "analysis": {
    "faceShape": string,
    "neckLength": string,
    "shoulderWidth": string,
    "bodyProportions": string,
    "skinUndertone": string,
    "outfitNeckline": string
  },
  "recommendations": {
    "earrings": string,
    "necklaces": string,
    "bangles": string,
    "rings": string,
    "maangTikka": string,
    "fullSet": string,
    "rationale": string[]
  },
  "scores": {
    "traditionalCompatibility": number,
    "luxuryMatch": number,
    "bodyShapeHarmony": number
  },
  "narrative": string,
  "shoppingMatches": [
    {
      "title": string,
      "price": string,
      "vibe": string
    }
  ]
}

Rules:
- Use the image first, then the style brief.
- Scores must be integers from 70 to 98.
- Recommendations must feel premium, feminine, fashion-aware, and realistic.
- Prefer a strong match between face geometry, neckline, embroidery level, and occasion.

Style brief:
${JSON.stringify(context, null, 2)}

Image meta:
${JSON.stringify(imageMeta || {}, null, 2)}
    `.trim()

    const response = await client.responses.create({
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageDataUrl },
          ],
        },
      ],
    })

    const parsed = extractJson(response.output_text || '')

    return res.json({
      analysis: parsed.analysis || fallback.analysis,
      recommendations: parsed.recommendations || fallback.recommendations,
      scores: parsed.scores || fallback.scores,
      narrative: parsed.narrative || fallback.narrative,
      shoppingMatches: Array.isArray(parsed.shoppingMatches)
        ? parsed.shoppingMatches
        : fallback.shoppingMatches,
      usedAi: true,
      model,
    })
  } catch (error) {
    return res.status(500).json({
      ...fallback,
      usedAi: false,
      error: error instanceof Error ? error.message : 'Unknown API error.',
      narrative:
        'The AI request failed, so the app switched to the local stylist engine and still produced a polished result.',
    })
  }
})

app.listen(port, () => {
  console.log(`AuraWear server running on http://localhost:${port}`)
})
