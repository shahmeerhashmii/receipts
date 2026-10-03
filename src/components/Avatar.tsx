import React from 'react';
import type { LeagueMember } from '../demo/store';

interface AvatarProps {
  member: Pick<LeagueMember, 'display_name' | 'avatar_color' | 'avatar_url'>;
  size?: number;
  showCrown?: boolean;
}

// 16 gender-neutral illustrated icons, picked deterministically from the name
type IconFn = (c: string) => React.ReactElement;
const ICONS: IconFn[] = [
  // rocket
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4C16 4 10 10 10 18C10 21.3 11.4 24.2 13.6 26.2L16 28L18.4 26.2C20.6 24.2 22 21.3 22 18C22 10 16 4 16 4Z" fill={c} opacity="0.9"/>
      <circle cx="16" cy="18" r="3" fill="#0D0F12"/>
      <path d="M10 22L7 25" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <path d="M22 22L25 25" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  // lightning bolt
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 4L8 18H16L14 28L24 14H16L18 4Z" fill={c} stroke="#0D0F12" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  ),
  // gem / diamond
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 6L6 14L16 26L26 14L16 6Z" fill={c} opacity="0.9"/>
      <path d="M6 14H26" stroke="#0D0F12" strokeWidth="1.5"/>
      <path d="M11 14L16 6L21 14" stroke="#0D0F12" strokeWidth="1"/>
    </svg>
  ),
  // star
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4L19.1 12.6H28.2L21 17.8L23.6 26.4L16 21.2L8.4 26.4L11 17.8L3.8 12.6H12.9L16 4Z" fill={c}/>
    </svg>
  ),
  // flame
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 28C10.5 28 7 23.5 7 19C7 14 11 11 13 8C13 8 13 13 16 14C16 14 14 10 18 6C18 6 20 11 19 13C21 11 22 8 22 8C24 12 25 15 25 19C25 23.5 21.5 28 16 28Z" fill={c} opacity="0.9"/>
      <path d="M16 28C13.8 28 12 26 12 23.5C12 21 13.5 19.5 16 19C18.5 19.5 20 21 20 23.5C20 26 18.2 28 16 28Z" fill="#0D0F12" opacity="0.4"/>
    </svg>
  ),
  // wave / water
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 16C6.5 16 6.5 12 9 12C11.5 12 11.5 16 14 16C16.5 16 16.5 12 19 12C21.5 12 21.5 16 24 16C26.5 16 26.5 12 29 12" stroke={c} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M4 22C6.5 22 6.5 18 9 18C11.5 18 11.5 22 14 22C16.5 22 16.5 18 19 18C21.5 18 21.5 22 24 22C26.5 22 26.5 18 29 18" stroke={c} strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/>
      <path d="M4 10C6.5 10 6.5 6 9 6C11.5 6 11.5 10 14 10C16.5 10 16.5 6 19 6C21.5 6 21.5 10 24 10" stroke={c} strokeWidth="2.5" strokeLinecap="round" opacity="0.35"/>
    </svg>
  ),
  // leaf / plant
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 28V12" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 12C16 12 8 8 8 4C8 4 16 4 20 8C24 12 20 18 16 18" fill={c} opacity="0.85"/>
      <path d="M16 18C16 18 22 14 26 18C26 18 22 26 16 24" fill={c} opacity="0.5"/>
    </svg>
  ),
  // snowflake
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4V28M4 16H28M7.5 7.5L24.5 24.5M24.5 7.5L7.5 24.5" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="16" r="3" fill={c}/>
      <circle cx="16" cy="4" r="2" fill={c}/>
      <circle cx="16" cy="28" r="2" fill={c}/>
      <circle cx="4" cy="16" r="2" fill={c}/>
      <circle cx="28" cy="16" r="2" fill={c}/>
    </svg>
  ),
  // moon
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6C13.4 6 8 11.4 8 18C8 24.6 13.4 30 20 30C23.3 30 26.3 28.7 28.5 26.5C25.5 27.2 22 26.5 19 24C14.5 20.5 13 15 15 10.5C16.5 7.5 18.5 6.3 20 6Z" fill={c}/>
    </svg>
  ),
  // sun
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="6" fill={c}/>
      <path d="M16 3V7M16 25V29M3 16H7M25 16H29M6.5 6.5L9.3 9.3M22.7 22.7L25.5 25.5M6.5 25.5L9.3 22.7M22.7 9.3L25.5 6.5" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  // crystal / prism
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4L26 12V24L16 28L6 24V12L16 4Z" fill={c} opacity="0.75"/>
      <path d="M16 4L26 12L16 16L6 12L16 4Z" fill={c}/>
      <path d="M16 16V28" stroke="#0D0F12" strokeWidth="1"/>
      <path d="M6 12L16 16L26 12" stroke="#0D0F12" strokeWidth="1"/>
    </svg>
  ),
  // ghost / spirit
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 14C8 9.6 11.6 6 16 6C20.4 6 24 9.6 24 14V26L21 24L18 26L16 24L14 26L11 24L8 26V14Z" fill={c} opacity="0.85"/>
      <circle cx="13" cy="15" r="2" fill="#0D0F12"/>
      <circle cx="19" cy="15" r="2" fill="#0D0F12"/>
    </svg>
  ),
  // shield
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4L6 8V17C6 22.5 10.5 27.5 16 28C21.5 27.5 26 22.5 26 17V8L16 4Z" fill={c} opacity="0.8"/>
      <path d="M11 16L14 19L21 12" stroke="#0D0F12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  // controller / game
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="11" width="24" height="13" rx="6" fill={c} opacity="0.85"/>
      <path d="M10 17V15M10 17V19M10 17H8M10 17H12" stroke="#0D0F12" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="20" cy="16" r="1.5" fill="#0D0F12"/>
      <circle cx="23" cy="18.5" r="1.5" fill="#0D0F12"/>
    </svg>
  ),
  // fox / animal face
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 8L4 4L10 12H22L28 4L24 8C24 8 21 6 16 6C11 6 8 8 8 8Z" fill={c}/>
      <path d="M10 12C10 12 8 26 16 26C24 26 22 12 22 12H10Z" fill={c} opacity="0.8"/>
      <circle cx="13" cy="17" r="1.5" fill="#0D0F12"/>
      <circle cx="19" cy="17" r="1.5" fill="#0D0F12"/>
      <path d="M14 21C14 21 15 22 16 22C17 22 18 21 18 21" stroke="#0D0F12" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  // planet / orbit
  (c: string) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="7" fill={c} opacity="0.9"/>
      <ellipse cx="16" cy="16" rx="14" ry="5" stroke={c} strokeWidth="2" fill="none" transform="rotate(-20 16 16)"/>
    </svg>
  ),
];

/** Pick an icon index deterministically from the display name */
function iconIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % ICONS.length;
}

export function Avatar({ member, size = 36, showCrown = false }: AvatarProps) {
  const idx = iconIndex(member.display_name);
  const IconFn = ICONS[idx];
  const padding = Math.round(size * 0.18);

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      {member.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={member.display_name}
          className="avatar"
          style={{ width: size, height: size, objectFit: 'cover' }}
        />
      ) : (
        <div
          className="avatar"
          style={{
            width: size,
            height: size,
            background: member.avatar_color + '22', // faint tint
            border: `2px solid ${member.avatar_color}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding,
          }}
        >
          {IconFn(member.avatar_color)}
        </div>
      )}

      {/* Crown: sits cleanly above the avatar */}
      {showCrown && (
        <div
          style={{
            position: 'absolute',
            top: -Math.round(size * 0.38),
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          <svg
            width={Math.round(size * 0.72)}
            height={Math.round(size * 0.42)}
            viewBox="0 0 36 21"
            fill="none"
          >
            {/* Crown shape: flat base + 3 points */}
            <path
              d="M2 19 L2 8 L10 13 L18 2 L26 13 L34 8 L34 19 Z"
              fill="#F2C14E"
              stroke="#F2C14E"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="18" cy="2" r="2.5" fill="#F2C14E"/>
            <circle cx="2" cy="8" r="2" fill="#F2C14E"/>
            <circle cx="34" cy="8" r="2" fill="#F2C14E"/>
          </svg>
        </div>
      )}
    </div>
  );
}
