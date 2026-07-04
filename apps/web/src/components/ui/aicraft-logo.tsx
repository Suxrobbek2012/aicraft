'use client'

import React from 'react'

interface AicraftLogoProps {
  size?: number
  className?: string
  showText?: boolean
}

export function AicraftLogo({ size = 28, className = '', showText = true }: AicraftLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* SVG Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer hexagon shape */}
        <path
          d="M16 2L28 8.5V23.5L16 30L4 23.5V8.5L16 2Z"
          fill="url(#grad1)"
          opacity="0.15"
        />
        <path
          d="M16 2L28 8.5V23.5L16 30L4 23.5V8.5L16 2Z"
          stroke="url(#grad1)"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Inner spark / AI symbol */}
        <path
          d="M16 8 L18.5 14 L25 16 L18.5 18 L16 24 L13.5 18 L7 16 L13.5 14 Z"
          fill="url(#grad1)"
        />
        {/* Center dot */}
        <circle cx="16" cy="16" r="2" fill="white" opacity="0.9" />

        <defs>
          <linearGradient id="grad1" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <span
          style={{ fontSize: size * 0.5, lineHeight: 1 }}
          className="font-semibold text-foreground tracking-tight"
        >
          aicraft
        </span>
      )}
    </div>
  )
}
