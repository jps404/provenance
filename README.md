# Provenance

> *"Every object has a history."*

**Provenance** is a mobile-first web application designed for phone browsers (iOS Safari and Android Chrome) that reads any physical artifact, tool, artwork, or building the way a historian, museum curator, and docent would.

Rather than generic conversational AI, Provenance is built upon established material-culture scholarship, museum interpretation principles, and design historiography.

---

## 1. What Provenance Does

When a user points their phone camera at an object or building:
1. **Visual Thinking Strategies (VTS)**: It initiates the reading with an open-ended observation question about visual details in the user's specific photo before revealing factual attributions.
2. **Material-Culture Triad (Prown)**: It analyzes the object through three disciplined stages: observable physical **Description**, cultural **Deduction** about its makers and users, and historical **Speculation** / scholarly hypotheses.
3. **Form Follows Failure (Petroski)**: Tappable numbered pins overlay the user's photo to explain which mechanical or functional failure in earlier tools each design feature evolved to solve.
4. **Cultural Biography & Lineage (Kopytoff & Kubler)**: A chronological vertical lineage traces from the ancestral "prime object" archetype to the specimen in hand.
5. **The Hidden World (Read)**: Unveils the invisible global commodity supply chains, mineral extractions, and chemical syntheses bound inside the object's materials.
6. **Myth vs. Record (Wineburg)**: Distinguishes popular marketing folklore from archival and patent records, corroborated by verifiable Google Search sources.
7. **Curatorial Provocation (Tilden)**: Concludes with a single provocative question to sit with rather than a didactic summary.
8. **The Big Idea Label (Serrell)**: A standard museum placard paired with an interpretive takeaway capped under 75 words.
9. **The Cabinet of Curiosities**: Automatically catalogs scans into the user's personal Wunderkammer with standardized museum accession numbers formatted by year, month, and sequence (`YYYY.MM.N`).
10. **Docent Audio Narration**: Reads a spoken script aloud using sentence-queued browser speech synthesis with play, pause, and resume controls.
11. **Shareable Museum Placard**: Generates a high-resolution museum placard card (`.png`) formatted with typography, accession metadata, Serrell label, and photo for native mobile sharing or direct download.

---

## 2. Device Features & Hardware Permissions

- **Rear Environment Camera**:
  - Live rear camera feed via `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false })`.
  - Configured with `playsInline`, `muted`, and `autoPlay` for iOS Safari compliance.
  - Video tracks are automatically stopped when navigating away or when the tab is hidden (`visibilitychange`), and restarted on return.
  - An 8-second timeout guard prevents frozen interfaces if camera permissions hang or are ignored, gracefully transitioning to the photo picker panel.
  - **Universal Fallback**: A `<input type="file" accept="image/*" capture="environment">` button remains accessible at all times to take or upload a photo directly.
- **Geolocation**:
  - Geolocation is requested strictly **after the first shutter tap** (never on initial page load) so the GPS prompt does not stack with the camera permission modal on iOS.
  - Races against a 4-second timeout to ensure scans are never delayed by slow GPS fixes.
  - Provides coordinates and accuracy only to corroborate buildings, historic places, and architectural layers; object scans function completely without location.
- **IFrame Frame Permissions (`metadata.json`)**:
  - To allow camera and geolocation access when running inside an iframe or embedded preview, `metadata.json` explicitly declares:
    ```json
    {
      "requestFramePermissions": ["camera", "geolocation"],
      "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]
    }
    ```

---

## 3. AI Architecture & High-Concurrency Resiliency

Provenance splits analysis into two server-side calls using the official `@google/genai` TypeScript SDK:

### Call 1 — OBSERVE (Fast & Structured)
- **Latency Budget**: 15s per-attempt timeout (target under 6s).
- **Configuration**: `responseMimeType: "application/json"` with strict `responseSchema`, no external tools, and `ThinkingLevel.LOW` to maximize bounding-box coordinate accuracy.
- **Returns**: Specimen kind, tombstone metadata, confidence level, VTS docent question, Prown stage 1 physical description, and 3–5 Petroski failure-driven hotspots (`[ymin, xmin, ymax, xmax]` normalized to 0–1000).

### Call 2 — INTERPRET (Streaming & Grounded)
- **Starts Immediately**: Kicks off in the background while the user reads the VTS question.
- **Server-Sent Events (SSE)**: Streams progressive status events (`"Researching sources..."`, `"Drafting museum interpretation..."`) to the frontend in real time.
- **Visible Grounding**: Uses the `googleSearch` tool to corroborate dates, patents, makers, and lineages against live web sources. Surfaces executed search queries (`webSearchQueries`) under Sources as `"Searched: <query>"`, alongside verified source links and section-level `"Sourced"` tags.
- **Timeline Sanitization**: Enforces strict chronological ordering and specimen anchoring (`is_specimen: true`), dropping any hallucinated entries dated after the specimen.

### Confidence Gating
If Observe reports `identification_confidence === "Low"` or `kind === "unknown"`, Call 2 is bypassed entirely. The exhibit renders the tombstone and physical description with a curatorial notice:
> *"Not enough to go on. Try a closer, well-lit photo of a single object."*
Speculative lineages and myth-versus-record sections are withheld to uphold museum truth standards.

### Model Fallback Chain
To ensure reliable operation when 30+ simultaneous users scan objects during live demonstrations, `server.ts` implements an automated sequential fallback chain across distinct model quota buckets:
$$\text{gemini-3.6-flash} \longrightarrow \text{gemini-3.8-flash} \longrightarrow \text{gemini-3.5-flash-lite} \longrightarrow \text{gemini-3.1-flash-lite}$$
- **Immediate Failover**: On 503, 429, 404, or per-attempt timeouts, the server advances immediately to the next candidate model without delay.
- **Search Tool Preservation**: `googleSearch` remains active on all models except the final edge fallback (`gemini-3.1-flash-lite`), which may run without tools as an unsourced reading with confidence capped at Medium.
- **Attribution**: Every completed exhibit notes the answering engine (e.g. `"Read by gemini-3.6-flash"`).
- **Secure Key Isolation**: `GEMINI_API_KEY` is loaded exclusively on the server (`server.ts`) via server-side proxy endpoints (`/api/observe`, `/api/interpret`), never exposing keys to the client bundle.

---

## 4. The Curatorial Framework: 9 Methodological Citations

Provenance includes a dedicated **Method** screen (reachable from the book icon in the header) citing the scholarly origins of each interpretive principle:

1. **Visual Thinking Strategies (VTS)**: Abigail Housen & Philip Yenawine (1991). *Look before being told: open-ended sensory observation precedes factual instruction.*
2. **Material Culture Triad**: Jules David Prown, *"Mind in Matter: An Introduction to Material Culture Theory and Method"* (*Winterthur Portfolio*, 1982). *Three stages: Description, Deduction, Speculation.*
3. **Form Follows Failure**: Henry Petroski, *"The Evolution of Useful Things"* (Vintage Books, 1992). *Design changes evolve specifically to address documented flaws in predecessor artifacts.*
4. **The Cultural Biography of Things**: Igor Kopytoff, *"The Cultural Biography of Things"* (1986) & George Kubler, *"The Shape of Time: Remarks on the History of Things"* (Yale University Press, 1962). *Tracing mutations from the prime object to the specimen in hand.*
5. **Commodity History**: Leonard E. Read, *"I, Pencil: My Family Tree as Told to Leonard E. Read"* (*The Freeman*, 1958). *Revealing the invisible global web of materials and human cooperation.*
6. **Historical Thinking**: Sam Wineburg, *"Historical Thinking and Other Unnatural Acts"* (Temple University Press, 2001). *Sourcing and corroboration: confronting myths against patent and archival records.*
7. **Interpretation as Provocation**: Freeman Tilden, *"Interpreting Our Heritage"* (University of North Carolina Press, 1957). *The chief aim of interpretation is not instruction, but provocation.*
8. **The Big Idea Label**: Beverly Serrell, *"Exhibit Labels: An Interpretive Approach"* (Rowman & Littlefield, 1996). *Tombstone placard accompanied by a core idea of 75 words or fewer.*
9. **Museum Accessioning**: International Council of Museums (ICOM) Curatorial Standards. *Archival indexing formatted by sequence: `YYYY.MM.N`.*

---

## 5. Local Development & Setup

### Prerequisites
- Node.js 20+ (with npm)
- A Google Gemini API key (obtainable at [aistudio.google.com](https://aistudio.google.com))

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/provenance.git
cd provenance

# Install dependencies
npm install

# Configure your Gemini API key in environment
cp .env.example .env
# Edit .env and set:
# GEMINI_API_KEY="your-gemini-api-key"
```

### Running Locally
```bash
# Start full-stack dev server (Express backend + Vite frontend on port 3000)
npm run dev
```

Visit `http://localhost:3000` in your browser. On a smartphone connected to your local network, browse to `http://<your-local-ip>:3000` to test rear camera and geolocation.

### Running Automated Tests
```bash
# Run pure logic unit tests (Node.js built-in test runner)
node --test src/utils/pure-logic.test.ts
```

### Production Build
```bash
npm run build
npm start
```
