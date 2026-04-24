export const initialContext = {
  occasion: 'Delhi wedding in summer',
  styleGoal: 'Wedding look',
  neckline: 'Deep neck',
  embroidery: 'Heavy embroidery',
  budget: 'Luxury',
}

export const lookPresets = [
  {
    id: 'wedding',
    title: 'Wedding Muse',
    tone: 'Layered kundan glamour with a soft royal finish.',
    accent: 'Champagne Gold',
  },
  {
    id: 'cocktail',
    title: 'Cocktail Night',
    tone: 'Crystal shine and sleek structure for evening sparkle.',
    accent: 'Diamond Silver',
  },
  {
    id: 'minimal',
    title: 'Soft Minimal',
    tone: 'Delicate pieces with airy elegance and modern romance.',
    accent: 'Rose Pearl',
  },
  {
    id: 'luxury',
    title: 'Luxury Edit',
    tone: 'Editorial richness with emerald-toned high jewelry energy.',
    accent: 'Emerald Gold',
  },
]

export const editorialCards = [
  {
    title: 'Bridal gold drama',
    subtitle: 'Deep necklines, sculpted chokers, soft-glow earrings',
    image:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Pearl evening glow',
    subtitle: 'Cocktail-ready polish for elegant receptions',
    image:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Luxury bridal edit',
    subtitle: 'Modern heritage styling with premium statement detail',
    image:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80',
  },
]

export const commercePartners = ['Tanishq', 'CaratLane', 'Myntra', 'Bridal concierge', 'Affiliate stack']

export const scoreLabelMap = {
  traditionalCompatibility: 'Traditional compatibility',
  luxuryMatch: 'Luxury match',
  bodyShapeHarmony: 'Body-shape harmony',
}

function clampScore(value) {
  return Math.max(70, Math.min(98, Math.round(value)))
}

export function buildAnalysis({ imageMeta, context }) {
  const ratio = imageMeta?.height ? imageMeta.width / imageMeta.height : 0.67
  const isPetite = ratio < 0.62
  const isBroad = ratio > 0.77

  return {
    faceShape: ratio < 0.62 ? 'Oval' : ratio > 0.81 ? 'Round' : 'Heart',
    neckLength:
      context.neckline === 'Boat neck' ? 'Short to medium' : ratio < 0.66 ? 'Long' : 'Balanced',
    shoulderWidth: isBroad ? 'Broad' : isPetite ? 'Narrow' : 'Balanced',
    bodyProportions: isPetite ? 'Petite frame' : isBroad ? 'Tall frame' : 'Balanced frame',
    skinUndertone:
      context.budget === 'Luxury'
        ? 'Warm golden undertone'
        : context.styleGoal === 'Minimalist look'
          ? 'Neutral undertone'
          : 'Warm-neutral undertone',
    outfitNeckline: context.neckline,
  }
}

export function buildRecommendations({ analysis, context }) {
  const heavyDress = context.embroidery === 'Heavy embroidery'
  const deepNeck = context.neckline === 'Deep neck' || context.neckline === 'V-neck'
  const wedding = context.styleGoal === 'Wedding look'
  const luxury = context.budget === 'Luxury'

  const earrings =
    analysis.faceShape === 'Round'
      ? 'Long drop earrings'
      : wedding
        ? 'Kundan chandelier earrings'
        : 'Soft pearl halo earrings'

  const necklaces = deepNeck
    ? 'Layered neckline necklace'
    : analysis.neckLength === 'Long'
      ? 'Structured bridal choker'
      : heavyDress
        ? 'Slim pendant chain'
        : 'Contoured collar necklace'

  const bangles = heavyDress ? 'Delicate kada pair' : 'Textured bangle stack'
  const rings = luxury ? 'Heritage centerpiece ring' : 'Slim stacked rings'
  const maangTikka = wedding ? 'Kundan maang tikka' : 'Single-drop maang tikka'

  return {
    earrings,
    necklaces,
    bangles,
    rings,
    maangTikka,
    fullSet: `${earrings}, ${necklaces}, ${bangles}, ${rings}, and ${maangTikka}`,
    rationale: [
      `${analysis.faceShape} face geometry is complemented by ${earrings.toLowerCase()}.`,
      `${analysis.outfitNeckline} necklines open space for ${necklaces.toLowerCase()}.`,
      `${context.embroidery} detail calls for ${heavyDress ? 'a cleaner jewelry balance' : 'a richer ornament stack'}.`,
    ],
  }
}

export function buildScores({ analysis, context }) {
  const traditionalBoost = context.styleGoal === 'Wedding look' ? 8 : 3
  const luxuryBoost = context.budget === 'Luxury' ? 10 : 4
  const embroideryAdjustment = context.embroidery === 'Heavy embroidery' ? -1 : 4
  const harmonyBoost = analysis.bodyProportions === 'Petite frame' ? 5 : 8
  const occasionBoost = context.occasion.toLowerCase().includes('wedding') ? 5 : 1

  return {
    traditionalCompatibility: clampScore(84 + traditionalBoost + embroideryAdjustment),
    luxuryMatch: clampScore(79 + luxuryBoost + occasionBoost),
    bodyShapeHarmony: clampScore(82 + harmonyBoost + (analysis.neckLength === 'Long' ? 4 : 1)),
  }
}

export function recommendationCards(recommendations) {
  return [
    ['Earrings', recommendations.earrings],
    ['Necklaces', recommendations.necklaces],
    ['Bangles', recommendations.bangles],
    ['Rings', recommendations.rings],
    ['Maang tikka', recommendations.maangTikka],
    ['Full set', recommendations.fullSet],
  ]
}

export function buildStylistFallback({ context = initialContext, imageMeta = {} }) {
  const safeContext = { ...initialContext, ...context }
  const analysis = buildAnalysis({ imageMeta, context: safeContext })
  const recommendations = buildRecommendations({ analysis, context: safeContext })
  const scores = buildScores({ analysis, context: safeContext })

  return {
    analysis,
    recommendations,
    scores,
    narrative: `For ${safeContext.occasion}, the strongest edit is ${recommendations.necklaces.toLowerCase()} with ${recommendations.earrings.toLowerCase()} so the jewelry complements the dress instead of competing with it.`,
    shoppingMatches: [
      { title: 'Layered bridal necklace set', price: 'INR 8,900', vibe: 'Wedding bestseller' },
      { title: 'Pearl drop earrings', price: 'INR 2,400', vibe: 'Elegant match' },
      { title: 'Delicate kada pair', price: 'INR 3,100', vibe: 'Minimal luxe' },
    ],
    usedAi: false,
  }
}

export function buildDefaultOverlayLayout() {
  return {
    leftEarring: { left: 35, top: 24 },
    rightEarring: { left: 65, top: 24 },
    necklace: { left: 50, top: 35, width: 28, height: 14 },
    leftBangle: { left: 22, top: 66 },
    rightBangle: { left: 78, top: 66 },
    tikka: { left: 50, top: 14, length: 14 },
  }
}
