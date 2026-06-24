// Note: sprites.ts still available but we draw procedurally for flexibility
// import { PALETTE, PROGRAMMER_SPRITES, BOSS_SPRITES, SpriteFrame } from './sprites'

export type ProgrammerState = 'idle' | 'relaxed' | 'working' | 'anxious' | 'crazy' | 'collapse'

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
  transitionFrame: number // for smooth transitions
  prevAction: PersonAction | null
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
  shirtColor: string; hairColor: string; hairStyle: 'short' | 'medium' | 'long' | 'bun'
  pantsColor: string
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

// === Environment State ===
interface EnvironmentState {
  cloudX: number
  ambientColor: string
  lightFlicker: number
  musicNoteTimer: number
  totalBugs: number
}

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
const CANVAS_H = 350

const WALL_TOP = 0
const WALL_BOTTOM = 70
const WORK_TOP = 70
const WORK_BOTTOM = 285
const FLOOR_TOP = 285
const FLOOR_BOTTOM = 350

// Colors
const SHIRT_COLORS = ['#4a90d9', '#d94a4a', '#4ad99a', '#d9a84a', '#9a4ad9', '#4ad9d9', '#d94a9a', '#7a7a7a']
const HAIR_COLORS = ['#3d2314', '#1a1a1a', '#8b4513', '#daa520', '#2f1b0e', '#4a3728', '#c0392b', '#5d4037']
const PANTS_COLORS = ['#2c3e50', '#1a237e', '#3e2723', '#263238', '#4a148c', '#004d40']

function simpleHash(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function getPersonAppearance(name: string): PersonAppearance {
  const hash = simpleHash(name)
  const styles: ('short' | 'medium' | 'long' | 'bun')[] = ['short', 'medium', 'long', 'bun']
  return {
    shirtColor: SHIRT_COLORS[hash % SHIRT_COLORS.length],
    hairColor: HAIR_COLORS[(hash * 3) % HAIR_COLORS.length],
    hairStyle: styles[(hash * 7) % styles.length],
    pantsColor: PANTS_COLORS[(hash * 11) % PANTS_COLORS.length],
  }
}

function getDecorations(name: string): string[] {
  const hash = simpleHash(name)
  const decorations = ['plant', 'catToy', 'coffee', 'frame', 'lamp', 'waterCup', 'snack', 'figure']
  const d1 = decorations[hash % decorations.length]
  const d2 = decorations[(hash * 7 + 3) % decorations.length]
  return d1 === d2 ? [d1] : [d1, d2]
}

// === Action selection based on bugCount ===
function selectPersonAction(bugCount: number, seed: number): PersonAction {
  const r = ((seed * 1664525 + 1013904223) >>> 0) / 4294967296
  if (bugCount === 0) {
    // Relaxed: high chance slacking/phone/chatting/drinking
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
    // 8+ bugs: exhausted
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
  private starPositions: { x: number; y: number; phase: number }[] = []

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get 2d context')
    this.ctx = ctx
    this.ctx.imageSmoothingEnabled = false
    this.cat = {
      x: 100, y: FLOOR_TOP + 25, targetX: 300,
      state: 'walking', direction: 'right', frame: 0, stateTimer: 0,
      yarnBallX: 150, yarnBallY: FLOOR_TOP + 35,
    }
    this.boss = {
      active: false, x: CANVAS_W - 35, y: FLOOR_TOP + 30,
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
    // Pre-generate star positions for windows
    for (let i = 0; i < 8; i++) {
      this.starPositions.push({
        x: Math.random() * 40,
        y: Math.random() * 28,
        phase: Math.floor(Math.random() * 120),
      })
    }
  }

  setState(state: ProgrammerState) {
    if (this.state !== state) {
      this.state = state
    }
  }

  setTeamMembers(members: TeamMemberData[]) {
    if (members.length > 10) {
      const sorted = [...members].sort((a, b) => b.bugCount - a.bugCount)
      this.displayMembers = sorted.slice(0, 10)
      this.overflowCount = members.length - 10
    } else {
      this.displayMembers = members
      this.overflowCount = 0
    }
    this.buildWorkstations()
    this.initPersonStates()
    // Update environment total bugs
    this.environment.totalBugs = members.reduce((sum, m) => sum + m.bugCount, 0)
  }

  updateTeamMembers(members: TeamMemberData[]) {
    this.setTeamMembers(members)
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
      active: true, x: CANVAS_W - 35, y: FLOOR_TOP + 30,
      targetX, targetMemberIndex,
      phase: 'walking', frame: 0, whipFrame: 0,
      whipCount: 0, speechBubbleTimer: 0,
      speechText: bubbleTexts[Math.floor(Math.random() * bubbleTexts.length)],
    }
  }

  private initPersonStates() {
    const existing = new Map(this.personStates)
    this.personStates.clear()
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
        })
      }
    }
  }

  private updatePersonStates() {
    for (const ws of this.workstations) {
      const ps = this.personStates.get(ws.name)
      if (!ps) continue
      ps.actionTimer++
      if (ps.transitionFrame > 0) {
        ps.transitionFrame--
      }
      if (ps.actionTimer >= ps.actionDuration) {
        // Switch to new action
        ps.prevAction = ps.currentAction
        ps.transitionFrame = 10
        const seed = simpleHash(ws.name) * 31 + this.frameCount
        ps.currentAction = selectPersonAction(ws.bugCount, seed)
        ps.actionTimer = 0
        ps.actionDuration = 120 + Math.floor(((seed * 7) % 180))
      }
    }
  }

  private buildWorkstations() {
    this.workstations = []
    const members = this.displayMembers
    if (members.length === 0) return

    const count = members.length
    const maxPerRow = count <= 5 ? count : Math.min(6, Math.ceil(count / 2))
    const row1Count = Math.min(count, maxPerRow)
    const row2Count = Math.max(0, count - maxPerRow)

    const margin = 20
    const availW = CANVAS_W - margin * 2
    const slotW1 = row1Count > 0 ? availW / row1Count : 0
    const slotW2 = row2Count > 0 ? availW / row2Count : 0

    const row1Y = WORK_TOP + 30
    const row2Y = WORK_TOP + 130

    for (let i = 0; i < row1Count; i++) {
      const m = members[i]
      this.workstations.push({
        x: margin + i * slotW1 + slotW1 / 2 - 24,
        y: row1Y,
        name: m.name, state: getStateFromBugCount(m.bugCount),
        bugCount: m.bugCount, decorations: getDecorations(m.name),
        appearance: getPersonAppearance(m.name),
      })
    }
    for (let i = 0; i < row2Count; i++) {
      const m = members[maxPerRow + i]
      this.workstations.push({
        x: margin + i * slotW2 + slotW2 / 2 - 24,
        y: row2Y,
        name: m.name, state: getStateFromBugCount(m.bugCount),
        bugCount: m.bugCount, decorations: getDecorations(m.name),
        appearance: getPersonAppearance(m.name),
      })
    }
  }

  // ====== Drawing: Background ======
  private drawBackground() {
    const { ctx } = this
    // Wall
    ctx.fillStyle = '#2a2a40'
    ctx.fillRect(0, WALL_TOP, CANVAS_W, WALL_BOTTOM - WALL_TOP)
    ctx.fillStyle = '#3a3a55'
    for (let i = 0; i < CANVAS_W; i += 40) ctx.fillRect(i, 0, 1, WALL_BOTTOM)
    ctx.fillRect(0, 35, CANVAS_W, 1)

    // Floor (work area)
    ctx.fillStyle = '#3d3530'
    ctx.fillRect(0, WORK_TOP, CANVAS_W, WORK_BOTTOM - WORK_TOP)
    ctx.fillStyle = '#4a4540'
    for (let y = WORK_TOP; y < WORK_BOTTOM; y += 30) {
      ctx.fillRect(0, y, CANVAS_W, 1)
    }

    // Bottom corridor
    ctx.fillStyle = '#3d2b1f'
    ctx.fillRect(0, FLOOR_TOP, CANVAS_W, FLOOR_BOTTOM - FLOOR_TOP)
    ctx.fillStyle = '#4d3b2f'
    for (let i = 0; i < CANVAS_W; i += 20) {
      ctx.fillRect(i, FLOOR_TOP, 10, FLOOR_BOTTOM - FLOOR_TOP)
    }
    ctx.fillStyle = '#5a4a3a'
    ctx.fillRect(0, FLOOR_TOP, CANVAS_W, 2)

    // Windows
    this.drawWindow(50, 8, 50, 40)
    this.drawWindow(310, 8, 50, 40)
    this.drawWindow(560, 8, 50, 40)

    // Bulletin board
    this.drawBulletinBoard(180, 10)

    // Clock
    this.drawClock(470, 28)

    // Boss door
    this.drawBossDoor()

    // Water cooler
    this.drawWaterCooler(CANVAS_W - 50, FLOOR_TOP + 8)

    // Overflow indicator
    if (this.overflowCount > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(CANVAS_W - 90, WORK_BOTTOM - 22, 80, 18)
      ctx.fillStyle = '#aaaaaa'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`+${this.overflowCount} 其他`, CANVAS_W - 50, WORK_BOTTOM - 9)
      ctx.textAlign = 'left'
    }
  }

  private drawWindow(x: number, y: number, w: number, h: number) {
    const { ctx } = this
    ctx.fillStyle = '#555555'
    ctx.fillRect(x, y, w, h)
    // Night sky
    ctx.fillStyle = '#1a3a5c'
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6)

    // Cloud drifting across
    const cloudOffset = this.environment.cloudX
    const cloudInWindow = ((cloudOffset + x * 0.3) % (w + 30)) - 15
    if (cloudInWindow > -10 && cloudInWindow < w - 6) {
      ctx.fillStyle = 'rgba(180,200,220,0.3)'
      const cx = x + 3 + Math.max(0, Math.min(cloudInWindow, w - 20))
      ctx.fillRect(cx, y + h / 2 - 2, 12, 4)
      ctx.fillRect(cx + 2, y + h / 2 - 4, 8, 3)
    }

    // Cross frame
    ctx.fillStyle = '#555555'
    ctx.fillRect(x + w / 2 - 1, y + 3, 2, h - 6)
    ctx.fillRect(x + 3, y + h / 2 - 1, w - 6, 2)

    // Moon
    ctx.fillStyle = '#ffffcc'
    ctx.fillRect(x + w - 15, y + 8, 4, 4)
    ctx.fillRect(x + w - 14, y + 7, 2, 1)

    // Twinkling stars (more stars with varied timing)
    const windowIdx = Math.floor((x - 50) / 260)
    for (let i = windowIdx * 3; i < windowIdx * 3 + 3 && i < this.starPositions.length; i++) {
      const star = this.starPositions[i]
      const twinkle = (this.frameCount + star.phase) % (80 + i * 20)
      if (twinkle < 45) {
        ctx.fillStyle = twinkle < 20 ? '#ffffff' : 'rgba(255,255,255,0.6)'
        const sx = x + 5 + (star.x % (w - 16))
        const sy = y + 5 + (star.y % (h - 12))
        ctx.fillRect(sx, sy, 2, 2)
        // Cross sparkle on brightest frames
        if (twinkle < 10) {
          ctx.fillRect(sx - 1, sy + 0.5, 1, 1)
          ctx.fillRect(sx + 2, sy + 0.5, 1, 1)
        }
      }
    }
  }

  private drawBulletinBoard(x: number, y: number) {
    const { ctx } = this
    ctx.fillStyle = '#8b6914'
    ctx.fillRect(x, y, 60, 42)
    ctx.fillStyle = '#c9a96e'
    ctx.fillRect(x + 3, y + 3, 54, 36)
    const noteColors = ['#ff6b6b', '#ffd93d', '#6bcfff', '#77dd77', '#ffb3de']
    for (let i = 0; i < 4; i++) {
      const nx = x + 5 + (i % 2) * 28
      const ny = y + 6 + Math.floor(i / 2) * 18
      ctx.fillStyle = noteColors[(42 + i * 3) % noteColors.length]
      ctx.fillRect(nx, ny, 20, 14)
    }
  }

  private drawClock(x: number, y: number) {
    const { ctx } = this
    // Clock face
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 8, y - 8, 16, 16)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(x - 7, y - 7, 14, 14)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 6, y - 6, 12, 12)

    // Hour markers
    ctx.fillStyle = '#333333'
    ctx.fillRect(x - 1, y - 5, 2, 1) // 12
    ctx.fillRect(x - 1, y + 4, 2, 1) // 6
    ctx.fillRect(x - 5, y - 1, 1, 2) // 9
    ctx.fillRect(x + 4, y - 1, 1, 2) // 3

    // Smooth rotating hands
    const sec = this.frameCount / 60
    ctx.fillStyle = '#000000'
    // Hour hand (slow)
    const hAngle = sec * 0.02
    const hhx = Math.cos(hAngle - Math.PI / 2) * 3
    const hhy = Math.sin(hAngle - Math.PI / 2) * 3
    ctx.fillRect(x + hhx - 0.5, y + hhy - 0.5, 2, 2)
    // Minute hand (faster)
    const mAngle = sec * 0.2
    const mhx = Math.cos(mAngle - Math.PI / 2) * 4.5
    const mhy = Math.sin(mAngle - Math.PI / 2) * 4.5
    ctx.fillRect(x + mhx - 0.5, y + mhy - 0.5, 1.5, 1.5)
    // Second hand (red, fast)
    ctx.fillStyle = '#cc0000'
    const sAngle = sec * 1.0
    const shx = Math.cos(sAngle - Math.PI / 2) * 5
    const shy = Math.sin(sAngle - Math.PI / 2) * 5
    ctx.fillRect(x + shx - 0.3, y + shy - 0.3, 1, 1)
    // Center dot
    ctx.fillStyle = '#000000'
    ctx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5)
  }

  private drawBossDoor() {
    const { ctx } = this
    const dx = CANVAS_W - 42
    const dy = FLOOR_TOP + 4
    ctx.fillStyle = '#4a3520'
    ctx.fillRect(dx, dy, 30, 55)
    ctx.fillStyle = '#5d4430'
    ctx.fillRect(dx + 2, dy + 2, 26, 51)
    ctx.fillStyle = '#f1c40f'
    ctx.fillRect(dx + 5, dy + 28, 3, 3)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('BOSS', dx + 15, dy + 14)
    ctx.textAlign = 'left'
  }

  private drawWaterCooler(x: number, y: number) {
    const { ctx } = this
    // Body
    ctx.fillStyle = '#b0bec5'
    ctx.fillRect(x, y, 12, 30)
    // Water bottle
    ctx.fillStyle = '#4fc3f7'
    ctx.fillRect(x + 2, y - 8, 8, 10)
    ctx.fillStyle = '#81d4fa'
    ctx.fillRect(x + 3, y - 6, 6, 6)
    // Spout
    ctx.fillStyle = '#78909c'
    ctx.fillRect(x + 4, y + 14, 6, 3)

    // Bubbles rising inside water bottle
    const bubblePhase = this.frameCount % 150
    if (bubblePhase < 30) {
      ctx.fillStyle = 'rgba(200,230,255,0.6)'
      const by1 = y - 2 - (bubblePhase * 0.15)
      ctx.fillRect(x + 4, by1, 2, 2)
      if (bubblePhase > 10) {
        const by2 = y - 1 - ((bubblePhase - 10) * 0.15)
        ctx.fillRect(x + 7, by2, 1, 1)
      }
    }
  }

  // ====== Drawing: Workstations ======
  private drawWorkstation(ws: Workstation) {
    const { ctx } = this
    const { x, y } = ws

    const deskW = 48, deskH = 10
    const deskX = x, deskY = y + 50

    // Chair
    ctx.fillStyle = '#444444'
    ctx.fillRect(x + 16, y + 60, 16, 16)
    ctx.fillStyle = '#555555'
    ctx.fillRect(x + 18, y + 54, 12, 8)

    // Desk surface
    ctx.fillStyle = '#a0784c'
    ctx.fillRect(deskX, deskY, deskW, deskH)
    ctx.fillStyle = '#8b6914'
    ctx.fillRect(deskX, deskY + deskH - 2, deskW, 2)
    ctx.fillStyle = '#6b4f10'
    ctx.fillRect(deskX + 3, deskY + deskH, 4, 14)
    ctx.fillRect(deskX + deskW - 7, deskY + deskH, 4, 14)

    // Monitor
    const monX = x + 14, monY = y + 26
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(monX, monY, 20, 16)

    // Screen - check if person is slacking (rainbow screen)
    const ps = this.personStates.get(ws.name)
    const isSlacking = ps?.currentAction === 'slacking'

    if (isSlacking) {
      // Colorful video stripes
      const colors = ['#ff4466', '#44ff66', '#4488ff', '#ffdd44', '#ff66ff']
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = colors[(i + Math.floor(this.frameCount / 8)) % colors.length]
        ctx.fillRect(monX + 2, monY + 2 + i * 3, 16, 3)
      }
    } else {
      const screenColor = ws.bugCount >= 8 ? '#ff4444' : ws.bugCount >= 5 ? '#ffaa00' : '#00ff88'
      ctx.fillStyle = screenColor
      ctx.fillRect(monX + 2, monY + 2, 16, 12)
      ctx.fillStyle = ws.bugCount >= 8 ? '#ff8888' : '#00cc66'
      for (let i = 0; i < 3; i++) {
        const lw = 4 + ((i * 3 + this.frameCount / 15) % 8)
        ctx.fillRect(monX + 4, monY + 4 + i * 4, lw, 2)
      }
    }

    // Screen sparkle (occasional glint)
    if (this.frameCount % 200 < 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillRect(monX + 3, monY + 3, 2, 1)
    }

    // Monitor stand
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(monX + 8, monY + 16, 4, 4)
    ctx.fillRect(monX + 5, monY + 19, 10, 2)

    // Keyboard
    ctx.fillStyle = '#333333'
    ctx.fillRect(x + 12, deskY - 6, 24, 6)
    ctx.fillStyle = '#444444'
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x + 14 + i * 4, deskY - 5, 3, 2)
    }

    // Decorations
    ws.decorations.forEach((deco, i) => {
      this.drawDecoration(deskX, deskY, deco, i, deskW)
    })

    // Person with action system
    this.drawPersonWithAction(x + 12, y + 36, ws)
  }

  private drawDecoration(deskX: number, deskY: number, deco: string, index: number, deskW: number) {
    const { ctx } = this
    const ox = index === 0 ? deskX + 2 : deskX + deskW - 10

    switch (deco) {
      case 'plant':
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(ox, deskY - 6, 6, 5)
        ctx.fillStyle = '#228B22'
        ctx.fillRect(ox + 1, deskY - 10, 4, 5)
        ctx.fillStyle = '#32CD32'
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
        ctx.fillStyle = '#D2691E'
        ctx.fillRect(ox, deskY - 6, 5, 5)
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(ox + 5, deskY - 4, 2, 3)
        // Steam from coffee
        if (this.frameCount % 40 < 20) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          const steamOff = Math.sin(this.frameCount * 0.08) * 1
          ctx.fillRect(ox + 1 + steamOff, deskY - 8, 1, 2)
          ctx.fillRect(ox + 3 - steamOff, deskY - 9, 1, 2)
        }
        break
      case 'frame':
        ctx.fillStyle = '#4169E1'
        ctx.fillRect(ox, deskY - 8, 7, 7)
        ctx.fillStyle = '#87CEEB'
        ctx.fillRect(ox + 1, deskY - 7, 5, 5)
        break
      case 'lamp':
        ctx.fillStyle = '#333333'
        ctx.fillRect(ox + 2, deskY - 5, 2, 5)
        ctx.fillStyle = '#FFD700'
        ctx.fillRect(ox, deskY - 9, 6, 4)
        break
      case 'waterCup':
        ctx.fillStyle = 'rgba(100,149,237,0.8)'
        ctx.fillRect(ox, deskY - 6, 4, 6)
        ctx.fillStyle = 'rgba(135,206,250,0.6)'
        ctx.fillRect(ox + 1, deskY - 4, 2, 3)
        break
      case 'snack':
        ctx.fillStyle = '#FF6347'
        ctx.fillRect(ox, deskY - 5, 6, 4)
        ctx.fillStyle = '#FFD700'
        ctx.fillRect(ox + 1, deskY - 4, 4, 2)
        break
      case 'figure':
        ctx.fillStyle = index === 0 ? '#FF4500' : '#1E90FF'
        ctx.fillRect(ox + 1, deskY - 8, 4, 5)
        ctx.fillStyle = '#FFE4C4'
        ctx.fillRect(ox + 1, deskY - 10, 4, 2)
        break
    }
  }

  // ====== Drawing: Person with Action System ======
  private drawPersonWithAction(x: number, y: number, ws: Workstation) {
    const ps = this.personStates.get(ws.name)
    if (!ps) {
      // Fallback to basic drawing
      this.drawPerson(x, y, ws.state, ws.appearance)
      return
    }

    const { ctx } = this
    const app = ws.appearance
    let bodyOffY = 0
    const headX = x + 6, headY = y + bodyOffY
    const action = ps.currentAction

    // Transition blending factor (1 = fully new action, 0 = blend)
    const blend = ps.transitionFrame > 0 ? (10 - ps.transitionFrame) / 10 : 1

    // === Head & Hair ===
    let headOffX = 0
    let headOffY = 0

    if (action === 'phone') headOffY = 1  // Looking down
    if (action === 'chatting') headOffX = 2  // Turned slightly
    if (action === 'yawning') headOffY = -1
    if (action === 'stretching') headOffY = -2

    // Apply blend to offsets
    headOffX = Math.round(headOffX * blend)
    headOffY = Math.round(headOffY * blend)

    const hx = headX + headOffX
    const hy = headY + headOffY

    // Hair
    ctx.fillStyle = app.hairColor
    switch (app.hairStyle) {
      case 'short':
        ctx.fillRect(hx, hy, 12, 4)
        ctx.fillRect(hx + 1, hy + 4, 10, 2)
        break
      case 'medium':
        ctx.fillRect(hx - 1, hy - 1, 14, 5)
        ctx.fillRect(hx, hy + 4, 12, 3)
        break
      case 'long':
        ctx.fillRect(hx - 1, hy - 1, 14, 5)
        ctx.fillRect(hx - 1, hy + 4, 2, 10)
        ctx.fillRect(hx + 11, hy + 4, 2, 10)
        ctx.fillRect(hx, hy + 4, 12, 2)
        break
      case 'bun':
        ctx.fillRect(hx, hy, 12, 4)
        ctx.fillRect(hx + 3, hy - 3, 6, 4)
        ctx.fillRect(hx + 1, hy + 4, 10, 2)
        break
    }

    // Face
    ctx.fillStyle = '#ffdbac'
    ctx.fillRect(hx + 1, hy + 4, 10, 10)

    // Eyes
    ctx.fillStyle = '#000000'
    const blink = this.frameCount % 120 > 115
    if (action === 'yawning') {
      // Squinting eyes during yawn
      ctx.fillRect(hx + 3, hy + 7, 3, 1)
      ctx.fillRect(hx + 8, hy + 7, 3, 1)
    } else if (action === 'phone') {
      // Looking down
      ctx.fillRect(hx + 3, hy + 8, 2, 2)
      ctx.fillRect(hx + 8, hy + 8, 2, 2)
    } else if (blink) {
      ctx.fillRect(hx + 3, hy + 7, 3, 1)
      ctx.fillRect(hx + 8, hy + 7, 3, 1)
    } else {
      ctx.fillRect(hx + 3, hy + 6, 2, 2)
      ctx.fillRect(hx + 8, hy + 6, 2, 2)
    }

    // Mouth based on action
    if (action === 'yawning') {
      ctx.fillStyle = '#000000'
      // Big open mouth
      ctx.fillRect(hx + 4, hy + 10, 5, 3)
      ctx.fillStyle = '#cc4444'
      ctx.fillRect(hx + 5, hy + 11, 3, 1)
    } else if (action === 'chatting') {
      // Talking - animated mouth
      const mouthOpen = this.frameCount % 20 < 10
      ctx.fillStyle = '#000000'
      ctx.fillRect(hx + 4, hy + 11, 4, mouthOpen ? 2 : 1)
    } else if (action === 'slacking') {
      // Slight smile
      ctx.fillStyle = '#000000'
      ctx.fillRect(hx + 4, hy + 11, 4, 1)
      ctx.fillRect(hx + 3, hy + 11, 1, 1)
      ctx.fillRect(hx + 8, hy + 11, 1, 1)
    } else if (ws.state === 'anxious' || ws.state === 'crazy' || ws.state === 'collapse') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(hx + 4, hy + 11, 4, 2)
    } else {
      ctx.fillStyle = '#000000'
      ctx.fillRect(hx + 4, hy + 11, 4, 1)
    }

    // Body / Shirt
    ctx.fillStyle = app.shirtColor
    ctx.fillRect(hx - 1, hy + 14, 14, 10)

    // Arms based on action
    this.drawArmsForAction(hx, hy, action, app, ps)

    // Pants
    ctx.fillStyle = app.pantsColor
    ctx.fillRect(hx, hy + 24, 12, 6)
    // Legs/shoes
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(hx + 1, hy + 30, 4, 3)
    ctx.fillRect(hx + 7, hy + 30, 4, 3)

    // Action-specific extra effects
    this.drawActionEffects(hx, hy, action, ws)
  }

  private drawArmsForAction(hx: number, hy: number, action: PersonAction, app: PersonAppearance, ps: PersonState) {
    const { ctx } = this
    ctx.fillStyle = '#ffdbac'

    switch (action) {
      case 'typing': {
        const handOffset = Math.sin(this.frameCount * 0.15) > 0 ? 1 : -1
        ctx.fillRect(hx - 3 + handOffset, hy + 20, 3, 4)
        ctx.fillRect(hx + 12 - handOffset, hy + 20, 3, 4)
        break
      }
      case 'typing_fast': {
        const handOff = Math.sin(this.frameCount * 0.3) > 0 ? 1 : -1
        const handOff2 = Math.cos(this.frameCount * 0.3) > 0 ? 1 : -1
        ctx.fillRect(hx - 3 + handOff, hy + 19, 3, 4)
        ctx.fillRect(hx + 12 + handOff2, hy + 19, 3, 4)
        break
      }
      case 'stretching': {
        // Arms raised above head
        const progress = Math.min(ps.actionTimer / 20, 1)
        const armY = hy + 20 - Math.round(progress * 18)
        ctx.fillRect(hx - 4, armY, 3, 4)
        ctx.fillRect(hx + 13, armY, 3, 4)
        // Draw shirt sleeve extending up
        ctx.fillStyle = app.shirtColor
        ctx.fillRect(hx - 3, hy + 14, 3, Math.max(1, 8 - Math.round(progress * 6)))
        ctx.fillRect(hx + 12, hy + 14, 3, Math.max(1, 8 - Math.round(progress * 6)))
        break
      }
      case 'drinking': {
        // One hand holds cup to mouth
        const cupPhase = Math.min(ps.actionTimer / 30, 1)
        const cupY = hy + 20 - Math.round(cupPhase * 14)
        // Left arm normal
        ctx.fillRect(hx - 3, hy + 20, 3, 4)
        // Right arm raised with cup
        ctx.fillRect(hx + 12, cupY, 3, 4)
        // Cup
        ctx.fillStyle = '#D2691E'
        ctx.fillRect(hx + 14, cupY - 2, 4, 5)
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(hx + 18, cupY, 2, 3)
        break
      }
      case 'scratching': {
        // One hand on head
        const scratchOff = Math.sin(this.frameCount * 0.2) * 1
        ctx.fillRect(hx + 1 + scratchOff, hy - 1, 3, 4) // Right hand on head
        ctx.fillRect(hx - 3, hy + 20, 3, 4) // Left arm down
        break
      }
      case 'phone': {
        // Both hands together holding phone (lower position)
        ctx.fillRect(hx + 3, hy + 20, 3, 3)
        ctx.fillRect(hx + 7, hy + 20, 3, 3)
        // Phone (small rectangle)
        ctx.fillStyle = '#333333'
        ctx.fillRect(hx + 4, hy + 19, 5, 7)
        ctx.fillStyle = '#4488ff'
        ctx.fillRect(hx + 5, hy + 20, 3, 4)
        break
      }
      case 'chatting': {
        // One hand gesturing
        const gestFrame = Math.sin(this.frameCount * 0.1) * 2
        ctx.fillRect(hx + 13, hy + 16 + gestFrame, 3, 4)
        ctx.fillRect(hx - 3, hy + 20, 3, 4)
        break
      }
      case 'yawning': {
        // One hand covering mouth
        ctx.fillRect(hx + 3, hy + 9, 4, 4) // Hand near mouth
        ctx.fillRect(hx - 3, hy + 20, 3, 4) // Other arm down
        break
      }
      case 'slacking': {
        // Normal arms but occasionally looking back
        const lookBack = (this.frameCount % 180) < 15
        if (lookBack) {
          // Turn head effect already handled above
          ctx.fillRect(hx - 4, hy + 18, 3, 4)
          ctx.fillRect(hx + 13, hy + 18, 3, 4)
        } else {
          ctx.fillRect(hx - 3, hy + 20, 3, 4)
          ctx.fillRect(hx + 12, hy + 20, 3, 4)
        }
        break
      }
      case 'standing':
      default: {
        ctx.fillRect(hx - 2, hy + 20, 3, 4)
        ctx.fillRect(hx + 11, hy + 20, 3, 4)
        break
      }
    }
  }

  private drawActionEffects(hx: number, hy: number, action: PersonAction, ws: Workstation) {
    const { ctx } = this

    // Chat bubble "..."
    if (action === 'chatting') {
      const bubbleY = hy - 8
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(hx + 12, bubbleY, 14, 8)
      ctx.fillStyle = '#333333'
      // Three dots
      const dotAnim = Math.floor(this.frameCount / 15) % 4
      for (let i = 0; i < 3; i++) {
        if (i <= dotAnim) {
          ctx.fillRect(hx + 14 + i * 4, bubbleY + 3, 2, 2)
        }
      }
    }

    // Sweat drops for anxious states
    if (ws.state === 'anxious' && this.frameCount % 45 < 30) {
      ctx.fillStyle = '#66ccff'
      ctx.fillRect(hx + 12, hy + 3, 2, 3)
    }
    if (ws.state === 'crazy' && this.frameCount % 20 < 15) {
      ctx.fillStyle = 'rgba(150,150,150,0.6)'
      const oy = Math.sin(this.frameCount / 10) * 2
      ctx.fillRect(hx + 2, hy - 5 + oy, 3, 3)
      ctx.fillRect(hx + 7, hy - 7 + oy, 2, 2)
    }
    if (ws.state === 'collapse') {
      ctx.fillStyle = 'rgba(100,100,100,0.4)'
      ctx.fillRect(hx - 2, hy - 2, 16, 2)
    }

    // Typing fast - keyboard sparks
    if (action === 'typing_fast' && this.frameCount % 12 < 4) {
      ctx.fillStyle = 'rgba(255,255,100,0.5)'
      ctx.fillRect(hx + 2 + (this.frameCount % 8), hy + 25, 2, 1)
    }
  }

  // Fallback basic person drawing (for edge cases)
  private drawPerson(x: number, y: number, state: ProgrammerState, app: PersonAppearance) {
    const { ctx } = this
    let bodyOffY = 0
    if (state === 'relaxed') bodyOffY = -1
    if (state === 'anxious') bodyOffY = 1
    const headX = x + 6, headY = y + bodyOffY
    ctx.fillStyle = app.hairColor
    ctx.fillRect(headX, headY, 12, 4)
    ctx.fillRect(headX + 1, headY + 4, 10, 2)
    ctx.fillStyle = '#ffdbac'
    ctx.fillRect(headX + 1, headY + 4, 10, 10)
    ctx.fillStyle = '#000000'
    ctx.fillRect(headX + 3, headY + 6, 2, 2)
    ctx.fillRect(headX + 8, headY + 6, 2, 2)
    ctx.fillStyle = app.shirtColor
    ctx.fillRect(headX - 1, headY + 14, 14, 10)
    ctx.fillStyle = '#ffdbac'
    ctx.fillRect(headX - 2, headY + 20, 3, 4)
    ctx.fillRect(headX + 11, headY + 20, 3, 4)
    ctx.fillStyle = app.pantsColor
    ctx.fillRect(headX, headY + 24, 12, 6)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(headX + 1, headY + 30, 4, 3)
    ctx.fillRect(headX + 7, headY + 30, 4, 3)
  }

  // ====== Public: Label Position for HTML overlay ======
  getMemberLabelPosition(index: number): { x: number; y: number } | null {
    if (index >= this.workstations.length) return null
    const ws = this.workstations[index]
    return { x: ws.x + 24, y: ws.y + 10 }
  }

  getDisplayMembers(): TeamMemberData[] {
    return this.displayMembers
  }

  // ====== Cat (Enhanced) ======
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
      cat.frame = Math.floor(this.frameCount / 12) % 2
    } else if (cat.state === 'sitting') {
      cat.frame = Math.floor(this.frameCount / 20) % 2
      if (cat.stateTimer > 100) this.catNewTarget()
    } else if (cat.state === 'sleeping') {
      if (cat.stateTimer > 180) this.catNewTarget()
    } else if (cat.state === 'playing') {
      // Chase yarn ball
      cat.yarnBallX += (cat.direction === 'right' ? 0.8 : -0.8)
      if (Math.abs(cat.x - cat.yarnBallX) > 3) {
        cat.x += cat.x < cat.yarnBallX ? 0.7 : -0.7
        cat.direction = cat.x < cat.yarnBallX ? 'right' : 'left'
      }
      cat.frame = Math.floor(this.frameCount / 8) % 2
      if (cat.stateTimer > 120 || cat.yarnBallX > CANVAS_W - 60 || cat.yarnBallX < 40) {
        this.catNewTarget()
      }
    } else if (cat.state === 'stretching') {
      cat.frame = Math.floor(this.frameCount / 15) % 2
      if (cat.stateTimer > 60) this.catNewTarget()
    }
  }

  private catNewTarget() {
    this.cat.state = 'walking'
    this.cat.targetX = 40 + Math.random() * (CANVAS_W - 120)
    this.cat.y = FLOOR_TOP + 20 + Math.random() * 20
    this.cat.stateTimer = 0
    this.cat.yarnBallX = this.cat.x + (Math.random() > 0.5 ? 30 : -30)
    this.cat.yarnBallY = this.cat.y + 5
  }

  private drawCat() {
    const { ctx } = this
    const { x, y, state, direction, frame } = this.cat

    ctx.save()
    if (direction === 'left') {
      ctx.translate(x + 14, 0)
      ctx.scale(-1, 1)
      this.drawCatBody(0, y, state, frame)
    } else {
      this.drawCatBody(x, y, state, frame)
    }
    ctx.restore()

    // Draw yarn ball if playing
    if (state === 'playing') {
      ctx.fillStyle = '#ff4444'
      const bx = this.cat.yarnBallX
      const by = this.cat.yarnBallY
      ctx.fillRect(bx, by, 4, 4)
      ctx.fillStyle = '#cc0000'
      ctx.fillRect(bx + 1, by + 1, 2, 2)
      // Yarn trail
      ctx.fillStyle = 'rgba(255,100,100,0.4)'
      ctx.fillRect(bx - 3, by + 2, 3, 1)
    }
  }

  private drawCatBody(x: number, y: number, state: string, frame: number) {
    const { ctx } = this
    ctx.fillStyle = '#FF8C00'
    if (state === 'walking' || state === 'playing') {
      ctx.fillRect(x + 2, y, 10, 6)
      ctx.fillRect(x + 10, y - 2, 5, 5)
      ctx.fillStyle = '#FF6600'
      ctx.fillRect(x + 11, y - 3, 2, 1)
      ctx.fillRect(x + 14, y - 3, 2, 1)
      ctx.fillStyle = '#CC7000'
      if (frame === 0) {
        ctx.fillRect(x + 3, y + 6, 2, 3)
        ctx.fillRect(x + 9, y + 6, 2, 3)
      } else {
        ctx.fillRect(x + 5, y + 6, 2, 3)
        ctx.fillRect(x + 7, y + 6, 2, 3)
      }
      ctx.fillStyle = '#FF8C00'
      ctx.fillRect(x, y - 1, 2, 3)
      ctx.fillRect(x - 1, y - 2, 2, 2)
    } else if (state === 'sitting') {
      ctx.fillRect(x + 2, y, 8, 7)
      ctx.fillRect(x + 8, y - 2, 5, 5)
      ctx.fillStyle = '#FF6600'
      ctx.fillRect(x + 9, y - 3, 1, 1)
      ctx.fillRect(x + 12, y - 3, 1, 1)
      ctx.fillStyle = '#FF8C00'
      ctx.fillRect(x, y + 3, 3, 2)
    } else if (state === 'stretching') {
      // Arched back stretch
      ctx.fillRect(x + 2, y - 1, 10, 5)
      ctx.fillRect(x + 10, y - 3, 5, 4)
      ctx.fillStyle = '#FF6600'
      ctx.fillRect(x + 11, y - 4, 2, 1)
      ctx.fillRect(x + 14, y - 4, 2, 1)
      ctx.fillStyle = '#CC7000'
      // Legs stretched
      ctx.fillRect(x + 2, y + 4, 2, 4)
      ctx.fillRect(x + 10, y + 4, 2, 3)
      // Arched tail
      ctx.fillStyle = '#FF8C00'
      ctx.fillRect(x - 1, y - 3, 2, 3)
      ctx.fillRect(x - 2, y - 4, 2, 2)
    } else {
      // sleeping
      ctx.fillRect(x + 2, y + 2, 10, 5)
      ctx.fillRect(x + 3, y + 1, 8, 2)
      ctx.fillStyle = '#CC7000'
      ctx.fillRect(x + 8, y + 4, 4, 2)
      if (this.frameCount % 60 < 40) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '7px monospace'
        ctx.fillText('z', x + 12, y - 1)
        if (this.frameCount % 60 < 25) ctx.fillText('z', x + 15, y - 4)
      }
    }
  }

  // ====== Boss ======
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
        const targetY = targetWs ? targetWs.y + 60 : WORK_BOTTOM - 30
        if (b.frame <= 25) {
          const progress = b.frame / 25
          b.y = FLOOR_TOP + 30 - (FLOOR_TOP + 30 - targetY) * progress
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
          const corridorY = FLOOR_TOP + 30
          if (b.frame === 1) (b as any)._leaveStartY = b.y
          const leaveStartY = (b as any)._leaveStartY || b.y
          const progress = b.frame / 18
          b.y = leaveStartY + (corridorY - leaveStartY) * progress
        } else {
          b.y = FLOOR_TOP + 30
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

    // Head
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

    // Body
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(x - 5, y - 12, 10, 8)
    ctx.fillStyle = '#cc0000'
    ctx.fillRect(x - 1, y - 12, 2, 6)

    // Arms
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

    // Pants
    ctx.fillStyle = '#333333'
    ctx.fillRect(x - 4, y - 4, 4, 4)
    ctx.fillRect(x, y - 4, 4, 4)

    // Legs
    ctx.fillStyle = '#1a1a1a'
    const legFrame = Math.floor(this.frameCount / 8) % 2
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
      this.drawSpeechBubble(x, headTop - 5, this.boss.speechText)
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

  private drawSpeechBubble(x: number, y: number, text: string) {
    const { ctx } = this
    const textWidth = text.length * 7
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - textWidth / 2 - 4, y - 14, textWidth + 8, 12)
    ctx.fillStyle = '#333333'
    ctx.fillRect(x - textWidth / 2 - 5, y - 14, 1, 12)
    ctx.fillRect(x + textWidth / 2 + 4, y - 14, 1, 12)
    ctx.fillRect(x - textWidth / 2 - 4, y - 15, textWidth + 8, 1)
    ctx.fillRect(x - textWidth / 2 - 4, y - 2, textWidth + 8, 1)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 1, y - 2, 3, 2)
    ctx.fillRect(x, y, 1, 2)
    ctx.fillStyle = '#cc0000'
    ctx.font = 'bold 8px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(text, x, y - 5)
    ctx.textAlign = 'left'
  }

  // ====== Boss Target Reaction ======
  private drawBossTargetReaction() {
    if (!this.boss.active) return
    if (this.boss.phase !== 'whipping') return
    if (this.boss.targetMemberIndex < 0) return
    const ws = this.workstations[this.boss.targetMemberIndex]
    if (!ws) return
    const { ctx } = this
    const personX = ws.x + 12
    const personY = ws.y + 36
    const shake = this.boss.whipFrame % 4 < 2 ? 1 : -1
    const cycleFrame = this.boss.whipFrame % 20
    if (cycleFrame >= 8 && cycleFrame <= 12 && this.boss.whipFrame % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fillRect(personX + shake - 2, personY - 2, 28, 38)
    }
    if (this.boss.whipFrame % 20 < 13) {
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('!', personX + 12 + shake, personY - 4)
      ctx.textAlign = 'left'
    }
    if (cycleFrame >= 7 && cycleFrame < 14) {
      ctx.fillStyle = '#ffcc00'
      ctx.fillRect(personX - 5 + shake, personY + 8, 2, 6)
      ctx.fillRect(personX + 26 + shake, personY + 6, 2, 8)
      ctx.fillRect(personX - 4 + shake, personY + 16, 2, 4)
    }
  }

  // ====== Atmosphere Particles ======
  private updateAtmosphereParticles() {
    // Dust particles (from window light)
    if (Math.random() < 0.015 && this.particles.length < 30) {
      this.particles.push({
        x: 50 + Math.random() * 80,
        y: WALL_BOTTOM + Math.random() * 60,
        vx: 0.03 + Math.random() * 0.04,
        vy: 0.01 + Math.random() * 0.02,
        life: 200 + Math.floor(Math.random() * 150),
        maxLife: 350,
        color: 'rgba(255,255,200,0.3)',
        size: 1,
        type: 'dust',
      })
    }

    // Coffee steam from desks with coffee decoration
    for (const ws of this.workstations) {
      if (ws.decorations.includes('coffee') && Math.random() < 0.008 && this.particles.length < 30) {
        const deskX = ws.x
        const deskY = ws.y + 50
        const ox = ws.decorations.indexOf('coffee') === 0 ? deskX + 2 : deskX + ws.decorations.length * 20 + 28
        this.particles.push({
          x: ox + Math.random() * 3,
          y: deskY - 10,
          vx: (Math.random() - 0.5) * 0.05,
          vy: -0.2 - Math.random() * 0.15,
          life: 40 + Math.floor(Math.random() * 20),
          maxLife: 60,
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
    // Cloud movement
    env.cloudX += 0.08
    if (env.cloudX > 200) env.cloudX = -50

    // Light flicker
    if (env.lightFlicker > 0) env.lightFlicker--

    // Music notes in relaxed atmosphere
    if (env.totalBugs <= 3 && env.musicNoteTimer <= 0 && Math.random() < 0.003) {
      env.musicNoteTimer = 90
      // Spawn a music note particle from a random workstation
      if (this.workstations.length > 0) {
        const ws = this.workstations[Math.floor(Math.random() * this.workstations.length)]
        this.particles.push({
          x: ws.x + 20, y: ws.y + 30,
          vx: (Math.random() - 0.5) * 0.3, vy: -0.4,
          life: 60, maxLife: 60,
          color: '#ffdd44', size: 2,
          type: 'musicNote',
        })
      }
    }
    if (env.musicNoteTimer > 0) env.musicNoteTimer--

    // High pressure effects
    if (env.totalBugs > 7) {
      // Random light flicker
      if (Math.random() < 0.004) env.lightFlicker = 3
      // Paper flying
      if (Math.random() < 0.006 && this.particles.length < 30 && this.workstations.length > 0) {
        const ws = this.workstations[Math.floor(Math.random() * this.workstations.length)]
        this.particles.push({
          x: ws.x + 20, y: ws.y + 40,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -1 - Math.random() * 0.8,
          life: 50, maxLife: 50,
          color: '#ffffff', size: 3,
          type: 'paper',
        })
      }
    }
  }

  private drawEnvironmentEffects() {
    const { ctx } = this
    const env = this.environment

    // Light flicker overlay
    if (env.lightFlicker > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }

    // Ambient color overlay for bug pressure
    if (env.totalBugs <= 3 && this.workstations.length > 0) {
      ctx.fillStyle = 'rgba(0,255,100,0.015)'
      ctx.fillRect(0, WORK_TOP, CANVAS_W, WORK_BOTTOM - WORK_TOP)
    } else if (env.totalBugs > 10) {
      ctx.fillStyle = 'rgba(255,50,0,0.02)'
      ctx.fillRect(0, WORK_TOP, CANVAS_W, WORK_BOTTOM - WORK_TOP)
    }
  }

  // ====== Particles ======
  private spawnWorkstationParticles() {
    for (const ws of this.workstations) {
      const hx = ws.x + 18, hy = ws.y + 34
      if (ws.state === 'anxious' && this.frameCount % 50 === 0) {
        this.particles.push({
          x: hx + 14, y: hy, vx: 0, vy: 0.5,
          life: 25, maxLife: 25, color: '#66ccff', size: 2, type: 'default',
        })
      }
      if (ws.state === 'crazy' && this.frameCount % 15 === 0) {
        this.particles.push({
          x: hx + (Math.random() - 0.5) * 10, y: hy - 8,
          vx: (Math.random() - 0.5) * 0.4, vy: -0.7,
          life: 30, maxLife: 30,
          color: Math.random() > 0.5 ? '#ff6b35' : '#888888', size: 3, type: 'default',
        })
      }
      if (ws.state === 'collapse' && this.frameCount % 70 === 0) {
        this.particles.push({
          x: hx + 5, y: hy - 3, vx: 0, vy: -0.3,
          life: 40, maxLife: 40, color: '#666666', size: 2, type: 'default',
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
        // Draw a small music note ♪
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, 2, 2)
        ctx.fillRect(p.x + 2, p.y + 1, 1, 3)
        ctx.globalAlpha = 1
      } else if (p.type === 'paper') {
        // Tumbling paper
        ctx.globalAlpha = alpha * 0.8
        ctx.fillStyle = p.color
        const rot = Math.sin(this.frameCount * 0.1 + p.x) * 1
        ctx.fillRect(p.x + rot, p.y, p.size, p.size - 1)
        ctx.globalAlpha = 1
        p.vy += 0.03 // gravity
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
    if (this.particles.length > 50) this.particles = this.particles.slice(-35)
  }

  private drawFlash() {
    if (this.flashAlpha > 0) {
      this.ctx.globalAlpha = this.flashAlpha
      this.ctx.fillStyle = '#ffffff'
      this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      this.ctx.globalAlpha = 1
      this.flashAlpha -= 0.03
      if (this.flashAlpha < 0) this.flashAlpha = 0
    }
  }

  // ====== Render Loop ======
  private render = () => {
    this.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    this.drawBackground()

    // Update person actions
    this.updatePersonStates()

    // Update environment
    this.updateEnvironment()

    // Draw workstations
    for (const ws of this.workstations) {
      this.drawWorkstation(ws)
    }

    // Particles
    this.spawnWorkstationParticles()
    this.updateAtmosphereParticles()
    this.updateAndDrawParticles()

    // Environment overlays
    this.drawEnvironmentEffects()

    // Cat
    this.updateCat()
    this.drawCat()

    // Boss
    this.updateBoss()
    this.drawBossTargetReaction()
    this.drawBoss()

    // Flash effect
    this.drawFlash()

    this.frameCount++
    this.animationId = requestAnimationFrame(this.render)
  }

  start() {
    this.render()
  }

  stop() {
    cancelAnimationFrame(this.animationId)
  }

  destroy() {
    this.stop()
    this.particles = []
  }
}
