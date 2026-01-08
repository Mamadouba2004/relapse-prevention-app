# Design System Migration Guide

## ✅ Phase 1: Setup (COMPLETED)
- [x] Created comprehensive `constants/theme.ts` with JITAI + Apple Health aesthetic
- [x] Kept legacy `Colors` and `Fonts` exports for backward compatibility
- [x] Added helper functions: `getRiskColor()`, `getRiskLevel()`, `getRiskGradient()`, etc.

## 🎯 Phase 2: Component Library (NEXT)
Create reusable styled components that use the design system.

### Priority Components to Build:

1. **RiskGauge.tsx** (circular progress indicator)
   - Usage: Replace static percentage displays with animated circular gauges
   - Props: `riskPercent`, `size`, `showLabel`
   - Location: `components/ui/risk-gauge.tsx`

2. **GradientButton.tsx** (primary CTA button)
   - Usage: Replace existing buttons with gradient-styled versions
   - Props: `variant`, `onPress`, `children`, `icon`
   - Location: `components/ui/gradient-button.tsx`

3. **ActionButton.tsx** (emoji/icon action buttons)
   - Usage: For quick actions like "I need support", "Log urge"
   - Props: `emoji`, `label`, `onPress`, `variant`
   - Location: `components/ui/action-button.tsx`

4. **StatsCard.tsx** (consistent stat display)
   - Usage: Replace hardcoded stat cards throughout app
   - Props: `value`, `label`, `trend`, `icon`
   - Location: `components/ui/stats-card.tsx`

## 🔄 Phase 3: Screen-by-Screen Migration
Gradually apply design system to each tab screen.

### Migration Priority:

1. **✅ Analytics Tab (analytics.tsx)** - Already has Apple Health aesthetic
   - [x] Uses `#1C1C1E` card backgrounds
   - [x] Typography scales match design system
   - [ ] Replace hardcoded colors with `theme.colors.*` imports
   - [ ] Add gradient buttons for filters

2. **🎯 Home Tab (index.tsx)** - Transform to Risk Dashboard
   - [ ] Replace top risk percentage with `<RiskGauge>`
   - [ ] Update Weather Card to use `theme.colors.background.card`
   - [ ] Convert action buttons to `<ActionButton>` components
   - [ ] Apply gradient backgrounds to timers
   - [ ] Use `theme.spacing.*` instead of hardcoded margins

3. **Pattern Tab (profile.tsx)** - Polish existing chart
   - [ ] Keep chart as-is (already polished)
   - [ ] Replace insight card colors with theme
   - [ ] Add gradient to weekly wins section
   - [ ] Use consistent spacing values

4. **Routine Tab (routine.tsx)** - Checklist refinement
   - [ ] Keep animations (already smooth)
   - [ ] Apply card styling to checklist container
   - [ ] Update colors to theme palette
   - [ ] Add gradient to streak counter

5. **Explore Tab (explore.tsx)** - Style consistency
   - [ ] Apply theme colors
   - [ ] Update typography to design system
   - [ ] Add proper spacing

## 🎨 Phase 4: Polish & Animations
Add micro-interactions and delightful touches.

- [ ] Haptic feedback on all interactions
- [ ] Smooth transitions between screens
- [ ] Loading states with skeletons
- [ ] Success animations for completed actions
- [ ] Breathing circle animation for calm

## 📝 How to Use the Design System

### Before (hardcoded):
```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
```

### After (design system):
```typescript
import { theme } from '@/constants/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background.card,
    padding: theme.components.card.padding,
    borderRadius: theme.components.card.radius,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.md,  // Consistent shadows
  },
  title: {
    fontSize: theme.typography.fontSize.h2,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
});
```

### Using Helper Functions:
```typescript
import { getRiskColor, getRiskLevel, applyShadow } from '@/constants/theme';

// Dynamic risk-based colors
const riskColor = getRiskColor(75); // Returns '#FF6B6B' for high risk
const riskLevel = getRiskLevel(75); // Returns 'HIGH'

// Consistent shadows
const cardStyle = {
  ...applyShadow('md'),
  backgroundColor: theme.colors.background.card,
};
```

## 🚀 Quick Wins (Start Here!)

### 1. Replace Colors in Analytics (5 minutes)
File: `app/(tabs)/analytics.tsx`

Find:
```typescript
backgroundColor: '#1C1C1E'
```

Replace with:
```typescript
import { theme } from '@/constants/theme';
// ...
backgroundColor: theme.colors.background.card
```

### 2. Add Gradient Button to Home (10 minutes)
Create `components/ui/gradient-button.tsx`, then use in home screen for "Log Urge" button.

### 3. Replace Spacing Values (5 minutes per screen)
Find all hardcoded margins/paddings like `marginBottom: 16` and replace with `theme.spacing.sm`.

## 🎯 Success Metrics

- [ ] Zero hardcoded colors in screen files
- [ ] All spacing uses 8px grid (`theme.spacing.*`)
- [ ] All shadows use `theme.shadows.*`
- [ ] Typography sizes from `theme.typography.fontSize.*`
- [ ] Buttons use gradient components
- [ ] Risk displays use `getRiskColor()` helper

## 📚 Design System Reference

### Color Usage Guide:
- **Background**: `theme.colors.background.card` for all cards
- **Text**: `primary` for headlines, `secondary` for body, `tertiary` for labels
- **Accents**: `primary` (#5B7CFF) for CTAs, `success` (#4ECDC4) for positive actions
- **Risk**: Use `getRiskColor(percentage)` for dynamic risk-based colors

### Spacing Guide (8px grid):
- `xxxs` (4px): Tight spacing within components
- `xxs` (8px): Between related items
- `xs` (12px): Default spacing
- `sm` (16px): Between sections
- `md` (24px): Large gaps
- `lg` (32px): Screen padding

### Typography Guide:
- `hero` (72px): Big risk percentages
- `h2` (24px): Section headers
- `h3` (20px): Card titles
- `body` (14px): Body text
- `caption` (12px): Labels

## 🛠️ Tools & Scripts

### Find Hardcoded Colors:
```bash
grep -r "#[0-9A-Fa-f]\{6\}" app/ --include="*.tsx" | grep -v "node_modules"
```

### Find Hardcoded Spacing:
```bash
grep -rE "(margin|padding)(Top|Bottom|Left|Right)?: [0-9]+" app/ --include="*.tsx"
```

## 📞 Need Help?

- Check `constants/theme.ts` for all available values
- Look at `analytics.tsx` for Apple Health styling example
- Use TypeScript autocomplete: `theme.` will show all options
- Helper functions have JSDoc comments with usage examples

---

**Next Step**: Create `RiskGauge` component and replace home screen risk percentage! 🎯
