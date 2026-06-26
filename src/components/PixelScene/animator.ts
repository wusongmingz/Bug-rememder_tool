// Sprite sheet based renderer - uses drawImage for characters/props/pets
// Falls back to fillRect when sprite sheet is not loaded
import { getSpriteSheet, isSpritesReady } from './spriteLoader'
import {
  CODE, COFFEE, IDLE, THINK, TIRED,
  PROP_PLANT, PROP_COFFEE_CUP, PROP_BOOK, PROP_CLOCK,
  PET_ORANGE_CAT,
  EFFECT_NOTIFICATION, EFFECT_LEVEL_UP_GLOW, EFFECT_COMPLETE,
  EFFECT_BUG_APPEAR, EFFECT_ENERGY_RESTORE, EFFECT_EXP_PLUS,
  EFFECT_ASSIGN,
} from './spriteAnimations'
import type { AnimationDef } from './spriteSheet'
import { EventSystem, RandomEvent } from './EventSystem'

export type ProgrammerState = 'idle' | 'relaxed' | 'working' | 'anxious' | 'crazy' | 'collapse'

// === HTML Speech Bubble Data (exposed to React layer) ===
export interface SpeechBubbleData {
  id: string
  x: number            // canvas coordinate x
  y: number            // canvas coordinate y
  text: string
  color?: string       // text color
  bgColor?: string     // background color
  duration: number     // remaining frames
  type: 'speech' | 'thought' | 'shout'
}

// === Sprite Effect System ===
export type SpriteEffectType = 'notification' | 'levelUp' | 'complete' | 'bugAppear' | 'energyRestore' | 'expPlus' | 'assign'

export interface SpriteEffect {
  id: string
  type: SpriteEffectType
  x: number
  y: number
  startTime: number
  duration: number  // ms
}

const EFFECT_ANIM_MAP: Record<SpriteEffectType, AnimationDef> = {
  notification: EFFECT_NOTIFICATION,
  levelUp: EFFECT_LEVEL_UP_GLOW,
  complete: EFFECT_COMPLETE,
  bugAppear: EFFECT_BUG_APPEAR,
  energyRestore: EFFECT_ENERGY_RESTORE,
  expPlus: EFFECT_EXP_PLUS,
  assign: EFFECT_ASSIGN,
}

function getEffectDuration(type: SpriteEffectType): number {
  if (type === 'assign') return 1500
  const anim = EFFECT_ANIM_MAP[type]
  return (anim.frames.length / anim.fps) * 1000 + 200 // animation duration + slight buffer
}

export interface TeamMemberData {
  name: string
  bugCount: number
  isCurrentUser?: boolean
}

// === Person Action System ===
type PersonAction =
  | 'typing'
  | 'typing_fast'
  | 'stretching'
  | 'drinking'
  | 'scratching'
  | 'yawning'
  | 'phone'
  | 'chatting'
  | 'standing'
  | 'slacking'

interface PersonState {
  currentAction: PersonAction
  actionTimer: number
  actionDuration: number
  nextActionDelay: number
  transitionFrame: number
  prevAction: PersonAction | null
  animStartTime: number // timestamp when current action started (for sprite anim)
}

// === Enhanced Particle ===
interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string; size: number
  type: 'default' | 'dust' | 'sparkle' | 'steam' | 'paper' | 'musicNote'
}

// === Cat System ===
type CatAction = 'walking' | 'sitting' | 'sleeping' | 'playing' | 'stretching'

interface Workstation {
  x: number; y: number; name: string; state: ProgrammerState
  bugCount: number; decorations: string[]; appearance: PersonAppearance
}

interface PersonAppearance {
  shirtColor: string; hairColor: string; hairStyle: 'short' | 'medium' | 'long' | 'bun' | 'spiky' | 'curly'
  pantsColor: string
  accessory: 'none' | 'glasses' | 'headphones' | 'cap'
  skinTone: string
}

interface Cat {
  x: number; y: number; targetX: number
  state: CatAction
  direction: 'left' | 'right'; frame: number; stateTimer: number
  yarnBallX: number; yarnBallY: number
}

interface BossState {
  active: boolean
  x: number
  y: number
  targetX: number
  targetMemberIndex: number
  phase: 'walking' | 'climbing' | 'whipping' | 'leaving'
  frame: number
  whipFrame: number
  whipCount: number
  speechBubbleTimer: number
  speechText: string
}

// === User Whip Animation State ===
interface UserWhipState {
  active: boolean
  phase: 'standing' | 'walking' | 'arriving' | 'whipping' | 'speech' | 'returning' | 'sitting'
  currentUserIndex: number
  targetIndex: number
  originX: number
  originY: number
  x: number
  y: number
  frame: number
  whipCount: number
  speechText: string
  targetScaredTimer: number  // post-whip scared reaction timer
}

// === Environment State ===
interface EnvironmentState {
  cloudX: number
  ambientColor: string
  lightFlicker: number
  musicNoteTimer: number
  totalBugs: number
}

// === Feed State ===
type FeedType = 'coffee' | 'snack' | 'energy'

interface FeedState {
  active: boolean
  phase: 'walking' | 'giving' | 'reaction' | 'returning'
  targetIndex: number
  feedType: FeedType
  x: number
  y: number
  originX: number
  originY: number
  frame: number
  currentUserIndex: number
}

// === Cat Interaction State ===
interface CatInteractionState {
  active: boolean
  phase: 'petting' | 'happy' | 'runaway'
  frame: number
  mood: number
}

// === Achievement Popup ===
interface AchievementPopup {
  name: string
  frame: number
  duration: number
}

// === Off-Work State ===
interface OffWorkState {
  active: boolean
  phase: 'leaving' | 'empty' | 'returning'
  frame: number
  leavingMembers: number[]  // 离开的成员索引
  memberOffsets: { delay: number; x: number; gone: boolean }[]  // 每人离开状态
  lonelyTimer: number  // 孤独特效计时
  lonelyTextIndex: number
}

const LONELY_TEXTS = [
  '加班好累...', '就我一个人...', '命苦啊...', '别人都走了...',
  '今天也是加班的一天', '我为什么还在这...', '好想下班...',
]

export function getStateFromBugCount(count: number): ProgrammerState {
  if (count === 0) return 'idle'
  if (count <= 2) return 'relaxed'
  if (count <= 5) return 'working'
  if (count <= 8) return 'anxious'
  if (count <= 10) return 'crazy'
  return 'collapse'
}

// ====== Constants ======
const CANVAS_W = 700
const DEFAULT_CANVAS_H = 350

const WALL_TOP = 0
const WALL_BOTTOM = 70
const WORK_TOP = 70
// Dynamic layout constants (computed per instance based on member count)
const DEFAULT_WORK_BOTTOM = 285
const DEFAULT_FLOOR_TOP = 285
const DEFAULT_FLOOR_BOTTOM = 350
const FLOOR_HEIGHT = 65 // corridor height stays fixed

// === Layout Config ===
interface LayoutConfig {
  rows: number
  cols: number
  canvasHeight: number
  personScale: number
}

function getLayoutConfig(memberCount: number): LayoutConfig {
  if (memberCount <= 5) {
    return { rows: 1, cols: 5, canvasHeight: 350, personScale: 1.0 }
  } else if (memberCount <= 10) {
    return { rows: 2, cols: 5, canvasHeight: 350, personScale: 1.0 }
  } else if (memberCount <= 14) {
    return { rows: 2, cols: 7, canvasHeight: 350, personScale: 0.9 }
  } else {
    // 15-20 people: 3 rows × 7 cols
    return { rows: 3, cols: 7, canvasHeight: 420, personScale: 0.85 }
  }
}

// Sprite scale - 102x128px sprite source renders at ~55px high in canvas
// 55/128 ≈ 0.43, use 0.45 for slightly larger characters
const BASE_SPRITE_SCALE = 0.45

// === Stardew Valley Style Palette ===
const SV_PALETTE = {
  // Floor
  woodFloor: ['#c09060', '#b08050', '#a07040'],
  tileFloor: ['#d0c8b8', '#c8c0b0'],
  // Walls
  wallBase: '#e8dcc8',
  wallTrim: '#8b7355',
  wallTop: '#d4c8b4',
  wallStripe: 'rgba(180, 160, 130, 0.1)',
  // Furniture
  deskWood: ['#9b7340', '#8b6330', '#7b5320'],
  chair: ['#4a6fa5', '#3a5f95', '#2a4f85'],
  // Lighting
  windowLight: 'rgba(255, 248, 220, 0.15)',
  lampLight: 'rgba(255, 240, 200, 0.2)',
  shadow: 'rgba(60, 40, 20, 0.15)',
  // Window
  windowFrame: '#5c3d1e',
  windowGlass: '#87ceeb',
  windowPane: '#6b4420',
  curtain: '#c85a4a',
  curtainDark: '#b84a3a',
  // Sky
  skyBlue: '#a8d8f0',
  skyLight: '#c8e8ff',
  cloudWhite: 'rgba(255,255,255,0.5)',
}

// Colors
const SHIRT_COLORS = ['#4a90d9', '#d94a4a', '#4ad99a', '#d9a84a', '#9a4ad9', '#4ad9d9', '#d94a9a', '#7a7a7a']
const HAIR_COLORS = ['#3d2314', '#1a1a1a', '#8b4513', '#daa520', '#2f1b0e', '#4a3728', '#c0392b', '#5d4037']
const PANTS_COLORS = ['#2c3e50', '#1a237e', '#3e2723', '#263238', '#4a148c', '#004d40']
const SKIN_TONES = ['#ffdbac', '#f5c6a0', '#e8b090', '#c68642', '#8d5524', '#ffcd94']

function simpleHash(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function getPersonAppearance(name: string): PersonAppearance {
  const hash = simpleHash(name)
  const styles: ('short' | 'medium' | 'long' | 'bun' | 'spiky' | 'curly')[] = ['short', 'medium', 'long', 'bun', 'spiky', 'curly']
  // Accessory distribution: 30% glasses, 20% headphones, 10% cap, 40% none
  const accessoryRoll = (hash * 13) % 100
  let accessory: 'none' | 'glasses' | 'headphones' | 'cap' = 'none'
  if (accessoryRoll < 30) accessory = 'glasses'
  else if (accessoryRoll < 50) accessory = 'headphones'
  else if (accessoryRoll < 60) accessory = 'cap'
  return {
    shirtColor: SHIRT_COLORS[hash % SHIRT_COLORS.length],
    hairColor: HAIR_COLORS[(hash * 3) % HAIR_COLORS.length],
    hairStyle: styles[(hash * 7) % styles.length],
    pantsColor: PANTS_COLORS[(hash * 11) % PANTS_COLORS.length],
    accessory,
    skinTone: SKIN_TONES[(hash * 17) % SKIN_TONES.length],
  }
}

function getDecorations(name: string): string[] {
  const hash = simpleHash(name)
  const decorations = ['plant', 'catToy', 'coffee', 'frame', 'lamp', 'waterCup', 'snack', 'figure']
  const d1 = decorations[hash % decorations.length]
  const d2 = decorations[(hash * 7 + 3) % decorations.length]
  return d1 === d2 ? [d1] : [d1, d2]
}

// === Action → Sprite Animation mapping ===
function getAnimForAction(action: PersonAction): AnimationDef {
  switch (action) {
    case 'typing':
    case 'typing_fast':
      return CODE
    case 'drinking':
      return COFFEE
    case 'phone':
    case 'slacking':
    case 'standing':
    case 'chatting':
      return IDLE
    case 'stretching':
    case 'yawning':
      return TIRED
    case 'scratching':
      return THINK
    default:
      return IDLE
  }
}

// === Action selection based on bugCount ===
function selectPersonAction(bugCount: number, seed: number): PersonAction {
  const r = ((seed * 1664525 + 1013904223) >>> 0) / 4294967296
  if (bugCount === 0) {
    if (r < 0.25) return 'slacking'
    if (r < 0.45) return 'phone'
    if (r < 0.60) return 'chatting'
    if (r < 0.75) return 'drinking'
    if (r < 0.85) return 'stretching'
    return 'typing'
  } else if (bugCount <= 3) {
    if (r < 0.50) return 'typing'
    if (r < 0.65) return 'drinking'
    if (r < 0.80) return 'stretching'
    if (r < 0.90) return 'chatting'
    return 'phone'
  } else if (bugCount <= 7) {
    if (r < 0.55) return 'typing_fast'
    if (r < 0.75) return 'typing'
    if (r < 0.85) return 'scratching'
    if (r < 0.92) return 'drinking'
    return 'yawning'
  } else {
    if (r < 0.45) return 'typing_fast'
    if (r < 0.65) return 'scratching'
    if (r < 0.80) return 'yawning'
    if (r < 0.90) return 'typing'
    return 'stretching'
  }
}

// ====== Main Animator Class ======
export class PixelAnimator {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private state: ProgrammerState = 'idle'
  private frameCount = 0
  private animationId = 0
  private particles: Particle[] = []
  private flashAlpha = 0
  private workstations: Workstation[] = []
  private cat: Cat
  private boss: BossState
  private displayMembers: TeamMemberData[] = []
  private overflowCount = 0
  private personStates: Map<string, PersonState> = new Map()
  private environment: EnvironmentState

  // Dynamic layout properties
  private canvasH = DEFAULT_CANVAS_H
  private workBottom = DEFAULT_WORK_BOTTOM
  private floorTop = DEFAULT_FLOOR_TOP
  private floorBottom = DEFAULT_FLOOR_BOTTOM
  private personScale = 1.0
  private layoutConfig: LayoutConfig = getLayoutConfig(0)
  private starPositions: { x: number; y: number; phase: number }[] = []
  private userWhip: UserWhipState

  // Feed System
  private feedState: FeedState

  // Cat Interaction
  private catInteraction: CatInteractionState

  // Achievement Popup
  private achievementPopup: AchievementPopup | null = null

  // Energized members (after being fed)
  private energizedMembers: Map<number, number> = new Map() // memberIndex -> remaining frames

  // Event System
  private eventSystem: EventSystem

  // Off-Work System
  private offWork: OffWorkState
  private offWorkTriggeredThisHour = false

  // Sprite Effect System
  private activeEffects: SpriteEffect[] = []
  private maxEffects = 10
  private effectIdCounter = 0

  // HTML Speech Bubble System
  private activeBubbles: SpeechBubbleData[] = []
  private bubbleIdCounter = 0

  // Offscreen background cache
  private offscreenCanvas: HTMLCanvasElement
  private offscreenCtx: CanvasRenderingContext2D
  private bgDirty = true

  // Visibility API
  private visibilityHandler: (() => void) | null = null

  // Animation timing
  private startTime = 0

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get 2d context')
    this.canvas = canvas
    this.ctx = ctx
    this.ctx.imageSmoothingEnabled = false

    // Create offscreen canvas for background caching
    this.offscreenCanvas = document.createElement('canvas')
    this.offscreenCanvas.width = CANVAS_W
    this.offscreenCanvas.height = this.canvasH
    const offCtx = this.offscreenCanvas.getContext('2d')
    if (!offCtx) throw new Error('Cannot get offscreen 2d context')
    this.offscreenCtx = offCtx
    this.offscreenCtx.imageSmoothingEnabled = false

    this.cat = {
      x: 100, y: this.floorTop + 25, targetX: 300,
      state: 'walking', direction: 'right', frame: 0, stateTimer: 0,
      yarnBallX: 150, yarnBallY: this.floorTop + 35,
    }
    this.boss = {
      active: false, x: CANVAS_W - 35, y: this.floorTop + 30,
      targetX: 250, targetMemberIndex: -1,
      phase: 'walking', frame: 0, whipFrame: 0,
      whipCount: 0, speechBubbleTimer: 0, speechText: '',
    }
    this.environment = {
      cloudX: -30,
      ambientColor: 'none',
      lightFlicker: 0,
      musicNoteTimer: 0,
      totalBugs: 0,
    }
    this.userWhip = {
      active: false,
      phase: 'standing',
      currentUserIndex: -1,
      targetIndex: -1,
      originX: 0,
      originY: 0,
      x: 0,
      y: 0,
      frame: 0,
      whipCount: 0,
      speechText: '',
      targetScaredTimer: 0,
    }

    this.feedState = {
      active: false,
      phase: 'walking',
      targetIndex: -1,
      feedType: 'coffee',
      x: 0,
      y: 0,
      originX: 0,
      originY: 0,
      frame: 0,
      currentUserIndex: -1,
    }

    this.catInteraction = {
      active: false,
      phase: 'petting',
      frame: 0,
      mood: 50,
    }

    // Initialize Event System
    this.eventSystem = new EventSystem()

    // Initialize Off-Work State
    this.offWork = {
      active: false,
      phase: 'leaving',
      frame: 0,
      leavingMembers: [],
      memberOffsets: [],
      lonelyTimer: 0,
      lonelyTextIndex: 0,
    }
    // Pre-generate star positions for windows
    for (let i = 0; i < 8; i++) {
      this.starPositions.push({
        x: Math.random() * 40,
        y: Math.random() * 28,
        phase: Math.floor(Math.random() * 120),
      })
    }

    this.startTime = performance.now()

    // Visibility API - pause when hidden
    this.visibilityHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(this.animationId)
      } else {
        this.animationId = requestAnimationFrame(this.render)
      }
    }
    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  // === Public: Get active speech bubbles for HTML rendering ===
  getActiveBubbles(): SpeechBubbleData[] {
    return this.activeBubbles
  }

  private addCanvasBubble(x: number, y: number, text: string, type: SpeechBubbleData['type'] = 'speech', color?: string, duration?: number): void {
    this.bubbleIdCounter++
    // Avoid duplicate bubbles with same text at same approx position
    const existing = this.activeBubbles.find(b => b.text === text && Math.abs(b.x - x) < 20 && Math.abs(b.y - y) < 20)
    if (existing) {
      existing.duration = duration || 90 // refresh duration
      return
    }
    this.activeBubbles.push({
      id: `cb_${this.bubbleIdCounter}_${Date.now()}`,
      x, y, text, type,
      color,
      duration: duration || 90, // default ~3s at 30fps
    })
    // Limit max bubbles
    if (this.activeBubbles.length > 15) {
      this.activeBubbles.shift()
    }
  }

  private updateCanvasBubbles(): void {
    this.activeBubbles = this.activeBubbles.filter(b => {
      b.duration--
      return b.duration > 0
    })
  }

  setState(state: ProgrammerState) {
    if (this.state !== state) {
      this.state = state
    }
  }

  setTeamMembers(members: TeamMemberData[]) {
    const maxMembers = 20
    if (members.length > maxMembers) {
      const sorted = [...members].sort((a, b) => b.bugCount - a.bugCount)
      this.displayMembers = sorted.slice(0, maxMembers)
      this.overflowCount = members.length - maxMembers
    } else {
      this.displayMembers = members
      this.overflowCount = 0
    }
    this.updateCanvasLayout(this.displayMembers.length)
    this.buildWorkstations()
    this.initPersonStates()
    this.environment.totalBugs = members.reduce((sum, m) => sum + m.bugCount, 0)
    this.bgDirty = true // workstation layout changed, redraw background
  }

  updateTeamMembers(members: TeamMemberData[]) {
    this.setTeamMembers(members)
  }

  // === Public: Sprite Effect System ===
  triggerEffect(type: SpriteEffectType, x: number, y: number): void {
    if (this.activeEffects.length >= this.maxEffects) {
      // Remove oldest effect to make room
      this.activeEffects.shift()
    }
    this.effectIdCounter++
    this.activeEffects.push({
      id: `effect_${this.effectIdCounter}`,
      type,
      x,
      y,
      startTime: performance.now(),
      duration: getEffectDuration(type),
    })
  }

  /** Trigger effect at a specific member's position */
  triggerEffectAtMember(type: SpriteEffectType, memberName: string): void {
    const idx = this.workstations.findIndex(w => w.name === memberName)
    if (idx >= 0) {
      const ws = this.workstations[idx]
      this.triggerEffect(type, ws.x + 24, ws.y + 20)
    }
  }

  triggerBoss(targetName?: string) {
    if (this.boss.active) return
    let targetX = CANVAS_W / 2
    let targetMemberIndex = -1
    if (targetName) {
      const idx = this.workstations.findIndex(w => w.name === targetName)
      if (idx >= 0) {
        targetX = this.workstations[idx].x + 24
        targetMemberIndex = idx
      }
    } else if (this.workstations.length > 0) {
      targetMemberIndex = Math.floor(Math.random() * this.workstations.length)
      targetX = this.workstations[targetMemberIndex].x + 24
    }
    const bubbleTexts = ['干活！', '快修Bug！', '又有Bug了！', '加班！']
    this.boss = {
      active: true, x: CANVAS_W - 35, y: this.floorTop + 30,
      targetX, targetMemberIndex,
      phase: 'walking', frame: 0, whipFrame: 0,
      whipCount: 0, speechBubbleTimer: 0,
      speechText: bubbleTexts[Math.floor(Math.random() * bubbleTexts.length)],
    }
  }

  private initPersonStates() {
    const existing = new Map(this.personStates)
    this.personStates.clear()
    const now = performance.now()
    for (const ws of this.workstations) {
      if (existing.has(ws.name)) {
        this.personStates.set(ws.name, existing.get(ws.name)!)
      } else {
        const action = selectPersonAction(ws.bugCount, simpleHash(ws.name) + this.frameCount)
        this.personStates.set(ws.name, {
          currentAction: action,
          actionTimer: 0,
          actionDuration: 120 + Math.floor(Math.random() * 180),
          nextActionDelay: 0,
          transitionFrame: 0,
          prevAction: null,
          animStartTime: now,
        })
      }
    }
  }

  private updatePersonStates() {
    const now = performance.now()
    for (const ws of this.workstations) {
      const ps = this.personStates.get(ws.name)
      if (!ps) continue
      ps.actionTimer++
      if (ps.transitionFrame > 0) {
        ps.transitionFrame--
      }
      if (ps.actionTimer >= ps.actionDuration) {
        ps.prevAction = ps.currentAction
        ps.transitionFrame = 10
        const seed = simpleHash(ws.name) * 31 + this.frameCount
        ps.currentAction = selectPersonAction(ws.bugCount, seed)
        ps.actionTimer = 0
        ps.actionDuration = 120 + Math.floor(((seed * 7) % 180))
        ps.animStartTime = now // reset animation start for new action
      }
    }
  }

  private buildWorkstations() {
    this.workstations = []
    const members = this.displayMembers
    if (members.length === 0) return

    const count = members.length
    const { rows, cols } = this.layoutConfig

    const margin = 20
    const availW = CANVAS_W - margin * 2
    const workAreaHeight = this.workBottom - WORK_TOP
    const startY = WORK_TOP + 30
    const rowSpacing = rows > 1 ? (workAreaHeight - 60) / (rows - 1) : 0

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const rowMemberCount = Math.min(cols, count - row * cols)
      const slotW = availW / rowMemberCount
      const m = members[i]
      this.workstations.push({
        x: margin + col * slotW + slotW / 2 - 24,
        y: startY + row * rowSpacing,
        name: m.name, state: getStateFromBugCount(m.bugCount),
        bugCount: m.bugCount, decorations: getDecorations(m.name),
        appearance: getPersonAppearance(m.name),
      })
    }
  }

  /** Update canvas size and layout properties based on member count */
  private updateCanvasLayout(memberCount: number): void {
    const config = getLayoutConfig(memberCount)
    this.layoutConfig = config
    this.personScale = config.personScale

    const newH = config.canvasHeight
    if (newH !== this.canvasH) {
      this.canvasH = newH
      this.workBottom = newH - FLOOR_HEIGHT
      this.floorTop = newH - FLOOR_HEIGHT
      this.floorBottom = newH

      // Resize actual canvas
      this.canvas.height = newH
      // Resize offscreen canvas
      this.offscreenCanvas.height = newH
      this.offscreenCtx.imageSmoothingEnabled = false

      // Update cat and boss Y positions
      this.cat.y = this.floorTop + 25
      this.cat.yarnBallY = this.floorTop + 35
      if (!this.boss.active) {
        this.boss.y = this.floorTop + 30
      }
    }
    this.bgDirty = true
  }

  /** Get current canvas dimensions (for PixelScene to read) */
  getCanvasSize(): { width: number; height: number } {
    return { width: CANVAS_W, height: this.canvasH }
  }

  // ====== Background: Offscreen Cache ======
  private renderBackgroundCache() {
    const ctx = this.offscreenCtx
    ctx.clearRect(0, 0, CANVAS_W, this.canvasH)

    // Wall (Stardew Valley warm cream color)
    ctx.fillStyle = SV_PALETTE.wallBase
    ctx.fillRect(0, WALL_TOP, CANVAS_W, WALL_BOTTOM - WALL_TOP)
    // Wallpaper subtle vertical stripes
    ctx.fillStyle = SV_PALETTE.wallStripe
    for (let i = 0; i < CANVAS_W; i += 20) ctx.fillRect(i, 0, 1, WALL_BOTTOM - 4)
    // Horizontal wainscoting line
    ctx.fillStyle = SV_PALETTE.wallTop
    ctx.fillRect(0, 35, CANVAS_W, 1)
    // Kickboard / baseboard (warm wood trim)
    ctx.fillStyle = SV_PALETTE.wallTrim
    ctx.fillRect(0, WALL_BOTTOM - 4, CANVAS_W, 4)

    // Floor (work area) - wood plank texture
    for (let y = WORK_TOP; y < this.workBottom; y += 8) {
      for (let x = 0; x < CANVAS_W; x += 16) {
        const colorIndex = ((Math.floor(x / 16) + Math.floor(y / 8)) % 3)
        ctx.fillStyle = SV_PALETTE.woodFloor[colorIndex]
        ctx.fillRect(x, y, 16, 8)
        // Plank seam (horizontal)
        ctx.fillStyle = 'rgba(80, 50, 20, 0.25)'
        ctx.fillRect(x, y + 7, 16, 1)
        // Vertical seams (staggered)
        if (Math.floor(y / 8) % 2 === 0) {
          ctx.fillStyle = 'rgba(80, 50, 20, 0.2)'
          ctx.fillRect(x + 15, y, 1, 8)
        }
      }
    }

    // Bottom corridor - tile floor
    for (let y = this.floorTop; y < this.floorBottom; y += 12) {
      for (let x = 0; x < CANVAS_W; x += 12) {
        const ci = (Math.floor(x / 12) + Math.floor(y / 12)) % 2
        ctx.fillStyle = SV_PALETTE.tileFloor[ci]
        ctx.fillRect(x, y, 12, 12)
        ctx.fillStyle = 'rgba(0,0,0,0.05)'
        ctx.fillRect(x, y + 11, 12, 1)
        ctx.fillRect(x + 11, y, 1, 12)
      }
    }
    // Corridor top edge highlight
    ctx.fillStyle = '#b8a890'
    ctx.fillRect(0, this.floorTop, CANVAS_W, 2)

    // Static window frames (sky + cross, not animated elements)
    this.drawWindowStatic(ctx, 50, 8, 50, 40)
    this.drawWindowStatic(ctx, 310, 8, 50, 40)
    this.drawWindowStatic(ctx, 560, 8, 50, 40)

    // Bulletin board
    this.drawBulletinBoardTo(ctx, 180, 10)

    // Boss door
    this.drawBossDoorTo(ctx)

    // Water cooler (static parts)
    this.drawWaterCoolerStatic(ctx, CANVAS_W - 50, this.floorTop + 8)

    // Overflow indicator
    if (this.overflowCount > 0) {
      ctx.fillStyle = 'rgba(90,70,50,0.7)'
      ctx.fillRect(CANVAS_W - 90, this.workBottom - 22, 80, 18)
      ctx.fillStyle = '#f0e8d0'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`+${this.overflowCount} 其他`, CANVAS_W - 50, this.workBottom - 9)
      ctx.textAlign = 'left'
    }

    this.bgDirty = false
  }

  private drawWindowStatic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    // Window frame (dark wood)
    ctx.fillStyle = SV_PALETTE.windowFrame
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
    // Glass (sky blue)
    ctx.fillStyle = SV_PALETTE.skyBlue
    ctx.fillRect(x, y, w, h)
    // Lighter sky gradient top
    ctx.fillStyle = SV_PALETTE.skyLight
    ctx.fillRect(x, y, w, h / 3)
    // Window pane cross (wood)
    ctx.fillStyle = SV_PALETTE.windowPane
    ctx.fillRect(x + w / 2 - 1, y, 2, h)
    ctx.fillRect(x, y + h / 2 - 1, w, 2)
    // Curtains (left + right)
    ctx.fillStyle = SV_PALETTE.curtain
    ctx.fillRect(x - 4, y - 2, 6, h + 4)
    ctx.fillRect(x + w - 2, y - 2, 6, h + 4)
    // Curtain valance
    ctx.fillStyle = SV_PALETTE.curtainDark
    ctx.fillRect(x - 6, y - 6, w + 12, 5)
    // Sun/cloud in sky
    ctx.fillStyle = '#fff8d0'
    ctx.fillRect(x + w - 14, y + 6, 5, 5)
    ctx.fillRect(x + w - 15, y + 7, 1, 3)
    ctx.fillRect(x + w - 9, y + 7, 1, 3)
    // Window light cast onto floor below
    ctx.fillStyle = SV_PALETTE.windowLight
    ctx.fillRect(x - 5, WALL_BOTTOM, w + 10, 20)
  }

  private drawBulletinBoardTo(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Cork board with wood frame
    ctx.fillStyle = '#7a5a28'
    ctx.fillRect(x - 2, y - 2, 64, 46)
    ctx.fillStyle = '#c9a56e'
    ctx.fillRect(x, y, 60, 42)
    // Cork texture dots
    ctx.fillStyle = 'rgba(160, 120, 60, 0.3)'
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(x + 5 + (i * 6) % 52, y + 4 + (i * 7) % 36, 2, 2)
    }
    const noteColors = ['#ff6b6b', '#ffd93d', '#6bcfff', '#77dd77', '#ffb3de']
    for (let i = 0; i < 4; i++) {
      const nx = x + 5 + (i % 2) * 28
      const ny = y + 6 + Math.floor(i / 2) * 18
      ctx.fillStyle = noteColors[(42 + i * 3) % noteColors.length]
      ctx.fillRect(nx, ny, 20, 14)
      // Pin
      ctx.fillStyle = '#cc3333'
      ctx.fillRect(nx + 9, ny - 1, 3, 3)
    }
  }

  private drawBossDoorTo(ctx: CanvasRenderingContext2D) {
    const dx = CANVAS_W - 42
    const dy = this.floorTop + 4
    // Door frame (dark wood)
    ctx.fillStyle = '#4a3520'
    ctx.fillRect(dx - 2, dy - 2, 34, 59)
    // Door panel (warm brown)
    ctx.fillStyle = '#7a5a30'
    ctx.fillRect(dx, dy, 30, 55)
    // Door panels (raised)
    ctx.fillStyle = '#8b6a40'
    ctx.fillRect(dx + 4, dy + 5, 22, 20)
    ctx.fillRect(dx + 4, dy + 30, 22, 20)
    // Panel borders
    ctx.fillStyle = '#6a4a20'
    ctx.fillRect(dx + 4, dy + 5, 22, 1)
    ctx.fillRect(dx + 4, dy + 24, 22, 1)
    ctx.fillRect(dx + 4, dy + 30, 22, 1)
    ctx.fillRect(dx + 4, dy + 49, 22, 1)
    // Door knob (gold)
    ctx.fillStyle = '#f1c40f'
    ctx.fillRect(dx + 5, dy + 28, 4, 4)
    ctx.fillStyle = '#d4a80a'
    ctx.fillRect(dx + 6, dy + 29, 2, 2)
    // Name plate
    ctx.fillStyle = '#d4a80a'
    ctx.fillRect(dx + 8, dy + 8, 14, 8)
    ctx.fillStyle = '#1a1a1a'
    ctx.font = 'bold 6px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('BOSS', dx + 15, dy + 14)
    ctx.textAlign = 'left'
  }

  private drawWaterCoolerStatic(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Main body (light gray)
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(x, y, 12, 24)
    // Top water bottle (blue translucent)
    ctx.fillStyle = '#6699cc'
    ctx.fillRect(x + 1, y - 8, 10, 9)
    ctx.fillStyle = '#88bbdd'
    ctx.fillRect(x + 2, y - 7, 8, 7)
    // Hot/cold buttons
    ctx.fillStyle = '#cc3333'
    ctx.fillRect(x + 3, y + 10, 2, 2)
    ctx.fillStyle = '#3366cc'
    ctx.fillRect(x + 7, y + 10, 2, 2)
    // Base stand
    ctx.fillStyle = '#cccccc'
    ctx.fillRect(x - 1, y + 22, 14, 3)
    // Drip tray
    ctx.fillStyle = '#aaaaaa'
    ctx.fillRect(x + 2, y + 14, 8, 2)
  }

  // ====== Dynamic background elements (drawn each frame on main canvas) ======
  private drawDynamicBackground() {
    const { ctx } = this
    // Window animations: clouds, stars
    this.drawWindowDynamic(ctx, 50, 8, 50, 40)
    this.drawWindowDynamic(ctx, 310, 8, 50, 40)
    this.drawWindowDynamic(ctx, 560, 8, 50, 40)

    // Clock (hands rotate)
    this.drawClock(470, 28)

    // Water cooler bubbles
    this.drawWaterCoolerBubbles(CANVAS_W - 50, this.floorTop + 8)
  }

  private drawWindowDynamic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    // Cloud drifting (white fluffy)
    const cloudOffset = this.environment.cloudX
    const cloudInWindow = ((cloudOffset + x * 0.3) % (w + 30)) - 15
    if (cloudInWindow > -10 && cloudInWindow < w - 6) {
      ctx.fillStyle = SV_PALETTE.cloudWhite
      const cx = x + 3 + Math.max(0, Math.min(cloudInWindow, w - 20))
      ctx.fillRect(cx, y + h / 2 + 2, 14, 4)
      ctx.fillRect(cx + 2, y + h / 2, 10, 3)
      ctx.fillRect(cx + 4, y + h / 2 - 2, 6, 3)
    }

    // Birds (small V shapes flying)
    const birdPhase = (this.frameCount * 0.02 + x * 0.1) % 40
    if (birdPhase < 30) {
      const bx = x + 5 + birdPhase
      const by = y + 8 + Math.sin(birdPhase * 0.3) * 3
      if (bx < x + w - 5) {
        ctx.fillStyle = '#4a4a4a'
        ctx.fillRect(bx - 2, by, 1, 1)
        ctx.fillRect(bx - 1, by - 1, 1, 1)
        ctx.fillRect(bx, by, 1, 1)
        ctx.fillRect(bx + 1, by - 1, 1, 1)
        ctx.fillRect(bx + 2, by, 1, 1)
      }
    }
  }

  private drawClock(x: number, y: number) {
    const { ctx } = this
    // Clock frame (wood)
    ctx.fillStyle = '#7a5a28'
    ctx.fillRect(x - 9, y - 9, 18, 18)
    // Clock face (cream)
    ctx.fillStyle = '#fff8e8'
    ctx.fillRect(x - 7, y - 7, 14, 14)
    // Hour markers
    ctx.fillStyle = '#5c3d1e'
    ctx.fillRect(x - 1, y - 6, 2, 1)
    ctx.fillRect(x - 1, y + 5, 2, 1)
    ctx.fillRect(x - 6, y - 1, 1, 2)
    ctx.fillRect(x + 5, y - 1, 1, 2)

    const sec = this.frameCount / 30
    // Hour hand
    ctx.fillStyle = '#3d2314'
    const hAngle = sec * 0.02
    const hhx = Math.cos(hAngle - Math.PI / 2) * 3
    const hhy = Math.sin(hAngle - Math.PI / 2) * 3
    ctx.fillRect(x + hhx - 0.5, y + hhy - 0.5, 2, 2)
    // Minute hand
    const mAngle = sec * 0.2
    const mhx = Math.cos(mAngle - Math.PI / 2) * 4.5
    const mhy = Math.sin(mAngle - Math.PI / 2) * 4.5
    ctx.fillRect(x + mhx - 0.5, y + mhy - 0.5, 1.5, 1.5)
    // Second hand (red)
    ctx.fillStyle = '#cc3333'
    const sAngle = sec * 1.0
    const shx = Math.cos(sAngle - Math.PI / 2) * 5
    const shy = Math.sin(sAngle - Math.PI / 2) * 5
    ctx.fillRect(x + shx - 0.3, y + shy - 0.3, 1, 1)
    // Center dot
    ctx.fillStyle = '#3d2314'
    ctx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5)
  }

  private drawWaterCoolerBubbles(x: number, y: number) {
    const { ctx } = this
    const bubblePhase = this.frameCount % 75 // adjusted for 30fps
    if (bubblePhase < 15) {
      ctx.fillStyle = 'rgba(200,230,255,0.6)'
      const by1 = y - 2 - (bubblePhase * 0.3)
      ctx.fillRect(x + 4, by1, 2, 2)
      if (bubblePhase > 5) {
        const by2 = y - 1 - ((bubblePhase - 5) * 0.3)
        ctx.fillRect(x + 7, by2, 1, 1)
      }
    }
  }

  // ====== Office Environment Decorations ======
  private drawOfficeEnvironment() {
    const { ctx } = this
    const w = CANVAS_W

    // --- Wall baseboard highlight ---
    ctx.fillStyle = '#a08860'
    ctx.fillRect(0, WALL_BOTTOM - 1, w, 1)

    // --- Top wall: AC vents ---
    this.drawACVent(ctx, 115, 18)
    this.drawACVent(ctx, 510, 18)

    // --- Top wall: picture frames ---
    this.drawPictureFrame(ctx, 260, 12, 30, 22, '#6a9080')
    this.drawPictureFrame(ctx, 430, 15, 25, 18, '#907060')

    // --- Left side: whiteboard ---
    this.drawWhiteboard(ctx, 4, WORK_TOP + 5)

    // --- Left side: floor plant ---
    this.drawFloorPlant(ctx, 10, this.workBottom - 55)

    // --- Right side: bookshelf ---
    this.drawBookshelf(ctx, w - 38, WORK_TOP + 8)

    // --- Right side: printer ---
    this.drawPrinter(ctx, w - 35, this.workBottom - 35)

    // --- Bottom floor: warm rug area ---
    ctx.fillStyle = '#a06040'
    ctx.fillRect(80, this.floorTop + 5, 160, 50)
    ctx.fillStyle = '#c07050'
    ctx.fillRect(82, this.floorTop + 7, 156, 46)
    // Rug pattern (warm geometric)
    ctx.fillStyle = '#d49060'
    for (let i = 0; i < 156; i += 12) {
      ctx.fillRect(82 + i, this.floorTop + 10, 8, 2)
      ctx.fillRect(82 + i + 4, this.floorTop + 48, 8, 2)
    }
    // Inner rug design
    ctx.fillStyle = '#e8b080'
    ctx.fillRect(100, this.floorTop + 20, 120, 2)
    ctx.fillRect(100, this.floorTop + 42, 120, 2)
    ctx.fillRect(100, this.floorTop + 20, 2, 24)
    ctx.fillRect(218, this.floorTop + 20, 2, 24)

    // --- Floor: scattered details ---
    // Small floor mat at entrance
    ctx.fillStyle = '#8a7a60'
    ctx.fillRect(CANVAS_W - 60, this.floorTop + 8, 20, 12)
    ctx.fillStyle = '#9a8a70'
    ctx.fillRect(CANVAS_W - 58, this.floorTop + 10, 16, 8)

    // --- Corner: trash can ---
    this.drawTrashCan(ctx, 5, this.floorTop + 12)

    // --- Corner: cardboard boxes ---
    this.drawCardboardBoxes(ctx, 35, this.floorTop + 15)
  }

  private drawACVent(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // White AC unit with rounded top
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(x, y, 36, 10)
    // Frame border
    ctx.fillStyle = '#cccccc'
    ctx.fillRect(x, y, 36, 1)
    ctx.fillRect(x, y + 9, 36, 1)
    ctx.fillRect(x, y, 1, 10)
    ctx.fillRect(x + 35, y, 1, 10)
    // Grille slats
    ctx.fillStyle = '#dddddd'
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x + 3 + i * 7, y + 3, 5, 1)
      ctx.fillRect(x + 3 + i * 7, y + 5, 5, 1)
      ctx.fillRect(x + 3 + i * 7, y + 7, 5, 1)
    }
  }

  private drawPictureFrame(ctx: CanvasRenderingContext2D, x: number, y: number, fw: number, fh: number, innerColor: string) {
    // Wood frame
    ctx.fillStyle = '#7a5a28'
    ctx.fillRect(x - 1, y - 1, fw + 2, fh + 2)
    // Inner picture
    ctx.fillStyle = innerColor
    ctx.fillRect(x + 2, y + 2, fw - 4, fh - 4)
    // Simple landscape art inside
    ctx.fillStyle = '#90c8a0'
    ctx.fillRect(x + 3, y + fh - 8, fw - 6, 5)
    ctx.fillStyle = '#70a880'
    ctx.fillRect(x + 4, y + fh - 10, 6, 4)
    ctx.fillRect(x + fw - 12, y + fh - 12, 5, 6)
    // Sky portion
    ctx.fillStyle = '#a8d8f0'
    ctx.fillRect(x + 3, y + 3, fw - 6, fh - 12)
  }

  private drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Aluminum frame
    ctx.fillStyle = '#c0c0c0'
    ctx.fillRect(x - 1, y - 1, 36, 52)
    // White board surface
    ctx.fillStyle = '#f8f8f8'
    ctx.fillRect(x + 1, y + 1, 32, 48)
    // Sticky notes on board (colorful)
    ctx.fillStyle = '#ff6b6b'
    ctx.fillRect(x + 4, y + 5, 10, 8)
    ctx.fillStyle = '#ffd93d'
    ctx.fillRect(x + 17, y + 6, 12, 7)
    ctx.fillStyle = '#77dd77'
    ctx.fillRect(x + 5, y + 18, 11, 8)
    ctx.fillStyle = '#6bcfff'
    ctx.fillRect(x + 18, y + 20, 10, 7)
    // Scribble lines on notes
    ctx.fillStyle = '#333333'
    ctx.fillRect(x + 5, y + 7, 6, 1)
    ctx.fillRect(x + 5, y + 9, 4, 1)
    ctx.fillRect(x + 18, y + 8, 8, 1)
    ctx.fillRect(x + 6, y + 20, 7, 1)
    ctx.fillRect(x + 19, y + 22, 6, 1)
    // Bottom: marker tray
    ctx.fillStyle = '#999999'
    ctx.fillRect(x + 3, y + 44, 28, 3)
    ctx.fillStyle = '#cc3333'
    ctx.fillRect(x + 6, y + 43, 4, 2)
    ctx.fillStyle = '#3366cc'
    ctx.fillRect(x + 12, y + 43, 4, 2)
    ctx.fillStyle = '#33aa33'
    ctx.fillRect(x + 18, y + 43, 4, 2)
  }

  private drawFloorPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Terracotta pot
    ctx.fillStyle = '#b86840'
    ctx.fillRect(x + 2, y + 28, 12, 16)
    ctx.fillStyle = '#cc7850'
    ctx.fillRect(x + 3, y + 26, 10, 3)
    // Rim highlight
    ctx.fillStyle = '#d89070'
    ctx.fillRect(x + 3, y + 26, 10, 1)
    // Soil
    ctx.fillStyle = '#5a3820'
    ctx.fillRect(x + 3, y + 27, 10, 2)
    // Leaves with sway animation
    const sway = Math.sin(this.frameCount * 0.03) * 1.5
    // Main stem
    ctx.fillStyle = '#4a8a3a'
    ctx.fillRect(x + 7, y + 8, 2, 20)
    // Leaves (lush green)
    ctx.fillStyle = '#5aaa50'
    ctx.fillRect(x + 3 + sway, y + 6, 5, 4)
    ctx.fillRect(x + 9 - sway, y + 4, 5, 4)
    ctx.fillRect(x + 2 + sway * 0.7, y + 12, 5, 3)
    ctx.fillRect(x + 10 - sway * 0.7, y + 10, 5, 3)
    ctx.fillStyle = '#6cc060'
    ctx.fillRect(x + 5 + sway * 0.5, y + 2, 4, 3)
    ctx.fillRect(x + 7 - sway * 0.5, y + 8, 4, 3)
    // Leaf highlights
    ctx.fillStyle = '#88e080'
    ctx.fillRect(x + 4 + sway, y + 7, 2, 1)
    ctx.fillRect(x + 10 - sway, y + 5, 2, 1)
  }

  private drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const shelfW = 30
    const shelfH = 80
    // Back panel (warm wood)
    ctx.fillStyle = '#8b6030'
    ctx.fillRect(x, y, shelfW, shelfH)
    // Side edges
    ctx.fillStyle = '#7a5020'
    ctx.fillRect(x, y, 2, shelfH)
    ctx.fillRect(x + shelfW - 2, y, 2, shelfH)
    // Shelves (4 levels - lighter wood)
    ctx.fillStyle = '#a07030'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x, y + 18 * i + 18, shelfW, 3)
    }
    // Books on shelves (colorful like Stardew Valley)
    const bookColors = ['#cc4444', '#4488bb', '#44aa55', '#cc8830', '#8855aa', '#449999', '#aa5577']
    for (let shelf = 0; shelf < 3; shelf++) {
      const shelfY = y + shelf * 18 + 2
      let bx = x + 3
      for (let b = 0; b < 4 + (shelf % 2); b++) {
        const bw = 3 + (b % 3)
        const bh = 12 + (b % 2) * 3
        ctx.fillStyle = bookColors[(shelf * 5 + b) % bookColors.length]
        ctx.fillRect(bx, shelfY + (15 - bh), bw, bh)
        // Book spine highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(bx, shelfY + (15 - bh), 1, bh)
        bx += bw + 1
        if (bx > x + shelfW - 4) break
      }
    }
    // Bottom shelf: binder
    ctx.fillStyle = '#6a6a6a'
    ctx.fillRect(x + 3, y + 58, 10, 14)
    ctx.fillStyle = '#888888'
    ctx.fillRect(x + 15, y + 60, 8, 12)
  }

  private drawPrinter(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Printer body (white/cream)
    ctx.fillStyle = '#f0f0e8'
    ctx.fillRect(x, y, 28, 18)
    // Top edge
    ctx.fillStyle = '#e0e0d8'
    ctx.fillRect(x + 1, y + 1, 26, 2)
    // Paper tray (raised)
    ctx.fillStyle = '#e8e8e0'
    ctx.fillRect(x + 4, y - 3, 20, 4)
    // Paper in tray
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x + 6, y - 2, 16, 2)
    // Status LED
    const ledOn = this.frameCount % 90 < 60
    ctx.fillStyle = ledOn ? '#44cc44' : '#448844'
    ctx.fillRect(x + 22, y + 4, 3, 2)
    // Output slot
    ctx.fillStyle = '#c8c8c0'
    ctx.fillRect(x + 3, y + 12, 22, 2)
    // Legs
    ctx.fillStyle = '#aaaaaa'
    ctx.fillRect(x + 3, y + 18, 3, 4)
    ctx.fillRect(x + 22, y + 18, 3, 4)
  }

  private drawTrashCan(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Metal trash can (lighter)
    ctx.fillStyle = '#a0a098'
    ctx.fillRect(x, y + 4, 14, 22)
    // Rim
    ctx.fillStyle = '#b0b0a8'
    ctx.fillRect(x - 1, y + 2, 16, 3)
    // Lid handle
    ctx.fillStyle = '#c0c0b8'
    ctx.fillRect(x + 5, y, 4, 3)
    // Body lines
    ctx.fillStyle = '#8a8a82'
    ctx.fillRect(x + 4, y + 6, 1, 18)
    ctx.fillRect(x + 9, y + 6, 1, 18)
  }

  private drawCardboardBoxes(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Box 1 (larger, bottom) - warm cardboard
    ctx.fillStyle = '#c8a050'
    ctx.fillRect(x, y + 10, 20, 16)
    ctx.fillStyle = '#d8b060'
    ctx.fillRect(x + 1, y + 11, 18, 14)
    // Tape
    ctx.fillStyle = '#e8c880'
    ctx.fillRect(x + 8, y + 10, 4, 16)
    // Box 2 (smaller, on top)
    ctx.fillStyle = '#b89040'
    ctx.fillRect(x + 3, y, 14, 11)
    ctx.fillStyle = '#c8a050'
    ctx.fillRect(x + 4, y + 1, 12, 9)
    // Tape on top box
    ctx.fillStyle = '#e8c880'
    ctx.fillRect(x + 9, y, 3, 11)
    // Box 3 (tiny, beside)
    ctx.fillStyle = '#a88030'
    ctx.fillRect(x + 22, y + 18, 10, 8)
    ctx.fillStyle = '#b89040'
    ctx.fillRect(x + 23, y + 19, 8, 6)
  }

  // ====== Drawing: Workstations ======
  private drawWorkstation(ws: Workstation) {
    const { ctx } = this
    const { x, y } = ws

    if (isSpritesReady()) {
      this.drawPersonWithAction(x, y, ws)
      return
    }

    // === Fallback mode: Stardew Valley style programmatic drawing ===
    const s = this.personScale
    const deskW = Math.round(52 * s), deskH = Math.round(10 * s)
    const deskX = x - Math.round(2 * s), deskY = y + Math.round(54 * s)

    // Chair (blue office chair - Stardew style)
    ctx.fillStyle = SV_PALETTE.chair[0]
    ctx.fillRect(x + Math.round(14 * s), y + Math.round(56 * s), Math.round(18 * s), Math.round(8 * s))
    ctx.fillStyle = SV_PALETTE.chair[1]
    ctx.fillRect(x + Math.round(14 * s), y + Math.round(64 * s), Math.round(20 * s), Math.round(3 * s))
    // Chair support
    ctx.fillStyle = '#4a4a4a'
    ctx.fillRect(x + Math.round(22 * s), y + Math.round(67 * s), Math.round(4 * s), Math.round(8 * s))
    // Chair base/wheels
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(x + Math.round(17 * s), y + Math.round(75 * s), Math.round(14 * s), Math.round(3 * s))
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(x + Math.round(16 * s), y + Math.round(77 * s), Math.round(3 * s), Math.round(2 * s))
    ctx.fillRect(x + Math.round(29 * s), y + Math.round(77 * s), Math.round(3 * s), Math.round(2 * s))

    // Desk surface (warm wood with thickness)
    ctx.fillStyle = SV_PALETTE.deskWood[0]
    ctx.fillRect(deskX, deskY, deskW, deskH)
    // Desk front edge (darker)
    ctx.fillStyle = SV_PALETTE.deskWood[1]
    ctx.fillRect(deskX, deskY + deskH - Math.round(3 * s), deskW, Math.round(3 * s))
    // Wood grain lines
    ctx.fillStyle = 'rgba(180, 140, 80, 0.3)'
    for (let i = 0; i < deskW; i += Math.round(8 * s)) {
      ctx.fillRect(deskX + i, deskY + Math.round(2 * s), Math.round(6 * s), 1)
      ctx.fillRect(deskX + i + Math.round(3 * s), deskY + Math.round(5 * s), Math.round(4 * s), 1)
    }
    // Desk legs
    ctx.fillStyle = SV_PALETTE.deskWood[2]
    ctx.fillRect(deskX + Math.round(3 * s), deskY + deskH, Math.round(4 * s), Math.round(16 * s))
    ctx.fillRect(deskX + deskW - Math.round(7 * s), deskY + deskH, Math.round(4 * s), Math.round(16 * s))

    // Monitor (thin black frame with colored screen)
    const monX = x + Math.round(12 * s), monY = y + Math.round(20 * s)
    const monW = Math.round(24 * s), monH = Math.round(18 * s)
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(monX, monY, monW, monH)

    // Screen content based on action
    const ps = this.personStates.get(ws.name)
    const isSlacking = ps?.currentAction === 'slacking'
    const isTyping = ps?.currentAction === 'typing' || ps?.currentAction === 'typing_fast'

    if (isSlacking) {
      ctx.fillStyle = '#4488cc'
      ctx.fillRect(monX + 2, monY + 2, monW - 4, monH - 4)
      // Video content (colorful bars)
      const colors = ['#ff6688', '#66ff88', '#6688ff', '#ffdd66']
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = colors[(i + Math.floor(this.frameCount / 6)) % colors.length]
        ctx.fillRect(monX + 3, monY + 3 + i * Math.round(3 * s), monW - 6, Math.round(2.5 * s))
      }
    } else if (isTyping) {
      // Dark IDE with code lines
      ctx.fillStyle = '#1e1e2e'
      ctx.fillRect(monX + 2, monY + 2, monW - 4, monH - 4)
      ctx.fillStyle = '#88cc88'
      const scrollOff = Math.floor(this.frameCount / 4) % 4
      for (let i = 0; i < 5; i++) {
        const lw = 4 + ((i * 3 + simpleHash(ws.name) + scrollOff) % 10)
        const ly = monY + 3 + i * Math.round(3 * s) - scrollOff
        if (ly >= monY + 2 && ly < monY + monH - 3) {
          ctx.fillRect(monX + 4, ly, Math.min(lw, monW - 8), 1)
        }
      }
      // Cursor blink
      if (this.frameCount % 16 < 10) {
        ctx.fillStyle = '#88cc88'
        ctx.fillRect(monX + 5 + (this.frameCount % 12), monY + monH - 6, 1, 2)
      }
    } else {
      // Idle: blue screen or alert
      const screenColor = ws.bugCount >= 8 ? '#884444' : ws.bugCount >= 5 ? '#886644' : '#4488cc'
      ctx.fillStyle = screenColor
      ctx.fillRect(monX + 2, monY + 2, monW - 4, monH - 4)
    }

    // Monitor stand
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(monX + Math.round(9 * s), monY + monH, Math.round(6 * s), Math.round(5 * s))
    ctx.fillRect(monX + Math.round(6 * s), monY + monH + Math.round(4 * s), Math.round(12 * s), Math.round(2 * s))

    // Keyboard
    ctx.fillStyle = '#e8e8e0'
    ctx.fillRect(x + Math.round(10 * s), deskY - Math.round(7 * s), Math.round(28 * s), Math.round(6 * s))
    ctx.fillStyle = '#d0d0c8'
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(x + Math.round((12 + i * 4) * s), deskY - Math.round((6 - row * 3) * s), Math.round(3 * s), Math.round(2 * s))
      }
    }

    // Mouse
    ctx.fillStyle = '#e0e0d8'
    ctx.fillRect(x + Math.round(40 * s), deskY - Math.round(5 * s), Math.round(4 * s), Math.round(3 * s))

    // Decorations
    ws.decorations.forEach((deco, i) => {
      this.drawDecoration(deskX, deskY, deco, i, deskW)
    })

    // Person with action system (fallback procedural)
    this.drawPersonWithAction(x + Math.round(9 * s), y + Math.round(30 * s), ws)
  }

  /** Draw workstation furniture only (no person) - used during user whip animation */
  private drawWorkstationFurnitureOnly(ws: Workstation) {
    const { ctx } = this
    const { x, y } = ws

    if (isSpritesReady()) {
      return
    }

    const s = this.personScale
    const deskW = Math.round(52 * s), deskH = Math.round(10 * s)
    const deskX = x - Math.round(2 * s), deskY = y + Math.round(54 * s)

    // Chair (pushed back slightly)
    ctx.fillStyle = SV_PALETTE.chair[0]
    ctx.fillRect(x + Math.round(16 * s), y + Math.round(58 * s), Math.round(18 * s), Math.round(8 * s))
    ctx.fillStyle = SV_PALETTE.chair[1]
    ctx.fillRect(x + Math.round(16 * s), y + Math.round(66 * s), Math.round(20 * s), Math.round(3 * s))
    ctx.fillStyle = '#4a4a4a'
    ctx.fillRect(x + Math.round(24 * s), y + Math.round(69 * s), Math.round(4 * s), Math.round(8 * s))
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(x + Math.round(19 * s), y + Math.round(77 * s), Math.round(14 * s), Math.round(3 * s))

    // Desk
    ctx.fillStyle = SV_PALETTE.deskWood[0]
    ctx.fillRect(deskX, deskY, deskW, deskH)
    ctx.fillStyle = SV_PALETTE.deskWood[1]
    ctx.fillRect(deskX, deskY + deskH - Math.round(3 * s), deskW, Math.round(3 * s))
    ctx.fillStyle = SV_PALETTE.deskWood[2]
    ctx.fillRect(deskX + Math.round(3 * s), deskY + deskH, Math.round(4 * s), Math.round(16 * s))
    ctx.fillRect(deskX + deskW - Math.round(7 * s), deskY + deskH, Math.round(4 * s), Math.round(16 * s))

    // Monitor
    const monX = x + Math.round(12 * s), monY = y + Math.round(20 * s)
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(monX, monY, Math.round(24 * s), Math.round(18 * s))
    ctx.fillStyle = '#4488cc'
    ctx.fillRect(monX + 2, monY + 2, Math.round(24 * s) - 4, Math.round(18 * s) - 4)
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(monX + Math.round(9 * s), monY + Math.round(18 * s), Math.round(6 * s), Math.round(5 * s))
    ctx.fillRect(monX + Math.round(6 * s), monY + Math.round(22 * s), Math.round(12 * s), Math.round(2 * s))

    // Keyboard
    ctx.fillStyle = '#e8e8e0'
    ctx.fillRect(x + Math.round(10 * s), deskY - Math.round(7 * s), Math.round(28 * s), Math.round(6 * s))

    // Decorations
    ws.decorations.forEach((deco, i) => {
      this.drawDecoration(deskX, deskY, deco, i, deskW)
    })
  }

  private drawDecoration(deskX: number, deskY: number, deco: string, index: number, deskW: number) {
    const { ctx } = this
    const ox = index === 0 ? deskX + 2 : deskX + deskW - 10
    const spriteSheet = getSpriteSheet()
    const ready = isSpritesReady()

    // Try sprite-based rendering for known props
    if (ready) {
      let propAnim: AnimationDef | null = null
      switch (deco) {
        case 'plant': propAnim = PROP_PLANT; break
        case 'coffee': propAnim = PROP_COFFEE_CUP; break
        case 'catToy': propAnim = PET_ORANGE_CAT; break
        case 'frame': propAnim = PROP_BOOK; break
        case 'lamp': propAnim = PROP_CLOCK; break
        // others fall through to fillRect
      }
      if (propAnim && propAnim.frames.length > 0) {
        const elapsed = performance.now() - this.startTime
        // 102x128 frames, scale 0.15 → ~15x19px for desk decorations
        spriteSheet.drawAnimation(ctx, propAnim, ox, deskY - 18, elapsed, 0.15)
        // Still draw steam for coffee
        if (deco === 'coffee' && this.frameCount % 20 < 10) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          const steamOff = Math.sin(this.frameCount * 0.16) * 1
          ctx.fillRect(ox + 1 + steamOff, deskY - 14, 1, 2)
        }
        return
      }
    }

    // Fallback: fillRect rendering (Stardew Valley style)
    switch (deco) {
      case 'plant':
        ctx.fillStyle = '#b86840'
        ctx.fillRect(ox, deskY - 6, 6, 5)
        ctx.fillStyle = '#5aaa50'
        ctx.fillRect(ox + 1, deskY - 10, 4, 5)
        ctx.fillStyle = '#6cc060'
        ctx.fillRect(ox + 2, deskY - 12, 2, 3)
        break
      case 'catToy':
        ctx.fillStyle = '#FF8C00'
        ctx.fillRect(ox, deskY - 5, 5, 4)
        ctx.fillRect(ox + 1, deskY - 8, 3, 3)
        ctx.fillStyle = '#FF6600'
        ctx.fillRect(ox + 1, deskY - 9, 1, 1)
        ctx.fillRect(ox + 3, deskY - 9, 1, 1)
        break
      case 'coffee':
        ctx.fillStyle = '#f5f5f5'
        ctx.fillRect(ox, deskY - 6, 5, 5)
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(ox + 1, deskY - 5, 3, 2)
        // Cup handle
        ctx.fillStyle = '#f5f5f5'
        ctx.fillRect(ox + 5, deskY - 4, 2, 3)
        if (this.frameCount % 20 < 10) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          const steamOff = Math.sin(this.frameCount * 0.16) * 1
          ctx.fillRect(ox + 1 + steamOff, deskY - 8, 1, 2)
          ctx.fillRect(ox + 3 - steamOff, deskY - 9, 1, 2)
        }
        break
      case 'frame':
        ctx.fillStyle = '#7a5a28'
        ctx.fillRect(ox, deskY - 8, 7, 7)
        ctx.fillStyle = '#87CEEB'
        ctx.fillRect(ox + 1, deskY - 7, 5, 5)
        break
      case 'lamp':
        ctx.fillStyle = '#555555'
        ctx.fillRect(ox + 2, deskY - 5, 2, 5)
        ctx.fillStyle = '#44aa66'
        ctx.fillRect(ox, deskY - 9, 6, 4)
        // Lamp glow
        ctx.fillStyle = 'rgba(255, 240, 180, 0.1)'
        ctx.fillRect(ox - 2, deskY - 6, 10, 8)
        break
      case 'waterCup':
        ctx.fillStyle = 'rgba(135,206,250,0.8)'
        ctx.fillRect(ox, deskY - 6, 4, 6)
        ctx.fillStyle = 'rgba(200,230,255,0.6)'
        ctx.fillRect(ox + 1, deskY - 4, 2, 3)
        break
      case 'snack':
        ctx.fillStyle = '#ff8844'
        ctx.fillRect(ox, deskY - 5, 6, 4)
        ctx.fillStyle = '#ffcc44'
        ctx.fillRect(ox + 1, deskY - 4, 4, 2)
        break
      case 'figure':
        ctx.fillStyle = index === 0 ? '#FF6347' : '#4a90d9'
        ctx.fillRect(ox + 1, deskY - 8, 4, 5)
        ctx.fillStyle = '#ffdbac'
        ctx.fillRect(ox + 1, deskY - 10, 4, 2)
        break
    }
  }

  // ====== Drawing: Person with Action System (Sprite or Fallback) ======
  private drawPersonWithAction(x: number, y: number, ws: Workstation) {
    const ps = this.personStates.get(ws.name)
    const spriteSheet = getSpriteSheet()
    const ready = isSpritesReady()

    if (ready) {
      // === Sprite-based rendering ===
      // Sprite frames (102x128) contain complete workstation scene (character + desk + monitor)
      // x, y here are ws.x, ws.y (workstation origin)
      const anim = ps ? getAnimForAction(ps.currentAction) : IDLE
      const elapsed = ps ? (performance.now() - ps.animStartTime) : (performance.now() - this.startTime)
      // Scale: apply personScale for dense layouts
      const scale = BASE_SPRITE_SCALE * this.personScale
      const spriteDrawW = 102 * scale
      // Center sprite horizontally in workstation slot (desk area ~48px wide)
      const drawX = x + 24 - spriteDrawW / 2
      const drawY = y
      spriteSheet.drawAnimation(this.ctx, anim, drawX, drawY, elapsed, scale)

      // Draw action effects on top (chat bubble, sweat, sparks)
      if (ps) {
        const hx = x + 24
        const hy = y + 10
        this.drawActionEffects(hx, hy, ps.currentAction, ws)
      }
    } else {
      // === Fallback: procedural fillRect rendering ===
      if (!ps) {
        this.drawPersonFallback(x, y, ws.state, ws.appearance)
        return
      }
      this.drawPersonProcedural(x, y, ws, ps)
    }
  }

  // Procedural person drawing (fallback when sprites not loaded)
  // Stardew Valley style: larger head, rounder, warm colors
  private drawPersonProcedural(x: number, y: number, ws: Workstation, ps: PersonState) {
    const { ctx } = this
    const app = ws.appearance
    const action = ps.currentAction
    const blend = ps.transitionFrame > 0 ? (10 - ps.transitionFrame) / 10 : 1

    // Breathing animation
    const breathPhase = Math.sin(this.frameCount * 0.05 + simpleHash(ws.name) * 0.1) * 0.8
    const breathOffset = Math.round(breathPhase)

    let headOffX = 0, headOffY = 0
    if (action === 'phone') headOffY = 1
    if (action === 'chatting') headOffX = 1
    if (action === 'yawning') headOffY = -1
    if (action === 'stretching') headOffY = -2
    if (action === 'slacking' && (this.frameCount % 90) < 8) headOffX = -2
    headOffX = Math.round(headOffX * blend)
    headOffY = Math.round(headOffY * blend)

    const hx = x + 3 + headOffX
    const hy = y + headOffY + breathOffset

    // === Shadow under character ===
    ctx.fillStyle = 'rgba(60, 40, 20, 0.12)'
    ctx.fillRect(hx + 2, hy + 28, 12, 2)

    // === Hair (Y=0~4) ===
    ctx.fillStyle = app.hairColor
    const hairDark = this.darkenColor(app.hairColor, 0.7)
    switch (app.hairStyle) {
      case 'short':
        ctx.fillRect(hx + 2, hy, 12, 3)
        ctx.fillRect(hx + 3, hy + 3, 10, 2)
        // Shadow layer
        ctx.fillStyle = hairDark
        ctx.fillRect(hx + 3, hy + 4, 10, 1)
        break
      case 'medium':
        ctx.fillStyle = app.hairColor
        ctx.fillRect(hx + 1, hy - 1, 14, 4)
        ctx.fillRect(hx + 2, hy + 3, 12, 2)
        ctx.fillStyle = hairDark
        ctx.fillRect(hx + 2, hy + 4, 12, 1)
        break
      case 'long':
        ctx.fillStyle = app.hairColor
        ctx.fillRect(hx + 1, hy - 1, 14, 4)
        ctx.fillRect(hx + 1, hy + 3, 3, 9)
        ctx.fillRect(hx + 12, hy + 3, 3, 9)
        ctx.fillRect(hx + 2, hy + 3, 12, 2)
        ctx.fillStyle = hairDark
        ctx.fillRect(hx + 1, hy + 10, 3, 2)
        ctx.fillRect(hx + 12, hy + 10, 3, 2)
        break
      case 'bun':
        ctx.fillStyle = app.hairColor
        ctx.fillRect(hx + 2, hy, 12, 3)
        ctx.fillRect(hx + 5, hy - 3, 6, 4)
        ctx.fillRect(hx + 3, hy + 3, 10, 2)
        ctx.fillStyle = hairDark
        ctx.fillRect(hx + 6, hy - 2, 4, 2)
        break
      case 'spiky':
        ctx.fillStyle = app.hairColor
        ctx.fillRect(hx + 2, hy + 1, 12, 3)
        // Spikes
        ctx.fillRect(hx + 3, hy - 2, 2, 3)
        ctx.fillRect(hx + 6, hy - 3, 2, 4)
        ctx.fillRect(hx + 9, hy - 2, 2, 3)
        ctx.fillRect(hx + 12, hy - 1, 2, 2)
        ctx.fillStyle = hairDark
        ctx.fillRect(hx + 3, hy + 3, 10, 1)
        break
      case 'curly':
        ctx.fillStyle = app.hairColor
        ctx.fillRect(hx + 1, hy - 1, 14, 4)
        ctx.fillRect(hx + 2, hy + 3, 12, 2)
        // Curly bumps
        ctx.fillRect(hx, hy + 1, 2, 3)
        ctx.fillRect(hx + 14, hy + 1, 2, 3)
        ctx.fillRect(hx + 1, hy + 4, 2, 3)
        ctx.fillRect(hx + 13, hy + 4, 2, 3)
        ctx.fillStyle = hairDark
        ctx.fillRect(hx + 2, hy + 4, 12, 1)
        break
    }

    // Cap accessory (drawn over hair)
    if (app.accessory === 'cap') {
      ctx.fillStyle = '#cc3333'
      ctx.fillRect(hx + 1, hy - 1, 14, 3)
      ctx.fillRect(hx + 12, hy, 5, 2) // brim
      ctx.fillStyle = '#aa2222'
      ctx.fillRect(hx + 2, hy + 1, 12, 1)
    }

    // === Face (Y=4~11, 8px high, 10px wide) ===
    ctx.fillStyle = app.skinTone
    ctx.fillRect(hx + 3, hy + 5, 10, 8)
    // Ears
    ctx.fillRect(hx + 2, hy + 7, 1, 3)
    ctx.fillRect(hx + 13, hy + 7, 1, 3)

    // Headphones accessory
    if (app.accessory === 'headphones') {
      ctx.fillStyle = '#444444'
      ctx.fillRect(hx + 1, hy + 6, 2, 4)
      ctx.fillRect(hx + 13, hy + 6, 2, 4)
      ctx.fillStyle = '#666666'
      ctx.fillRect(hx + 2, hy + 3, 12, 2)
    }

    // Blush / Cheeks (subtle pink)
    ctx.fillStyle = 'rgba(255, 130, 130, 0.25)'
    ctx.fillRect(hx + 3, hy + 10, 2, 2)
    ctx.fillRect(hx + 11, hy + 10, 2, 2)

    // Eyebrows (expressive based on state)
    ctx.fillStyle = this.darkenColor(app.hairColor, 0.6)
    if (action === 'scratching' || ws.state === 'anxious' || ws.state === 'crazy') {
      // Furrowed brows (angled inward)
      ctx.fillRect(hx + 4, hy + 7, 3, 1)
      ctx.fillRect(hx + 5, hy + 6, 2, 1)
      ctx.fillRect(hx + 9, hy + 7, 3, 1)
      ctx.fillRect(hx + 9, hy + 6, 2, 1)
    } else if (ws.state === 'collapse') {
      // Drooping brows
      ctx.fillRect(hx + 4, hy + 7, 3, 1)
      ctx.fillRect(hx + 4, hy + 6, 1, 1)
      ctx.fillRect(hx + 9, hy + 7, 3, 1)
      ctx.fillRect(hx + 11, hy + 6, 1, 1)
    } else if (ws.state === 'idle' || ws.state === 'relaxed') {
      // Relaxed brows (slightly raised)
      ctx.fillRect(hx + 4, hy + 6, 3, 1)
      ctx.fillRect(hx + 9, hy + 6, 3, 1)
    } else {
      // Normal brows
      ctx.fillRect(hx + 4, hy + 6, 3, 1)
      ctx.fillRect(hx + 9, hy + 6, 3, 1)
    }

    // Eyes (Stardew Valley style - large and expressive)
    const blink = this.frameCount % 180 < 5
    if (action === 'yawning') {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 4, hy + 8, 3, 1)
      ctx.fillRect(hx + 9, hy + 8, 3, 1)
    } else if (action === 'phone') {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 4, hy + 9, 3, 2)
      ctx.fillRect(hx + 9, hy + 9, 3, 2)
    } else if (blink) {
      ctx.fillStyle = app.skinTone
      ctx.fillRect(hx + 4, hy + 7, 3, 3)
      ctx.fillRect(hx + 9, hy + 7, 3, 3)
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 4, hy + 8, 3, 1)
      ctx.fillRect(hx + 9, hy + 8, 3, 1)
    } else {
      // Eye whites
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(hx + 4, hy + 7, 3, 3)
      ctx.fillRect(hx + 9, hy + 7, 3, 3)
      // Pupils
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(hx + 5, hy + 8, 2, 2)
      ctx.fillRect(hx + 10, hy + 8, 2, 2)
      // Pupil highlight
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(hx + 5, hy + 7, 1, 1)
      ctx.fillRect(hx + 10, hy + 7, 1, 1)
    }

    // Glasses accessory
    if (app.accessory === 'glasses') {
      ctx.fillStyle = '#333333'
      ctx.fillRect(hx + 3, hy + 7, 5, 3) // left frame
      ctx.fillRect(hx + 8, hy + 7, 5, 3) // right frame
      ctx.fillRect(hx + 7, hy + 8, 2, 1) // bridge
      ctx.fillStyle = 'rgba(100,180,255,0.3)'
      ctx.fillRect(hx + 4, hy + 8, 3, 1) // left lens
      ctx.fillRect(hx + 9, hy + 8, 3, 1) // right lens
    }

    // Mouth (action & state dependent, more expressive)
    if (action === 'yawning') {
      const mouthOpen = this.frameCount % 16 < 8
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 5, hy + 11, 5, mouthOpen ? 2 : 1)
      if (mouthOpen) {
        ctx.fillStyle = '#cc4444'
        ctx.fillRect(hx + 6, hy + 12, 3, 1)
      }
    } else if (action === 'chatting') {
      const mouthOpen = this.frameCount % 10 < 5
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 5, hy + 11, 4, mouthOpen ? 2 : 1)
    } else if (action === 'slacking') {
      // Happy smile
      ctx.fillStyle = '#cc7755'
      ctx.fillRect(hx + 5, hy + 11, 5, 1)
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 4, hy + 11, 1, 1)
      ctx.fillRect(hx + 10, hy + 11, 1, 1)
    } else if (ws.state === 'idle' || ws.state === 'relaxed') {
      // Gentle smile
      ctx.fillStyle = '#cc7755'
      ctx.fillRect(hx + 5, hy + 11, 4, 1)
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 4, hy + 11, 1, 1)
      ctx.fillRect(hx + 9, hy + 11, 1, 1)
    } else if (ws.state === 'anxious' || ws.state === 'crazy') {
      // Stressed wavy mouth
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 5, hy + 11, 5, 1)
      ctx.fillRect(hx + 6, hy + 10, 1, 1)
      ctx.fillRect(hx + 8, hy + 12, 1, 1)
    } else if (ws.state === 'collapse') {
      // Frown
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 5, hy + 12, 5, 1)
      ctx.fillRect(hx + 4, hy + 11, 1, 1)
      ctx.fillRect(hx + 10, hy + 11, 1, 1)
    } else {
      // Normal neutral mouth
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 6, hy + 11, 3, 1)
    }

    // === Neck (Y=12, 1px) ===
    ctx.fillStyle = app.skinTone
    ctx.fillRect(hx + 6, hy + 13, 4, 1)

    // === Shoulders + Body (Y=13~21, 9px high) ===
    ctx.fillStyle = app.shirtColor
    // Shoulders (wider than body)
    ctx.fillRect(hx + 1, hy + 14, 14, 3)
    // Body
    ctx.fillRect(hx + 2, hy + 17, 12, 5)
    // Shirt shadow at bottom
    const shirtDark = this.darkenColor(app.shirtColor, 0.75)
    ctx.fillStyle = shirtDark
    ctx.fillRect(hx + 2, hy + 20, 12, 2)
    ctx.fillRect(hx + 1, hy + 16, 1, 1) // shoulder edge shadow
    ctx.fillRect(hx + 14, hy + 16, 1, 1)

    // Collar detail
    ctx.fillStyle = app.skinTone
    ctx.fillRect(hx + 6, hy + 14, 4, 1)

    // Shirt detail (based on hash)
    const detailHash = simpleHash(ws.name) % 4
    if (detailHash === 0) {
      // Pocket
      ctx.fillStyle = shirtDark
      ctx.fillRect(hx + 9, hy + 17, 4, 3)
      ctx.fillStyle = app.shirtColor
      ctx.fillRect(hx + 10, hy + 17, 2, 2)
    } else if (detailHash === 1) {
      // Buttons
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(hx + 7, hy + 15, 1, 1)
      ctx.fillRect(hx + 7, hy + 17, 1, 1)
      ctx.fillRect(hx + 7, hy + 19, 1, 1)
    } else if (detailHash === 2) {
      // Logo
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(hx + 4, hy + 16, 3, 2)
    }

    // Arms
    this.drawArmsForAction(hx, hy, action, app, ps)

    // === Pants (Y=22~25, 4px) ===
    ctx.fillStyle = app.pantsColor
    ctx.fillRect(hx + 3, hy + 22, 10, 4)
    // Belt
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(hx + 4, hy + 22, 8, 1)
    // Belt buckle
    ctx.fillStyle = '#888888'
    ctx.fillRect(hx + 7, hy + 22, 2, 1)

    // === Shoes (Y=26~28, 3px) ===
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(hx + 3, hy + 26, 4, 3)
    ctx.fillRect(hx + 9, hy + 26, 4, 3)
    // Shoe sole
    ctx.fillStyle = '#333333'
    ctx.fillRect(hx + 3, hy + 28, 4, 1)
    ctx.fillRect(hx + 9, hy + 28, 4, 1)
    // Shoe highlight
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(hx + 3, hy + 26, 3, 1)
    ctx.fillRect(hx + 9, hy + 26, 3, 1)

    // Action effects
    this.drawActionEffects(hx, hy, action, ws)
  }

  // Helper to darken a hex color
  private darkenColor(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`
  }

  private drawArmsForAction(hx: number, hy: number, action: PersonAction, app: PersonAppearance, ps: PersonState) {
    const { ctx } = this
    ctx.fillStyle = app.skinTone
    // Arms positioned relative to shoulders (shoulders at hy+14, body hy+14 to hy+22)

    switch (action) {
      case 'typing': {
        const handOffset = Math.sin(this.frameCount * 0.3) > 0 ? 1 : 0
        // Upper arm (shirt color)
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 2, hy + 15, 3, 4)
        ctx.fillRect(hx + 15, hy + 15, 3, 4)
        // Hands on keyboard
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 1 + handOffset, hy + 19, 3, 2)
        ctx.fillRect(hx + 14 - handOffset, hy + 19, 3, 2)
        break
      }
      case 'typing_fast': {
        const handOff = Math.sin(this.frameCount * 0.6) > 0 ? 2 : 0
        const handOff2 = Math.cos(this.frameCount * 0.6) > 0 ? 2 : 0
        const handBounce = Math.abs(Math.sin(this.frameCount * 0.8)) > 0.5 ? -1 : 0
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 2, hy + 15, 3, 3)
        ctx.fillRect(hx + 15, hy + 15, 3, 3)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 1 + handOff, hy + 18 + handBounce, 3, 2)
        ctx.fillRect(hx + 14 - handOff2, hy + 18 + handBounce, 3, 2)
        break
      }
      case 'stretching': {
        const progress = Math.min(ps.actionTimer / 20, 1)
        const armY = hy + 15 - Math.round(progress * 14)
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 2, armY, 3, 5)
        ctx.fillRect(hx + 15, armY, 3, 5)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 2, armY - 2, 3, 3)
        ctx.fillRect(hx + 15, armY - 2, 3, 3)
        break
      }
      case 'drinking': {
        const cupPhase = Math.min(ps.actionTimer / 30, 1)
        const cupY = hy + 18 - Math.round(cupPhase * 12)
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 2, hy + 15, 3, 4)
        ctx.fillRect(hx + 15, hy + 15, 3, 3)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 1, hy + 19, 3, 2)
        ctx.fillRect(hx + 15, cupY, 3, 3)
        // Coffee cup
        ctx.fillStyle = '#D2691E'
        ctx.fillRect(hx + 17, cupY - 2, 4, 5)
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(hx + 21, cupY, 2, 3)
        // Steam when cup is up
        if (cupPhase > 0.5 && this.frameCount % 12 < 8) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)'
          const steamOff = Math.sin(this.frameCount * 0.15) * 1
          ctx.fillRect(hx + 18 + steamOff, cupY - 4, 1, 2)
          ctx.fillRect(hx + 20 - steamOff, cupY - 5, 1, 2)
          if (this.frameCount % 12 < 4) {
            ctx.fillRect(hx + 19, cupY - 6, 1, 1)
          }
        }
        break
      }
      case 'scratching': {
        const scratchOff = Math.sin(this.frameCount * 0.4) * 2
        // One hand on head
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx + 4, hy + 2, 3, 4)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx + 4 + scratchOff, hy, 3, 3)
        // Other hand down
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 2, hy + 15, 3, 4)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 1, hy + 19, 3, 2)
        break
      }
      case 'phone': {
        // Both hands holding phone in lap
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx + 3, hy + 17, 3, 3)
        ctx.fillRect(hx + 10, hy + 17, 3, 3)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx + 4, hy + 20, 3, 2)
        ctx.fillRect(hx + 9, hy + 20, 3, 2)
        // Phone
        ctx.fillStyle = '#222222'
        ctx.fillRect(hx + 5, hy + 19, 5, 6)
        ctx.fillStyle = '#4488ff'
        ctx.fillRect(hx + 6, hy + 20, 3, 4)
        break
      }
      case 'chatting': {
        const gestFrame = Math.sin(this.frameCount * 0.2) * 2
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx + 15, hy + 13 + gestFrame, 3, 4)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx + 15, hy + 11 + gestFrame, 3, 3)
        // Other arm resting
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 2, hy + 15, 3, 4)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 1, hy + 19, 3, 2)
        break
      }
      case 'yawning': {
        // Hand covering mouth
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx + 4, hy + 8, 3, 4)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx + 5, hy + 10, 4, 3)
        // Other hand down
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 2, hy + 15, 3, 4)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 1, hy + 19, 3, 2)
        break
      }
      case 'slacking': {
        const lookBack = (this.frameCount % 90) < 8
        ctx.fillStyle = app.shirtColor
        if (lookBack) {
          ctx.fillRect(hx - 2, hy + 14, 3, 4)
          ctx.fillRect(hx + 15, hy + 14, 3, 4)
        } else {
          ctx.fillRect(hx - 2, hy + 15, 3, 4)
          ctx.fillRect(hx + 15, hy + 15, 3, 4)
        }
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 1, hy + 19, 3, 2)
        ctx.fillRect(hx + 15, hy + 19, 3, 2)
        break
      }
      case 'standing':
      default: {
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 1, hy + 15, 3, 5)
        ctx.fillRect(hx + 14, hy + 15, 3, 5)
        ctx.fillStyle = app.skinTone
        ctx.fillRect(hx - 1, hy + 20, 3, 2)
        ctx.fillRect(hx + 14, hy + 20, 3, 2)
        break
      }
    }
  }

  private drawActionEffects(hx: number, hy: number, action: PersonAction, ws: Workstation) {
    const { ctx } = this

    if (action === 'chatting') {
      // Chat bubble (HTML rendered)
      this.addCanvasBubble(hx + 18, hy - 6, '...', 'thought', '#666666', 30)
    }

    if (ws.state === 'anxious' && this.frameCount % 23 < 15) {
      ctx.fillStyle = '#66ccff'
      ctx.fillRect(hx + 14, hy + 4, 2, 3)
    }
    if (ws.state === 'crazy' && this.frameCount % 10 < 8) {
      ctx.fillStyle = 'rgba(150,150,150,0.6)'
      const oy = Math.sin(this.frameCount / 5) * 1
      ctx.fillRect(hx + 2, hy - 4 + oy, 3, 3)
      ctx.fillRect(hx + 10, hy - 5 + oy, 2, 2)
    }
    if (ws.state === 'collapse') {
      ctx.fillStyle = 'rgba(100,100,100,0.4)'
      ctx.fillRect(hx - 1, hy - 2, 18, 1)
    }

    if (action === 'typing_fast' && this.frameCount % 6 < 2) {
      ctx.fillStyle = 'rgba(255,255,100,0.5)'
      ctx.fillRect(hx + 2 + (this.frameCount % 6) * 2, hy + 23, 3, 1)
    }

    // Screen code characters for typing
    if ((action === 'typing' || action === 'typing_fast') && this.frameCount % 4 < 2) {
      ctx.fillStyle = 'rgba(0,255,136,0.3)'
      const sparkX = hx + 3 + Math.floor(Math.random() * 10)
      ctx.fillRect(sparkX, hy - 8, 1, 1)
    }
  }

  // Fallback person (Stardew Valley style) - for edge cases without PersonState
  private drawPersonFallback(x: number, y: number, state: ProgrammerState, app: PersonAppearance) {
    const { ctx } = this
    let bodyOffY = 0
    if (state === 'relaxed') bodyOffY = -1
    if (state === 'anxious') bodyOffY = 1

    // Breathing
    const breathPhase = Math.sin(this.frameCount * 0.05) * 0.8
    const breathOffset = Math.round(breathPhase)

    const hx = x + 3
    const hy = y + bodyOffY + breathOffset

    // Shadow
    ctx.fillStyle = 'rgba(60, 40, 20, 0.12)'
    ctx.fillRect(hx + 2, hy + 28, 12, 2)

    // Hair (5px high)
    ctx.fillStyle = app.hairColor
    switch (app.hairStyle) {
      case 'short':
        ctx.fillRect(hx + 2, hy, 12, 3)
        ctx.fillRect(hx + 3, hy + 3, 10, 2)
        break
      case 'medium':
        ctx.fillRect(hx + 1, hy - 1, 14, 4)
        ctx.fillRect(hx + 2, hy + 3, 12, 2)
        break
      case 'long':
        ctx.fillRect(hx + 1, hy - 1, 14, 4)
        ctx.fillRect(hx + 1, hy + 3, 3, 9)
        ctx.fillRect(hx + 12, hy + 3, 3, 9)
        break
      case 'bun':
        ctx.fillRect(hx + 2, hy, 12, 3)
        ctx.fillRect(hx + 5, hy - 3, 6, 4)
        ctx.fillRect(hx + 3, hy + 3, 10, 2)
        break
      case 'spiky':
        ctx.fillRect(hx + 2, hy + 1, 12, 3)
        ctx.fillRect(hx + 3, hy - 2, 2, 3)
        ctx.fillRect(hx + 6, hy - 3, 2, 4)
        ctx.fillRect(hx + 9, hy - 2, 2, 3)
        ctx.fillRect(hx + 12, hy - 1, 2, 2)
        break
      case 'curly':
        ctx.fillRect(hx + 1, hy - 1, 14, 4)
        ctx.fillRect(hx + 2, hy + 3, 12, 2)
        ctx.fillRect(hx, hy + 1, 2, 3)
        ctx.fillRect(hx + 14, hy + 1, 2, 3)
        break
    }

    // Cap
    if (app.accessory === 'cap') {
      ctx.fillStyle = '#cc3333'
      ctx.fillRect(hx + 1, hy - 1, 14, 3)
      ctx.fillRect(hx + 12, hy, 5, 2)
    }

    // Face (8px high, 10px wide)
    ctx.fillStyle = app.skinTone
    ctx.fillRect(hx + 3, hy + 5, 10, 8)
    // Ears
    ctx.fillRect(hx + 2, hy + 7, 1, 3)
    ctx.fillRect(hx + 13, hy + 7, 1, 3)

    // Blush / Cheeks (subtle pink)
    ctx.fillStyle = 'rgba(255, 130, 130, 0.25)'
    ctx.fillRect(hx + 3, hy + 10, 2, 2)
    ctx.fillRect(hx + 11, hy + 10, 2, 2)

    // Headphones
    if (app.accessory === 'headphones') {
      ctx.fillStyle = '#444444'
      ctx.fillRect(hx + 1, hy + 6, 2, 4)
      ctx.fillRect(hx + 13, hy + 6, 2, 4)
      ctx.fillStyle = '#666666'
      ctx.fillRect(hx + 2, hy + 3, 12, 2)
    }

    // Eyebrows (expressive based on state)
    ctx.fillStyle = this.darkenColor(app.hairColor, 0.6)
    if (state === 'anxious' || state === 'crazy') {
      // Furrowed brows
      ctx.fillRect(hx + 4, hy + 7, 3, 1)
      ctx.fillRect(hx + 5, hy + 6, 2, 1)
      ctx.fillRect(hx + 9, hy + 7, 3, 1)
      ctx.fillRect(hx + 9, hy + 6, 2, 1)
    } else if (state === 'collapse') {
      // Drooping brows
      ctx.fillRect(hx + 4, hy + 7, 3, 1)
      ctx.fillRect(hx + 4, hy + 6, 1, 1)
      ctx.fillRect(hx + 9, hy + 7, 3, 1)
      ctx.fillRect(hx + 11, hy + 6, 1, 1)
    } else {
      // Normal brows
      ctx.fillRect(hx + 4, hy + 6, 3, 1)
      ctx.fillRect(hx + 9, hy + 6, 3, 1)
    }

    // Eyes (Stardew Valley style with blinking)
    const blink = this.frameCount % 180 < 5
    if (blink) {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 4, hy + 8, 3, 1)
      ctx.fillRect(hx + 9, hy + 8, 3, 1)
    } else {
      // Eye whites
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(hx + 4, hy + 7, 3, 3)
      ctx.fillRect(hx + 9, hy + 7, 3, 3)
      // Pupils
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(hx + 5, hy + 8, 2, 2)
      ctx.fillRect(hx + 10, hy + 8, 2, 2)
      // Pupil highlight
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(hx + 5, hy + 7, 1, 1)
      ctx.fillRect(hx + 10, hy + 7, 1, 1)
    }

    // Glasses
    if (app.accessory === 'glasses') {
      ctx.fillStyle = '#333333'
      ctx.fillRect(hx + 3, hy + 7, 5, 3)
      ctx.fillRect(hx + 8, hy + 7, 5, 3)
      ctx.fillRect(hx + 7, hy + 8, 2, 1)
    }

    // Mouth (state-dependent, more expressive)
    if (state === 'idle' || state === 'relaxed') {
      // Gentle smile
      ctx.fillStyle = '#cc7755'
      ctx.fillRect(hx + 5, hy + 11, 4, 1)
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 4, hy + 11, 1, 1)
      ctx.fillRect(hx + 9, hy + 11, 1, 1)
    } else if (state === 'anxious' || state === 'crazy') {
      // Stressed wavy mouth
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 5, hy + 11, 5, 1)
      ctx.fillRect(hx + 6, hy + 10, 1, 1)
      ctx.fillRect(hx + 8, hy + 12, 1, 1)
    } else if (state === 'collapse') {
      // Frown
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 5, hy + 12, 5, 1)
      ctx.fillRect(hx + 4, hy + 11, 1, 1)
      ctx.fillRect(hx + 10, hy + 11, 1, 1)
    } else {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(hx + 6, hy + 11, 3, 1)
    }

    // Neck
    ctx.fillStyle = app.skinTone
    ctx.fillRect(hx + 6, hy + 13, 4, 1)

    // Body
    ctx.fillStyle = app.shirtColor
    ctx.fillRect(hx + 1, hy + 14, 14, 3)
    ctx.fillRect(hx + 2, hy + 17, 12, 5)
    // Collar detail
    ctx.fillStyle = app.skinTone
    ctx.fillRect(hx + 6, hy + 14, 4, 1)
    // Shirt shadow at bottom
    const shirtDarkFB = this.darkenColor(app.shirtColor, 0.75)
    ctx.fillStyle = shirtDarkFB
    ctx.fillRect(hx + 2, hy + 20, 12, 2)

    // Arms
    ctx.fillStyle = app.shirtColor
    ctx.fillRect(hx - 1, hy + 15, 3, 5)
    ctx.fillRect(hx + 14, hy + 15, 3, 5)
    ctx.fillStyle = app.skinTone
    ctx.fillRect(hx - 1, hy + 20, 3, 2)
    ctx.fillRect(hx + 14, hy + 20, 3, 2)

    // Pants
    ctx.fillStyle = app.pantsColor
    ctx.fillRect(hx + 3, hy + 22, 10, 4)
    // Belt
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(hx + 4, hy + 22, 8, 1)
    // Belt buckle
    ctx.fillStyle = '#888888'
    ctx.fillRect(hx + 7, hy + 22, 2, 1)

    // Shoes
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(hx + 3, hy + 26, 4, 3)
    ctx.fillRect(hx + 9, hy + 26, 4, 3)
    // Shoe sole
    ctx.fillStyle = '#333333'
    ctx.fillRect(hx + 3, hy + 28, 4, 1)
    ctx.fillRect(hx + 9, hy + 28, 4, 1)
    // Shoe highlight
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(hx + 3, hy + 26, 3, 1)
    ctx.fillRect(hx + 9, hy + 26, 3, 1)
  }

  // ====== Public: Label Position for HTML overlay ======
  getMemberLabelPosition(index: number): { x: number; y: number } | null {
    if (index >= this.workstations.length) return null
    // Hide label for members who have left (off-work)
    if (this.isMemberAway(index)) return null
    const ws = this.workstations[index]
    return { x: ws.x + 24, y: ws.y - 10 }
  }

  getDisplayMembers(): TeamMemberData[] {
    return this.displayMembers
  }

  // ====== Public: Click Detection ======
  getMemberAtPosition(x: number, y: number): number {
    for (let i = 0; i < this.workstations.length; i++) {
      const ws = this.workstations[i]
      // Check if click is within the workstation area (desk+person region)
      if (x >= ws.x - 5 && x <= ws.x + 52 &&
          y >= ws.y && y <= ws.y + 85) {
        // Cannot click yourself
        if (this.displayMembers[i]?.isCurrentUser) return -1
        return i
      }
    }
    return -1
  }

  // ====== Public: Trigger User Whip Animation ======
  triggerUserWhip(targetIndex: number) {
    if (this.userWhip.active) return // already in progress
    if (this.boss.active) return // boss is active, don't interfere

    // Find current user's index
    const currentUserIdx = this.displayMembers.findIndex(m => m.isCurrentUser)
    if (currentUserIdx < 0) return
    if (targetIndex >= this.workstations.length) return

    const currentWs = this.workstations[currentUserIdx]
    const phrases = [
      '别摸鱼了！',
      '你的Bug都生孩子了！',
      '996福报！',
      '还不修Bug？！',
      '我数三声！',
      '醒醒！上班了！',
      'Bug不修完不准走！',
      '鞭策一下！',
    ]

    this.userWhip = {
      active: true,
      phase: 'standing',
      currentUserIndex: currentUserIdx,
      targetIndex: targetIndex,
      originX: currentWs.x + 24,
      originY: currentWs.y + 50,
      x: currentWs.x + 24,
      y: currentWs.y + 50,
      frame: 0,
      whipCount: 0,
      speechText: phrases[Math.floor(Math.random() * phrases.length)],
      targetScaredTimer: 0,
    }
  }

  /** Check if a workstation index is currently walking out (user whip) */
  isUserWhipActive(): boolean {
    return this.userWhip.active
  }

  // ====== Public: Feed System ======
  triggerFeedMember(targetIndex: number, feedType: FeedType): void {
    if (this.userWhip.active || this.feedState.active) return
    if (this.boss.active) return

    const currentUserIdx = this.displayMembers.findIndex(m => m.isCurrentUser)
    if (currentUserIdx < 0) return
    if (targetIndex >= this.workstations.length) return

    const currentWs = this.workstations[currentUserIdx]

    this.feedState = {
      active: true,
      phase: 'walking',
      targetIndex,
      feedType,
      x: currentWs.x + 24,
      y: currentWs.y + 50,
      originX: currentWs.x + 24,
      originY: currentWs.y + 50,
      frame: 0,
      currentUserIndex: currentUserIdx,
    }
  }

  // ====== Public: Cat Interaction ======
  getCatPosition(): { x: number; y: number } | null {
    return { x: this.cat.x, y: this.cat.y }
  }

  triggerPetCat(): void {
    if (this.catInteraction.active && this.catInteraction.phase !== 'happy') return

    this.catInteraction.mood += 10

    if (this.catInteraction.mood > 80) {
      // cat is over-petted, run away
      this.catInteraction = { active: true, phase: 'runaway', frame: 0, mood: 0 }
    } else {
      this.catInteraction = { active: true, phase: 'petting', frame: 0, mood: this.catInteraction.mood }
    }
  }

  // ====== Public: Achievement Unlock Effect ======
  triggerAchievementUnlock(name: string): void {
    this.achievementPopup = { name, frame: 0, duration: 180 }
  }

  // ====== Cat (Sprite or Fallback) ======
  private updateCat() {
    const cat = this.cat
    cat.stateTimer++

    if (cat.state === 'walking') {
      const speed = 0.5
      if (Math.abs(cat.x - cat.targetX) > 1) {
        cat.x += cat.x < cat.targetX ? speed : -speed
        cat.direction = cat.x < cat.targetX ? 'right' : 'left'
      } else {
        const r = Math.random()
        if (r < 0.3) cat.state = 'sitting'
        else if (r < 0.55) cat.state = 'sleeping'
        else if (r < 0.75) cat.state = 'playing'
        else cat.state = 'stretching'
        cat.stateTimer = 0
      }
      cat.frame = Math.floor(this.frameCount / 6) % 2
    } else if (cat.state === 'sitting') {
      cat.frame = Math.floor(this.frameCount / 10) % 2
      if (cat.stateTimer > 50) this.catNewTarget()
    } else if (cat.state === 'sleeping') {
      if (cat.stateTimer > 90) this.catNewTarget()
    } else if (cat.state === 'playing') {
      cat.yarnBallX += (cat.direction === 'right' ? 0.8 : -0.8)
      if (Math.abs(cat.x - cat.yarnBallX) > 3) {
        cat.x += cat.x < cat.yarnBallX ? 0.7 : -0.7
        cat.direction = cat.x < cat.yarnBallX ? 'right' : 'left'
      }
      cat.frame = Math.floor(this.frameCount / 4) % 2
      if (cat.stateTimer > 60 || cat.yarnBallX > CANVAS_W - 60 || cat.yarnBallX < 40) {
        this.catNewTarget()
      }
    } else if (cat.state === 'stretching') {
      cat.frame = Math.floor(this.frameCount / 8) % 2
      if (cat.stateTimer > 30) this.catNewTarget()
    }
  }

  private catNewTarget() {
    this.cat.state = 'walking'
    this.cat.targetX = 40 + Math.random() * (CANVAS_W - 120)
    this.cat.y = this.floorTop + 20 + Math.random() * 20
    this.cat.stateTimer = 0
    this.cat.yarnBallX = this.cat.x + (Math.random() > 0.5 ? 30 : -30)
    this.cat.yarnBallY = this.cat.y + 5
  }

  private drawCat() {
    const { ctx } = this
    const { x, y, state, direction } = this.cat
    const spriteSheet = getSpriteSheet()
    const ready = isSpritesReady()

    if (ready) {
      // Use sprite sheet for cat - 102x128 frames, scale 0.2 → ~20x26px
      const elapsed = performance.now() - this.startTime
      const catScale = 0.2
      ctx.save()
      if (direction === 'left') {
        ctx.translate(x + 16, 0)
        ctx.scale(-1, 1)
        spriteSheet.drawAnimation(ctx, PET_ORANGE_CAT, 0, y - 10, elapsed, catScale)
      } else {
        spriteSheet.drawAnimation(ctx, PET_ORANGE_CAT, x, y - 10, elapsed, catScale)
      }
      ctx.restore()
    } else {
      // Fallback procedural cat
      ctx.save()
      if (direction === 'left') {
        ctx.translate(x + 14, 0)
        ctx.scale(-1, 1)
        this.drawCatBody(0, y, state, this.cat.frame)
      } else {
        this.drawCatBody(x, y, state, this.cat.frame)
      }
      ctx.restore()
    }

    // Draw yarn ball if playing
    if (state === 'playing') {
      ctx.fillStyle = '#ff4444'
      const bx = this.cat.yarnBallX
      const by = this.cat.yarnBallY
      ctx.fillRect(bx, by, 4, 4)
      ctx.fillStyle = '#cc0000'
      ctx.fillRect(bx + 1, by + 1, 2, 2)
      ctx.fillStyle = 'rgba(255,100,100,0.4)'
      ctx.fillRect(bx - 3, by + 2, 3, 1)
    }
  }

  private drawCatBody(x: number, y: number, state: string, frame: number) {
    const { ctx } = this
    // Stardew Valley style orange tabby cat
    ctx.fillStyle = '#f0a030'
    if (state === 'walking' || state === 'playing') {
      ctx.fillRect(x + 2, y, 10, 6)
      ctx.fillRect(x + 10, y - 2, 5, 5)
      // Ears
      ctx.fillStyle = '#e09020'
      ctx.fillRect(x + 11, y - 3, 2, 1)
      ctx.fillRect(x + 14, y - 3, 2, 1)
      // Tabby stripes
      ctx.fillStyle = '#cc8020'
      ctx.fillRect(x + 4, y + 1, 2, 3)
      ctx.fillRect(x + 7, y + 1, 2, 3)
      // Legs (animated)
      ctx.fillStyle = '#e09020'
      if (frame === 0) {
        ctx.fillRect(x + 3, y + 6, 2, 3)
        ctx.fillRect(x + 9, y + 6, 2, 3)
      } else {
        ctx.fillRect(x + 5, y + 6, 2, 3)
        ctx.fillRect(x + 7, y + 6, 2, 3)
      }
      // Tail
      ctx.fillStyle = '#f0a030'
      ctx.fillRect(x, y - 1, 2, 3)
      ctx.fillRect(x - 1, y - 2, 2, 2)
    } else if (state === 'sitting') {
      ctx.fillRect(x + 2, y, 8, 7)
      ctx.fillRect(x + 8, y - 2, 5, 5)
      ctx.fillStyle = '#e09020'
      ctx.fillRect(x + 9, y - 3, 1, 1)
      ctx.fillRect(x + 12, y - 3, 1, 1)
      // Tail curled
      ctx.fillStyle = '#f0a030'
      ctx.fillRect(x, y + 3, 3, 2)
    } else if (state === 'stretching') {
      ctx.fillRect(x + 2, y - 1, 10, 5)
      ctx.fillRect(x + 10, y - 3, 5, 4)
      ctx.fillStyle = '#e09020'
      ctx.fillRect(x + 11, y - 4, 2, 1)
      ctx.fillRect(x + 14, y - 4, 2, 1)
      ctx.fillStyle = '#cc8020'
      ctx.fillRect(x + 2, y + 4, 2, 4)
      ctx.fillRect(x + 10, y + 4, 2, 3)
      ctx.fillStyle = '#f0a030'
      ctx.fillRect(x - 1, y - 3, 2, 3)
      ctx.fillRect(x - 2, y - 4, 2, 2)
    } else {
      // sleeping (curled up)
      ctx.fillRect(x + 2, y + 2, 10, 5)
      ctx.fillRect(x + 3, y + 1, 8, 2)
      ctx.fillStyle = '#cc8020'
      ctx.fillRect(x + 8, y + 4, 4, 2)
      // Z z z
      if (this.frameCount % 30 < 20) {
        ctx.fillStyle = 'rgba(100,100,100,0.5)'
        ctx.font = '7px monospace'
        ctx.fillText('z', x + 12, y - 1)
        if (this.frameCount % 30 < 13) ctx.fillText('z', x + 15, y - 4)
      }
    }
  }

  // ====== Boss (procedural - no dedicated sprite) ======
  private updateBoss() {
    if (!this.boss.active) return
    const b = this.boss
    b.frame++

    switch (b.phase) {
      case 'walking':
        if (Math.abs(b.x - b.targetX) > 3) {
          b.x += b.x > b.targetX ? -0.8 : 0.8
        } else {
          b.phase = 'climbing'
          b.frame = 0
        }
        break
      case 'climbing': {
        const targetWs = this.workstations[b.targetMemberIndex]
        const targetY = targetWs ? targetWs.y + 60 : this.workBottom - 30
        if (b.frame <= 25) {
          const progress = b.frame / 25
          b.y = this.floorTop + 30 - (this.floorTop + 30 - targetY) * progress
        } else {
          b.y = targetY
          b.phase = 'whipping'
          b.frame = 0
          b.whipFrame = 0
          b.whipCount = 0
        }
        break
      }
      case 'whipping': {
        b.whipFrame++
        const cycleFrame = b.whipFrame % 20
        if (cycleFrame === 10) {
          this.flashAlpha = 0.15
          const targetWs = this.workstations[b.targetMemberIndex]
          const sparkBaseX = targetWs ? targetWs.x + 24 : b.x + 20
          const sparkBaseY = b.y - 5
          for (let i = 0; i < 5; i++) {
            this.particles.push({
              x: sparkBaseX + (Math.random() - 0.5) * 10,
              y: sparkBaseY + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * 3,
              vy: -1.5 - Math.random() * 2,
              life: 20, maxLife: 20,
              color: Math.random() > 0.5 ? '#ffff00' : '#ff8800',
              size: Math.random() > 0.5 ? 3 : 2,
              type: 'default',
            })
          }
        }
        if (cycleFrame === 19) b.whipCount++
        if (b.whipCount >= 3) {
          b.speechBubbleTimer = 60
          b.phase = 'leaving'
          b.frame = 0
        }
        break
      }
      case 'leaving': {
        if (b.speechBubbleTimer > 0) b.speechBubbleTimer--
        if (b.frame <= 18) {
          const corridorY = this.floorTop + 30
          if (b.frame === 1) (b as any)._leaveStartY = b.y
          const leaveStartY = (b as any)._leaveStartY || b.y
          const progress = b.frame / 18
          b.y = leaveStartY + (corridorY - leaveStartY) * progress
        } else {
          b.y = this.floorTop + 30
          b.x += 1.0
          if (b.x > CANVAS_W + 20) b.active = false
        }
        break
      }
    }
  }

  private drawBoss() {
    if (!this.boss.active) return
    const { ctx } = this
    const { x, y, phase, whipFrame } = this.boss
    const bossHeight = 20
    const headTop = y - bossHeight

    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(x - 4, headTop, 8, 3)
    ctx.fillStyle = '#f5c6a0'
    ctx.fillRect(x - 4, headTop + 3, 8, 8)
    ctx.fillStyle = '#000000'
    ctx.fillRect(x - 2, headTop + 6, 2, 1)
    ctx.fillRect(x + 1, headTop + 6, 2, 1)
    ctx.fillRect(x - 3, headTop + 5, 2, 1)
    ctx.fillRect(x + 2, headTop + 5, 2, 1)
    if (phase === 'whipping') {
      ctx.fillStyle = '#cc0000'
      ctx.fillRect(x - 1, headTop + 9, 3, 2)
    } else {
      ctx.fillStyle = '#000000'
      ctx.fillRect(x - 1, headTop + 9, 3, 1)
    }

    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(x - 5, y - 12, 10, 8)
    ctx.fillStyle = '#cc0000'
    ctx.fillRect(x - 1, y - 12, 2, 6)

    if (phase === 'whipping') {
      const cycleFrame = whipFrame % 20
      ctx.fillStyle = '#1a1a1a'
      if (cycleFrame < 7) {
        ctx.fillRect(x + 5, y - 16, 3, 6)
        ctx.fillStyle = '#f5c6a0'
        ctx.fillRect(x + 5, y - 17, 3, 2)
      } else if (cycleFrame < 13) {
        ctx.fillRect(x + 5, y - 12, 4, 3)
        ctx.fillStyle = '#f5c6a0'
        ctx.fillRect(x + 8, y - 12, 3, 2)
      } else {
        ctx.fillRect(x + 5, y - 13, 3, 5)
        ctx.fillStyle = '#f5c6a0'
        ctx.fillRect(x + 5, y - 14, 3, 2)
      }
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(x - 7, y - 10, 3, 6)
    } else {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(x - 7, y - 10, 3, 6)
      ctx.fillRect(x + 5, y - 10, 3, 6)
      ctx.fillStyle = '#f5c6a0'
      ctx.fillRect(x - 7, y - 5, 3, 2)
      ctx.fillRect(x + 5, y - 5, 3, 2)
    }

    ctx.fillStyle = '#333333'
    ctx.fillRect(x - 4, y - 4, 4, 4)
    ctx.fillRect(x, y - 4, 4, 4)

    ctx.fillStyle = '#1a1a1a'
    const legFrame = Math.floor(this.frameCount / 4) % 2
    if (phase === 'walking' || phase === 'leaving') {
      if (legFrame === 0) {
        ctx.fillRect(x - 3, y, 3, 3)
        ctx.fillRect(x + 1, y, 3, 3)
      } else {
        ctx.fillRect(x - 2, y, 3, 3)
        ctx.fillRect(x + 0, y, 3, 3)
      }
    } else {
      ctx.fillRect(x - 3, y, 3, 2)
      ctx.fillRect(x + 1, y, 3, 2)
    }

    if (phase === 'whipping') this.drawWhip(x, y, whipFrame)
    if (phase === 'leaving' && this.boss.speechBubbleTimer > 0) {
      this.addCanvasBubble(x, headTop - 5, this.boss.speechText, 'shout', '#ff0000')
    }
  }

  private drawWhip(bossX: number, bossY: number, frame: number) {
    const { ctx } = this
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 1.5
    const whipPhase = frame % 20
    ctx.beginPath()
    if (whipPhase < 7) {
      ctx.moveTo(bossX + 6, bossY - 16)
      ctx.quadraticCurveTo(bossX + 12, bossY - 26, bossX + 9, bossY - 32)
    } else if (whipPhase < 13) {
      ctx.moveTo(bossX + 9, bossY - 12)
      ctx.quadraticCurveTo(bossX + 18, bossY - 8, bossX + 25, bossY - 5)
    } else {
      ctx.moveTo(bossX + 6, bossY - 14)
      ctx.quadraticCurveTo(bossX + 12, bossY - 10, bossX + 14, bossY - 8)
    }
    ctx.stroke()
    if (whipPhase >= 7 && whipPhase < 13) {
      ctx.fillStyle = '#ffff00'
      const sparkX = bossX + 25, sparkY = bossY - 5
      ctx.fillRect(sparkX, sparkY, 2, 2)
      ctx.fillRect(sparkX + 3, sparkY - 3, 2, 2)
      ctx.fillRect(sparkX - 2, sparkY + 2, 2, 2)
      ctx.fillStyle = '#ff8800'
      ctx.fillRect(sparkX + 2, sparkY - 1, 3, 1)
      ctx.fillRect(sparkX + 3, sparkY - 2, 1, 3)
    }
  }

  // ====== Boss Target Reaction ======
  private drawBossTargetReaction() {
    if (!this.boss.active) return
    if (this.boss.phase !== 'whipping') return
    if (this.boss.targetMemberIndex < 0) return
    const ws = this.workstations[this.boss.targetMemberIndex]
    if (!ws) return
    const { ctx } = this
    const personX = ws.x + 9
    const personY = ws.y + 30
    const shake = this.boss.whipFrame % 4 < 2 ? 1 : -1
    const cycleFrame = this.boss.whipFrame % 20
    if (cycleFrame >= 8 && cycleFrame <= 12 && this.boss.whipFrame % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fillRect(personX + shake - 1, personY - 1, 22, 30)
    }
    if (this.boss.whipFrame % 20 < 13) {
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('!', personX + 10 + shake, personY - 4)
      ctx.textAlign = 'left'
    }
    if (cycleFrame >= 7 && cycleFrame < 14) {
      ctx.fillStyle = '#ffcc00'
      ctx.fillRect(personX - 2 + shake, personY + 8, 3, 5)
      ctx.fillRect(personX + 20 + shake, personY + 7, 3, 6)
      ctx.fillRect(personX - 1 + shake, personY + 14, 2, 4)
    }
  }

  // ====== Atmosphere Particles ======
  private updateAtmosphereParticles() {
    if (Math.random() < 0.03 && this.particles.length < 30) {
      this.particles.push({
        x: 50 + Math.random() * 80,
        y: WALL_BOTTOM + Math.random() * 60,
        vx: 0.03 + Math.random() * 0.04,
        vy: 0.01 + Math.random() * 0.02,
        life: 100 + Math.floor(Math.random() * 75),
        maxLife: 175,
        color: 'rgba(255,240,180,0.4)',
        size: 1,
        type: 'dust',
      })
    }

    for (const ws of this.workstations) {
      if (ws.decorations.includes('coffee') && Math.random() < 0.016 && this.particles.length < 30) {
        const deskX = ws.x - 2
        const deskY = ws.y + 54
        const ox = ws.decorations.indexOf('coffee') === 0 ? deskX + 2 : deskX + ws.decorations.length * 20 + 28
        this.particles.push({
          x: ox + Math.random() * 3,
          y: deskY - 10,
          vx: (Math.random() - 0.5) * 0.05,
          vy: -0.2 - Math.random() * 0.15,
          life: 20 + Math.floor(Math.random() * 10),
          maxLife: 30,
          color: 'rgba(255,255,255,0.3)',
          size: 1,
          type: 'steam',
        })
      }
    }
  }

  // ====== Environment Effects ======
  private updateEnvironment() {
    const env = this.environment
    env.cloudX += 0.16 // doubled speed for 30fps
    if (env.cloudX > 200) env.cloudX = -50

    if (env.lightFlicker > 0) env.lightFlicker--

    if (env.totalBugs <= 3 && env.musicNoteTimer <= 0 && Math.random() < 0.006) {
      env.musicNoteTimer = 45
      if (this.workstations.length > 0) {
        const ws = this.workstations[Math.floor(Math.random() * this.workstations.length)]
        this.particles.push({
          x: ws.x + 20, y: ws.y + 30,
          vx: (Math.random() - 0.5) * 0.3, vy: -0.4,
          life: 30, maxLife: 30,
          color: '#ffdd44', size: 2,
          type: 'musicNote',
        })
      }
    }
    if (env.musicNoteTimer > 0) env.musicNoteTimer--

    if (env.totalBugs > 7) {
      if (Math.random() < 0.008) env.lightFlicker = 3
      if (Math.random() < 0.012 && this.particles.length < 30 && this.workstations.length > 0) {
        const ws = this.workstations[Math.floor(Math.random() * this.workstations.length)]
        this.particles.push({
          x: ws.x + 20, y: ws.y + 40,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -1 - Math.random() * 0.8,
          life: 25, maxLife: 25,
          color: '#ffffff', size: 3,
          type: 'paper',
        })
      }
    }
  }

  private drawEnvironmentEffects() {
    const { ctx } = this
    const env = this.environment

    if (env.lightFlicker > 0) {
      ctx.fillStyle = 'rgba(60,40,20,0.08)'
      ctx.fillRect(0, 0, CANVAS_W, this.canvasH)
    }

    if (env.totalBugs <= 3 && this.workstations.length > 0) {
      // Warm sunlight glow when peaceful
      ctx.fillStyle = 'rgba(255,248,200,0.03)'
      ctx.fillRect(0, WORK_TOP, CANVAS_W, this.workBottom - WORK_TOP)
    } else if (env.totalBugs > 10) {
      // Slight warm stress tint
      ctx.fillStyle = 'rgba(200,100,50,0.02)'
      ctx.fillRect(0, WORK_TOP, CANVAS_W, this.workBottom - WORK_TOP)
    }
  }

  // ====== Particles ======
  private spawnWorkstationParticles() {
    for (const ws of this.workstations) {
      const hx = ws.x + 20, hy = ws.y + 30
      if (ws.state === 'anxious' && this.frameCount % 25 === 0) {
        this.particles.push({
          x: hx + 12, y: hy + 2, vx: 0, vy: 0.5,
          life: 13, maxLife: 13, color: '#66ccff', size: 2, type: 'default',
        })
      }
      if (ws.state === 'crazy' && this.frameCount % 8 === 0) {
        this.particles.push({
          x: hx + (Math.random() - 0.5) * 12, y: hy - 4,
          vx: (Math.random() - 0.5) * 0.4, vy: -0.7,
          life: 15, maxLife: 15,
          color: Math.random() > 0.5 ? '#ff6b35' : '#888888', size: 2, type: 'default',
        })
      }
      if (ws.state === 'collapse' && this.frameCount % 35 === 0) {
        this.particles.push({
          x: hx + 4, y: hy - 2, vx: 0, vy: -0.3,
          life: 20, maxLife: 20, color: '#666666', size: 2, type: 'default',
        })
      }
    }
  }

  private updateAndDrawParticles() {
    const { ctx } = this
    this.particles = this.particles.filter(p => {
      p.x += p.vx
      p.y += p.vy
      p.life--
      if (p.life <= 0) return false

      const alpha = p.life / p.maxLife

      if (p.type === 'musicNote') {
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, 2, 2)
        ctx.fillRect(p.x + 2, p.y + 1, 1, 3)
        ctx.globalAlpha = 1
      } else if (p.type === 'paper') {
        ctx.globalAlpha = alpha * 0.8
        ctx.fillStyle = p.color
        const rot = Math.sin(this.frameCount * 0.2 + p.x) * 1
        ctx.fillRect(p.x + rot, p.y, p.size, p.size - 1)
        ctx.globalAlpha = 1
        p.vy += 0.03
      } else if (p.type === 'dust') {
        ctx.globalAlpha = alpha * 0.3
        ctx.fillStyle = '#ffffc8'
        ctx.fillRect(p.x, p.y, 1, 1)
        ctx.globalAlpha = 1
      } else if (p.type === 'steam') {
        ctx.globalAlpha = alpha * 0.4
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(p.x, p.y, 1, 1)
        ctx.globalAlpha = 1
      } else {
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)
        ctx.globalAlpha = 1
      }
      return true
    })
    if (this.particles.length > 50) this.particles = this.particles.slice(-30)
  }

  private drawFlash() {
    if (this.flashAlpha > 0) {
      this.ctx.globalAlpha = this.flashAlpha
      this.ctx.fillStyle = '#ffffff'
      this.ctx.fillRect(0, 0, CANVAS_W, this.canvasH)
      this.ctx.globalAlpha = 1
      this.flashAlpha -= 0.03
      if (this.flashAlpha < 0) this.flashAlpha = 0
    }
  }

  // ====== User Whip Animation: Update ======
  private updateUserWhip() {
    if (!this.userWhip.active) return
    const state = this.userWhip
    state.frame++

    const targetWs = this.workstations[state.targetIndex]
    if (!targetWs) { state.active = false; return }

    switch (state.phase) {
      case 'standing': {
        // Stand up from chair (30 frames)
        if (state.frame >= 30) {
          state.phase = 'walking'
          state.frame = 0
          // Compute walking path: go down to corridor, across, then up to target
        }
        break
      }
      case 'walking': {
        // Direct path to target workstation (no corridor detour)
        const targetX = targetWs.x + 50  // stand to the right of target
        const targetY = targetWs.y + 50

        const dx = targetX - state.x
        const dy = targetY - state.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance > 3) {
          // Move directly toward target at moderate speed
          const speed = 1.2
          state.x += (dx / distance) * speed
          state.y += (dy / distance) * speed
        } else {
          // Arrived at target
          state.x = targetX
          state.y = targetY
          state.phase = 'arriving'
          state.frame = 0
        }

        // Safety: prevent infinite walking (max 600 frames = ~10s)
        if (state.frame > 600) {
          state.x = targetX
          state.y = targetY
          state.phase = 'arriving'
          state.frame = 0
        }
        break
      }
      case 'arriving': {
        // Prepare to strike (15 frames)
        if (state.frame >= 15) {
          state.phase = 'whipping'
          state.frame = 0
          state.whipCount = 0
        }
        break
      }
      case 'whipping': {
        // Whipping animation (20 frames per whip, 3 whips)
        const cycleFrame = state.frame % 20
        if (cycleFrame === 10) {
          // Impact frame - spawn particles
          this.flashAlpha = 0.08
          const sparkX = targetWs.x + 24
          const sparkY = targetWs.y + 40
          for (let i = 0; i < 4; i++) {
            this.particles.push({
              x: sparkX + (Math.random() - 0.5) * 12,
              y: sparkY + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * 3,
              vy: -1.5 - Math.random() * 2,
              life: 18, maxLife: 18,
              color: Math.random() > 0.5 ? '#ffff00' : '#ff8800',
              size: Math.random() > 0.5 ? 3 : 2,
              type: 'default',
            })
          }
        }
        if (cycleFrame === 19) state.whipCount++
        if (state.whipCount >= 3) {
          state.phase = 'speech'
          state.frame = 0
        }
        break
      }
      case 'speech': {
        // Show speech bubble (40 frames)
        if (state.frame >= 40) {
          state.phase = 'returning'
          state.frame = 0
        }
        break
      }
      case 'returning': {
        // Walk back directly to origin (no corridor detour)
        const dx = state.originX - state.x
        const dy = state.originY - state.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance > 3) {
          const speed = 1.0
          state.x += (dx / distance) * speed
          state.y += (dy / distance) * speed
        } else {
          state.x = state.originX
          state.y = state.originY
          state.phase = 'sitting'
          state.frame = 0
        }

        // Safety: prevent infinite returning (max 600 frames)
        if (state.frame > 600) {
          state.x = state.originX
          state.y = state.originY
          state.phase = 'sitting'
          state.frame = 0
        }
        break
      }
      case 'sitting': {
        // Sit back down (20 frames)
        if (state.frame >= 20) {
          state.active = false
          state.targetScaredTimer = 300 // target stays scared for 300 frames
        }
        break
      }
    }
  }

  // ====== User Whip Animation: Draw ======
  private drawUserWhip() {
    if (!this.userWhip.active) return
    const state = this.userWhip
    const { ctx } = this
    const targetWs = this.workstations[state.targetIndex]
    const currentWs = this.workstations[state.currentUserIndex]
    if (!targetWs || !currentWs) return

    const appearance = currentWs.appearance

    switch (state.phase) {
      case 'standing': {
        // Draw user standing up at their workstation
        const progress = state.frame / 30
        const riseY = currentWs.y + 50 - progress * 10  // rise 10px
        this.drawStandingPerson(currentWs.x + 24, riseY, appearance, 'angry')
        // Anger symbol
        if (state.frame > 15) {
          this.drawAngerSymbol(currentWs.x + 30, currentWs.y + 20)
        }
        break
      }
      case 'walking': {
        // Draw walking person at current position
        const bounce = Math.sin(state.frame * 0.5) * 1
        this.drawStandingPerson(state.x, state.y + bounce, appearance, 'angry')
        // Anger particles
        if (state.frame % 8 === 0) {
          this.particles.push({
            x: state.x, y: state.y - 15,
            vx: (Math.random() - 0.5) * 0.5, vy: -0.6,
            life: 12, maxLife: 12,
            color: '#ff4444', size: 2, type: 'default',
          })
        }
        break
      }
      case 'arriving': {
        // Draw person preparing to strike
        this.drawStandingPerson(state.x, state.y, appearance, 'angry')
        // Rolling up sleeves animation (arm flicker)
        if (state.frame % 4 < 2) {
          ctx.fillStyle = '#ffdd44'
          ctx.fillRect(state.x + 5, state.y - 18, 4, 3)
        }
        // Target gets scared
        this.drawScaredReaction(targetWs)
        break
      }
      case 'whipping': {
        // Draw person whipping
        this.drawStandingPerson(state.x, state.y, appearance, 'angry')
        // Draw whip/newspaper
        this.drawUserWhipWeapon(state.x, state.y, state.frame)
        // Target reaction
        this.drawWhipTargetReaction(targetWs, state.frame)
        // Nearby bystander reactions
        this.drawBystanderReactions(state.targetIndex)
        break
      }
      case 'speech': {
        // Draw person with speech bubble
        this.drawStandingPerson(state.x, state.y, appearance, 'satisfied')
        // Speech bubble (HTML rendered)
        this.addCanvasBubble(state.x, state.y - 30, state.speechText, 'shout', '#ff4444')
        // Target cowering
        this.drawCoweringTarget(targetWs, state.frame)
        // Bystander reactions
        this.drawBystanderReactions(state.targetIndex)
        break
      }
      case 'returning': {
        // Walking back, satisfied
        const bounce = Math.sin(state.frame * 0.4) * 0.8
        this.drawStandingPerson(state.x, state.y + bounce, appearance, 'satisfied')
        break
      }
      case 'sitting': {
        // Sitting back down
        const progress = state.frame / 20
        const sinkY = currentWs.y + 40 + progress * 10
        this.drawStandingPerson(currentWs.x + 24, sinkY, appearance, 'satisfied')
        break
      }
    }
  }

  // ====== Helper: Draw standing person ======
  private drawStandingPerson(x: number, y: number, appearance: PersonAppearance, mood: 'angry' | 'satisfied' | 'normal') {
    const { ctx } = this
    // Body
    ctx.fillStyle = appearance.shirtColor
    ctx.fillRect(x - 5, y - 8, 10, 12)
    // Head
    ctx.fillStyle = appearance.skinTone
    ctx.fillRect(x - 4, y - 18, 8, 9)
    // Hair
    ctx.fillStyle = appearance.hairColor
    ctx.fillRect(x - 4, y - 20, 8, 4)
    // Eyes
    ctx.fillStyle = '#000000'
    ctx.fillRect(x - 2, y - 14, 2, 2)
    ctx.fillRect(x + 1, y - 14, 2, 2)
    // Eyebrows based on mood
    if (mood === 'angry') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(x - 3, y - 16, 2, 1) // left brow angled down
      ctx.fillRect(x + 2, y - 16, 2, 1) // right brow angled down
      // Angry mouth
      ctx.fillStyle = '#cc0000'
      ctx.fillRect(x - 1, y - 11, 3, 1)
    } else if (mood === 'satisfied') {
      // Smug face
      ctx.fillStyle = '#000000'
      ctx.fillRect(x - 1, y - 11, 3, 1)
      ctx.fillRect(x - 2, y - 10, 1, 1)
      ctx.fillRect(x + 2, y - 10, 1, 1)
    } else {
      ctx.fillStyle = '#000000'
      ctx.fillRect(x - 1, y - 11, 3, 1)
    }
    // Legs
    ctx.fillStyle = appearance.pantsColor
    ctx.fillRect(x - 4, y + 4, 4, 6)
    ctx.fillRect(x + 1, y + 4, 4, 6)
    // Feet
    ctx.fillStyle = '#333333'
    ctx.fillRect(x - 4, y + 10, 4, 2)
    ctx.fillRect(x + 1, y + 10, 4, 2)
    // Arms
    ctx.fillStyle = appearance.shirtColor
    ctx.fillRect(x - 7, y - 7, 3, 8)
    ctx.fillRect(x + 5, y - 7, 3, 8)
    // Hands
    ctx.fillStyle = appearance.skinTone
    ctx.fillRect(x - 7, y + 1, 3, 2)
    ctx.fillRect(x + 5, y + 1, 3, 2)
  }

  // ====== Helper: Anger symbol (pixel cross) ======
  private drawAngerSymbol(x: number, y: number) {
    const { ctx } = this
    ctx.fillStyle = '#ff4444'
    // Cross pattern (like the manga anger mark ×)
    ctx.fillRect(x, y, 2, 2)
    ctx.fillRect(x + 3, y + 3, 2, 2)
    ctx.fillRect(x + 3, y, 2, 2)
    ctx.fillRect(x, y + 3, 2, 2)
    ctx.fillRect(x + 1, y + 1, 3, 3)
  }

  // ====== Helper: Draw whip/newspaper weapon ======
  private drawUserWhipWeapon(x: number, y: number, frame: number) {
    const { ctx } = this
    const cycleFrame = frame % 20

    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 2
    ctx.beginPath()
    if (cycleFrame < 7) {
      // Wind up - newspaper raised high
      ctx.moveTo(x + 6, y - 8)
      ctx.quadraticCurveTo(x + 10, y - 25, x + 6, y - 30)
    } else if (cycleFrame < 13) {
      // Swing down - impact!
      ctx.moveTo(x + 6, y - 8)
      ctx.quadraticCurveTo(x + 15, y - 5, x + 22, y + 2)
    } else {
      // Recovery
      ctx.moveTo(x + 6, y - 8)
      ctx.quadraticCurveTo(x + 10, y - 12, x + 12, y - 10)
    }
    ctx.stroke()

    // Impact sparks
    if (cycleFrame >= 7 && cycleFrame < 13) {
      ctx.fillStyle = '#ffff00'
      const sparkX = x + 22, sparkY = y + 2
      ctx.fillRect(sparkX, sparkY, 2, 2)
      ctx.fillRect(sparkX + 3, sparkY - 3, 2, 2)
      ctx.fillRect(sparkX - 2, sparkY + 2, 2, 2)
      // "!!!" impact text
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('!!!', sparkX + 4, sparkY)
      ctx.textAlign = 'left'
    }
  }

  // ====== Helper: Target scared reaction ======
  private drawScaredReaction(ws: Workstation) {
    const { ctx } = this
    const px = ws.x + 24
    const py = ws.y + 35
    // Wide eyes
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(px - 3, py, 3, 3)
    ctx.fillRect(px + 1, py, 3, 3)
    ctx.fillStyle = '#000000'
    ctx.fillRect(px - 2, py + 1, 1, 1)
    ctx.fillRect(px + 2, py + 1, 1, 1)
    // Open mouth
    ctx.fillStyle = '#000000'
    ctx.fillRect(px - 1, py + 5, 3, 3)
  }

  // ====== Helper: Target reaction during whipping ======
  private drawWhipTargetReaction(ws: Workstation, frame: number) {
    const { ctx } = this
    const px = ws.x + 24
    const py = ws.y + 35
    const cycleFrame = frame % 20
    const shake = cycleFrame >= 7 && cycleFrame < 13 ? (frame % 4 < 2 ? 2 : -2) : 0

    // Body bounce on impact
    if (cycleFrame >= 8 && cycleFrame <= 12) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.fillRect(ws.x + 9 + shake, ws.y + 28, 22, 30)
    }

    // Stars spinning around head
    if (frame > 20) {
      const starAngle = frame * 0.15
      for (let i = 0; i < 3; i++) {
        const angle = starAngle + (i * Math.PI * 2 / 3)
        const sx = px + Math.cos(angle) * 8
        const sy = py - 12 + Math.sin(angle) * 4
        ctx.fillStyle = '#ffdd00'
        ctx.fillRect(sx, sy, 2, 2)
      }
    }

    // Sweat drops after second hit
    if (frame > 30) {
      ctx.fillStyle = '#66ccff'
      ctx.fillRect(px + 6, py - 5 + (frame % 10) * 0.3, 2, 3)
    }

    // "!" reaction
    ctx.fillStyle = '#ff0000'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('!', px + shake, py - 15)
    ctx.textAlign = 'left'
  }

  // ====== Helper: Cowering target during speech phase ======
  private drawCoweringTarget(ws: Workstation, frame: number) {
    const { ctx } = this
    const px = ws.x + 24
    const py = ws.y + 35
    // Trembling
    const shake = frame % 3 === 0 ? 1 : frame % 3 === 1 ? -1 : 0
    // Sweat
    ctx.fillStyle = '#66ccff'
    ctx.fillRect(px + 6 + shake, py - 4, 2, 3)
    ctx.fillRect(px - 5 + shake, py - 2, 2, 3)
    // Fear lines
    ctx.fillStyle = '#aaaaaa'
    ctx.fillRect(px - 8, py - 8, 1, 4)
    ctx.fillRect(px + 10, py - 8, 1, 4)
  }

  // ====== Helper: Bystander reactions ======
  private drawBystanderReactions(targetIndex: number) {
    const { ctx } = this
    const targetWs = this.workstations[targetIndex]
    if (!targetWs) return

    // Find nearest 1-2 workstations (not target, not current user)
    const nearbyIndices: number[] = []
    for (let i = 0; i < this.workstations.length; i++) {
      if (i === targetIndex || i === this.userWhip.currentUserIndex) continue
      const ws = this.workstations[i]
      const dist = Math.abs(ws.x - targetWs.x) + Math.abs(ws.y - targetWs.y)
      if (dist < 200) {
        nearbyIndices.push(i)
      }
    }
    nearbyIndices.sort((a, b) => {
      const da = Math.abs(this.workstations[a].x - targetWs.x)
      const db = Math.abs(this.workstations[b].x - targetWs.x)
      return da - db
    })

    // Draw reaction for up to 2 nearby colleagues
    for (let n = 0; n < Math.min(2, nearbyIndices.length); n++) {
      const ws = this.workstations[nearbyIndices[n]]
      const px = ws.x + 24
      const py = ws.y + 30
      // Surprise mark
      ctx.fillStyle = '#ffdd00'
      ctx.fillRect(px - 1, py - 8, 2, 4)
      ctx.fillRect(px - 1, py - 3, 2, 2)
      // Sweat drop
      ctx.fillStyle = '#66ccff'
      ctx.fillRect(px + 7, py - 4, 2, 3)
    }
  }

  // ====== Helper: Update target scared timer (post-whip) ======
  private updateTargetScaredTimer() {
    if (this.userWhip.targetScaredTimer > 0) {
      this.userWhip.targetScaredTimer--
      // Force target into typing_fast during scared phase
      const targetIdx = this.userWhip.targetIndex
      if (targetIdx >= 0 && targetIdx < this.workstations.length) {
        const ws = this.workstations[targetIdx]
        const ps = this.personStates.get(ws.name)
        if (ps && ps.currentAction !== 'typing_fast') {
          ps.currentAction = 'typing_fast'
          ps.actionTimer = 0
          ps.actionDuration = this.userWhip.targetScaredTimer
          ps.animStartTime = performance.now()
        }
      }
    }
  }

  // ====== Render Loop (30fps via frame skip) ======
  private render = () => {
    this.animationId = requestAnimationFrame(this.render)
    this.frameCount++
    // Skip every other frame for 30fps
    if (this.frameCount % 2 !== 0) return

    // === Actual render ===
    this.ctx.clearRect(0, 0, CANVAS_W, this.canvasH)

    // Background: use cached offscreen canvas
    if (this.bgDirty) {
      this.renderBackgroundCache()
    }
    this.ctx.drawImage(this.offscreenCanvas, 0, 0)

    // Dynamic background elements (stars, clouds, clock, bubbles)
    this.drawDynamicBackground()

    // Update person actions
    this.updatePersonStates()

    // Update environment
    this.updateEnvironment()

    // Update event system and off-work system
    this.eventSystem.update()
    this.checkOffWorkTime()

    // Draw office environment decorations (before workstations so they appear behind)
    this.drawOfficeEnvironment()

    // Draw based on active state (off-work > event > normal)
    if (this.offWork.active) {
      this.updateOffWork()
      this.drawOffWorkScene()
    } else if (this.eventSystem.isEventActive()) {
      const event = this.eventSystem.getActiveEvent()
      if (event) this.drawEvent(event)
      // Still draw workstations but with event overlay
      for (let i = 0; i < this.workstations.length; i++) {
        this.drawWorkstation(this.workstations[i])
      }
    } else {
      // Normal drawing
      // Draw workstations (skip current user's person if whip/feed animation is active)
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        if (this.userWhip.active && i === this.userWhip.currentUserIndex &&
            this.userWhip.phase !== 'sitting') {
          this.drawWorkstationFurnitureOnly(ws)
        } else if (this.feedState.active && i === this.feedState.currentUserIndex) {
          this.drawWorkstationFurnitureOnly(ws)
        } else {
          this.drawWorkstation(ws)
        }
      }
    }

    // Particles
    this.spawnWorkstationParticles()
    this.updateAtmosphereParticles()
    this.updateAndDrawParticles()

    // Environment overlays
    this.drawEnvironmentEffects()

    // Cat (skip during off-work empty phase)
    if (!(this.offWork.active && this.offWork.phase === 'empty')) {
      this.updateCat()
      this.drawCat()
    }

    // Boss (skip during events/off-work)
    if (!this.eventSystem.isEventActive() && !this.offWork.active) {
      this.updateBoss()
      this.drawBossTargetReaction()
      this.drawBoss()
    }

    // User whip animation (skip during events/off-work)
    if (!this.eventSystem.isEventActive() && !this.offWork.active) {
      this.updateUserWhip()
      this.updateTargetScaredTimer()
      this.drawUserWhip()
    }

    // Feed animation (skip during events/off-work)
    if (!this.eventSystem.isEventActive() && !this.offWork.active) {
      this.updateFeedState()
      this.drawFeedState()
    }

    // Cat interaction
    this.updateCatInteraction()
    this.drawCatInteraction()

    // Energized members
    this.updateEnergizedMembers()
    this.drawEnergizedEffects()

    // Achievement popup
    this.updateAchievementPopup()
    this.drawAchievementPopup()

    // Sprite effects
    this.updateAndDrawEffects()

    // Flash effect
    this.drawFlash()

    // Update HTML speech bubbles (decrement duration, remove expired)
    this.updateCanvasBubbles()
  }

  // ====== Sprite Effect Rendering ======
  private updateAndDrawEffects() {
    const now = performance.now()
    const spriteSheet = getSpriteSheet()
    const ready = isSpritesReady()

    this.activeEffects = this.activeEffects.filter(effect => {
      const elapsed = now - effect.startTime
      if (elapsed > effect.duration) return false

      // assign 类型始终使用程序化渲染
      if (effect.type === 'assign') {
        this.drawAssignEffect(effect, elapsed)
        return true
      }

      if (ready) {
        const anim = EFFECT_ANIM_MAP[effect.type]
        // 102x128 effect frames, scale 0.4 → ~41x51px effect overlay
        spriteSheet.drawAnimation(this.ctx, anim, effect.x - 20, effect.y - 25, elapsed, 0.4)
      } else {
        // Fallback: 程序化渲染各类型效果
        this.drawEffectFallback(effect, elapsed)
      }
      return true
    })
  }

  /** assign 效果：白色文件从上方飘落到人物头顶 */
  private drawAssignEffect(effect: SpriteEffect, elapsed: number) {
    const duration = effect.duration
    const progress = elapsed / duration  // 0 到 1
    const fallY = effect.y - 30 + progress * 30  // 从上方30px处落下
    const opacity = progress < 0.8 ? 1 : (1 - progress) / 0.2  // 末尾淡出
    const wobble = Math.sin(progress * Math.PI * 4) * 3  // 左右摇摆

    this.ctx.globalAlpha = opacity
    const fx = effect.x + wobble
    const fy = fallY
    // 画小文件图标（白色方块+折角）
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(fx - 4, fy - 5, 8, 10)  // 纸张
    this.ctx.fillStyle = '#cccccc'
    this.ctx.fillRect(fx + 2, fy - 5, 2, 3)   // 折角
    this.ctx.fillStyle = '#4a90d9'
    this.ctx.fillRect(fx - 2, fy - 2, 4, 1)   // 文字行1
    this.ctx.fillRect(fx - 2, fy, 3, 1)       // 文字行2
    this.ctx.fillRect(fx - 2, fy + 2, 4, 1)   // 文字行3
    this.ctx.globalAlpha = 1
  }

  /** 程序化渲染 fallback（精灵图未加载时） */
  private drawEffectFallback(effect: SpriteEffect, elapsed: number) {
    const progress = elapsed / effect.duration
    const alpha = 1 - progress
    this.ctx.globalAlpha = alpha

    switch (effect.type) {
      case 'bugAppear': {
        // 红色 "!" 感叹号从角色上方弹出
        const bounceY = effect.y - 15 - Math.sin(progress * Math.PI) * 10
        this.ctx.fillStyle = '#ff4444'
        this.ctx.fillRect(effect.x - 1, bounceY - 6, 2, 5) // 竖线
        this.ctx.fillRect(effect.x - 1, bounceY, 2, 2)     // 点
        break
      }
      case 'complete': {
        // 绿色 "✓" 勾号上浮 + 淡出
        const floatY = effect.y - 10 - progress * 12
        this.ctx.fillStyle = '#00ff88'
        this.ctx.fillRect(effect.x - 3, floatY + 2, 2, 2)   // 勾号左
        this.ctx.fillRect(effect.x - 1, floatY + 4, 2, 2)   // 勾号底
        this.ctx.fillRect(effect.x + 1, floatY + 2, 2, 2)   // 勾号右上1
        this.ctx.fillRect(effect.x + 3, floatY, 2, 2)       // 勾号右上2
        break
      }
      case 'notification': {
        // 黄色铃铛图标闪烁
        const blink = Math.sin(elapsed / 150 * Math.PI) > 0 ? 1 : 0.4
        this.ctx.globalAlpha = alpha * blink
        this.ctx.fillStyle = '#ffdd00'
        this.ctx.fillRect(effect.x - 3, effect.y - 15, 6, 5)  // 铃铛体
        this.ctx.fillRect(effect.x - 1, effect.y - 10, 2, 2)  // 铃铛嘴
        this.ctx.fillRect(effect.x, effect.y - 17, 1, 2)      // 铃铛顶
        break
      }
      case 'levelUp': {
        // 金色星星上升
        const riseY = effect.y - 10 - progress * 20
        const sparkle = Math.sin(elapsed / 100 * Math.PI) > 0 ? 1 : 0.6
        this.ctx.globalAlpha = alpha * sparkle
        this.ctx.fillStyle = '#ffd700'
        this.ctx.fillRect(effect.x - 1, riseY - 2, 2, 5)     // 竖线
        this.ctx.fillRect(effect.x - 2, riseY, 5, 1)         // 横线
        break
      }
      case 'energyRestore': {
        // 绿色 "+" 号上浮
        const upY = effect.y - 10 - progress * 15
        this.ctx.fillStyle = '#00ff88'
        this.ctx.fillRect(effect.x - 1, upY - 2, 2, 5)   // 竖线
        this.ctx.fillRect(effect.x - 2, upY, 5, 1)       // 横线
        break
      }
      case 'expPlus': {
        // 蓝色 "+EXP" 上浮
        const expY = effect.y - 10 - progress * 12
        this.ctx.fillStyle = '#4a90d9'
        this.ctx.fillRect(effect.x - 3, expY, 6, 4)      // 小矩形背景
        this.ctx.fillStyle = '#ffffff'
        this.ctx.fillRect(effect.x - 2, expY + 1, 4, 2)  // 文字行
        break
      }
      default:
        break
    }
    this.ctx.globalAlpha = 1
  }

  // ====== Event System Drawing ======
  private drawEvent(event: RandomEvent): void {
    switch (event.id) {
      case 'delivery': this.drawDeliveryEvent(event); break
      case 'blackout': this.drawBlackoutEvent(event); break
      case 'bossVisit': this.drawBossVisitEvent(event); break
      case 'catSpill': this.drawCatSpillEvent(event); break
    }
  }

  private drawDeliveryEvent(event: RandomEvent): void {
    const { ctx } = this
    const f = event.currentFrame
    const phase = event.phase

    // Phase 0: Delivery guy walks in from right
    if (phase === 0) {
      const enterX = CANVAS_W + 20 - (f / 60) * (CANVAS_W - 600)
      this.drawDeliveryGuy(enterX, this.floorTop + 15)
    }
    // Phase 1: Shouts "外卖到了！", everyone stands up excited
    else if (phase === 1) {
      this.drawDeliveryGuy(620, this.floorTop + 15)
      // Speech bubble (HTML rendered)
      this.addCanvasBubble(610, this.floorTop - 5, '外卖到了！', 'shout', '#ff6600')
      // Exclamation above members
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        ctx.fillStyle = '#ffdd00'
        ctx.fillRect(ws.x + 22, ws.y - 5, 4, 6)
        ctx.fillRect(ws.x + 22, ws.y + 3, 4, 3)
      }
    }
    // Phase 2: Everyone walks toward right side
    else if (phase === 2) {
      this.drawDeliveryGuy(620, this.floorTop + 15)
      const progress = (f - 120) / 180
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        const targetX = 550 + (i % 3) * 25
        const currentX = ws.x + 24 + (targetX - ws.x - 24) * Math.min(1, progress * (1 + i * 0.1))
        const currentY = ws.y + 40 + (this.floorTop + 20 - ws.y - 40) * Math.min(1, progress)
        const bounce = Math.sin((f + i * 10) * 0.2) * 2
        this.drawStandingPerson(currentX, currentY + bounce, ws.appearance, 'normal')
      }
    }
    // Phase 3: People walk back with food
    else if (phase === 3) {
      const progress = (f - 300) / 120
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        const startX = 550 + (i % 3) * 25
        const currentX = startX + (ws.x + 24 - startX) * Math.min(1, progress)
        const currentY = this.floorTop + 20 + (ws.y + 40 - this.floorTop - 20) * Math.min(1, progress)
        this.drawStandingPerson(currentX, currentY, ws.appearance, 'satisfied')
        // Food box in hand
        ctx.fillStyle = '#ff8844'
        ctx.fillRect(currentX + 6, currentY - 3, 6, 5)
      }
      // Delivery guy leaving
      const leaveX = 620 + progress * 120
      this.drawDeliveryGuy(leaveX, this.floorTop + 15)
    }
    // Phase 4: Eating at desk
    else if (phase === 4) {
      // Draw food on desks + eating animation
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        ctx.fillStyle = '#ff8844'
        ctx.fillRect(ws.x + 35, ws.y + 50, 7, 5)
        // Steam
        if ((f + i * 5) % 20 < 10) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          ctx.fillRect(ws.x + 37, ws.y + 46, 1, 3)
        }
      }
    }
  }

  private drawDeliveryGuy(x: number, y: number): void {
    const { ctx } = this
    // Yellow uniform + helmet
    ctx.fillStyle = '#ffcc00'
    ctx.fillRect(x - 5, y - 20, 10, 4) // helmet
    ctx.fillStyle = '#ffdbac'
    ctx.fillRect(x - 4, y - 16, 8, 7) // face
    ctx.fillStyle = '#000000'
    ctx.fillRect(x - 2, y - 13, 2, 2) // eyes
    ctx.fillRect(x + 1, y - 13, 2, 2)
    ctx.fillStyle = '#ffcc00'
    ctx.fillRect(x - 6, y - 9, 12, 14) // body
    // Delivery box on back
    ctx.fillStyle = '#4488ff'
    ctx.fillRect(x - 9, y - 15, 5, 12)
    ctx.fillStyle = '#ffffff'
    ctx.font = '5px monospace'
    ctx.fillText('送', x - 8, y - 7)
    // Legs (walking animation)
    const legAnim = Math.sin(this.frameCount * 0.3) > 0
    ctx.fillStyle = '#333333'
    ctx.fillRect(x - 3, y + 5, 3, legAnim ? 7 : 6)
    ctx.fillRect(x + 1, y + 5, 3, legAnim ? 6 : 7)
  }

  private drawBlackoutEvent(event: RandomEvent): void {
    const { ctx } = this
    const f = event.currentFrame
    const phase = event.phase

    if (phase === 0) {
      // Flicker and go dark
      const flickerOn = f < 7 || (f > 10 && f < 14)
      if (!flickerOn) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (f - 5) / 15)})`
        ctx.fillRect(0, 0, CANVAS_W, this.canvasH)
      }
    } else if (phase === 1) {
      // Full darkness with emergency light
      ctx.fillStyle = 'rgba(0,0,0,0.92)'
      ctx.fillRect(0, 0, CANVAS_W, this.canvasH)
      // Emergency light (green blink)
      const blink = (f % 30) < 15
      if (blink) {
        ctx.fillStyle = '#00ff44'
        ctx.fillRect(15, 10, 4, 4)
        // Glow
        ctx.fillStyle = 'rgba(0,255,68,0.1)'
        ctx.fillRect(5, 0, 24, 24)
      }
    } else if (phase === 2) {
      // Darkness + phone screens light up
      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.fillRect(0, 0, CANVAS_W, this.canvasH)
      // Phone screens at each workstation
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        const phoneDelay = i * 8
        if (f - 120 > phoneDelay) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(ws.x + 20, ws.y + 40, 5, 8)
          // Face illumination
          ctx.fillStyle = 'rgba(200,220,255,0.15)'
          ctx.fillRect(ws.x + 12, ws.y + 30, 20, 20)
        }
      }
    } else if (phase === 3) {
      // Power restoring
      const progress = (f - 200) / 60
      const alpha = Math.max(0, 0.85 - progress * 0.85)
      ctx.fillStyle = `rgba(0,0,0,${alpha})`
      ctx.fillRect(0, 0, CANVAS_W, this.canvasH)
    } else if (phase === 4) {
      // Everyone cheers
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        // Arms up
        ctx.fillStyle = ws.appearance.skinTone
        ctx.fillRect(ws.x + 18, ws.y + 20, 3, 6)
        ctx.fillRect(ws.x + 28, ws.y + 20, 3, 6)
        // "耶！" bubble (HTML rendered)
        if (i % 2 === 0) {
          this.addCanvasBubble(ws.x + 26, ws.y - 8, '耶！', 'shout', '#ff6600')
        }
      }
    }
  }

  private drawBossVisitEvent(event: RandomEvent): void {
    const { ctx } = this
    const f = event.currentFrame
    const phase = event.phase

    if (phase === 0) {
      // Boss + client walk in from left
      const enterX = -30 + (f / 60) * 100
      this.drawBossVisitPair(enterX, this.floorTop + 15)
    } else if (phase === 1) {
      // Everyone sits up straight instantly
      this.drawBossVisitPair(70, this.floorTop + 15)
      // "!" above everyone
      for (const ws of this.workstations) {
        ctx.fillStyle = '#ff4444'
        ctx.fillRect(ws.x + 23, ws.y - 5, 3, 5)
        ctx.fillRect(ws.x + 23, ws.y + 2, 3, 2)
      }
    } else if (phase === 2) {
      // Boss walks through, everyone typing fast
      const walkProgress = (f - 90) / 150
      const bossX = 70 + walkProgress * (CANVAS_W - 140)
      this.drawBossVisitPair(bossX, this.floorTop + 15)
      // Typing sparks on screens
      for (const ws of this.workstations) {
        if (this.frameCount % 4 < 2) {
          ctx.fillStyle = '#00ff88'
          ctx.fillRect(ws.x + 15, ws.y + 24, 2, 1)
          ctx.fillRect(ws.x + 19, ws.y + 25, 3, 1)
        }
      }
    } else if (phase === 3) {
      // Boss and client leave from right
      const leaveProgress = (f - 240) / 60
      const bossX = CANVAS_W - 70 + leaveProgress * 100
      this.drawBossVisitPair(bossX, this.floorTop + 15)
    } else if (phase === 4) {
      // Everyone relaxes: slump + wipe sweat
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        // Sweat drops
        ctx.fillStyle = '#66ccff'
        ctx.fillRect(ws.x + 30, ws.y + 32, 2, 3)
        // Relief sigh (HTML rendered)
        if (i % 3 === 0) {
          this.addCanvasBubble(ws.x + 26, ws.y - 5, '终于走了...', 'thought', '#aaaaaa')
        }
        // Fist (secret gesture)
        if (i === this.workstations.length - 1 && (f % 20) < 10) {
          ctx.fillStyle = ws.appearance.skinTone
          ctx.fillRect(ws.x + 30, ws.y + 26, 4, 5)
        }
      }
    }
  }

  private drawBossVisitPair(x: number, y: number): void {
    const { ctx } = this
    // Boss (red suit)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(x - 4, y - 20, 8, 4) // hair
    ctx.fillStyle = '#ffc8a0'
    ctx.fillRect(x - 3, y - 16, 6, 6) // face
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(x - 5, y - 10, 10, 14) // body
    ctx.fillStyle = '#f1c40f'
    ctx.fillRect(x - 1, y - 9, 2, 8) // tie
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(x - 3, y + 4, 3, 7)
    ctx.fillRect(x + 1, y + 4, 3, 7)

    // Client (blue suit, slightly behind)
    const cx = x + 20
    ctx.fillStyle = '#333333'
    ctx.fillRect(cx - 4, cx < CANVAS_W ? y - 20 : -100, 8, 4)
    ctx.fillStyle = '#ffdbac'
    ctx.fillRect(cx - 3, y - 16, 6, 6)
    ctx.fillStyle = '#2c5aa0'
    ctx.fillRect(cx - 5, y - 10, 10, 14)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(cx - 3, y + 4, 3, 7)
    ctx.fillRect(cx + 1, y + 4, 3, 7)
  }

  private drawCatSpillEvent(event: RandomEvent): void {
    const { ctx } = this
    const f = event.currentFrame
    const phase = event.phase
    // Pick a random workstation (deterministic from frame seed)
    const victimIdx = this.workstations.length > 0
      ? (simpleHash('catspill') % this.workstations.length)
      : 0
    const ws = this.workstations[victimIdx]
    if (!ws) return
    const deskY = ws.y + 54

    if (phase === 0) {
      // Cat jumps onto desk
      const jumpProgress = f / 40
      const catX = ws.x + 40
      const catY = this.floorTop + 30 - jumpProgress * (this.floorTop + 30 - deskY + 10)
      this.drawEventCat(catX, catY)
    } else if (phase === 1) {
      // Cat paws at coffee cup, cup tilts
      this.drawEventCat(ws.x + 40, deskY - 10)
      const tilt = Math.min(1, (f - 40) / 30)
      // Tilting cup
      ctx.save()
      ctx.translate(ws.x + 42, deskY - 4)
      ctx.rotate(tilt * 1.2)
      ctx.fillStyle = '#D2691E'
      ctx.fillRect(-2, -5, 5, 5)
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(3, -3, 2, 3)
      ctx.restore()
    } else if (phase === 2) {
      // Coffee spills, person reacts
      this.drawEventCat(ws.x + 45, deskY - 8)
      // Coffee liquid flowing
      const spillProgress = (f - 80) / 80
      ctx.fillStyle = '#6f4e37'
      const spillWidth = Math.min(20, spillProgress * 25)
      ctx.fillRect(ws.x + 38, deskY - 2, spillWidth, 3)
      // Dripping off desk
      if (spillProgress > 0.3) {
        for (let d = 0; d < 3; d++) {
          const dropY = deskY + 2 + (spillProgress - 0.3) * 20 * (d + 1) / 3
          ctx.fillRect(ws.x + 40 + d * 5, dropY, 2, 3)
        }
      }
      // Person reaction: "啊！" (HTML rendered)
      this.addCanvasBubble(ws.x + 20, ws.y + 10, '啊！', 'shout', '#ff0000')
    } else if (phase === 3) {
      // Person wiping desk, cat licking paw
      // Cat sitting
      this.drawEventCat(ws.x + 48, deskY - 8)
      // Wiping motion
      const wipeX = ws.x + 30 + Math.sin((f - 160) * 0.15) * 10
      ctx.fillStyle = ws.appearance.skinTone
      ctx.fillRect(wipeX, deskY - 3, 6, 3)
      // Reduced spill
      ctx.fillStyle = 'rgba(111,78,55,0.4)'
      ctx.fillRect(ws.x + 38, deskY - 2, 10, 2)
    }
  }

  private drawEventCat(x: number, y: number): void {
    const { ctx } = this
    // Stardew Valley style pixel cat
    ctx.fillStyle = '#f0a030'
    ctx.fillRect(x - 4, y - 3, 8, 6) // body
    ctx.fillRect(x - 6, y - 6, 5, 5) // head
    // Ears
    ctx.fillRect(x - 7, y - 8, 2, 3)
    ctx.fillRect(x - 3, y - 8, 2, 3)
    // Eyes
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(x - 6, y - 4, 1, 1)
    ctx.fillRect(x - 3, y - 4, 1, 1)
    // Tail
    ctx.fillStyle = '#e09020'
    ctx.fillRect(x + 4, y - 4, 2, 2)
    ctx.fillRect(x + 5, y - 6, 2, 3)
  }

  // ====== Off-Work System ======
  private checkOffWorkTime(): void {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()

    // 12:00-12:05 or 18:00-18:05 trigger window
    const isLunchTime = hour === 12 && minute >= 0 && minute < 5
    const isOffTime = hour === 18 && minute >= 0 && minute < 5

    if ((isLunchTime || isOffTime) && !this.offWork.active && !this.offWorkTriggeredThisHour) {
      this.triggerOffWork()
      this.offWorkTriggeredThisHour = true
    }

    // 13:30 lunch return or 18:30 off-work return
    const isLunchReturn = hour === 13 && minute >= 30
    const isOffReturn = hour === 18 && minute >= 30
    if ((isLunchReturn || isOffReturn) && this.offWork.active && this.offWork.phase === 'empty') {
      this.offWork.phase = 'returning'
      this.offWork.frame = 0
    }

    // Reset trigger flag well after the return window
    if ((hour === 13 && minute >= 35) || (hour === 19 && minute >= 0)) {
      this.offWorkTriggeredThisHour = false
    }
  }

  private triggerOffWork(): void {
    const leavingIndices: number[] = []
    this.displayMembers.forEach((member, i) => {
      if (!member.isCurrentUser) {
        leavingIndices.push(i)
      }
    })
    if (leavingIndices.length === 0) return

    this.offWork = {
      active: true,
      phase: 'leaving',
      frame: 0,
      leavingMembers: leavingIndices,
      memberOffsets: leavingIndices.map((_, idx) => ({
        delay: Math.floor(Math.random() * 60) + idx * 15,
        x: 0,
        gone: false,
      })),
      lonelyTimer: 0,
      lonelyTextIndex: 0,
    }
  }

  private updateOffWork(): void {
    this.offWork.frame++
    const f = this.offWork.frame

    if (this.offWork.phase === 'leaving') {
      let allGone = true
      for (let i = 0; i < this.offWork.memberOffsets.length; i++) {
        const offset = this.offWork.memberOffsets[i]
        if (f > offset.delay && !offset.gone) {
          offset.x += 1.5
          const memberIdx = this.offWork.leavingMembers[i]
          const ws = this.workstations[memberIdx]
          if (ws && ws.x + 24 + offset.x > CANVAS_W + 30) {
            offset.gone = true
          } else {
            allGone = false
          }
        } else if (!offset.gone) {
          allGone = false
        }
      }
      if (allGone) {
        this.offWork.phase = 'empty'
        this.offWork.frame = 0
        this.offWork.lonelyTimer = 0
      }
    } else if (this.offWork.phase === 'returning') {
      let allBack = true
      for (let i = 0; i < this.offWork.memberOffsets.length; i++) {
        const offset = this.offWork.memberOffsets[i]
        if (offset.x > 0) {
          offset.x -= 1.5
          if (offset.x <= 0) {
            offset.x = 0
            offset.gone = false
          } else {
            allBack = false
          }
        }
      }
      // Safety: max 300 frames (~5s) for returning, force complete
      if (allBack || this.offWork.frame > 300) {
        this.offWork.active = false
        this.offWork.phase = 'leaving'
        this.offWork.frame = 0
        // Force reset all offsets
        for (const offset of this.offWork.memberOffsets) {
          offset.x = 0
          offset.gone = false
        }
      }
    } else if (this.offWork.phase === 'empty') {
      this.offWork.lonelyTimer++
      // Change lonely text every 150 frames (~5 seconds)
      if (this.offWork.lonelyTimer % 150 === 0) {
        this.offWork.lonelyTextIndex = (this.offWork.lonelyTextIndex + 1) % LONELY_TEXTS.length
      }
      // Safety timeout: max ~90 minutes (324000 frames at 60fps), auto-end if stuck
      if (this.offWork.frame > 324000) {
        this.offWork.active = false
        this.offWork.phase = 'leaving'
        this.offWork.frame = 0
      }
    }
  }

  private drawOffWorkScene(): void {
    const { ctx } = this
    const phase = this.offWork.phase

    // Always draw current user's workstation normally
    const currentUserIdx = this.displayMembers.findIndex(m => m.isCurrentUser)

    if (phase === 'leaving') {
      // Draw all workstations
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        const leaveIdx = this.offWork.leavingMembers.indexOf(i)
        if (leaveIdx >= 0) {
          const offset = this.offWork.memberOffsets[leaveIdx]
          if (this.offWork.frame > offset.delay && !offset.gone) {
            // Person walking away
            this.drawWorkstationFurnitureOnly(ws)
            const walkX = ws.x + 24 + offset.x
            const walkY = ws.y + 50
            const bounce = Math.sin(this.offWork.frame * 0.2) * 1.5
            this.drawStandingPerson(walkX, walkY + bounce, ws.appearance, 'satisfied')
            // Backpack
            ctx.fillStyle = '#555555'
            ctx.fillRect(walkX - 7, walkY - 12, 5, 8)
            // Wave bye (HTML rendered)
            if (offset.x > 30 && offset.x < 80) {
              const texts = ['拜拜~', '下班啦!', '辛苦了...']
              this.addCanvasBubble(walkX + 3, walkY - 30, texts[leaveIdx % texts.length], 'speech', '#666666', 30)
            }
          } else if (offset.gone) {
            // Already gone - empty workstation
            this.drawWorkstationFurnitureOnly(ws)
          } else {
            // Not yet started leaving
            this.drawWorkstation(ws)
          }
        } else {
          // Current user - draw normally
          this.drawWorkstation(ws)
        }
      }
    } else if (phase === 'empty') {
      // Draw empty office with only current user
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        if (i === currentUserIdx) {
          this.drawWorkstation(ws)
        } else {
          this.drawWorkstationFurnitureOnly(ws)
        }
      }

      // Dim overlay (except current user's area)
      if (currentUserIdx >= 0) {
        const userWs = this.workstations[currentUserIdx]
        // Draw darkness mask with cutout for current user
        ctx.fillStyle = 'rgba(0,0,20,0.3)'
        // Top area
        ctx.fillRect(0, 0, CANVAS_W, userWs.y - 10)
        // Left
        ctx.fillRect(0, userWs.y - 10, userWs.x - 15, 100)
        // Right
        ctx.fillRect(userWs.x + 65, userWs.y - 10, CANVAS_W - userWs.x - 65, 100)
        // Bottom
        ctx.fillRect(0, userWs.y + 90, CANVAS_W, this.canvasH - userWs.y - 90)

        // Lonely user actions
        const actionCycle = this.offWork.lonelyTimer % 120
        if (actionCycle > 80 && actionCycle < 100) {
          // Sigh particle
          ctx.fillStyle = 'rgba(200,200,255,0.4)'
          const sighY = userWs.y + 25 - (actionCycle - 80) * 0.5
          ctx.fillRect(userWs.x + 30, sighY, 3, 2)
        }

        // Lonely text bubble (HTML rendered)
        if (this.offWork.lonelyTimer > 60 && (this.offWork.lonelyTimer % 150) < 80) {
          const text = LONELY_TEXTS[this.offWork.lonelyTextIndex]
          this.addCanvasBubble(userWs.x + 24, userWs.y - 20, text, 'thought', '#aaaaff', 80)
        }

        // Cat comes to comfort (during empty phase)
        if (this.offWork.lonelyTimer > 100) {
          const catX = userWs.x + 50
          const catY = userWs.y + 75
          this.drawEventCat(catX, catY)
          // Purring effect
          if ((this.offWork.lonelyTimer % 40) < 20) {
            ctx.fillStyle = 'rgba(255,150,150,0.6)'
            ctx.fillRect(catX - 2, catY - 10, 2, 2)
          }
        }
      }

      // Window sky color based on time
      const hour = new Date().getHours()
      if (hour >= 18) {
        // Evening - orange tint on windows
        ctx.fillStyle = 'rgba(255,140,50,0.15)'
        ctx.fillRect(53, 11, 44, 34)
        ctx.fillRect(313, 11, 44, 34)
        ctx.fillRect(563, 11, 44, 34)
      }
    } else if (phase === 'returning') {
      // Draw people walking back
      for (let i = 0; i < this.workstations.length; i++) {
        const ws = this.workstations[i]
        const leaveIdx = this.offWork.leavingMembers.indexOf(i)
        if (leaveIdx >= 0) {
          const offset = this.offWork.memberOffsets[leaveIdx]
          if (offset.x > 0) {
            // Still walking back
            this.drawWorkstationFurnitureOnly(ws)
            const walkX = ws.x + 24 + offset.x
            const walkY = ws.y + 50
            const bounce = Math.sin(this.offWork.frame * 0.2) * 1.5
            this.drawStandingPerson(walkX, walkY + bounce, ws.appearance, 'satisfied')
            // Carrying tea/snack
            ctx.fillStyle = '#88ddaa'
            ctx.fillRect(walkX + 5, walkY - 5, 4, 5)
            // "你还在啊？！" bubble for first person back (HTML rendered)
            if (leaveIdx === 0 && offset.x < 60) {
              this.addCanvasBubble(walkX + 8, walkY - 35, '你还在啊？！', 'speech', '#333333', 30)
            }
          } else {
            // Back at desk
            this.drawWorkstation(ws)
          }
        } else {
          this.drawWorkstation(ws)
        }
      }
    }
  }

  // ====== Off-Work: check if member is currently away ======
  isMemberAway(index: number): boolean {
    if (!this.offWork.active) return false
    const leaveIdx = this.offWork.leavingMembers.indexOf(index)
    if (leaveIdx < 0) return false
    if (this.offWork.phase === 'empty') return true
    if (this.offWork.phase === 'leaving') {
      return this.offWork.memberOffsets[leaveIdx]?.gone ?? false
    }
    if (this.offWork.phase === 'returning') {
      return (this.offWork.memberOffsets[leaveIdx]?.x ?? 0) > 30
    }
    return false
  }

  start() {
    this.animationId = requestAnimationFrame(this.render)
  }

  stop() {
    cancelAnimationFrame(this.animationId)
  }

  destroy() {
    this.stop()
    this.particles = []
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
  }

  // ====== Feed Animation Update ======
  private updateFeedState() {
    if (!this.feedState.active) return

    const fs = this.feedState
    fs.frame++

    if (fs.phase === 'walking') {
      const targetWs = this.workstations[fs.targetIndex]
      if (!targetWs) { fs.active = false; return }
      const targetX = targetWs.x + 24
      const targetY = targetWs.y + 50
      const dx = targetX - fs.x
      const dy = targetY - fs.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 3) {
        fs.phase = 'giving'
        fs.frame = 0
      } else {
        fs.x += (dx / dist) * 1.5
        fs.y += (dy / dist) * 1.5
      }
    } else if (fs.phase === 'giving') {
      if (fs.frame >= 40) {
        fs.phase = 'reaction'
        fs.frame = 0
      }
    } else if (fs.phase === 'reaction') {
      if (fs.frame >= 60) {
        fs.phase = 'returning'
        fs.frame = 0
        // Energize the target member
        this.energizedMembers.set(fs.targetIndex, 300)
      }
    } else if (fs.phase === 'returning') {
      const dx = fs.originX - fs.x
      const dy = fs.originY - fs.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 3) {
        fs.active = false
      } else {
        fs.x += (dx / dist) * 1.5
        fs.y += (dy / dist) * 1.5
      }
    }
  }

  private drawFeedState() {
    if (!this.feedState.active) return
    const { ctx } = this
    const fs = this.feedState

    // Draw the walking person (current user)
    const appearance = this.workstations[fs.currentUserIndex]?.appearance
    if (appearance) {
      this.drawSmallPerson(ctx, fs.x - 12, fs.y - 30, appearance)
    }

    // Draw feed item
    if (fs.phase === 'giving' || fs.phase === 'reaction') {
      const targetWs = this.workstations[fs.targetIndex]
      if (targetWs) {
        const itemX = targetWs.x + 24
        const itemY = targetWs.y + 35
        this.drawFeedItem(ctx, itemX, itemY, fs.feedType, fs.frame)
      }
    }

    // Draw reaction
    if (fs.phase === 'reaction') {
      const targetWs = this.workstations[fs.targetIndex]
      if (targetWs) {
        // Heart particles
        const heartY = targetWs.y + 10 - (fs.frame * 0.3)
        ctx.font = '10px sans-serif'
        ctx.fillStyle = '#ff6b6b'
        ctx.textAlign = 'center'
        const opacity = Math.max(0, 1 - fs.frame / 60)
        ctx.globalAlpha = opacity
        ctx.fillText('❤', targetWs.x + 24, heartY)
        // If bugCount > 3 show "续命了..." (HTML rendered)
        if (targetWs.bugCount > 3 && fs.frame > 20 && fs.frame < 55) {
          this.addCanvasBubble(targetWs.x + 24, targetWs.y + 5, '续命了...', 'thought', '#00ff88', 45)
        }
        ctx.globalAlpha = 1
        ctx.textAlign = 'left'
      }
    }
  }

  private drawFeedItem(ctx: CanvasRenderingContext2D, x: number, y: number, feedType: FeedType, frame: number) {
    const bobY = Math.sin(frame * 0.15) * 2
    if (feedType === 'coffee') {
      // Coffee cup
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(x - 3, y + bobY - 3, 6, 8)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x - 2, y + bobY - 2, 4, 2)
      // Steam
      if (frame % 10 < 5) {
        ctx.fillStyle = 'rgba(200,200,200,0.5)'
        ctx.fillRect(x - 1, y + bobY - 6, 1, 2)
        ctx.fillRect(x + 1, y + bobY - 7, 1, 2)
      }
    } else if (feedType === 'snack') {
      // Cookie
      ctx.fillStyle = '#D2691E'
      ctx.beginPath()
      ctx.arc(x, y + bobY, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#4a2500'
      ctx.fillRect(x - 1, y + bobY - 1, 2, 2)
      ctx.fillRect(x + 1, y + bobY + 1, 1, 1)
    } else {
      // Energy drink can
      ctx.fillStyle = '#00bcd4'
      ctx.fillRect(x - 3, y + bobY - 5, 6, 10)
      ctx.fillStyle = '#ffeb3b'
      ctx.fillRect(x - 2, y + bobY - 2, 4, 3)
      // Lightning bolt
      ctx.fillStyle = '#ffeb3b'
      ctx.fillRect(x - 1, y + bobY - 4, 2, 1)
    }
  }

  private drawSmallPerson(ctx: CanvasRenderingContext2D, x: number, y: number, appearance: PersonAppearance) {
    // Head
    ctx.fillStyle = appearance.skinTone
    ctx.fillRect(x + 4, y, 8, 8)
    // Hair
    ctx.fillStyle = appearance.hairColor
    ctx.fillRect(x + 4, y, 8, 3)
    // Body
    ctx.fillStyle = appearance.shirtColor
    ctx.fillRect(x + 3, y + 8, 10, 12)
    // Legs
    ctx.fillStyle = appearance.pantsColor
    ctx.fillRect(x + 4, y + 20, 4, 8)
    ctx.fillRect(x + 9, y + 20, 4, 8)
  }

  // ====== Cat Interaction Animation ======
  private updateCatInteraction() {
    if (!this.catInteraction.active) return

    const ci = this.catInteraction
    ci.frame++

    if (ci.phase === 'petting') {
      if (ci.frame >= 60) {
        ci.phase = 'happy'
        ci.frame = 0
      }
    } else if (ci.phase === 'happy') {
      if (ci.frame >= 40) {
        ci.active = false
      }
    } else if (ci.phase === 'runaway') {
      // Cat runs off screen
      this.cat.x += (this.cat.direction === 'right' ? 4 : -4)
      if (ci.frame >= 60) {
        ci.active = false
        // Reset cat position after runaway - will come back from opposite side
        this.cat.x = this.cat.direction === 'right' ? -20 : CANVAS_W + 20
        this.cat.direction = this.cat.direction === 'right' ? 'left' : 'right'
        this.catNewTarget()
      }
    }
  }

  private drawCatInteraction() {
    if (!this.catInteraction.active) return
    const { ctx } = this
    const ci = this.catInteraction
    const catX = this.cat.x
    const catY = this.cat.y

    if (ci.phase === 'petting') {
      // Draw a hand petting the cat
      const handOffset = Math.sin(ci.frame * 0.2) * 4
      ctx.fillStyle = '#ffdbac'
      ctx.fillRect(catX - 3 + handOffset, catY - 10, 8, 5)
      // Cat flips belly up (just squish vertically)
      ctx.fillStyle = '#ffa500'
      ctx.fillRect(catX - 5, catY + 2, 12, 4)
      // Paws up
      ctx.fillRect(catX - 4, catY, 3, 3)
      ctx.fillRect(catX + 3, catY, 3, 3)
    } else if (ci.phase === 'happy') {
      // Heart particles
      const heartY = catY - 8 - ci.frame * 0.3
      ctx.font = '8px sans-serif'
      ctx.textAlign = 'center'
      ctx.globalAlpha = Math.max(0, 1 - ci.frame / 40)
      ctx.fillStyle = '#ff6b6b'
      ctx.fillText('❤', catX, heartY)
      // "喵呜" bubble (HTML rendered)
      if (ci.frame < 25) {
        this.addCanvasBubble(catX + 18, catY - 14, '喵呜~', 'speech', '#333333', 25)
      }
      ctx.globalAlpha = 1
      ctx.textAlign = 'left'
    } else if (ci.phase === 'runaway') {
      // Speed lines
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        const lx = catX + (this.cat.direction === 'right' ? -10 - i * 5 : 10 + i * 5)
        ctx.beginPath()
        ctx.moveTo(lx, catY + i * 3)
        ctx.lineTo(lx + (this.cat.direction === 'right' ? -8 : 8), catY + i * 3)
        ctx.stroke()
      }
    }
  }

  // ====== Achievement Popup ======
  private updateAchievementPopup() {
    if (!this.achievementPopup) return
    this.achievementPopup.frame++
    if (this.achievementPopup.frame >= this.achievementPopup.duration) {
      this.achievementPopup = null
    }
  }

  private drawAchievementPopup() {
    if (!this.achievementPopup) return
    const { ctx } = this
    const popup = this.achievementPopup
    const progress = popup.frame / popup.duration

    // Fade in/out
    let alpha = 1
    if (progress < 0.1) alpha = progress / 0.1
    else if (progress > 0.8) alpha = (1 - progress) / 0.2
    ctx.globalAlpha = alpha

    // Golden background bar
    const centerX = CANVAS_W / 2
    const centerY = this.canvasH / 2 - 30
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillRect(centerX - 80, centerY - 15, 160, 30)
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 2
    ctx.strokeRect(centerX - 80, centerY - 15, 160, 30)

    // Text
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('🏆 成就解锁!', centerX, centerY - 3)
    ctx.fillStyle = '#ffffff'
    ctx.font = '9px monospace'
    ctx.fillText(popup.name, centerX, centerY + 10)
    ctx.textAlign = 'left'

    // Gold particles
    if (popup.frame % 3 === 0 && progress < 0.7) {
      this.particles.push({
        x: centerX - 60 + Math.random() * 120,
        y: centerY - 15,
        vx: (Math.random() - 0.5) * 2,
        vy: -(1 + Math.random() * 2),
        life: 30,
        maxLife: 30,
        color: '#ffd700',
        size: 2,
        type: 'sparkle',
      })
    }

    ctx.globalAlpha = 1
  }

  // ====== Energized State Drawing ======
  private updateEnergizedMembers() {
    for (const [idx, remaining] of this.energizedMembers.entries()) {
      if (remaining <= 0) {
        this.energizedMembers.delete(idx)
      } else {
        this.energizedMembers.set(idx, remaining - 1)
      }
    }
  }

  private drawEnergizedEffects() {
    const { ctx } = this
    for (const [idx, remaining] of this.energizedMembers.entries()) {
      if (idx >= this.workstations.length) continue
      const ws = this.workstations[idx]
      // Small stars around workstation
      const phase = (300 - remaining) * 0.05
      for (let i = 0; i < 3; i++) {
        const angle = phase + (i * Math.PI * 2) / 3
        const sx = ws.x + 24 + Math.cos(angle) * 18
        const sy = ws.y + 35 + Math.sin(angle) * 12
        ctx.fillStyle = '#ffeb3b'
        ctx.globalAlpha = 0.6 + Math.sin(phase * 2 + i) * 0.3
        ctx.fillRect(sx - 1, sy - 1, 3, 3)
      }
      ctx.globalAlpha = 1
    }
  }
}
