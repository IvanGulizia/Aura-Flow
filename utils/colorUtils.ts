
export const hexToHsl = (hex: string): { h: number, s: number, l: number } => {
  // 1. Sanitize input
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  
  let r = 0, g = 0, b = 0;

  // 2. Parse based on length
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else {
    // Fallback for invalid hex -> Return Black (Safety)
    return { h: 0, s: 0, l: 0 };
  }

  // 3. NaN Safety Check
  if (isNaN(r) || isNaN(g) || isNaN(b)) return { h: 0, s: 0, l: 0 };

  r /= 255; g /= 255; b /= 255;
  const cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin;
  let h = 0, s = 0, l = 0;

  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  // 4. Final Safety Clamp
  if (isNaN(h)) h = 0;
  if (isNaN(s)) s = 0;
  if (isNaN(l)) l = 0;

  return { h, s, l };
};

export const getShiftedColor = (hex: string, shift: number): string => {
    if (shift === 0 || isNaN(shift)) return hex;
    const hsl = hexToHsl(hex);
    // Ensure positive hue
    let newH = (hsl.h + shift) % 360;
    if (newH < 0) newH += 360;
    
    return `hsl(${Math.round(newH)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
};

// Returns color mixed in RGB space
export const getGradientMiddleColor = (c1: string, c2: string, ratio: number = 0.5) => {
    const parse = (c: string) => {
        if (c.startsWith('rgb')) {
            const matches = c.match(/\d+/g);
            if (matches && matches.length >= 3) return [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2])];
        }
        
        // Hex fallback
        let hex = c.replace(/[^0-9a-fA-F]/g, '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        if (hex.length !== 6) return [0,0,0]; // Safety

        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return [r, g, b];
    };
    
    let [r1, g1, b1] = [0,0,0];
    let [r2, g2, b2] = [255,255,255];
    
    try { 
        const c1Parsed = parse(c1);
        const c2Parsed = parse(c2);
        if (c1Parsed) [r1, g1, b1] = c1Parsed;
        if (c2Parsed) [r2, g2, b2] = c2Parsed;
    } catch(e) {}

    const r = Math.max(0, Math.min(255, Math.round(r1 + (r2 - r1) * ratio)));
    const g = Math.max(0, Math.min(255, Math.round(g1 + (g2 - g1) * ratio)));
    const b = Math.max(0, Math.min(255, Math.round(b1 + (b2 - b1) * ratio)));
    
    return `rgb(${r}, ${g}, ${b})`;
};

// Multi-color interpolation
export const interpolateColors = (colors: string[], t: number): string => {
    if (!colors || colors.length === 0) return '#000000';
    if (colors.length === 1) return colors[0];
    if (t <= 0 || isNaN(t)) return colors[0];
    if (t >= 1) return colors[colors.length - 1];

    const scaledT = t * (colors.length - 1);
    const index = Math.floor(scaledT);
    const innerT = scaledT - index;
    
    return getGradientMiddleColor(colors[index], colors[index + 1], innerT);
};

export const hexToRgba = (hex: string, alpha: number) => {
  let cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  if (cleanHex.length === 3) cleanHex = cleanHex[0]+cleanHex[0]+cleanHex[1]+cleanHex[1]+cleanHex[2]+cleanHex[2];
  if (cleanHex.length !== 6) return `rgba(0,0,0,${alpha})`;

  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
