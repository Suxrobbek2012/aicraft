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
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="pulse-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Pulsatsiya halqalari */}
        <circle cx="20" cy="20" r="16" stroke="#fbbf24" strokeWidth="0.8" fill="none" opacity="0.15" />
        <circle cx="20" cy="20" r="12" stroke="#f59e0b" strokeWidth="1" fill="none" opacity="0.25" />
        <circle cx="20" cy="20" r="8" stroke="#fbbf24" strokeWidth="1.2" fill="none" opacity="0.4" />

        {/* Markaziy glow */}
        <circle cx="20" cy="20" r="12" fill="url(#pulse-grad)" opacity="0.15" />

        {/* AI yadrosi */}
        <circle cx="20" cy="20" r="5" fill="url(#pulse-grad)" opacity="0.9" />
        <circle cx="20" cy="20" r="2" fill="white" opacity="0.8" />

        {/* To'lqin chiqaruvchi nuqtalar */}
        <circle cx="20" cy="4" r="1.5" fill="#fbbf24" opacity="0.9" />
        <circle cx="20" cy="36" r="1.5" fill="#fbbf24" opacity="0.9" />
        <circle cx="4" cy="20" r="1.5" fill="#f59e0b" opacity="0.9" />
        <circle cx="36" cy="20" r="1.5" fill="#f59e0b" opacity="0.9" />
        
        <circle cx="8.5" cy="8.5" r="1.2" fill="#fbbf24" opacity="0.7" />
        <circle cx="31.5" cy="8.5" r="1.2" fill="#fbbf24" opacity="0.7" />
        <circle cx="8.5" cy="31.5" r="1.2" fill="#d97706" opacity="0.7" />
        <circle cx="31.5" cy="31.5" r="1.2" fill="#d97706" opacity="0.7" />

        {/* To'lqin chiziqlari */}
        <path d="M24 20H30" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M10 20H16" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M20 10V16" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M20 24V30" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      </svg>

      {showText && (
        <span style={{ fontSize: size * 0.45 }} className="font-bold text-foreground tracking-tight">
          aicraft
        </span>
      )}
    </div>
  )
}