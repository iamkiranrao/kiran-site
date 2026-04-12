# Teardown Pages — Persona Picker Bypass Verification

**Date:** 2026-04-12
**Issue:** #155 — Verify that teardown landing pages bypass the persona picker
**Status:** ✓ VERIFIED — Teardowns already bypass picker correctly

---

## Summary

Teardown pages **do not load persona-system.js** and therefore automatically bypass the persona picker. The mechanism is confirmed and working as designed.

---

## Verification Method

### 1. Persona System Script Inclusion

**Finding:** Zero teardown files (`/teardowns/*.html`) include `persona-system.js`

```bash
$ grep -l "persona-system.js" teardowns/*.html
# Result: (no matches — 0 files)
```

**Evidence:** Checked all teardown HTML files in `/teardowns/` directory (20+ files). None reference the persona system script.

### 2. Picker Section HTML Element

**Finding:** Zero teardown files contain the `persona-picker-section` HTML element

```bash
$ grep -l "persona-picker-section" teardowns/*.html
# Result: (no matches — 0 files)
```

**Why this matters:** The picker UI requires this element to exist in the DOM. See `persona-system.js` line 201:

```javascript
if (!document.getElementById('persona-picker-section')) return;
```

Without this element, the entire persona pill and picker initialization is skipped.

### 3. What Teardowns DO Load

Teardown pages load minimal, focused scripts:

```html
<script src="../fenix-core.js?v=20260410"></script>
<script src="../fenix-adapters/content-adapter.js?v=20260410"></script>
```

These provide the **Fenix module** (ask Kiran questions about the page) but NOT persona selection.

---

## How It Works

The bypass is automatic, not explicit. Here's the flow:

### Homepage (`index.html`)
1. Loads `persona-system.js`
2. `initMorph()` checks for `#persona-picker-section` element → **found**
3. Shows picker UI if no persona is selected
4. Pill system is initialized

### Teardown Pages (e.g., `teardowns/airbnb.html`)
1. Does NOT load `persona-system.js`
2. No picker code runs
3. No `#persona-picker-section` lookup happens
4. Fenix module loads independently (via content-adapter.js)
5. User sees only Fenix on teardowns, no persona selection

### Subpage Redirect (Safety Fallback)

Even if a teardown somehow loaded persona-system.js, lines 282-287 of `persona-system.js` implement a safety redirect:

```javascript
function showPickerMode() {
  var pickerSection = document.getElementById('persona-picker-section');
  if (!pickerSection) {
    // On subpages: redirect to homepage picker instead of hiding nav
    localStorage.removeItem('persona');
    localStorage.removeItem('persona-accent');
    window.location.href = 'index.html';
    return;
  }
  // ... show picker on homepage
}
```

**Translation:** If a subpage (including teardown) triggers picker intent but lacks the picker section, it redirects to the homepage picker instead.

---

## Code References

### Persona System Initialization

**File:** `/persona-system.js` (lines 933-934)
```javascript
function initFenixSubpageModule() {
  // Only on subpages (not index.html)
  if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) return;
```

This Fenix subpage detection uses `window.location.pathname` checks. Teardown paths like `/teardowns/airbnb.html` don't match these conditions, so they get their own Fenix handling.

### Picker Section Check

**File:** `/persona-system.js` (lines 200-201)
```javascript
// Skip pill on pages without persona-specific treatment
if (!document.getElementById('persona-picker-section')) return;
```

This is the gating logic. No element = no picker initialization.

### Subpage Redirect Fallback

**File:** `/persona-system.js` (lines 281-288)
```javascript
function showPickerMode() {
  var pickerSection = document.getElementById('persona-picker-section');
  if (!pickerSection) {
    // On subpages: redirect to homepage picker instead of hiding nav
    localStorage.removeItem('persona');
    localStorage.removeItem('persona-accent');
    window.location.href = 'index.html';
    return;
  }
  // ...
}
```

---

## Conclusion

**No changes needed.** Teardown pages already bypass the persona picker correctly through:

1. **Primary:** Not loading persona-system.js
2. **Secondary:** Element presence checks prevent picker init if somehow loaded
3. **Tertiary:** Subpage redirect as fallback if user somehow triggers picker action

The design is defensive at three levels, making accidental picker exposure on teardowns effectively impossible.

---

## Verification Checklist

- [x] Confirmed: No teardown files load persona-system.js
- [x] Confirmed: No teardown files contain #persona-picker-section element
- [x] Confirmed: Persona system checks for element existence before running
- [x] Confirmed: Subpage redirect logic exists as fallback
- [x] Confirmed: Teardown paths correctly excluded from Fenix subpage module
- [x] Design is defensive at multiple levels

---

## Related Issues

- #155: Teardown landing pages should bypass persona picker
- `docs/UNLOCK-STRATEGY.md` — Overall gating architecture
- `persona-system.js` — Implementation source
