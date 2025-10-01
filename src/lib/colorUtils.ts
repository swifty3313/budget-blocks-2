// Predefined color palette
export const COLOR_PALETTE = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Cyan', value: '#06B6D4' },
];

// Convert hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Calculate relative luminance (WCAG 2.0)
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio (WCAG 2.0)
export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Check if color has sufficient contrast against background
export function hasGoodContrast(
  color: string,
  isDarkMode: boolean = false
): { isGood: boolean; ratio: number; suggestedColor?: string } {
  const rgb = hexToRgb(color);
  if (!rgb) return { isGood: false, ratio: 0 };

  const colorLuminance = getLuminance(rgb.r, rgb.g, rgb.b);
  
  // Background luminance (white in light mode, dark gray in dark mode)
  const bgLuminance = isDarkMode ? getLuminance(15, 23, 42) : getLuminance(255, 255, 255);
  
  const ratio = getContrastRatio(colorLuminance, bgLuminance);
  
  // WCAG AA requires 4.5:1 for normal text
  const isGood = ratio >= 4.5;
  
  // If contrast is poor, suggest a darker/lighter version
  let suggestedColor: string | undefined;
  if (!isGood && rgb) {
    // Darken or lighten the color
    const factor = isDarkMode ? 1.5 : 0.6;
    suggestedColor = `#${Math.floor(rgb.r * factor).toString(16).padStart(2, '0')}${Math.floor(rgb.g * factor).toString(16).padStart(2, '0')}${Math.floor(rgb.b * factor).toString(16).padStart(2, '0')}`;
  }
  
  return { isGood, ratio, suggestedColor };
}

// Get text color (black or white) based on background color
export function getTextColorForBackground(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return '#000000';
  
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
