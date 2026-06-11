/**
 * LeafMark — the AromaTool brand leaf, as an inline SVG.
 *
 * Identical geometry to public/favicon.svg, so the logo used across the app
 * is pixel-consistent with the browser-tab icon. Inline SVG (not the Tabler
 * webfont) means the brand mark never depends on an external CDN — it always
 * renders, even offline or if the icon font fails to load.
 */
type LeafMarkProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export default function LeafMark({
  size = 26,
  color = "#FFFFFF",
  strokeWidth = 2,
}: LeafMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21c.5 -4.5 2.5 -8 7 -10" />
      <path d="M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3z" />
    </svg>
  );
}
