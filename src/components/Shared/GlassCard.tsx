import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hoverable?: boolean
}

export default function GlassCard({ children, className = '', hoverable = false }: GlassCardProps) {
  return (
    <div
      className={`
        bg-[rgba(30,30,60,0.6)]
        backdrop-blur-[12px]
        border border-[rgba(255,255,255,0.08)]
        rounded-[12px]
        p-4 md:p-5
        transition-all duration-200 ease-in-out
        ${hoverable ? 'hover:border-[rgba(0,255,136,0.3)] hover:-translate-y-0.5' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
