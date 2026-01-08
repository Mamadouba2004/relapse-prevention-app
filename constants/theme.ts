/**
 * Design System - Relapse Prevention App
 * Combines JITAI principles with Apple Health aesthetic
 * Use these values throughout the app - no hardcoded colors/spacing
 */

import { Platform } from 'react-native';

// ===== LEGACY COMPATIBILITY (keep for existing code) =====
const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ===== NEW DESIGN SYSTEM =====

export const theme = {
  // ===== COLORS =====
  colors: {
    // Background hierarchy
    background: {
      primary: '#0F172A',    // Main app background (existing)
      card: '#1C1C1E',       // Card backgrounds (Apple Health style)
      elevated: '#242b3d',   // Hover/active states
      modal: '#1a1f2e',      // Modal overlays
    },

    // Accent colors
    accent: {
      primary: '#5B7CFF',    // CTAs, links, active states (JITAI blue)
      success: '#4ECDC4',    // Positive actions (JITAI teal)
      warning: '#FFB74D',    // Medium risk
      danger: '#FF6B6B',     // High risk
      info: '#9D8CFF',       // Neutral info
      teal: '#14B8A6',       // Existing teal (safe harbor)
    },

    // Text hierarchy
    text: {
      primary: '#FFFFFF',    // Headlines
      secondary: '#AEAEB2',  // Body text (Apple Health)
      tertiary: '#8E8E93',   // Labels (Apple Health)
      disabled: '#4A5568',   // Disabled
      muted: '#64748B',      // Existing muted text
    },

    // Risk levels (for gauges and indicators)
    risk: {
      low: '#4ECDC4',        // 0-30% (teal/green)
      moderate: '#FFB74D',   // 31-60% (orange)
      high: '#FF6B6B',       // 61-100% (red)
      danger: '#DC2626',     // Critical (existing red)
    },

    // Existing colors (keep for compatibility)
    existing: {
      redZone: '#8b0000',
      caution: '#B8860B',
      clearSkies: '#1e5128',
      blue: '#3B82F6',
      green: '#34C759',
      slate: '#334155',
    },
  },

  // ===== TYPOGRAPHY =====
  typography: {
    // Font sizes
    fontSize: {
      hero: 72,       // Risk percentage, big numbers
      h1: 32,         // Page titles
      h2: 24,         // Section headers
      h3: 20,         // Card titles
      h4: 18,         // Subsection headers
      body: 14,       // Body text
      bodyLarge: 16,  // Larger body
      caption: 12,    // Labels, captions
      small: 11,      // Tiny text
      button: 16,     // Button text
    },

    // Font weights
    fontWeight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '900' as const,
    },

    // Line heights
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },

    // Letter spacing
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
      wider: 1.2,
    },
  },

  // ===== SPACING (8px grid) =====
  spacing: {
    xxxs: 4,
    xxs: 8,
    xs: 12,
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
    xxl: 64,
    xxxl: 80,
  },

  // ===== BORDER RADIUS =====
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 999,     // Fully rounded (pills)
  },

  // ===== COMPONENT SPECIFICATIONS =====
  components: {
    button: {
      height: 56,
      heightSmall: 44,
      heightLarge: 64,
      radius: 28,      // Fully rounded
      paddingHorizontal: 24,
    },
    card: {
      padding: 20,
      paddingSmall: 16,
      paddingLarge: 24,
      radius: 16,
    },
    input: {
      height: 48,
      radius: 12,
      padding: 16,
    },
    bottomNav: {
      height: 80,
    },
    riskGauge: {
      diameter: 200,
      strokeWidth: 16,
    },
    actionButton: {
      size: 64,
      iconSize: 32,
    },
  },

  // ===== SHADOWS =====
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
    },
  },

  // ===== GRADIENTS =====
  gradients: {
    primary: ['#5B7CFF', '#9D8CFF'] as const,        // Blue to purple
    success: ['#4ECDC4', '#14B8A6'] as const,        // Teal gradient
    warning: ['#FFB74D', '#F59E0B'] as const,        // Orange gradient
    danger: ['#FF6B6B', '#DC2626'] as const,         // Red gradient
    riskLowToHigh: ['#4ECDC4', '#FFB74D', '#FF6B6B'] as const, // Teal to orange to red
    darkElevated: ['#1a1f2e', '#242b3d'] as const,   // Dark card gradient
  },

  // ===== ANIMATION TIMING =====
  animation: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 350,
      verySlow: 500,
    },
  },

  // ===== OPACITY VALUES =====
  opacity: {
    disabled: 0.4,
    muted: 0.6,
    subtle: 0.7,
    normal: 0.9,
    full: 1,
  },

  // ===== BREAKPOINTS (for responsive design) =====
  breakpoints: {
    xs: 320,
    sm: 375,
    md: 414,
    lg: 768,
    xl: 1024,
  },
};

// ===== HELPER FUNCTIONS =====

/**
 * Get risk color based on percentage
 */
export const getRiskColor = (riskPercent: number): string => {
  if (riskPercent <= 30) return theme.colors.risk.low;
  if (riskPercent <= 60) return theme.colors.risk.moderate;
  return theme.colors.risk.high;
};

/**
 * Get risk level text based on percentage
 */
export const getRiskLevel = (riskPercent: number): 'LOW' | 'MODERATE' | 'HIGH' => {
  if (riskPercent <= 30) return 'LOW';
  if (riskPercent <= 60) return 'MODERATE';
  return 'HIGH';
};

/**
 * Get gradient colors for risk level
 */
export const getRiskGradient = (riskPercent: number): readonly [string, string] => {
  if (riskPercent <= 30) return theme.gradients.success;
  if (riskPercent <= 60) return theme.gradients.warning;
  return theme.gradients.danger;
};

/**
 * Apply shadow based on platform
 */
export const applyShadow = (shadowName: keyof typeof theme.shadows) => {
  return theme.shadows[shadowName];
};

/**
 * Get responsive value based on screen width
 */
export const getResponsiveValue = <T>(
  values: { xs?: T; sm?: T; md?: T; lg?: T; xl?: T },
  screenWidth: number
): T | undefined => {
  if (screenWidth >= theme.breakpoints.xl && values.xl) return values.xl;
  if (screenWidth >= theme.breakpoints.lg && values.lg) return values.lg;
  if (screenWidth >= theme.breakpoints.md && values.md) return values.md;
  if (screenWidth >= theme.breakpoints.sm && values.sm) return values.sm;
  return values.xs;
};

export default theme;
