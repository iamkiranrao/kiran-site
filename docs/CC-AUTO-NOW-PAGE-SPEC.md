# CC-Powered Auto-Generating /Now Page — Specification

## Concept

The `/now` page (`now.html`) currently contains static, manually-updated content about what Kiran is working on. This spec proposes a dynamic content layer powered by the Command Center backend, which already tracks:

- **Action Items** — Current priorities grouped by workstream, with status (todo, in-progress, blocked, done)
- **Kiran's Journal** — Strategic decisions, principles, and recent thinking (last 30 days)
- **Session Archive** — Recent session transcripts and activity

A new `/api/now-page/` endpoint in the CC backend would expose structured JSON synthesizing these sources. The frontend (`now.html`) could then fetch this data on page load and dynamically populate content sections, falling back to static content if the API is unreachable.

**North Star:** Automatic reflection of Kiran's current focus and thinking without manual sync. The /now page becomes a living dashboard of what's in motion and what's top-of-mind.

---

## Data Sources

### Source 1: Action Items (by Workstream)
**API endpoint:** `GET /api/action-items/`

Filter for:
- Status: `todo`, `in-progress` (exclude `blocked`, `done`, `wont-do`)
- Items from last 30 days (sort by workstream, then by priority)
- Group by workstream
- Include critical/high priority items prominently

**Use case:** "What workstreams are active right now?"

### Source 2: Kiran's Journal (Recent Entries)
**API endpoint:** `GET /api/kirans-journal/`

Filter for:
- Last 30 days (use `created_at` timestamp)
- Categories: `principle`, `product-philosophy`, `career-strategy`, `apprehension`, `idea` (exclude `general`)
- Return title + body snippet (first 200 chars)

**Use case:** "What's on Kiran's mind? What tensions exist?"

### Source 3: Session Activity
**API endpoint:** TBD (new lightweight endpoint or read from existing archive)

Could be minimal: just the count and date of most recent session, or list of 3 most recent sessions with timestamps.

**Use case:** "When was Kiran last in a build session? What's the cadence?"

---

## JSON Schema — /api/now-page/ Response

```json
{
  "generated_at": "2026-04-12T15:30:00Z",
  "cache_ttl_seconds": 3600,
  "status": "success",

  "workstreams": [
    {
      "name": "fenix",
      "display_name": "Fenix",
      "open_items": 12,
      "items_by_priority": {
        "critical": 2,
        "high": 5,
        "medium": 5,
        "low": 0
      },
      "top_items": [
        {
          "id": "abc123",
          "title": "Build subscription flow for Scannibal",
          "priority": "critical",
          "status": "in-progress",
          "owner": "claude"
        },
        {
          "id": "def456",
          "title": "Test on iPhone SE + 15 Pro Max",
          "priority": "high",
          "status": "todo",
          "owner": "kiran"
        }
      ]
    },
    {
      "name": "site-homepage",
      "display_name": "Site / Homepage",
      "open_items": 5,
      "items_by_priority": {
        "critical": 0,
        "high": 2,
        "medium": 3,
        "low": 0
      },
      "top_items": [ /* ... */ ]
    }
  ],

  "recent_thinking": {
    "last_30_days": 8,
    "entries": [
      {
        "id": "entry-001",
        "title": "Why we gate connected features",
        "category": "product-philosophy",
        "created_at": "2026-04-10T12:00:00Z",
        "snippet": "Identity is the gate, not price. The site works best when features require you to understand who you are and what you want...",
        "url": "/cc/kirans-journal/#entry-001"
      },
      {
        "id": "entry-002",
        "title": "Tension: speed vs. polish",
        "category": "apprehension",
        "created_at": "2026-04-08T14:30:00Z",
        "snippet": "We keep delaying launches to perfect things. But getting real feedback faster might teach us more than another week of polish...",
        "url": "/cc/kirans-journal/#entry-002"
      }
    ]
  },

  "session_activity": {
    "total_sessions_tracked": 145,
    "recent_sessions": [
      {
        "date": "2026-04-11",
        "label": "Session 142 — Build Fenix Evaluator"
      },
      {
        "date": "2026-04-09",
        "label": "Session 141 — Scannibal UAT Fixes"
      },
      {
        "date": "2026-04-07",
        "label": "Session 140 — Homepage Bento Refinement"
      }
    ],
    "last_session": "2026-04-11T16:45:00Z",
    "cadence_insights": "Recent: ~3 sessions/week. Last build session 1 day ago."
  },

  "metadata": {
    "persona_hints": "Pattern-Breaker Who Hires Pattern-Breakers — builder, systems thinker, community-focused",
    "north_star": "Relational connection. The site is a permanent home, not a campaign."
  }
}
```

---

## Frontend Integration

### Fetch & Render Flow

1. **Page load** (`now.html`):
   - Fetch `GET https://cc.kiranrao.ai/api/now-page/`
   - Include `X-API-Key` header (stored as JS constant in HTML)
   - Parse JSON response

2. **Render sections**:
   - "What's In Motion" — Workstreams with open item counts (collapsed by default, expand on click)
   - "What's On My Mind" — Recent journal entries as blockquote cards
   - "Recent Sessions" — Last 3 sessions + cadence
   - "Updated At" — Show `generated_at` timestamp

3. **Fallback (API unreachable)**:
   - Keep existing static HTML in place
   - Show notice: "Dynamic sections unavailable; showing static snapshot."
   - Continue rendering static content below

4. **Caching** (optional, highly recommended):
   - Client-side cache: store response in `localStorage` with `cache_ttl_seconds`
   - Only re-fetch if cached response is stale
   - Show "(cached as of X minutes ago)" when serving from cache

### Example HTML Structure

```html
<div class="now-dynamic">
  <!-- Populated by JavaScript -->
  <section id="whats-in-motion">
    <h2>What's In Motion</h2>
    <div id="workstreams-container">
      <!-- Rendered from API: workstream cards -->
    </div>
  </section>

  <section id="whats-on-my-mind">
    <h2>What's On My Mind</h2>
    <div id="journal-entries">
      <!-- Rendered from API: journal entry cards -->
    </div>
  </section>

  <section id="session-cadence">
    <h2>Recent Sessions</h2>
    <div id="sessions-list">
      <!-- Rendered from API: session dates -->
    </div>
  </section>

  <p class="now-api-status" id="api-status"></p>
</div>

<!-- Fallback static content (hidden if API succeeds) -->
<div id="static-content-fallback">
  <!-- Existing /now content here -->
</div>
```

### JavaScript (Minimal Example)

```javascript
async function loadNowPage() {
  const apiUrl = "https://cc.kiranrao.ai/api/now-page/";
  const apiKey = "H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk";

  try {
    const response = await fetch(apiUrl, {
      headers: { "X-API-Key": apiKey }
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    renderNowPage(data);
    localStorage.setItem("now-page-cache", JSON.stringify(data));
  } catch (error) {
    console.error("Failed to load dynamic content:", error);
    // Keep static fallback visible
    document.getElementById("static-content-fallback").style.display = "block";
  }
}

function renderNowPage(data) {
  // Render workstreams
  const wsContainer = document.getElementById("workstreams-container");
  data.workstreams.forEach(ws => {
    wsContainer.innerHTML += `
      <article class="workstream-card">
        <h3>${ws.display_name} <span class="badge">${ws.open_items}</span></h3>
        <ul>
          ${ws.top_items.map(item => `
            <li class="priority-${item.priority}">
              ${item.title} <span class="owner">${item.owner}</span>
            </li>
          `).join("")}
        </ul>
      </article>
    `;
  });

  // Render journal entries
  const journalContainer = document.getElementById("journal-entries");
  data.recent_thinking.entries.forEach(entry => {
    journalContainer.innerHTML += `
      <blockquote class="journal-card ${entry.category}">
        <strong>${entry.title}</strong>
        <p>${entry.snippet}</p>
        <small>${entry.category}</small>
      </blockquote>
    `;
  });

  // Show last updated
  document.getElementById("api-status").textContent =
    `Updated ${new Date(data.generated_at).toLocaleString()}`;
}

// Load on page load
document.addEventListener("DOMContentLoaded", loadNowPage);
```

---

## Privacy Considerations

### What Should Be Public

- **Workstream names** (e.g., "Fenix", "Site/Homepage") — these are part of Kiran's public brand
- **Open item counts** — shows activity level, not sensitive
- **Item titles** (sanitized) — what he's working on is part of the brand narrative
- **Journal entries** — if they're in the journal, they're intentionally strategic/philosophical
- **Session dates** — shows cadence, not content

### What Should NOT Be Public

- **Blocked items** or items flagged as "CRITICAL" with security context — gated
- **Notes field** on action items — often contains personal context
- **Due dates** for unreleased products — gated
- **Full item descriptions** — may contain internal details; use title + priority only
- **Journal entries with tag "private"** — if we add a privacy tag later

### Recommendation

Gate the endpoint itself at the API level:
- **No auth required** for basic workstream names + top 3 items per workstream
- **Optional: "Logged in" view** with more detail (notes, due dates, blocked items)
- Start public and tighten later if needed

---

## Implementation Phases

### Phase 1: Backend Endpoint (Tier 1 Effort)
**Deliverable:** `/api/now-page/` endpoint returning JSON schema above

**Steps:**
1. Create new router file: `command-center/backend/routers/now_page.py`
2. Implement `@router.get("/api/now-page/", response_model=dict)` that:
   - Calls `/api/action-items/?status=todo,in-progress&limit=100`
   - Calls `/api/kirans-journal/?limit=30&days=30`
   - Calls session archive query (count + recent dates)
   - Groups action items by workstream
   - Filters to top 3 items per workstream (critical > high > medium)
   - Paginates journal to 5-8 recent entries
   - Returns combined JSON response
3. Add to main FastAPI app router stack
4. Test locally: `curl -H "X-API-Key: ..." http://localhost:8000/api/now-page/`
5. Deploy to Vercel (CC backend)

**Effort estimate:** 2-3 hours
- 30 min: router boilerplate
- 60 min: data aggregation + grouping logic
- 30 min: response formatting + edge cases
- 30 min: testing + deployment

**Owner:** Claude (initial build), Kiran (testing + approval)

---

### Phase 2: Frontend JS & Rendering (Tier 1 Effort)
**Deliverable:** `now.html` with dynamic sections + fallback

**Steps:**
1. Add `<script>` block to `now.html` with `loadNowPage()` and `renderNowPage()` functions
2. Create CSS classes for:
   - `.workstream-card` — workstream boxes (priority badges, item lists)
   - `.journal-card` — blockquote cards (entry title, snippet, category tag)
   - `.priority-*` — color coding (critical = red, high = orange, medium = yellow, low = gray)
3. Add `<div id="whats-in-motion">`, `<div id="whats-on-my-mind">`, `<div id="session-cadence">` to HTML
4. Implement fallback: if API fails, keep existing static content visible + show error message
5. Add localStorage caching: 1-hour TTL, skip re-fetch if cached

**Effort estimate:** 1.5-2 hours
- 30 min: HTML structure + divs
- 45 min: JS fetch + render logic
- 30 min: CSS styling + responsive
- 15 min: testing + fallback flow

**Owner:** Claude (implementation), Kiran (visual review)

---

### Phase 3: Caching Layer (Tier 2 Effort — Optional)
**Deliverable:** Server-side caching in CC backend to reduce DB hits

**Steps:**
1. Add Redis or in-memory cache to CC backend
2. Cache `/api/now-page/` response for `cache_ttl_seconds` (default 3600 = 1 hour)
3. Invalidate cache on:
   - New action item created
   - Action item status changed
   - New journal entry created
4. Return `X-Cache: HIT|MISS` header for debugging
5. Track cache hit rate in metrics

**Effort estimate:** 1-2 hours
- 30 min: Redis setup (or in-memory dict)
- 45 min: cache invalidation hooks
- 15 min: testing + metrics

**Owner:** Claude (if building; can defer to Phase 2+)

**Note:** Can skip this initially. If the endpoint is fast (<100ms), caching is nice-to-have. Add after v1.

---

## Effort Summary by Phase

| Phase | Component | Est. Hours | Owner | Status |
|-------|-----------|-----------|-------|--------|
| 1 | Backend `/api/now-page/` endpoint | 2-3 | Claude | TBD |
| 2 | Frontend JS + rendering | 1.5-2 | Claude + Kiran | TBD |
| 3 | Caching layer (optional) | 1-2 | Claude | Backlog |
| **Total (Phases 1-2)** | **Core feature** | **3.5-5 hours** | — | — |

---

## API Error Handling

**Scenario 1: CC backend unreachable**
- Frontend catches `fetch()` error
- Shows fallback static content
- Logs to browser console (no user-facing error)
- Tries again on next page load

**Scenario 2: API returns 401 Unauthorized**
- Invalid or missing `X-API-Key`
- Show message: "Content refresh unavailable; check API key."
- Still show static fallback

**Scenario 3: API returns 500 Internal Server Error**
- Log error to CC backend
- Return cached response if available (even if stale)
- Show message: "Using cached snapshot (X hours old)"

**Scenario 4: API returns empty data**
- Render empty state: "No active items right now."
- Still show journal entries + sessions
- Not a failure; just a slow week

---

## Future Enhancements

1. **Interactive workstream cards** — Click to expand, see all items (with scrolling)
2. **Filter controls** — "Show critical only", "Show my items", "Show this workstream"
3. **Time-series sparkline** — Graph of open items over last 30 days
4. **Real-time updates** — WebSocket subscription to action item changes (push updates without refresh)
5. **Email digest** — Weekly summary of what's in motion (sent Friday)
6. **Mobile widget** — Embed mini /now view in home screen
7. **Smart snippets** — Use LLM to summarize action item lists into prose (e.g., "Fenix: finalizing evaluator, testing edge cases, shipping next week")

---

## Testing Checklist

- [ ] Backend: Endpoint returns valid JSON (curl test)
- [ ] Backend: Workstreams are properly grouped and sorted by priority
- [ ] Backend: Journal entries are from last 30 days only
- [ ] Frontend: Page loads and renders without API errors (local + tunnel)
- [ ] Frontend: Fallback static content shows if API fails
- [ ] Frontend: Cache works (second load uses localStorage)
- [ ] Frontend: Mobile responsive (check on iPhone SE, iPad, desktop)
- [ ] Frontend: Dark mode colors work (check against visual standards)
- [ ] Privacy: No sensitive details leak in public response
- [ ] Performance: Page load < 2s (including API fetch)

---

## Notes & Rationale

**Why auto-generate the /now page?**
- Kiran manually updates this page every 2-4 weeks
- The data already exists in CC (action items, journal entries, sessions)
- Auto-generation keeps it fresh without overhead
- Shows live proof that the systems (CC, Fenix, products) are interconnected

**Why CC backend over a separate integration?**
- CC is the single source of truth for action items
- One API key, one auth model (centralized)
- Reduces infrastructure overhead

**Why cache?**
- CC backend may be slow if doing complex aggregations
- Cloudflare Pages has no server-side rendering; pure client-side fetch
- Caching prevents hammering the backend on high traffic days

**Why fallback to static?**
- If CC goes down, the /now page doesn't break
- Users see something useful (if stale)
- Demonstrates resilience in product design

**Why public by default?**
- Workstream activity + thinking is part of Kiran's brand
- Adds authenticity: "Here's what I'm actually working on"
- Gate only if sensitive product details emerge later
