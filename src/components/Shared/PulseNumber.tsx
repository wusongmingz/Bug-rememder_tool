import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface PulseNumberProps {
  value: number
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
}

export default function PulseNumber({ value, color = '#00ff88', size = 'md' }: PulseNumberProps) {
  const prevValue = useRef(value)
  const hasChanged = prevValue.current !== value

  useEffect(() => {
    prevValue.current = value
  }, [value])

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* 脉冲光环 */}
      <AnimatePresence>
        {hasChanged && (
          <motion.span
            key={value}
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${color}` }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* 数字 */}
      <motion.span
        key={value}
        className={`${sizeClasses[size]} font-bold`}
        style={{ color, fontVariantNumeric: 'tabular-nums' }}
        initial={hasChanged ? { scale: 1.2 } : { scale: 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {value}
      </motion.span>
    </div>
  )
}
