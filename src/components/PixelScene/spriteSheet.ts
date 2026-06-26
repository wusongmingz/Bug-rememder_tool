/**
 * Sprite Sheet Manager
 * 负责精灵图的加载、帧裁切和绘制。
 * 使用 sprite sheet (大图) + 区域坐标 的方式高效渲染角色动画。
 */

/** 精灵帧区域定义 — 描述一帧在 sprite sheet 中的位置和尺寸 */
export interface SpriteRegion {
  x: number  // 在 sprite sheet 中的 x 坐标 (px)
  y: number  // 在 sprite sheet 中的 y 坐标 (px)
  w: number  // 帧宽度 (px)
  h: number  // 帧高度 (px)
}

/** 动画定义 — 由多帧组成的动画序列 */
export interface AnimationDef {
  frames: SpriteRegion[]  // 动画帧序列
  fps: number             // 播放帧率
  loop: boolean           // 是否循环播放
}

/**
 * 精灵图管理器
 * 负责加载 sprite sheet 图片并提供帧绘制能力。
 */
export class SpriteSheetManager {
  private image: HTMLImageElement | null = null
  private loaded: boolean = false
  private loadPromise: Promise<void> | null = null

  /**
   * 加载精灵图
   * @param src - 精灵图 URL（如 '/sprites/programmer-sprites.png'）
   * @returns 加载完成的 Promise
   */
  load(src: string): Promise<void> {
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.image = img
        this.loaded = true
        resolve()
      }
      img.onerror = (_e) => {
        console.error(`[SpriteSheetManager] Failed to load sprite sheet: ${src}`)
        reject(new Error(`Failed to load sprite sheet: ${src}`))
      }
      img.src = src
    })

    return this.loadPromise
  }

  /** 是否已加载完成 */
  isLoaded(): boolean {
    return this.loaded
  }

  /** 获取 Image 元素（未加载时返回 null） */
  getImage(): HTMLImageElement | null {
    return this.image
  }

  /**
   * 绘制单帧到 Canvas
   * @param ctx - Canvas 2D 上下文
   * @param region - 精灵帧区域
   * @param dx - 目标 x 坐标
   * @param dy - 目标 y 坐标
   * @param scale - 缩放倍数（默认 1）
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    region: SpriteRegion,
    dx: number,
    dy: number,
    scale: number = 1
  ): void {
    if (!this.image || !this.loaded) return

    // 确保像素锐利，不做平滑处理
    ctx.imageSmoothingEnabled = false

    ctx.drawImage(
      this.image,
      region.x, region.y, region.w, region.h,  // 源区域
      dx, dy, region.w * scale, region.h * scale  // 目标区域
    )
  }

  /**
   * 绘制动画当前帧（根据经过时间自动计算帧索引）
   * @param ctx - Canvas 2D 上下文
   * @param anim - 动画定义
   * @param dx - 目标 x 坐标
   * @param dy - 目标 y 坐标
   * @param elapsed - 动画开始后经过的时间（毫秒）
   * @param scale - 缩放倍数（默认 1）
   * @returns 当前帧索引
   */
  drawAnimation(
    ctx: CanvasRenderingContext2D,
    anim: AnimationDef,
    dx: number,
    dy: number,
    elapsed: number,
    scale: number = 1
  ): number {
    if (!this.image || !this.loaded || anim.frames.length === 0) return 0

    const frameDuration = 1000 / anim.fps
    const totalFrames = anim.frames.length
    const totalDuration = frameDuration * totalFrames

    let frameIndex: number

    if (anim.loop) {
      // 循环动画：取模
      frameIndex = Math.floor((elapsed % totalDuration) / frameDuration)
    } else {
      // 非循环动画：停在最后一帧
      frameIndex = Math.min(
        Math.floor(elapsed / frameDuration),
        totalFrames - 1
      )
    }

    this.drawFrame(ctx, anim.frames[frameIndex], dx, dy, scale)
    return frameIndex
  }

  /**
   * 获取动画当前帧索引（不绘制，仅计算）
   * @param anim - 动画定义
   * @param elapsed - 经过时间（毫秒）
   * @returns 帧索引
   */
  getFrameIndex(anim: AnimationDef, elapsed: number): number {
    if (anim.frames.length === 0) return 0

    const frameDuration = 1000 / anim.fps
    const totalFrames = anim.frames.length
    const totalDuration = frameDuration * totalFrames

    if (anim.loop) {
      return Math.floor((elapsed % totalDuration) / frameDuration)
    } else {
      return Math.min(
        Math.floor(elapsed / frameDuration),
        totalFrames - 1
      )
    }
  }

  /**
   * 检查非循环动画是否已播放完毕
   * @param anim - 动画定义
   * @param elapsed - 经过时间（毫秒）
   * @returns 是否播完
   */
  isAnimationDone(anim: AnimationDef, elapsed: number): boolean {
    if (anim.loop) return false
    const totalDuration = (1000 / anim.fps) * anim.frames.length
    return elapsed >= totalDuration
  }

  /** 重置加载状态（用于重新加载） */
  reset(): void {
    this.image = null
    this.loaded = false
    this.loadPromise = null
  }
}
