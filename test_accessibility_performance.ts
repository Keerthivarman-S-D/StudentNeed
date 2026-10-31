import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const root = process.cwd();
const sourceFiles: string[] = [];
function collect(directory: string) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else if (/\.(tsx|ts|css)$/.test(entry.name)) sourceFiles.push(fullPath);
  }
}
collect(path.join(root, 'src'));
const allSource = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const logo = fs.readFileSync(path.join(root, 'src/components/StudentNeedLogo.tsx'), 'utf8');
const launch = fs.readFileSync(path.join(root, 'src/pages/Launch.tsx'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const jpgPath = path.join(root, 'public/images/landing/hero-handoff.jpg');
const webpPath = path.join(root, 'public/images/landing/hero-handoff.webp');

console.log('\n--- StudentNeed Accessibility & LCP Regression Tests ---\n');
assert(!allSource.toLowerCase().includes('#717870'), 'Legacy low-contrast muted text color is removed from application source');
assert(contrastRatio('#555d56', '#f7f6f2') >= 4.5, `Muted text contrast passes WCAG AA (${contrastRatio('#555d56', '#f7f6f2').toFixed(2)}:1)`);
assert(contrastRatio('#0b7355', '#f7f6f2') >= 4.5, `Logo accent contrast passes WCAG AA (${contrastRatio('#0b7355', '#f7f6f2').toFixed(2)}:1)`);
assert(logo.includes('text-[#0b7355]'), 'StudentNeed logo uses the accessible dark teal accent');
assert((html.includes('rel="preload"') && html.includes('as="image"') && html.includes('fetchpriority="high"')) || (html.includes("heroPreload.as = 'image'") && html.includes("heroPreload.setAttribute('fetchpriority', 'high')")), 'Landing/auth hero image is preloaded with high fetch priority before React mounts');
assert(launch.includes('fetchPriority="high"') && launch.includes('loading="eager"'), 'LCP hero image is eager-loaded with high fetch priority');
assert(launch.includes('width={1200}') && launch.includes('height={896}'), 'LCP hero image declares intrinsic dimensions to prevent layout shift');
assert(fs.existsSync(webpPath), 'Optimized WebP hero image exists');
assert(fs.statSync(webpPath).size < fs.statSync(jpgPath).size * 0.6, 'WebP hero image is at least 40% smaller than the original JPEG');
console.log('\nAccessibility & LCP regression tests completed.\n');
