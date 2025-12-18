export const hexToHsl = (hex: string): { h: number, s: number, l: number } => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }
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

  return { h, s, l };
};

export const getShiftedColor = (hex: string, shift: number): string => {
    if (shift === 0) return hex;
    const hsl = hexToHsl(hex);
    const newH = (hsl.h + shift) % 360;
    return `hsl(${newH}, ${hsl.s}%, ${hsl.l}%)`;
};

// Returns color mixed in RGB space
export const getGradientMiddleColor = (c1: string, c2: string, ratio: number = 0.5) => {
    const parse = (c: string) => {
        if (c.startsWith('rgb')) {
            const matches = c.match(/\d+/g);
            if (matches) return [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2])];
        }
        if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
        return [r, g, b];
    };
    
    let [r1, g1, b1] = [0,0,0];
    let [r2, g2, b2] = [255,255,255];
    
    try { 
        [r1, g1, b1] = parse(c1);
        [r2, g2, b2] = parse(c2);
    } catch(e) {}

    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    
    return `rgb(${r}, ${g}, ${b})`;
};

// Multi-color interpolation
export const interpolateColors = (colors: string[], t: number): string => {
    if (colors.length === 0) return '#000000';
    if (colors.length === 1) return colors[0];
    if (t <= 0) return colors[0];
    if (t >= 1) return colors[colors.length - 1];

    const scaledT = t * (colors.length - 1);
    const index = Math.floor(scaledT);
    const innerT = scaledT - index;
    
    return getGradientMiddleColor(colors[index], colors[index + 1], innerT);
};

export const hexToRgba = (hex: string, alpha: number) => {
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};