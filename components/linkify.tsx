"use client"

import React from 'react'

interface LinkifyProps {
  text: string | null | undefined
}

export function Linkify({ text }: LinkifyProps) {
  if (!text) return null

  // Regex to match URLs (http, https, and www.)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g

  const parts = text.split(urlRegex)

  return (
    <>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          const href = part.startsWith('http') ? part : `https://${part}`
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline break-all font-medium"
              onClick={(e) => e.stopPropagation()} // Prevent triggering parent click handlers
            >
              {part}
            </a>
          )
        }
        return part
      })}
    </>
  )
}
