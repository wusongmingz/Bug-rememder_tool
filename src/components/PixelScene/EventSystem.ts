export type EventId = 'delivery' | 'blackout' | 'bossVisit' | 'catSpill'

export interface RandomEvent {
  id: EventId
  name: string
  duration: number       // 总帧数
  probability: number    // 触发权重
  currentFrame: number
  phase: number          // 事件内部阶段
}

export class EventSystem {
  private events: RandomEvent[] = []
  private activeEvent: RandomEvent | null = null
  private cooldownTimer: number = 0  // 距下次触发的帧数
  private minInterval = 7200   // 2分钟 @60fps (render skips frames so effectively longer)
  private maxInterval = 18000  // 5分钟

  constructor() {
    this.cooldownTimer = this.randomInterval()
    this.registerEvents()
  }

  private randomInterval(): number {
    return this.minInterval + Math.floor(Math.random() * (this.maxInterval - this.minInterval))
  }

  private registerEvents() {
    this.events = [
      { id: 'delivery', name: '外卖到了', duration: 480, probability: 3, currentFrame: 0, phase: 0 },
      { id: 'blackout', name: '突然断电', duration: 300, probability: 2, currentFrame: 0, phase: 0 },
      { id: 'bossVisit', name: '老板带客户', duration: 360, probability: 2, currentFrame: 0, phase: 0 },
      { id: 'catSpill', name: '猫打翻咖啡', duration: 240, probability: 3, currentFrame: 0, phase: 0 },
    ]
  }

  isEventActive(): boolean { return this.activeEvent !== null }
  getActiveEvent(): RandomEvent | null { return this.activeEvent }

  update(): void {
    if (this.activeEvent) {
      this.activeEvent.currentFrame++
      // Update phase based on event type and frame
      this.updatePhase()
      if (this.activeEvent.currentFrame >= this.activeEvent.duration) {
        this.activeEvent = null
        this.cooldownTimer = this.randomInterval()
      }
    } else {
      this.cooldownTimer--
      if (this.cooldownTimer <= 0) {
        this.triggerRandom()
      }
    }
  }

  private updatePhase(): void {
    if (!this.activeEvent) return
    const f = this.activeEvent.currentFrame
    switch (this.activeEvent.id) {
      case 'delivery':
        if (f < 60) this.activeEvent.phase = 0
        else if (f < 120) this.activeEvent.phase = 1
        else if (f < 300) this.activeEvent.phase = 2
        else if (f < 420) this.activeEvent.phase = 3
        else this.activeEvent.phase = 4
        break
      case 'blackout':
        if (f < 20) this.activeEvent.phase = 0
        else if (f < 120) this.activeEvent.phase = 1
        else if (f < 200) this.activeEvent.phase = 2
        else if (f < 260) this.activeEvent.phase = 3
        else this.activeEvent.phase = 4
        break
      case 'bossVisit':
        if (f < 60) this.activeEvent.phase = 0
        else if (f < 90) this.activeEvent.phase = 1
        else if (f < 240) this.activeEvent.phase = 2
        else if (f < 300) this.activeEvent.phase = 3
        else this.activeEvent.phase = 4
        break
      case 'catSpill':
        if (f < 40) this.activeEvent.phase = 0
        else if (f < 80) this.activeEvent.phase = 1
        else if (f < 160) this.activeEvent.phase = 2
        else this.activeEvent.phase = 3
        break
    }
  }

  triggerRandom(): void {
    // 加权随机选择
    const totalWeight = this.events.reduce((sum, e) => sum + e.probability, 0)
    let r = Math.random() * totalWeight
    for (const event of this.events) {
      r -= event.probability
      if (r <= 0) {
        this.activeEvent = { ...event, currentFrame: 0, phase: 0 }
        return
      }
    }
  }
}
