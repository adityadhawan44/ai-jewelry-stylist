export default async function handler(_req, res) {
  res.status(200).json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    runtime: 'vercel',
  })
}
