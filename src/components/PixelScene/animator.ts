// Note: sprites.ts still available but we draw procedurally for flexibility
// import { PALETTE, PROGRAMMER_SPRITES, BOSS_SPRITES, SpriteFrame } from './sprites'

export type ProgrammerState = 'idle' | 'relaxed' | 'working' | 'anxious' | 'crazy' | 'collapse'

export interface TeamMemberData {
  name: string
  bugCount: number
  isCurrentUser?: boolean
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string; size: number
}

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
  state: 'walking' | 'sitting' | 'sleeping'
  direction: 'left' | 'right'; frame: number; stateTimer: number
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
// Design at SCALE=2: logical 250x175, each art pixel = 2x2 canvas pixels

// Layout zones (canvas pixels)
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

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get 2d context')
    this.ctx = ctx
    this.ctx.imageSmoothingEnabled = false
    this.cat = {
      x: 100, y: FLOOR_TOP + 25, targetX: 300,
      state: 'walking', direction: 'right', frame: 0, stateTimer: 0,
    }
    this.boss = {
      active: false, x: CANVAS_W - 35, y: FLOOR_TOP + 30,
      targetX: 250, targetMemberIndex: -1,
      phase: 'walking', frame: 0, whipFrame: 0,
      whipCount: 0, speechBubbleTimer: 0, speechText: '',
    }
  }

  setState(state: ProgrammerState) {
    if (this.state !== state) {
      this.state = state
    }
  }

  setTeamMembers(members: TeamMemberData[]) {
    // If more than 10, show top 10 by bug count
    if (members.length > 10) {
      const sorted = [...members].sort((a, b) => b.bugCount - a.bugCount)
      this.displayMembers = sorted.slice(0, 10)
      this.overflowCount = members.length - 10
    } else {
      this.displayMembers = members
      this.overflowCount = 0
    }
    this.buildWorkstations()
  }

  updateTeamMembers(members: TeamMemberData[]) {
    this.setTeamMembers(members)
  }

  triggerBoss(targetName?: string) {
    console.log('[Animator] triggerBoss called, target:', targetName, 'bossActive:', this.boss.active)
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
      // Random target if no name specified
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

  private buildWorkstations() {
    this.workstations = []
    const members = this.displayMembers
    if (members.length === 0) return

    const count = members.length
    const maxPerRow = count <= 5 ? count : Math.min(6, Math.ceil(count / 2))
    const row1Count = Math.min(count, maxPerRow)
    const row2Count = Math.max(0, count - maxPerRow)

    // Calculate spacing
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
    // Wall texture lines
    ctx.fillStyle = '#3a3a55'
    for (let i = 0; i < CANVAS_W; i += 40) ctx.fillRect(i, 0, 1, WALL_BOTTOM)
    ctx.fillRect(0, 35, CANVAS_W, 1)

    // Floor (work area) - light tile
    ctx.fillStyle = '#3d3530'
    ctx.fillRect(0, WORK_TOP, CANVAS_W, WORK_BOTTOM - WORK_TOP)
    // Subtle grid
    ctx.fillStyle = '#4a4540'
    for (let y = WORK_TOP; y < WORK_BOTTOM; y += 30) {
      ctx.fillRect(0, y, CANVAS_W, 1)
    }

    // Bottom corridor - wood floor
    ctx.fillStyle = '#3d2b1f'
    ctx.fillRect(0, FLOOR_TOP, CANVAS_W, FLOOR_BOTTOM - FLOOR_TOP)
    // Wood stripes
    ctx.fillStyle = '#4d3b2f'
    for (let i = 0; i < CANVAS_W; i += 20) {
      ctx.fillRect(i, FLOOR_TOP, 10, FLOOR_BOTTOM - FLOOR_TOP)
    }
    // Corridor separator line
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

    // Boss door (bottom right)
    this.drawBossDoor()

    // Water cooler (bottom right area)
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
    ctx.fillStyle = '#1a3a5c'
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6)
    // Cross frame
    ctx.fillStyle = '#555555'
    ctx.fillRect(x + w / 2 - 1, y + 3, 2, h - 6)
    ctx.fillRect(x + 3, y + h / 2 - 1, w - 6, 2)
    // Moon/stars
    ctx.fillStyle = '#ffffcc'
    ctx.fillRect(x + w - 15, y + 8, 4, 4)
    ctx.fillRect(x + w - 14, y + 7, 2, 1)
    // Twinkling star
    if (this.frameCount % 90 < 50) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x + 10, y + 12, 2, 2)
    }
    if (this.frameCount % 120 < 60) {
      ctx.fillRect(x + 20, y + 20, 2, 2)
    }
  }

  private drawBulletinBoard(x: number, y: number) {
    const { ctx } = this
    // Board frame
    ctx.fillStyle = '#8b6914'
    ctx.fillRect(x, y, 60, 42)
    ctx.fillStyle = '#c9a96e'
    ctx.fillRect(x + 3, y + 3, 54, 36)
    // Sticky notes
    const noteColors = ['#ff6b6b', '#ffd93d', '#6bcfff', '#77dd77', '#ffb3de']
    const hash = this.frameCount > 0 ? 42 : 42 // deterministic
    for (let i = 0; i < 4; i++) {
      const nx = x + 5 + (i % 2) * 28
      const ny = y + 6 + Math.floor(i / 2) * 18
      ctx.fillStyle = noteColors[(hash + i * 3) % noteColors.length]
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
    // Hands
    const sec = this.frameCount / 60
    ctx.fillStyle = '#000000'
    const hx = Math.cos(sec * 0.1) * 4
    const hy = Math.sin(sec * 0.1) * 4
    ctx.fillRect(x + hx - 1, y + hy - 1, 2, 2)
    ctx.fillRect(x, y, 2, 2)
    const mx = Math.cos(sec * 0.8) * 3
    const my = Math.sin(sec * 0.8) * 3
    ctx.fillRect(x + mx, y + my, 2, 2)
  }

  private drawBossDoor() {
    const { ctx } = this
    const dx = CANVAS_W - 42
    const dy = FLOOR_TOP + 4
    ctx.fillStyle = '#4a3520'
    ctx.fillRect(dx, dy, 30, 55)
    ctx.fillStyle = '#5d4430'
    ctx.fillRect(dx + 2, dy + 2, 26, 51)
    // Handle
    ctx.fillStyle = '#f1c40f'
    ctx.fillRect(dx + 5, dy + 28, 3, 3)
    // BOSS sign
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
  }

  // ====== Drawing: Workstations ======
  private drawWorkstation(ws: Workstation) {
    const { ctx } = this
    const { x, y } = ws

    // Desk (24x10 logical → 48x20 canvas)
    const deskW = 48, deskH = 10
    const deskX = x, deskY = y + 50

    // Chair (behind person)
    ctx.fillStyle = '#444444'
    ctx.fillRect(x + 16, y + 60, 16, 16)
    ctx.fillStyle = '#555555'
    ctx.fillRect(x + 18, y + 54, 12, 8)

    // Desk surface
    ctx.fillStyle = '#a0784c'
    ctx.fillRect(deskX, deskY, deskW, deskH)
    ctx.fillStyle = '#8b6914'
    ctx.fillRect(deskX, deskY + deskH - 2, deskW, 2)
    // Desk legs
    ctx.fillStyle = '#6b4f10'
    ctx.fillRect(deskX + 3, deskY + deskH, 4, 14)
    ctx.fillRect(deskX + deskW - 7, deskY + deskH, 4, 14)

    // Monitor (positioned on desk)
    const monX = x + 14, monY = y + 26
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(monX, monY, 20, 16)
    // Screen color based on bug state
    const screenColor = ws.bugCount >= 8 ? '#ff4444' : ws.bugCount >= 5 ? '#ffaa00' : '#00ff88'
    ctx.fillStyle = screenColor
    ctx.fillRect(monX + 2, monY + 2, 16, 12)
    // Code lines on screen
    ctx.fillStyle = ws.bugCount >= 8 ? '#ff8888' : '#00cc66'
    for (let i = 0; i < 3; i++) {
      const lw = 4 + ((i * 3 + this.frameCount / 15) % 8)
      ctx.fillRect(monX + 4, monY + 4 + i * 4, lw, 2)
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

    // Person
    this.drawPerson(x + 12, y + 36, ws.state, ws.appearance)
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
        if (this.frameCount % 40 < 20) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)'
          ctx.fillRect(ox + 1, deskY - 8, 1, 2)
          ctx.fillRect(ox + 3, deskY - 9, 1, 2)
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

  // ====== Drawing: Person (procedural, ~16px tall at SCALE=1) ======
  private drawPerson(x: number, y: number, state: ProgrammerState, app: PersonAppearance) {
    const { ctx } = this
    // Person is drawn at about 24px wide, 34px tall (canvas pixels)
    // Adjust for animation state
    let bodyOffY = 0
    if (state === 'relaxed') bodyOffY = -1
    if (state === 'anxious') bodyOffY = 1

    const headX = x + 6, headY = y + bodyOffY

    // Hair based on style
    ctx.fillStyle = app.hairColor
    switch (app.hairStyle) {
      case 'short':
        ctx.fillRect(headX, headY, 12, 4)
        ctx.fillRect(headX + 1, headY + 4, 10, 2)
        break
      case 'medium':
        ctx.fillRect(headX - 1, headY - 1, 14, 5)
        ctx.fillRect(headX, headY + 4, 12, 3)
        break
      case 'long':
        ctx.fillRect(headX - 1, headY - 1, 14, 5)
        ctx.fillRect(headX - 1, headY + 4, 2, 10)
        ctx.fillRect(headX + 11, headY + 4, 2, 10)
        ctx.fillRect(headX, headY + 4, 12, 2)
        break
      case 'bun':
        ctx.fillRect(headX, headY, 12, 4)
        ctx.fillRect(headX + 3, headY - 3, 6, 4)
        ctx.fillRect(headX + 1, headY + 4, 10, 2)
        break
    }

    // Face
    ctx.fillStyle = '#ffdbac'
    ctx.fillRect(headX + 1, headY + 4, 10, 10)

    // Eyes
    ctx.fillStyle = '#000000'
    const blink = this.frameCount % 120 > 115
    if (blink) {
      ctx.fillRect(headX + 3, headY + 7, 3, 1)
      ctx.fillRect(headX + 8, headY + 7, 3, 1)
    } else {
      ctx.fillRect(headX + 3, headY + 6, 2, 2)
      ctx.fillRect(headX + 8, headY + 6, 2, 2)
    }

    // Mouth expression
    if (state === 'anxious' || state === 'crazy' || state === 'collapse') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(headX + 4, headY + 11, 4, 2) // open mouth
    } else if (state === 'relaxed' || state === 'idle') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(headX + 4, headY + 11, 4, 1) // smile line
    }

    // Body / Shirt
    ctx.fillStyle = app.shirtColor
    ctx.fillRect(headX - 1, headY + 14, 14, 10)
    // Arms
    if (state === 'working') {
      const armFrame = Math.floor(this.frameCount / 10) % 2
      ctx.fillStyle = '#ffdbac'
      if (armFrame === 0) {
        ctx.fillRect(headX - 3, headY + 18, 3, 4)
        ctx.fillRect(headX + 12, headY + 20, 3, 4)
      } else {
        ctx.fillRect(headX - 3, headY + 20, 3, 4)
        ctx.fillRect(headX + 12, headY + 18, 3, 4)
      }
    } else if (state === 'crazy') {
      // Hands on head
      ctx.fillStyle = '#ffdbac'
      ctx.fillRect(headX - 2, headY + 2, 3, 4)
      ctx.fillRect(headX + 11, headY + 2, 3, 4)
    } else {
      ctx.fillStyle = '#ffdbac'
      ctx.fillRect(headX - 2, headY + 20, 3, 4)
      ctx.fillRect(headX + 11, headY + 20, 3, 4)
    }

    // Pants
    ctx.fillStyle = app.pantsColor
    ctx.fillRect(headX, headY + 24, 12, 6)
    // Legs/shoes
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(headX + 1, headY + 30, 4, 3)
    ctx.fillRect(headX + 7, headY + 30, 4, 3)

    // State effects
    if (state === 'anxious') {
      // Sweat drops
      if (this.frameCount % 45 < 30) {
        ctx.fillStyle = '#66ccff'
        ctx.fillRect(headX + 12, headY + 3, 2, 3)
      }
    }
    if (state === 'crazy') {
      // Smoke/steam
      if (this.frameCount % 20 < 15) {
        ctx.fillStyle = 'rgba(150,150,150,0.6)'
        const oy = Math.sin(this.frameCount / 10) * 2
        ctx.fillRect(headX + 2, headY - 5 + oy, 3, 3)
        ctx.fillRect(headX + 7, headY - 7 + oy, 2, 2)
      }
    }
    if (state === 'collapse') {
      // "Fainted" - draw differently: slouched forward
      ctx.fillStyle = 'rgba(100,100,100,0.4)'
      ctx.fillRect(headX - 2, headY - 2, 16, 2) // soul leaving body effect
    }
  }

  // ====== Public: Label Position for HTML overlay ======
  getMemberLabelPosition(index: number): { x: number; y: number } | null {
    if (index >= this.workstations.length) return null
    const ws = this.workstations[index]
    // Return position above monitor (center of workstation, above monitor top)
    return { x: ws.x + 24, y: ws.y + 10 }
  }

  getDisplayMembers(): TeamMemberData[] {
    return this.displayMembers
  }

  // ====== Cat ======
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
        cat.state = r < 0.5 ? 'sitting' : 'sleeping'
        cat.stateTimer = 0
      }
      cat.frame = Math.floor(this.frameCount / 12) % 2
    } else if (cat.state === 'sitting') {
      cat.frame = Math.floor(this.frameCount / 20) % 2
      if (cat.stateTimer > 100) this.catNewTarget()
    } else {
      if (cat.stateTimer > 180) this.catNewTarget()
    }
  }

  private catNewTarget() {
    this.cat.state = 'walking'
    this.cat.targetX = 40 + Math.random() * (CANVAS_W - 120)
    this.cat.y = FLOOR_TOP + 20 + Math.random() * 20
    this.cat.stateTimer = 0
  }

  private drawCat() {
    const { ctx } = this
    const { x, y, state, direction, frame } = this.cat

    ctx.save()
    if (direction === 'left') {
      ctx.translate(x + 14, 0)
      ctx.scale(-1, 1)
      ctx.translate(0, 0)
      // Draw at 0, y
      this.drawCatBody(0, y, state, frame)
    } else {
      this.drawCatBody(x, y, state, frame)
    }
    ctx.restore()
  }

  private drawCatBody(x: number, y: number, state: string, frame: number) {
    const { ctx } = this
    ctx.fillStyle = '#FF8C00'
    if (state === 'walking') {
      ctx.fillRect(x + 2, y, 10, 6) // body
      ctx.fillRect(x + 10, y - 2, 5, 5) // head
      ctx.fillStyle = '#FF6600'
      ctx.fillRect(x + 11, y - 3, 2, 1) // ears
      ctx.fillRect(x + 14, y - 3, 2, 1)
      ctx.fillStyle = '#CC7000'
      if (frame === 0) {
        ctx.fillRect(x + 3, y + 6, 2, 3)
        ctx.fillRect(x + 9, y + 6, 2, 3)
      } else {
        ctx.fillRect(x + 5, y + 6, 2, 3)
        ctx.fillRect(x + 7, y + 6, 2, 3)
      }
      // Tail
      ctx.fillStyle = '#FF8C00'
      ctx.fillRect(x, y - 1, 2, 3)
      ctx.fillRect(x - 1, y - 2, 2, 2)
    } else if (state === 'sitting') {
      ctx.fillRect(x + 2, y, 8, 7) // body
      ctx.fillRect(x + 8, y - 2, 5, 5) // head
      ctx.fillStyle = '#FF6600'
      ctx.fillRect(x + 9, y - 3, 1, 1)
      ctx.fillRect(x + 12, y - 3, 1, 1)
      // Tail wrap
      ctx.fillStyle = '#FF8C00'
      ctx.fillRect(x, y + 3, 3, 2)
    } else { // sleeping
      ctx.fillRect(x + 2, y + 2, 10, 5) // curled body
      ctx.fillRect(x + 3, y + 1, 8, 2)
      ctx.fillStyle = '#CC7000'
      ctx.fillRect(x + 8, y + 4, 4, 2) // tail over nose
      // Zzz
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
        // Walk along corridor toward target X (slowed down)
        if (Math.abs(b.x - b.targetX) > 3) {
          b.x += b.x > b.targetX ? -0.8 : 0.8
        } else {
          b.phase = 'climbing'
          b.frame = 0
        }
        break

      case 'climbing': {
        // Move up from corridor to workstation area (slowed)
        const targetWs = this.workstations[b.targetMemberIndex]
        const targetY = targetWs ? targetWs.y + 60 : WORK_BOTTOM - 30
        if (b.frame <= 25) {
          // Gradually move up
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
        // Each whip cycle is 20 frames: raise(7) + swing(6) + retract(7)
        const cycleFrame = b.whipFrame % 20
        
        // On hit frame, spawn particles and flash
        if (cycleFrame === 10) {
          this.flashAlpha = 0.15
          // Impact star particles
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
            })
          }
        }

        // Count completed whip cycles
        if (cycleFrame === 19) {
          b.whipCount++
        }

        // After 3 whips, show speech bubble then leave
        if (b.whipCount >= 3) {
          b.speechBubbleTimer = 60 // Show bubble for 60 frames
          b.phase = 'leaving'
          b.frame = 0
        }
        break
      }

      case 'leaving': {
        // Show speech bubble during initial leaving frames
        if (b.speechBubbleTimer > 0) {
          b.speechBubbleTimer--
        }

        // First climb back down, then walk to door
        if (b.frame <= 18) {
          // Climb back down to corridor (slowed)
          const corridorY = FLOOR_TOP + 30
          const startY = b.y
          if (b.frame === 1) {
            // Store start Y for interpolation (use targetX area as marker)
            (b as any)._leaveStartY = startY
          }
          const leaveStartY = (b as any)._leaveStartY || startY
          const progress = b.frame / 18
          b.y = leaveStartY + (corridorY - leaveStartY) * progress
        } else {
          b.y = FLOOR_TOP + 30
          // Walk right toward door (slowed)
          b.x += 1.0
          if (b.x > CANVAS_W + 20) {
            b.active = false
          }
        }
        break
      }
    }
  }

  private drawBoss() {
    if (!this.boss.active) return
    const { ctx } = this
    const { x, y, phase, whipFrame } = this.boss

    // Boss height ~20px, drawn relative to feet position (x, y)
    const bossHeight = 20
    const headTop = y - bossHeight

    // ---- Head ----
    // Hair (sparse, dark, suggesting middle-age)
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(x - 4, headTop, 8, 3)
    // Face
    ctx.fillStyle = '#f5c6a0'
    ctx.fillRect(x - 4, headTop + 3, 8, 8)
    // Angry eyes
    ctx.fillStyle = '#000000'
    ctx.fillRect(x - 2, headTop + 6, 2, 1)
    ctx.fillRect(x + 1, headTop + 6, 2, 1)
    // Inverted-V angry brows
    ctx.fillRect(x - 3, headTop + 5, 2, 1)
    ctx.fillRect(x + 2, headTop + 5, 2, 1)
    // Mouth
    if (phase === 'whipping') {
      ctx.fillStyle = '#cc0000'
      ctx.fillRect(x - 1, headTop + 9, 3, 2) // yelling open mouth
    } else {
      ctx.fillStyle = '#000000'
      ctx.fillRect(x - 1, headTop + 9, 3, 1) // frown
    }

    // ---- Body (black suit) ----
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(x - 5, y - 12, 10, 8)
    // Red tie
    ctx.fillStyle = '#cc0000'
    ctx.fillRect(x - 1, y - 12, 2, 6)

    // ---- Arms ----
    if (phase === 'whipping') {
      const cycleFrame = whipFrame % 20
      // Right arm holds whip (raised)
      ctx.fillStyle = '#1a1a1a'
      if (cycleFrame < 7) {
        // Raising - arm up
        ctx.fillRect(x + 5, y - 16, 3, 6)
        ctx.fillStyle = '#f5c6a0'
        ctx.fillRect(x + 5, y - 17, 3, 2)
      } else if (cycleFrame < 13) {
        // Swinging down - arm forward
        ctx.fillRect(x + 5, y - 12, 4, 3)
        ctx.fillStyle = '#f5c6a0'
        ctx.fillRect(x + 8, y - 12, 3, 2)
      } else {
        // Retract
        ctx.fillRect(x + 5, y - 13, 3, 5)
        ctx.fillStyle = '#f5c6a0'
        ctx.fillRect(x + 5, y - 14, 3, 2)
      }
      // Left arm at side
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(x - 7, y - 10, 3, 6)
    } else {
      // Arms at sides
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(x - 7, y - 10, 3, 6)
      ctx.fillRect(x + 5, y - 10, 3, 6)
      // Hands
      ctx.fillStyle = '#f5c6a0'
      ctx.fillRect(x - 7, y - 5, 3, 2)
      ctx.fillRect(x + 5, y - 5, 3, 2)
    }

    // ---- Pants ----
    ctx.fillStyle = '#333333'
    ctx.fillRect(x - 4, y - 4, 4, 4)
    ctx.fillRect(x, y - 4, 4, 4)

    // ---- Legs / Walking animation ----
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

    // ---- Whip drawing ----
    if (phase === 'whipping') {
      this.drawWhip(x, y, whipFrame)
    }

    // ---- Speech bubble ----
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
      // Raise phase - whip up
      ctx.moveTo(bossX + 6, bossY - 16)
      ctx.quadraticCurveTo(bossX + 12, bossY - 26, bossX + 9, bossY - 32)
    } else if (whipPhase < 13) {
      // Swing down - whip forward
      ctx.moveTo(bossX + 9, bossY - 12)
      ctx.quadraticCurveTo(bossX + 18, bossY - 8, bossX + 25, bossY - 5)
    } else {
      // Retract
      ctx.moveTo(bossX + 6, bossY - 14)
      ctx.quadraticCurveTo(bossX + 12, bossY - 10, bossX + 14, bossY - 8)
    }
    ctx.stroke()

    // Whip tip spark on hit frame
    if (whipPhase >= 7 && whipPhase < 13) {
      ctx.fillStyle = '#ffff00'
      const sparkX = bossX + 25
      const sparkY = bossY - 5
      ctx.fillRect(sparkX, sparkY, 2, 2)
      ctx.fillRect(sparkX + 3, sparkY - 3, 2, 2)
      ctx.fillRect(sparkX - 2, sparkY + 2, 2, 2)
      ctx.fillRect(sparkX + 1, sparkY - 5, 1, 1)
      ctx.fillRect(sparkX + 4, sparkY + 1, 1, 1)
      // Star effect
      ctx.fillStyle = '#ff8800'
      ctx.fillRect(sparkX + 2, sparkY - 1, 3, 1)
      ctx.fillRect(sparkX + 3, sparkY - 2, 1, 3)
    }
  }

  private drawSpeechBubble(x: number, y: number, text: string) {
    const { ctx } = this
    const textWidth = text.length * 7

    // Bubble background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - textWidth / 2 - 4, y - 14, textWidth + 8, 12)
    // Bubble border
    ctx.fillStyle = '#333333'
    ctx.fillRect(x - textWidth / 2 - 5, y - 14, 1, 12)
    ctx.fillRect(x + textWidth / 2 + 4, y - 14, 1, 12)
    ctx.fillRect(x - textWidth / 2 - 4, y - 15, textWidth + 8, 1)
    ctx.fillRect(x - textWidth / 2 - 4, y - 2, textWidth + 8, 1)
    // Tail (triangle)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 1, y - 2, 3, 2)
    ctx.fillRect(x, y, 1, 2)

    // Text
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

    // Body shaking: ±1px x offset
    const shake = this.boss.whipFrame % 4 < 2 ? 1 : -1

    // Flicker effect: hide person every few frames during hit
    const cycleFrame = this.boss.whipFrame % 20
    if (cycleFrame >= 8 && cycleFrame <= 12 && this.boss.whipFrame % 2 === 0) {
      // Flash white on hit
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fillRect(personX + shake - 2, personY - 2, 28, 38)
    }

    // Exclamation mark "!" above head
    if (this.boss.whipFrame % 20 < 13) {
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('!', personX + 12 + shake, personY - 4)
      ctx.textAlign = 'left'
    }

    // Shake offset applied via redrawing person with offset
    // (The actual person is drawn in drawWorkstation, so we overlay a shake indicator)
    // Draw shake lines around person
    if (cycleFrame >= 7 && cycleFrame < 14) {
      ctx.fillStyle = '#ffcc00'
      // Impact lines
      ctx.fillRect(personX - 5 + shake, personY + 8, 2, 6)
      ctx.fillRect(personX + 26 + shake, personY + 6, 2, 8)
      ctx.fillRect(personX - 4 + shake, personY + 16, 2, 4)
    }
  }

  // ====== Particles ======
  private spawnWorkstationParticles() {
    for (const ws of this.workstations) {
      const hx = ws.x + 18, hy = ws.y + 34
      if (ws.state === 'anxious' && this.frameCount % 50 === 0) {
        this.particles.push({
          x: hx + 14, y: hy, vx: 0, vy: 0.5,
          life: 25, maxLife: 25, color: '#66ccff', size: 2,
        })
      }
      if (ws.state === 'crazy' && this.frameCount % 15 === 0) {
        this.particles.push({
          x: hx + (Math.random() - 0.5) * 10, y: hy - 8,
          vx: (Math.random() - 0.5) * 0.4, vy: -0.7,
          life: 30, maxLife: 30,
          color: Math.random() > 0.5 ? '#ff6b35' : '#888888', size: 3,
        })
      }
      if (ws.state === 'collapse' && this.frameCount % 70 === 0) {
        this.particles.push({
          x: hx + 5, y: hy - 3, vx: 0, vy: -0.3,
          life: 40, maxLife: 40, color: '#666666', size: 2,
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
      ctx.globalAlpha = p.life / p.maxLife
      ctx.fillStyle = p.color
      ctx.fillRect(p.x, p.y, p.size, p.size)
      ctx.globalAlpha = 1
      return true
    })
    if (this.particles.length > 80) this.particles = this.particles.slice(-60)
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

    // Draw workstations
    for (const ws of this.workstations) {
      this.drawWorkstation(ws)
    }

    // Particles from workstations
    this.spawnWorkstationParticles()
    this.updateAndDrawParticles()

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
