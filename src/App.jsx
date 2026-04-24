import { useEffect, useMemo, useRef, useState } from 'react'
import { detectJewelryLandmarks } from './lib/landmarkDetection'
import {
  buildDefaultOverlayLayout,
  buildStylistFallback,
  commercePartners,
  editorialCards,
  initialContext,
  lookPresets,
  recommendationCards,
  scoreLabelMap,
} from './lib/stylistLogic'

const STORAGE_KEY = 'aurawear-saved-looks'

const apiChecklist = [
  {
    title: 'OpenAI API key',
    status: 'Required now',
    detail: 'Needed for real image analysis and recommendation generation on the backend.',
  },
  {
    title: 'MediaPipe',
    status: 'Optional later',
    detail: 'Useful for face, ear, neck, shoulder, and wrist landmarks for precise try-on.',
  },
  {
    title: 'Segment Anything',
    status: 'Optional later',
    detail: 'Useful for stronger person masking and cleaner jewelry placement.',
  },
  {
    title: 'Diffusion editing provider',
    status: 'Optional later',
    detail: 'Needed only for realistic generative try-on or inpainting beyond overlays.',
  },
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function makeLookId() {
  return `look-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function App() {
  const stageRef = useRef(null)
  const dragRef = useRef(null)

  const [context, setContext] = useState(initialContext)
  const [previewSrc, setPreviewSrc] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [imageMeta, setImageMeta] = useState({ width: 0, height: 0, name: 'No image uploaded yet' })
  const [activeLook, setActiveLook] = useState('wedding')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('Upload a photo and run the stylist engine.')
  const [landmarkStatus, setLandmarkStatus] = useState('Waiting for a clear uploaded portrait.')
  const [overlayLayout, setOverlayLayout] = useState(buildDefaultOverlayLayout)
  const [debugPoints, setDebugPoints] = useState([])
  const [showDebugLandmarks, setShowDebugLandmarks] = useState(false)
  const [savedLooks, setSavedLooks] = useState([])

  const fallbackBundle = useMemo(
    () =>
      buildStylistFallback({
        context,
        imageMeta,
      }),
    [context, imageMeta],
  )

  const display = result || fallbackBundle
  const activePreset = lookPresets.find((look) => look.id === activeLook) || lookPresets[0]
  const effectiveDebugPoints =
    debugPoints.length > 0
      ? debugPoints
      : [
          {
            id: 'left-earring-fallback',
            label: 'Left earring',
            x: overlayLayout.leftEarring.left,
            y: overlayLayout.leftEarring.top,
            tone: 'rose',
          },
          {
            id: 'right-earring-fallback',
            label: 'Right earring',
            x: overlayLayout.rightEarring.left,
            y: overlayLayout.rightEarring.top,
            tone: 'rose',
          },
          {
            id: 'necklace-fallback',
            label: 'Necklace',
            x: overlayLayout.necklace.left,
            y: overlayLayout.necklace.top,
            tone: 'gold',
          },
          {
            id: 'left-bangle-fallback',
            label: 'Left bangle',
            x: overlayLayout.leftBangle.left,
            y: overlayLayout.leftBangle.top,
            tone: 'champagne',
          },
          {
            id: 'right-bangle-fallback',
            label: 'Right bangle',
            x: overlayLayout.rightBangle.left,
            y: overlayLayout.rightBangle.top,
            tone: 'champagne',
          },
          {
            id: 'tikka-fallback',
            label: 'Tikka',
            x: overlayLayout.tikka.left,
            y: overlayLayout.tikka.top,
            tone: 'wine',
          },
        ]

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSavedLooks(JSON.parse(stored))
      }
    } catch {
      setSavedLooks([])
    }
  }, [])

  useEffect(() => {
    function onPointerMove(event) {
      if (!dragRef.current || !stageRef.current) return

      const rect = stageRef.current.getBoundingClientRect()
      const left = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
      const top = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
      const { key } = dragRef.current

      setOverlayLayout((current) => {
        const next = JSON.parse(JSON.stringify(current))

        if (key === 'necklace') {
          next.necklace.left = clamp(left, 15, 85)
          next.necklace.top = clamp(top, 18, 82)
        } else if (key === 'tikka') {
          next.tikka.left = clamp(left, 14, 86)
          next.tikka.top = clamp(top, 4, 40)
        } else {
          next[key].left = clamp(left, 6, 94)
          next[key].top = clamp(top, 6, 94)
        }

        return next
      })
    }

    function onPointerUp() {
      dragRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  function persistLooks(nextLooks) {
    setSavedLooks(nextLooks)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLooks))
  }

  function onFieldChange(event) {
    const { name, value } = event.target
    setContext((current) => ({ ...current, [name]: value }))
    setResult(null)
  }

  function selectLook(lookId) {
    setActiveLook(lookId)
    const selected = lookPresets.find((look) => look.id === lookId)
    if (selected) {
      setStatus(`${selected.title} applied to the preview.`)
    }
  }

  function startDrag(key) {
    return (event) => {
      event.preventDefault()
      dragRef.current = { key }
      setStatus(`Adjusting ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} placement manually.`)
    }
  }

  function onImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setPreviewSrc(objectUrl)
    setImageMeta({ width: 0, height: 0, name: file.name })
    setResult(null)
    setOverlayLayout(buildDefaultOverlayLayout())
    setDebugPoints([])

    const img = new Image()
    img.onload = async () => {
      setImageMeta({
        width: img.width,
        height: img.height,
        name: file.name,
      })

      setLandmarkStatus('Detecting face, shoulders, wrists, and jewelry anchors...')

      try {
        const landmarkResult = await detectJewelryLandmarks(img)
        if (landmarkResult.ok) {
          setOverlayLayout(landmarkResult.placements)
          setDebugPoints(landmarkResult.debugPoints || [])
          setLandmarkStatus(
            `MediaPipe locked onto ${landmarkResult.raw.faceCount} face and ${landmarkResult.raw.poseCount} pose track for dynamic jewelry placement.`,
          )
        } else {
          setOverlayLayout(buildDefaultOverlayLayout())
          setDebugPoints([])
          setLandmarkStatus(`Landmark detection fallback: ${landmarkResult.reason}`)
        }
      } catch {
        setOverlayLayout(buildDefaultOverlayLayout())
        setDebugPoints([])
        setLandmarkStatus('MediaPipe could not initialize, so the try-on overlay stayed in graceful fallback mode.')
      }
    }
    img.src = objectUrl

    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUrl(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsDataURL(file)
  }

  function saveCurrentLook() {
    if (!imageDataUrl) {
      setStatus('Upload a photo before saving a styled look.')
      return
    }

    const nextLooks = [
      {
        id: makeLookId(),
        title: `${context.styleGoal} for ${context.occasion}`,
        createdAt: new Date().toISOString(),
        context,
        imageDataUrl,
        imageMeta,
        result: display,
        overlayLayout,
        activeLook,
      },
      ...savedLooks,
    ].slice(0, 8)

    persistLooks(nextLooks)
    setStatus('Styled look saved locally on this device.')
  }

  function loadSavedLook(savedLook) {
    setContext(savedLook.context)
    setPreviewSrc(savedLook.imageDataUrl)
    setImageDataUrl(savedLook.imageDataUrl)
    setImageMeta(savedLook.imageMeta)
    setResult(savedLook.result)
    setOverlayLayout(savedLook.overlayLayout || buildDefaultOverlayLayout())
    setActiveLook(savedLook.activeLook || 'wedding')
    setStatus(`Loaded saved look: ${savedLook.title}`)
    setLandmarkStatus('Loaded saved manual and AI styling state from this device.')
  }

  function deleteSavedLook(lookId) {
    const nextLooks = savedLooks.filter((look) => look.id !== lookId)
    persistLooks(nextLooks)
  }

  async function downloadStyledPhoto() {
    if (!imageDataUrl) {
      setStatus('Upload a photo before downloading a styled image.')
      return
    }

    const image = new Image()
    image.src = imageDataUrl

    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
    })

    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      setStatus('Could not create export canvas.')
      return
    }

    const scaleX = image.width / 100
    const scaleY = image.height / 100
    ctx.drawImage(image, 0, 0, image.width, image.height)

    function drawLinearPiece(xPercent, yPercent, widthPx, heightPx, colors, radius = widthPx / 2) {
      const x = xPercent * scaleX
      const y = yPercent * scaleY
      const gradient = ctx.createLinearGradient(x, y - heightPx / 2, x, y + heightPx / 2)
      colors.forEach((color, index) => {
        gradient.addColorStop(index / (colors.length - 1 || 1), color)
      })
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x - widthPx / 2, y - heightPx / 2, widthPx, heightPx, radius)
      ctx.fill()
    }

    function drawRing(xPercent, yPercent, diameterPx, stroke, lineWidth) {
      const x = xPercent * scaleX
      const y = yPercent * scaleY
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      ctx.arc(x, y, diameterPx / 2, 0, Math.PI * 2)
      ctx.stroke()
    }

    drawLinearPiece(
      overlayLayout.leftEarring.left,
      overlayLayout.leftEarring.top,
      image.width * 0.02,
      image.height * 0.12,
      ['#ffe7bf', '#c99341'],
    )
    drawLinearPiece(
      overlayLayout.rightEarring.left,
      overlayLayout.rightEarring.top,
      image.width * 0.02,
      image.height * 0.12,
      ['#ffe7bf', '#c99341'],
    )
    drawRing(overlayLayout.leftBangle.left, overlayLayout.leftBangle.top, image.width * 0.08, '#d3a056', image.width * 0.008)
    drawRing(overlayLayout.rightBangle.left, overlayLayout.rightBangle.top, image.width * 0.08, '#d3a056', image.width * 0.008)

    ctx.strokeStyle = '#d3a056'
    ctx.lineWidth = image.width * 0.012
    ctx.beginPath()
    ctx.ellipse(
      overlayLayout.necklace.left * scaleX,
      overlayLayout.necklace.top * scaleY,
      (overlayLayout.necklace.width * scaleX) / 2,
      (overlayLayout.necklace.height * scaleY) / 2,
      0,
      0.1 * Math.PI,
      0.9 * Math.PI,
    )
    ctx.stroke()

    if (activeLook !== 'minimal') {
      drawLinearPiece(
        overlayLayout.tikka.left,
        overlayLayout.tikka.top + overlayLayout.tikka.length / 2,
        image.width * 0.018,
        overlayLayout.tikka.length * scaleY,
        ['#fbe6bd', '#b07b33'],
      )
    }

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `aurawear-look-${Date.now()}.png`
    link.click()
    setStatus('Styled image downloaded.')
  }

  async function runAnalysis() {
    if (!imageDataUrl) {
      setStatus('Upload a full-body photo first so the stylist can analyze the outfit.')
      return
    }

    setLoading(true)
    setStatus('Analyzing silhouette, neckline, styling goal, and jewelry harmony...')

    try {
      const response = await fetch('/api/style-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          imageMeta,
          context,
        }),
      })

      const data = await response.json()
      setResult(data)

      if (data.usedAi) {
        setStatus('AI vision analysis completed with the backend OpenAI key.')
      } else if (data.error) {
        setStatus('The AI request failed, so the app switched to the local stylist engine.')
      } else {
        setStatus('No OpenAI key is configured yet, so the polished local stylist engine is active.')
      }
    } catch {
      setResult(fallbackBundle)
      setStatus('Backend unavailable, so the polished local stylist engine is shown instead.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="mesh mesh-a" />
      <div className="mesh mesh-b" />
      <div className="mesh mesh-c" />

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AuraWear AI</p>
          <h1>Jewelry styling that feels feminine, premium, and launch-ready.</h1>
          <p className="hero-text">
            Upload a dress photo, let the stylist read body geometry and occasion mood, and preview
            recommendations that can grow into a serious bridal commerce platform.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={runAnalysis} disabled={loading}>
              {loading ? 'Styling...' : 'Run AI stylist'}
            </button>
            <button className="secondary-button" onClick={saveCurrentLook}>
              Save look
            </button>
            <button className="secondary-button" onClick={downloadStyledPhoto}>
              Download image
            </button>
            <span className="signal-pill">{display.usedAi ? 'AI mode live' : 'Elegant fallback mode'}</span>
          </div>

          <div className="stat-row">
            <article>
              <strong>6+</strong>
              <span>Jewelry recommendations</span>
            </article>
            <article>
              <strong>3</strong>
              <span>Stylist score pillars</span>
            </article>
            <article>
              <strong>MVP</strong>
              <span>Ready for phase two CV</span>
            </article>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-stack">
            {editorialCards.map((card) => (
              <article key={card.title} className="editorial-card">
                <img src={card.image} alt={card.title} />
                <div className="editorial-overlay">
                  <p>{card.title}</p>
                  <span>{card.subtitle}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel upload-panel">
          <div className="section-heading">
            <h2>Upload + style brief</h2>
            <p>Designed for weddings, festive outfits, luxury events, and modern minimal dressing.</p>
          </div>

          <label className="upload-box">
            <input type="file" accept="image/*" onChange={onImageUpload} />
            <span>Upload full-body outfit photo</span>
            <small>{imageMeta.name}</small>
          </label>

          <div className="control-grid">
            <label>
              Occasion
              <input name="occasion" value={context.occasion} onChange={onFieldChange} />
            </label>

            <label>
              Style goal
              <select name="styleGoal" value={context.styleGoal} onChange={onFieldChange}>
                <option>Wedding look</option>
                <option>Elegant match</option>
                <option>Minimalist look</option>
                <option>Luxury look</option>
              </select>
            </label>

            <label>
              Neckline
              <select name="neckline" value={context.neckline} onChange={onFieldChange}>
                <option>Deep neck</option>
                <option>V-neck</option>
                <option>Boat neck</option>
                <option>Square neck</option>
                <option>High neck</option>
              </select>
            </label>

            <label>
              Dress detail
              <select name="embroidery" value={context.embroidery} onChange={onFieldChange}>
                <option>Heavy embroidery</option>
                <option>Balanced embellishment</option>
                <option>Minimal surface work</option>
              </select>
            </label>

            <label>
              Budget tier
              <select name="budget" value={context.budget} onChange={onFieldChange}>
                <option>Luxury</option>
                <option>Premium</option>
                <option>Accessible</option>
              </select>
            </label>
          </div>

          <div className="status-card">
            <p className="panel-label">Current status</p>
            <strong>{status}</strong>
            <span className="status-subtle">{landmarkStatus}</span>
          </div>
        </section>

        <section className="panel tryon-panel">
          <div className="section-heading">
            <h2>Virtual try-on preview</h2>
            <p>Drag pieces directly on the image, save the look, and download the styled result.</p>
          </div>

          <div className="look-tabs">
            {lookPresets.map((look) => (
              <button
                key={look.id}
                className={look.id === activeLook ? 'active' : ''}
                onClick={() => selectLook(look.id)}
              >
                {look.title}
              </button>
            ))}
            <button
              className={showDebugLandmarks ? 'active debug-toggle' : 'debug-toggle'}
              onClick={() => setShowDebugLandmarks((current) => !current)}
            >
              {showDebugLandmarks ? 'Hide landmarks' : 'Show landmarks'}
            </button>
          </div>

          <div className="tryon-actions">
            <button className="primary-button small-action" onClick={runAnalysis} disabled={loading}>
              {loading ? 'Styling...' : 'Refresh styling'}
            </button>
            <button className="secondary-button small-action" onClick={saveCurrentLook}>
              Save look
            </button>
            <button className="secondary-button small-action" onClick={downloadStyledPhoto}>
              Download image
            </button>
          </div>

          <div className="preview-card">
            <div ref={stageRef} className={`image-stage ${previewSrc ? 'has-image' : ''}`}>
              {previewSrc ? (
                <>
                  <img src={previewSrc} alt="Uploaded preview" className="user-photo" />
                  <div className={`overlay-set overlay-${activeLook}`}>
                    <span
                      className="earring left"
                      onPointerDown={startDrag('leftEarring')}
                      style={{
                        left: `${overlayLayout.leftEarring.left}%`,
                        top: `${overlayLayout.leftEarring.top}%`,
                      }}
                    />
                    <span
                      className="earring right"
                      onPointerDown={startDrag('rightEarring')}
                      style={{
                        left: `${overlayLayout.rightEarring.left}%`,
                        top: `${overlayLayout.rightEarring.top}%`,
                      }}
                    />
                    <span
                      className="necklace"
                      onPointerDown={startDrag('necklace')}
                      style={{
                        left: `${overlayLayout.necklace.left}%`,
                        top: `${overlayLayout.necklace.top}%`,
                        width: `${overlayLayout.necklace.width}%`,
                        height: `${overlayLayout.necklace.height}%`,
                      }}
                    />
                    <span
                      className="bangle left"
                      onPointerDown={startDrag('leftBangle')}
                      style={{
                        left: `${overlayLayout.leftBangle.left}%`,
                        top: `${overlayLayout.leftBangle.top}%`,
                      }}
                    />
                    <span
                      className="bangle right"
                      onPointerDown={startDrag('rightBangle')}
                      style={{
                        left: `${overlayLayout.rightBangle.left}%`,
                        top: `${overlayLayout.rightBangle.top}%`,
                      }}
                    />
                    {activeLook !== 'minimal' && (
                      <span
                        className="tikka"
                        onPointerDown={startDrag('tikka')}
                        style={{
                          left: `${overlayLayout.tikka.left}%`,
                          top: `${overlayLayout.tikka.top}%`,
                          height: `${overlayLayout.tikka.length}%`,
                        }}
                      />
                    )}
                  </div>
                  {showDebugLandmarks && effectiveDebugPoints.length > 0 && (
                    <div className="debug-layer">
                      {effectiveDebugPoints.map((point) => (
                        <div
                          key={point.id}
                          className={`debug-point tone-${point.tone}`}
                          style={{
                            left: `${point.x}%`,
                            top: `${point.y}%`,
                          }}
                        >
                          <span className="debug-dot" />
                          <span className="debug-label">{point.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="landmark-badge">MediaPipe overlay</div>
                </>
              ) : (
                <div className="placeholder-stage">
                  <div className="placeholder-art">
                    <div className="placeholder-ring one" />
                    <div className="placeholder-ring two" />
                    <div className="placeholder-silhouette" />
                  </div>
                  <p>Your outfit photo appears here with instant jewelry overlays.</p>
                </div>
              )}
            </div>

            <aside className="look-summary">
              <p className="panel-label">Active aesthetic</p>
              <h3>{activePreset.title}</h3>
              <p>{activePreset.tone}</p>
              <div className="accent-chip">{activePreset.accent}</div>
              <div className="summary-note">
                <strong>{display.narrative}</strong>
              </div>
              <div className="summary-note soft-note">
                <strong>{landmarkStatus}</strong>
              </div>
              <div className="summary-note soft-note">
                <strong>Tip:</strong> drag any jewelry piece directly on the image to manually adjust placement.
              </div>
            </aside>
          </div>
        </section>

        <section className="panel analysis-panel">
          <div className="section-heading">
            <h2>Body structure detection</h2>
            <p>These are the visual traits the AI reads before deciding what jewelry harmonizes best.</p>
          </div>

          <div className="analysis-grid">
            {Object.entries(display.analysis).map(([label, value]) => (
              <article key={label} className="analysis-card">
                <p>{label.replace(/([A-Z])/g, ' $1')}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="panel recommendations-panel">
          <div className="section-heading">
            <h2>Recommendation engine</h2>
            <p>Body-aware, outfit-aware, and occasion-aware jewelry suggestions.</p>
          </div>

          <div className="recommendation-grid">
            {recommendationCards(display.recommendations).map(([title, value]) => (
              <article key={title} className="recommendation-card">
                <p>{title}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          <div className="rationale-list">
            {display.recommendations.rationale.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <section className="panel score-panel">
          <div className="section-heading">
            <h2>Stylist score</h2>
            <p>A premium scoring layer that makes the experience feel intentional and trusted.</p>
          </div>

          <div className="score-grid">
            {Object.entries(display.scores).map(([key, value]) => (
              <article key={key} className="score-card">
                <div className="score-ring" style={{ '--score': `${value}%` }}>
                  <span>{value}%</span>
                </div>
                <p>{scoreLabelMap[key]}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel commerce-panel">
          <div className="section-heading">
            <h2>API and launch checklist</h2>
            <p>The app now tells you exactly what is required versus what can wait.</p>
          </div>

          <div className="checklist-grid">
            {apiChecklist.map((item) => (
              <article key={item.title} className="check-card">
                <span className="status-tag">{item.status}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel shopping-panel">
          <div className="section-heading">
            <h2>Commerce layer</h2>
            <p>Ready for affiliate links, bridal consultation, and marketplace expansion.</p>
          </div>

          <div className="shopping-grid">
            {display.shoppingMatches.map((item) => (
              <article key={`${item.title}-${item.price}`} className="shopping-card">
                <p>{item.vibe}</p>
                <strong>{item.title}</strong>
                <span>{item.price}</span>
              </article>
            ))}
          </div>

          <div className="partner-row">
            {commercePartners.map((partner) => (
              <span key={partner}>{partner}</span>
            ))}
          </div>
        </section>

        <section className="panel saved-panel">
          <div className="section-heading">
            <h2>Saved looks</h2>
            <p>Keep your strongest edits, reload them, and continue refining placement later.</p>
          </div>

          <div className="saved-grid">
            {savedLooks.length === 0 && (
              <article className="saved-card empty-card">
                <strong>No saved looks yet.</strong>
                <span>Upload a photo, style it, then press Save look.</span>
              </article>
            )}

            {savedLooks.map((look) => (
              <article key={look.id} className="saved-card">
                <img src={look.imageDataUrl} alt={look.title} className="saved-thumb" />
                <div className="saved-copy">
                  <strong>{look.title}</strong>
                  <span>{new Date(look.createdAt).toLocaleString()}</span>
                </div>
                <div className="saved-actions">
                  <button className="secondary-button small-button" onClick={() => loadSavedLook(look)}>
                    Load
                  </button>
                  <button className="ghost-button small-button" onClick={() => deleteSavedLook(look.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
