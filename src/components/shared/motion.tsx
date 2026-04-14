'use client'

/**
 * Reusable motion primitives wrapping Framer Motion.
 *
 * Design: respect prefers-reduced-motion, GPU-only transforms (opacity +
 * translate/scale), short durations (200-400ms) with the `easeOut` easing
 * that feels natural for UI. No layout-changing animations by default.
 */

import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from 'framer-motion'
import type { PropsWithChildren } from 'react'

export const EASE = [0.22, 1, 0.36, 1] as const // easeOutExpo — snappy

// ── Page/section entrance ─────────────────────────────────────

export function FadeIn({
  children,
  delay = 0,
  y = 12,
  ...rest
}: PropsWithChildren<{ delay?: number; y?: number } & HTMLMotionProps<'div'>>) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

// ── Scroll-triggered reveal ───────────────────────────────────

export function Reveal({
  children,
  delay = 0,
  y = 24,
  once = true,
  ...rest
}: PropsWithChildren<{ delay?: number; y?: number; once?: boolean } & HTMLMotionProps<'div'>>) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

// ── Staggered list container ──────────────────────────────────

export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
}

export function Stagger({
  children,
  ...rest
}: PropsWithChildren<HTMLMotionProps<'div'>>) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  ...rest
}: PropsWithChildren<HTMLMotionProps<'div'>>) {
  return (
    <motion.div variants={staggerItem} {...rest}>
      {children}
    </motion.div>
  )
}

// ── Hover/tap button wrapper ──────────────────────────────────
//
// Scales subtly on hover, presses in on tap. Use on primary CTAs.

export function MotionButton({
  children,
  ...rest
}: PropsWithChildren<HTMLMotionProps<'button'>>) {
  const reduced = useReducedMotion()
  return (
    <motion.button
      whileHover={reduced ? undefined : { scale: 1.03, y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

// ── Card with subtle hover lift ───────────────────────────────

export function HoverCard({
  children,
  ...rest
}: PropsWithChildren<HTMLMotionProps<'div'>>) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
