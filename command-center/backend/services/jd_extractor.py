"""
JD Extractor Service — Fetches and extracts job description text from URLs.

Supports:
- LinkedIn job postings (via guest/embed views + multiple fallback strategies)
- Greenhouse, Lever, Ashby job boards
- Generic company career pages
"""

import re
import json
import httpx
from bs4 import BeautifulSoup
from typing import Optional
from urllib.parse import urlparse, urlencode


# Common user-agent to avoid basic bot blocking
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Timeout for HTTP requests (seconds)
TIMEOUT = 20.0


def _clean_text(text: str) -> str:
    """Normalize whitespace and strip boilerplate."""
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _extract_linkedin_job_id(url: str) -> Optional[str]:
    """Extract the numeric job ID from a LinkedIn job URL."""
    # Handles: /jobs/view/4358493140/... or /jobs/view/4358493140?...
    match = re.search(r"/jobs/view/(\d+)", url)
    if match:
        return match.group(1)
    # Also handles: /jobs/4358493140/
    match = re.search(r"/jobs/(\d+)", url)
    if match:
        return match.group(1)
    return None


def _extract_greenhouse(soup: BeautifulSoup) -> Optional[str]:
    """Extract JD from Greenhouse-hosted pages (boards.greenhouse.io)."""
    content = soup.find("div", id="content")
    if not content:
        content = soup.find("div", class_="content")
    if content:
        return _clean_text(content.get_text("\n", strip=True))
    return None


def _extract_lever(soup: BeautifulSoup) -> Optional[str]:
    """Extract JD from Lever-hosted pages (jobs.lever.co)."""
    sections = soup.find_all("div", class_="section-wrapper")
    if sections:
        parts = []
        for section in sections:
            parts.append(section.get_text("\n", strip=True))
        return _clean_text("\n\n".join(parts))
    body = soup.find("div", class_="posting-page")
    if body:
        return _clean_text(body.get_text("\n", strip=True))
    return None


def _extract_ashby(soup: BeautifulSoup) -> Optional[str]:
    """Extract JD from Ashby-hosted pages (jobs.ashbyhq.com)."""
    main = soup.find("main") or soup.find("div", class_="ashby-job-posting-brief-description")
    if main:
        return _clean_text(main.get_text("\n", strip=True))
    return None


def _extract_linkedin(soup: BeautifulSoup) -> Optional[str]:
    """Extract JD from LinkedIn job postings (multiple selector strategies)."""
    # Strategy 1: Guest view markup (most common for unauthenticated access)
    desc = soup.find("div", class_="show-more-less-html__markup")
    if desc:
        return _clean_text(desc.get_text("\n", strip=True))

    # Strategy 2: Description text container
    desc = soup.find("div", class_="description__text")
    if desc:
        return _clean_text(desc.get_text("\n", strip=True))

    # Strategy 3: Description section
    desc = soup.find("section", class_="description")
    if desc:
        return _clean_text(desc.get_text("\n", strip=True))

    # Strategy 4: Decorated job posting (newer LinkedIn layout)
    desc = soup.find("div", class_="decorated-job-posting__details")
    if desc:
        return _clean_text(desc.get_text("\n", strip=True))

    # Strategy 5: Look for JSON-LD structured data (LinkedIn often embeds this)
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                desc_text = data.get("description", "")
                if desc_text and len(desc_text) > 100:
                    # JSON-LD description is often HTML-encoded
                    desc_soup = BeautifulSoup(desc_text, "lxml")
                    return _clean_text(desc_soup.get_text("\n", strip=True))
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        desc_text = item.get("description", "")
                        if desc_text and len(desc_text) > 100:
                            desc_soup = BeautifulSoup(desc_text, "lxml")
                            return _clean_text(desc_soup.get_text("\n", strip=True))
        except (json.JSONDecodeError, TypeError):
            continue

    # Strategy 6: Any large text block in the main content area
    for selector in [
        {"class_": re.compile(r"job.*description|description.*job", re.I)},
        {"class_": re.compile(r"details|content", re.I)},
    ]:
        for el in soup.find_all(["div", "section"], **selector):
            text = el.get_text("\n", strip=True)
            if len(text) > 300:
                return _clean_text(text)

    return None


def _extract_generic(soup: BeautifulSoup) -> Optional[str]:
    """Generic extraction: look for the largest content block likely to be a JD."""
    # Remove nav, footer, header, scripts
    for tag in soup.find_all(["nav", "footer", "header", "script", "style", "noscript"]):
        tag.decompose()

    candidates = []

    for selector in [
        {"class_": re.compile(r"job[-_]?desc|posting[-_]?desc|description", re.I)},
        {"class_": re.compile(r"job[-_]?content|posting[-_]?content", re.I)},
        {"id": re.compile(r"job[-_]?desc|posting|description", re.I)},
        {"role": "main"},
    ]:
        found = soup.find_all("div", **selector) or soup.find_all("section", **selector)
        for el in found:
            text = el.get_text("\n", strip=True)
            if len(text) > 200:
                candidates.append(text)

    for tag in soup.find_all(["main", "article"]):
        text = tag.get_text("\n", strip=True)
        if len(text) > 200:
            candidates.append(text)

    if candidates:
        best = max(candidates, key=len)
        return _clean_text(best)

    body = soup.find("body")
    if body:
        text = body.get_text("\n", strip=True)
        if len(text) > 200:
            return _clean_text(text[:10000])

    return None


def _detect_platform(url: str) -> str:
    """Detect which job platform a URL belongs to."""
    url_lower = url.lower()
    if "greenhouse.io" in url_lower or "boards.greenhouse" in url_lower:
        return "greenhouse"
    if "lever.co" in url_lower or "jobs.lever" in url_lower:
        return "lever"
    if "ashbyhq.com" in url_lower or "jobs.ashby" in url_lower:
        return "ashby"
    if "linkedin.com" in url_lower:
        return "linkedin"
    return "generic"


async def _fetch_linkedin(url: str) -> dict:
    """
    LinkedIn-specific fetch with multiple fallback strategies.

    LinkedIn blocks most automated requests, so we try several approaches:
    1. Direct fetch of the provided URL (works for some public postings)
    2. Guest/embed view URL (linkedin.com/jobs/view/{id}/ without tracking params)
    3. LinkedIn guest API endpoint
    """
    job_id = _extract_linkedin_job_id(url)
    if not job_id:
        return {
            "success": False,
            "html": "",
            "error": "Could not parse a job ID from this LinkedIn URL. Make sure it's a direct job posting link.",
        }

    urls_to_try = [
        # Clean public URL without tracking params
        f"https://www.linkedin.com/jobs/view/{job_id}/",
        # Guest view (sometimes has different access rules)
        f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}",
    ]

    last_error = ""

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=TIMEOUT,
    ) as client:
        for try_url in urls_to_try:
            try:
                # Use slightly different headers for LinkedIn
                linkedin_headers = {
                    **HEADERS,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                    "Cache-Control": "max-age=0",
                }

                response = await client.get(try_url, headers=linkedin_headers)

                if response.status_code == 200 and len(response.text) > 500:
                    return {"success": True, "html": response.text, "error": ""}

                if response.status_code in (403, 429, 999):
                    last_error = f"LinkedIn returned {response.status_code} — they're blocking automated access."
                    continue

                if response.status_code == 404:
                    last_error = "Job posting not found (404). It may have been removed."
                    continue

                last_error = f"LinkedIn returned HTTP {response.status_code}"

            except httpx.TimeoutException:
                last_error = "LinkedIn request timed out."
                continue
            except Exception as e:
                last_error = str(e)
                continue

    return {
        "success": False,
        "html": "",
        "error": last_error,
    }


async def extract_jd_from_url(url: str) -> dict:
    """
    Fetch a URL and extract the job description text.

    Returns:
        {
            "success": bool,
            "text": str (the extracted JD text),
            "platform": str (detected platform),
            "url": str (the original URL),
            "error": str (if success is False)
        }
    """
    platform = _detect_platform(url)

    try:
        # LinkedIn gets special handling with multiple fallback URLs
        if platform == "linkedin":
            fetch_result = await _fetch_linkedin(url)

            if not fetch_result["success"]:
                return {
                    "success": False,
                    "text": "",
                    "platform": platform,
                    "url": url,
                    "error": (
                        f"{fetch_result['error']} "
                        "LinkedIn heavily restricts automated access to job postings. "
                        "Try opening the job in your browser, copying the full description text, "
                        "and pasting it in the text box below."
                    ),
                }

            html = fetch_result["html"]
            soup = BeautifulSoup(html, "lxml")
            text = _extract_linkedin(soup)

            if not text or len(text) < 100:
                # Try generic as last resort
                text = _extract_generic(soup)

            if not text or len(text) < 100:
                return {
                    "success": False,
                    "text": "",
                    "platform": platform,
                    "url": url,
                    "error": (
                        "Got a response from LinkedIn but couldn't extract the job description. "
                        "The page may require you to be logged in. "
                        "Try copying the JD text from your browser and pasting it below."
                    ),
                }

            return {
                "success": True,
                "text": text,
                "platform": platform,
                "url": url,
            }

        # All other platforms: standard fetch
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=TIMEOUT,
            headers=HEADERS,
        ) as client:
            response = await client.get(url)
            response.raise_for_status()

        html = response.text
        soup = BeautifulSoup(html, "lxml")

        extractors = {
            "greenhouse": _extract_greenhouse,
            "lever": _extract_lever,
            "ashby": _extract_ashby,
            "generic": _extract_generic,
        }

        extractor = extractors.get(platform, _extract_generic)
        text = extractor(soup)

        # If platform-specific failed, try generic
        if not text and platform != "generic":
            text = _extract_generic(soup)

        if not text or len(text) < 100:
            return {
                "success": False,
                "text": "",
                "platform": platform,
                "url": url,
                "error": (
                    "Could not extract enough text from this page. "
                    "The page may require authentication or use JavaScript rendering. "
                    "Try pasting the JD text directly."
                ),
            }

        return {
            "success": True,
            "text": text,
            "platform": platform,
            "url": url,
        }

    except httpx.TimeoutException:
        return {
            "success": False,
            "text": "",
            "platform": platform,
            "url": url,
            "error": "Request timed out. The page may be slow or blocking automated requests.",
        }
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 403:
            msg = "Access denied (403). This page likely requires authentication. Try pasting the JD text directly."
        elif status == 404:
            msg = "Page not found (404). The job posting may have been removed."
        else:
            msg = f"HTTP error {status}. Try pasting the JD text directly."
        return {
            "success": False,
            "text": "",
            "platform": platform,
            "url": url,
            "error": msg,
        }
    except Exception as e:
        return {
            "success": False,
            "text": "",
            "platform": platform,
            "url": url,
            "error": f"Failed to fetch URL: {str(e)}",
        }
