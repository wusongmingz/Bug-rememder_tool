import { PALETTE, PROGRAMMER_SPRITES, BOSS_SPRITES, SpriteFrame } from './sprites'

export type ProgrammerState = 'idle' | 'relaxed' | 'working' | 'anxious' | 'crazy' | 'collapse'

export interface TeamMemberData {
  name: string
  bugCount: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface Workstation {
  x: number
  y: number
  name: string
  state: ProgrammerState
  bugCount: number
  isMain: boolean
}

export function getStateFromBugCount(count: number): ProgrammerState {
  if (count === 0) return 'idle'
  if (count <= 2) return 'relaxed'
  if (count <= 5) return 'working'
  if (count <= 8) return 'anxious'
  if (count <= 10) return 'crazy'
  return 'collapse'
}

// Canvas尺寸
const CANVAS_W = 400
const CANVAS_H = 220

export class PixelAnimator {
  private ctx: CanvasRenderingContext2D
  private state: ProgrammerState = 'idle'
  private frameCount = 0
  private animationId: number = 0
  private bossActive = false
  private bossX = CANVAS_W
  private bossPhase: 'enter' | 'slam' | 'exit' = 'enter'
  private bossFrameTimer = 0
  private bossSlamCount = 0
  private particles: Particle[] = []
  private flashAlpha = 0
  private teamMembers: TeamMemberData[] = []
  private workstations: Workstation[] = []

  // 场景常量
  private readonly SCALE = 2
  // MAIN_SCALE reserved for future main character emphasis
  // private readonly MAIN_SCALE = 3
  private readonly FLOOR_Y = 160
  private readonly DESK_ROW1_Y = 85
  private readonly DESK_ROW2_Y = 140

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get 2d context')
    this.ctx = ctx
    this.ctx.imageSmoothingEnabled = false
  }

  setState(state: ProgrammerState) {
    if (this.state !== state) {
      this.state = state
      this.updateWorkstations()
    }
  }

  setTeamMembers(members: TeamMemberData[]) {
    this.teamMembers = members
    this.buildWorkstations()
  }

  triggerBoss() {
    if (this.bossActive) return
    this.bossActive = true
    this.bossX = CANVAS_W
    this.bossPhase = 'enter'
    this.bossFrameTimer = 0
    this.bossSlamCount = 0
  }

  private buildWorkstations() {
    this.workstations = []
    const members = this.teamMembers

    if (members.length === 0) return

    // 每排最多放5个工位，第一排为同事，当前用户(主角)在前排右侧稍大
    const maxPerRow = 5
    const totalSlots = members.length
    const row1Count = Math.min(totalSlots, maxPerRow)
    const row2Count = Math.max(0, totalSlots - maxPerRow)

    const startX = 20
    const spacing = 72

    // 第一排
    for (let i = 0; i < row1Count; i++) {
      const member = members[i]
      this.workstations.push({
        x: startX + i * spacing,
        y: this.DESK_ROW1_Y,
        name: member.name,
        state: getStateFromBugCount(member.bugCount),
        bugCount: member.bugCount,
        isMain: false,
      })
    }

    // 第二排（如果有）
    for (let i = 0; i < row2Count; i++) {
      const member = members[maxPerRow + i]
      this.workstations.push({
        x: startX + i * spacing,
        y: this.DESK_ROW2_Y,
        name: member.name,
        state: getStateFromBugCount(member.bugCount),
        bugCount: member.bugCount,
        isMain: false,
      })
    }
  }

  private updateWorkstations() {
    // 更新主角状态 - 主角工位在buildWorkstations中不特殊处理
    // 因为主角数据来自teamMembers中的某一个
  }

  private drawSprite(sprite: SpriteFrame, x: number, y: number, scale: number = this.SCALE) {
    const { ctx } = this
    for (let row = 0; row < sprite.height; row++) {
      for (let col = 0; col < sprite.width; col++) {
        const color = sprite.pixels[row]?.[col]
        if (color) {
          ctx.fillStyle = color
          ctx.fillRect(
            x + col * scale,
            y + row * scale,
            scale,
            scale
          )
        }
      }
    }
  }

  private drawBackground() {
    const { ctx } = this
    // 墙壁
    ctx.fillStyle = PALETTE.wall
    ctx.fillRect(0, 0, CANVAS_W, this.FLOOR_Y)

    // 墙壁纹理线条
    ctx.fillStyle = PALETTE.wallAccent
    for (let i = 0; i < CANVAS_W; i += 40) {
      ctx.fillRect(i, 0, 1, this.FLOOR_Y)
    }
    // 横线分隔墙壁层次
    ctx.fillRect(0, 40, CANVAS_W, 1)

    // 地板
    ctx.fillStyle = PALETTE.floor
    ctx.fillRect(0, this.FLOOR_Y, CANVAS_W, CANVAS_H - this.FLOOR_Y)

    // 地板条纹
    ctx.fillStyle = PALETTE.floorLight
    for (let i = 0; i < CANVAS_W; i += 20) {
      ctx.fillRect(i, this.FLOOR_Y, 10, CANVAS_H - this.FLOOR_Y)
    }

    // 窗户1
    this.drawWindow(30, 10, 50, 40)
    // 窗户2
    this.drawWindow(150, 10, 50, 40)
    // 窗户3
    this.drawWindow(270, 10, 50, 40)

    // 时钟
    this.drawClock(360, 18)

    // 老板办公室门（右侧）
    ctx.fillStyle = '#4a3520'
    ctx.fillRect(CANVAS_W - 35, this.FLOOR_Y - 65, 30, 65)
    ctx.fillStyle = '#5d4430'
    ctx.fillRect(CANVAS_W - 33, this.FLOOR_Y - 63, 26, 61)
    // 门把手
    ctx.fillStyle = PALETTE.bossTie
    ctx.fillRect(CANVAS_W - 30, this.FLOOR_Y - 35, 3, 3)
    // 门牌: BOSS
    ctx.fillStyle = PALETTE.white
    ctx.font = '7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('BOSS', CANVAS_W - 20, this.FLOOR_Y - 50)
  }

  private drawWindow(x: number, y: number, w: number, h: number) {
    const { ctx } = this
    ctx.fillStyle = PALETTE.windowFrame
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = PALETTE.windowSky
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4)
    // 十字
    ctx.fillStyle = PALETTE.windowFrame
    ctx.fillRect(x + w / 2 - 1, y + 2, 2, h - 4)
    ctx.fillRect(x + 2, y + h / 2 - 1, w - 4, 2)
    // 小星星
    if (this.frameCount % 120 < 60) {
      ctx.fillStyle = PALETTE.white
      ctx.fillRect(x + 10, y + 8, 2, 2)
      ctx.fillRect(x + w - 15, y + 12, 2, 2)
    }
  }

  private drawClock(x: number, y: number) {
    const { ctx } = this
    // 圆形时钟
    ctx.fillStyle = PALETTE.white
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PALETTE.black
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PALETTE.white
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()
    // 时针分针
    const seconds = this.frameCount / 60
    ctx.strokeStyle = PALETTE.black
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(seconds * 0.1) * 4, y + Math.sin(seconds * 0.1) * 4)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(seconds) * 3, y + Math.sin(seconds) * 3)
    ctx.stroke()
  }

  private drawMiniDesk(wx: number, wy: number) {
    const { ctx } = this
    // 小桌子
    ctx.fillStyle = PALETTE.desk
    ctx.fillRect(wx, wy, 50, 4)
    ctx.fillStyle = PALETTE.deskDark
    ctx.fillRect(wx, wy + 3, 50, 1)
    // 桌腿
    ctx.fillRect(wx + 3, wy + 4, 3, 16)
    ctx.fillRect(wx + 44, wy + 4, 3, 16)
    // 小显示器
    ctx.fillStyle = PALETTE.monitorFrame
    ctx.fillRect(wx + 15, wy - 20, 22, 18)
    ctx.fillStyle = PALETTE.screenOn
    ctx.fillRect(wx + 17, wy - 18, 18, 14)
    // 小代码行
    ctx.fillStyle = PALETTE.screenCode
    for (let i = 0; i < 3; i++) {
      const lineW = 4 + ((i * 5 + this.frameCount / 10) % 8)
      ctx.fillRect(wx + 18, wy - 16 + i * 4, lineW, 2)
    }
    // 显示器支架
    ctx.fillStyle = PALETTE.monitorFrame
    ctx.fillRect(wx + 24, wy - 2, 4, 2)
  }

  private drawMiniProgrammer(wx: number, wy: number, state: ProgrammerState) {
    const scale = this.SCALE
    // 简化小人: 用状态对应的精灵，scale=2
    const frames = PROGRAMMER_SPRITES[state]
    let frameIndex = 0

    switch (state) {
      case 'idle':
        frameIndex = (this.frameCount % 120) > 112 ? 1 : 0
        break
      case 'working':
        frameIndex = Math.floor(this.frameCount / 8) % 2
        break
      default:
        frameIndex = 0
    }

    const sprite = frames[frameIndex] || frames[0]
    // 小人画在桌子后面 (y偏移使人坐在桌前)
    const personX = wx + 12
    const personY = wy - sprite.height * scale + 2
    this.drawSprite(sprite, personX, personY, scale)
  }

  private drawNameTag(wx: number, wy: number, name: string, bugCount: number, state: ProgrammerState) {
    const ctx = this.ctx
    // 名字背景
    const textWidth = name.length * 8 + 4
    const tagX = wx + 25 - textWidth / 2
    const tagY = wy - 52

    // 状态颜色背景
    let bgColor = 'rgba(0,255,136,0.3)' // idle/relaxed
    if (state === 'working') bgColor = 'rgba(255,200,0,0.3)'
    else if (state === 'anxious') bgColor = 'rgba(255,150,0,0.4)'
    else if (state === 'crazy' || state === 'collapse') bgColor = 'rgba(255,50,50,0.5)'

    ctx.fillStyle = bgColor
    ctx.fillRect(tagX - 1, tagY - 1, textWidth + 2, 11)

    // 名字文本
    ctx.fillStyle = PALETTE.white
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(name, wx + 25, tagY + 8)

    // Bug数显示
    ctx.fillStyle = bugCount > 5 ? '#ff6b6b' : '#00ff88'
    ctx.font = '7px monospace'
    ctx.fillText(`${bugCount}bug`, wx + 25, tagY + 17)
    ctx.textAlign = 'left'
  }

  private drawWorkstations() {
    for (const ws of this.workstations) {
      this.drawMiniDesk(ws.x, ws.y)
      this.drawMiniProgrammer(ws.x, ws.y, ws.state)
      this.drawNameTag(ws.x, ws.y, ws.name, ws.bugCount, ws.state)
      this.spawnMemberParticles(ws)
    }
  }

  private spawnMemberParticles(ws: Workstation) {
    const headX = ws.x + 25
    const headY = ws.y - 40

    switch (ws.state) {
      case 'anxious':
        // 汗珠
        if (this.frameCount % 45 === Math.floor(Math.random() * 5)) {
          this.particles.push({
            x: headX + (Math.random() - 0.5) * 8,
            y: headY,
            vx: 0,
            vy: 0.6,
            life: 30,
            maxLife: 30,
            color: PALETTE.sweat,
            size: 2,
          })
        }
        break
      case 'crazy':
        // 烟雾
        if (this.frameCount % 12 === Math.floor(Math.random() * 3)) {
          this.particles.push({
            x: headX + (Math.random() - 0.5) * 10,
            y: headY - 5,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.6,
            life: 35,
            maxLife: 35,
            color: Math.random() > 0.5 ? PALETTE.smoke : PALETTE.fire,
            size: 2 + Math.random() * 2,
          })
        }
        break
      case 'collapse':
        // 偶尔冒小烟
        if (this.frameCount % 80 === 0) {
          this.particles.push({
            x: headX,
            y: headY,
            vx: 0,
            vy: -0.2,
            life: 40,
            maxLife: 40,
            color: PALETTE.smokeDark,
            size: 2,
          })
        }
        break
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
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.fillRect(p.x, p.y, p.size, p.size)
      ctx.globalAlpha = 1

      return true
    })

    // 限制粒子数量
    if (this.particles.length > 100) {
      this.particles = this.particles.slice(-80)
    }
  }

  private updateBoss() {
    if (!this.bossActive) return

    this.bossFrameTimer++

    switch (this.bossPhase) {
      case 'enter':
        this.bossX -= 2.5
        if (this.bossX <= CANVAS_W - 70) {
          this.bossPhase = 'slam'
          this.bossFrameTimer = 0
        }
        {
          const walkFrame = Math.floor(this.frameCount / 10) % 2
          const sprite = BOSS_SPRITES.walk[walkFrame]
          this.drawSprite(sprite, this.bossX, this.FLOOR_Y - 55, this.SCALE)
        }
        break

      case 'slam':
        {
          const sprite = BOSS_SPRITES.slam[0]
          this.drawSprite(sprite, this.bossX, this.FLOOR_Y - 55, this.SCALE)

          // 拍桌效果
          if (this.bossFrameTimer % 20 === 10) {
            this.flashAlpha = 0.3
            this.bossSlamCount++
            // 震动粒子
            for (let i = 0; i < 4; i++) {
              this.particles.push({
                x: this.bossX - 10 + Math.random() * 20,
                y: this.FLOOR_Y - 10,
                vx: (Math.random() - 0.5) * 2.5,
                vy: -1.5 - Math.random() * 1.5,
                life: 12,
                maxLife: 12,
                color: PALETTE.white,
                size: 2,
              })
            }
          }

          if (this.bossSlamCount >= 3) {
            this.bossPhase = 'exit'
            this.bossFrameTimer = 0
          }
        }
        break

      case 'exit':
        this.bossX += 3
        if (this.bossX > CANVAS_W + 30) {
          this.bossActive = false
        }
        {
          const walkFrame = Math.floor(this.frameCount / 10) % 2
          const sprite = BOSS_SPRITES.walk[walkFrame]
          this.drawSprite(sprite, this.bossX, this.FLOOR_Y - 55, this.SCALE)
        }
        break
    }
  }

  private drawFlash() {
    if (this.flashAlpha > 0) {
      this.ctx.globalAlpha = this.flashAlpha
      this.ctx.fillStyle = PALETTE.white
      this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      this.ctx.globalAlpha = 1
      this.flashAlpha -= 0.04
      if (this.flashAlpha < 0) this.flashAlpha = 0
    }
  }

  private render = () => {
    // 清除画布
    this.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    this.drawBackground()
    this.drawWorkstations()
    this.updateAndDrawParticles()
    this.updateBoss()
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
