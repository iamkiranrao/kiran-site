"""visual_assets data models.

Visual asset inventory — every brand / site asset (shipped + planned).
Three lifecycle states:
  - uncommitted: spec exists, nobody's committed to producing it
  - in_progress: kiran has committed and is producing (or designer is)
  - shipped: file exists on disk, asset is live

Serves as living spec sheet + system of record for everything visual.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Enums (as string literals to keep schema lightweight) ──────

VALID_STATUSES = ["uncommitted", "in_progress", "shipped", "parked"]

VALID_CATEGORIES = [
    "brand-fundamentals",   # palette, typography, characters, aesthetics
    "site-identity",        # hero, favicon, logo
    "content-surfaces",     # bento, personas, OG cards, error imagery
    "marketing",            # banners, handout, mood board, social concepts
    "video",                # cinemagraph, manifesto
    "stationery",           # business cards, letterhead, envelope, notecard
    "documents",            # pitch deck, resume, one-pager, case study, press release
    "email",                # signature, newsletter
    "speaking",             # speaker bio, title slide, zoom bg, podcast
    "platform",             # avatars, workspace icons, GitHub social
    "print",                # stickers, posters, merch
    "brand-docs",           # guidelines, voice, logo lockups, palette spec, type spec, icon set, patterns, photo treatment, watermark
    "future-state",         # headshots, press kit (low priority)
]

VALID_OWNERS = ["kiran", "designer", "claude", "tbd"]


# ── Pydantic Models ────────────────────────────────────────────

class VisualAssetCreate(BaseModel):
    name: str
    category: str = Field(..., description="One of VALID_CATEGORIES")
    subcategory: Optional[str] = None
    status: str = Field("uncommitted", description="One of VALID_STATUSES")

    # What and why
    purpose: str = Field(..., description="1-2 line description of what the asset is for")
    where_deployed: Optional[str] = None  # e.g., "Top of index.html lines 147-152", "linkedin.com profile header"

    # Technical specs
    dimensions: Optional[str] = None      # "1200×630", "3:4 portrait", "180×180"
    aspect_ratio: Optional[str] = None    # "1.91:1", "3:4", "1:1"
    file_format: Optional[str] = None     # "PNG + WebP", "PDF + .docx", "SVG"
    file_size_target: Optional[str] = None  # "<300KB", "<1MB"
    quantity: Optional[int] = 1            # for sets like mood board (8), banners (3)

    # Output
    output_path: Optional[str] = None      # "images/og/og-teardowns.png"
    naming_pattern: Optional[str] = None   # "[character]-[slot]-[ratio].png"

    # Creative direction
    style_direction: Optional[str] = None  # Free text creative brief
    palette_constraints: Optional[str] = None  # Specific colors / palette rules
    typography_rules: Optional[str] = None  # If type is part of asset
    composition_rules: Optional[str] = None  # Safe zones, dead zones, etc.

    # Source & tooling
    source_method: Optional[str] = None   # "Midjourney", "Canva", "HTML/CSS", "Photographer", "Programmatic (PIL)", "Designer"
    generation_tool: Optional[str] = None  # Specific tool / version
    style_ref: Optional[str] = None       # URL or filename of reference

    # Preview & reference
    preview_image_url: Optional[str] = None  # Path to a thumbnail (relative to site root)
    inspiration_links: List[str] = []        # External reference URLs

    # Ownership
    owner: str = "tbd"                     # Who's producing — kiran / designer / claude / tbd
    estimated_effort: Optional[str] = None  # "small" / "medium" / "large"

    # Linking
    linked_action_items: List[str] = []   # IDs of related action items in CC
    related_assets: List[str] = []         # IDs of other visual assets that pair with this one

    # Notes
    notes: Optional[str] = None            # Free text — anything else worth knowing


class VisualAssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    status: Optional[str] = None
    purpose: Optional[str] = None
    where_deployed: Optional[str] = None
    dimensions: Optional[str] = None
    aspect_ratio: Optional[str] = None
    file_format: Optional[str] = None
    file_size_target: Optional[str] = None
    quantity: Optional[int] = None
    output_path: Optional[str] = None
    naming_pattern: Optional[str] = None
    style_direction: Optional[str] = None
    palette_constraints: Optional[str] = None
    typography_rules: Optional[str] = None
    composition_rules: Optional[str] = None
    source_method: Optional[str] = None
    generation_tool: Optional[str] = None
    style_ref: Optional[str] = None
    preview_image_url: Optional[str] = None
    inspiration_links: Optional[List[str]] = None
    owner: Optional[str] = None
    estimated_effort: Optional[str] = None
    linked_action_items: Optional[List[str]] = None
    related_assets: Optional[List[str]] = None
    notes: Optional[str] = None


class VisualAsset(VisualAssetCreate):
    """Stored asset record — adds id + timestamps."""
    id: str
    created_at: datetime
    updated_at: datetime
    shipped_at: Optional[datetime] = None  # Set when status flips to "shipped"
