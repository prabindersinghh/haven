/** The Haven mark: a home that is also a speech bubble, holding a voice made clear (Awaaz). */
export function Logo({ size = 32, title = 'Haven' }: { size?: number; title?: string }) {
  const id = `hv${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label={title}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2D6BFF" />
          <stop offset="1" stopColor="#0A1F44" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill={`url(#${id})`} />
      <path
        d="M64 25 L100 53 V89 Q100 95 94 95 H52 L38 106 L41 95 H34 Q28 95 28 89 V53 Z"
        fill="#fff"
        stroke="#fff"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <rect x="47" y="63" width="8" height="18" rx="4" fill="#1E5EFF" />
      <rect x="60" y="55" width="8" height="34" rx="4" fill="#E8833A" />
      <rect x="73" y="63" width="8" height="18" rx="4" fill="#1E5EFF" />
    </svg>
  );
}
