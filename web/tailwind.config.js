/** @type {import('tailwindcss').Config} */

// Every colour the app uses is a CSS variable (src/index.css), so light and dark come from one
// set of class names: the variables change with the system theme, the classes never do.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const shades = (name, list) => Object.fromEntries(list.map((shade) => [shade, token(`${name}-${shade}`)]));

// iOS-like motion: a quick start that settles softly, and a spring with a little overshoot.
const settle = 'cubic-bezier(0.22, 1, 0.36, 1)';
const spring = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // A finger, not a mouse: phones and tablets. Controls there get Apple's 44 px minimum.
      screens: { touch: { raw: '(pointer: coarse)' } },
      // The smallest text is 13 px, iOS's footnote size, not Tailwind's 12.
      fontSize: { xs: ['0.8125rem', { lineHeight: '1.125rem' }] },
      colors: {
        slate: shades('slate', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        teal: shades('teal', [50, 100, 200, 600, 700, 800, 900]),
        red: shades('red', [50, 100, 200, 300, 500, 600, 700, 800, 900]),
        emerald: shades('emerald', [50, 100, 200, 500, 800, 900]),
        amber: shades('amber', [50, 100, 200, 500, 800, 900]),
        sky: shades('sky', [100, 900]),
        canvas: token('canvas'),
        surface: token('surface'),
        // Filled controls keep white text readable in both themes.
        accent: { DEFAULT: token('accent'), strong: token('accent-strong') },
        danger: { DEFAULT: token('danger'), strong: token('danger-strong') },
      },
      // Apple's San Francisco where the device has it (iPhone, iPad, Mac); everywhere else Inter,
      // which was drawn to the same brief and is the usual open stand-in for it. San Francisco
      // itself may only be used on Apple's own systems. Devanagari falls through to the system's.
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Inter Variable"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans Devanagari"',
          '"Nirmala UI"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 10px 30px -18px rgb(0 0 0 / 0.18)',
        float: '0 12px 40px -12px rgb(0 0 0 / 0.28), 0 2px 6px rgb(0 0 0 / 0.06)',
        // A soft light in the role's tint, for what is under way.
        glow: '0 10px 34px -10px rgb(var(--accent) / 0.55)',
      },
      backgroundImage: {
        // The role's tint as a gradient. White text stays readable on it in both themes.
        tint: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-strong)))',
      },
      transitionTimingFunction: { settle, spring },
      keyframes: {
        'page-in': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-in': { from: { opacity: '0', transform: 'translateY(-14px)' }, to: { opacity: '1', transform: 'none' } },
        'badge-pop': { '0%': { transform: 'scale(0.4)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        'route-dash': { to: { strokeDashoffset: '-24' } },
        'live-ping': { '0%': { transform: 'scale(1)', opacity: '0.7' }, '80%, 100%': { transform: 'scale(2.8)', opacity: '0' } },
        'soft-ping': { '0%': { transform: 'scale(1)', opacity: '0.45' }, '80%, 100%': { transform: 'scale(1.55)', opacity: '0' } },
        'menu-in': { from: { opacity: '0', transform: 'translateY(-6px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'page-in': `page-in 0.5s ${settle} both`,
        'pop-in': `pop-in 0.4s ${settle} both`,
        'fade-in': `fade-in 0.3s ease-out both`,
        'sheet-in': `sheet-in 0.45s ${settle} both`,
        'badge-pop': `badge-pop 0.5s ${spring} both`,
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'route-dash': 'route-dash 1.2s linear infinite',
        'live-ping': 'live-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
        'soft-ping': 'soft-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'menu-in': `menu-in 0.22s ${settle} both`,
      },
    },
  },
  plugins: [],
};
