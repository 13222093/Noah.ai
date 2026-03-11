# Verification Fix Plan

4 items from the post-implementation audit. 1 bug, 2 incomplete, 1 lint.

---

## 🔴 Bug — `bg-cc-base` typo (breaks mobile fullscreen)

**File**: `CommandCenterView.tsx:447`
**Problem**: `bg-cc-base` doesn't exist in tailwind.config.ts — Drawer has no background.
**Fix**: Replace `bg-cc-base` → `bg-cc-bg` (2 occurrences: DrawerContent + DrawerHeader)

---

## ⚠️ #14 — Missing "View all" link

**File**: `CommandCenterView.tsx` (AlertPanel, ~line 108)
**Problem**: Cap raised to 20 ✅, but the conditional "View all X alerts →" CTA at bottom of feed was not rendered.
**Fix**: After the `.map()` block, add:
```tsx
{alerts.length > 20 && (
  <div className="px-3 pb-2">
    <Link href="/alerts" className="text-[11px] text-cc-cyan hover:text-cc-cyan-hover font-medium">
      View all {alerts.length} alerts →
    </Link>
  </div>
)}
```

---

## ⚠️ #5 — Infrastructure Status is hardcoded mock

**File**: `DataPanel.tsx:129–162`
**Problem**: Static array with fixed statuses — misleading since it never changes.
**Fix**: Add a `(Placeholder)` label to the section header so it's transparent:
```diff
-Infrastructure Status
+Infrastructure Status (Placeholder)
```
This is honest about the data source until a real infra API is wired.

---

## ⚠️ Lint — `fetchDisasterAreas` unused

**File**: `CommandCenterView.tsx:373`
**Problem**: Destructured but never called. Not a runtime bug (hook auto-fetches on mount).
**Fix**: Remove from destructuring:
```diff
-const { disasterProneAreas, isLoading: isLoadingDisaster, error: disasterError, fetchDisasterAreas } = useDisasterData();
+const { disasterProneAreas, isLoading: isLoadingDisaster, error: disasterError } = useDisasterData();
```

---

## Implementation Order

All 4 are independent one-line fixes. ~2 minutes total.

```
1. bg-cc-base → bg-cc-bg             (CommandCenterView.tsx)
2. Add "View all" link                (CommandCenterView.tsx)
3. Label infra as placeholder         (DataPanel.tsx)
4. Remove unused fetchDisasterAreas   (CommandCenterView.tsx)
```

## Verification

- `npm run build` must pass (exit 0)
