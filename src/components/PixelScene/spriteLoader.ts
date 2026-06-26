/**
 * Sprite Loader - 全局精灵图加载器
 *
 * 提供精灵图管理器的单例实例和便捷初始化函数。
 * 在应用启动时调用 initSprites() 预加载精灵图资源。
 */

import { SpriteSheetManager } from './spriteSheet'

// ========== 精灵图 URL 配置 ==========
const SPRITE_SHEET_URL = '/sprites/programmer-sprites.png'

// ========== 全局单例 ==========

/** 主精灵图管理器单例 */
export const mainSpriteSheet = new SpriteSheetManager()

// ========== 初始化函数 ==========

/**
 * 初始化并加载精灵图资源
 * 应在应用启动时调用（如 App.tsx 的 useEffect 中）
 *
 * @returns 加载完成的 Promise
 * @throws 加载失败时抛出错误
 */
export async function initSprites(): Promise<void> {
  try {
    await mainSpriteSheet.load(SPRITE_SHEET_URL)
    console.log('[SpriteLoader] Sprite sheet loaded successfully')
  } catch (error) {
    console.warn('[SpriteLoader] Failed to load sprite sheet, falling back to pixel rendering:', error)
    // 不抛出错误 — 允许应用继续使用旧的 fillRect 渲染作为 fallback
  }
}

// ========== 便捷查询函数 ==========

/**
 * 精灵图是否已加载就绪
 * 用于判断是否可以使用 sprite sheet 渲染，否则回退到旧方式
 */
export function isSpritesReady(): boolean {
  return mainSpriteSheet.isLoaded()
}

/**
 * 获取精灵图管理器实例
 * 返回全局单例，用于直接调用 drawFrame / drawAnimation
 */
export function getSpriteSheet(): SpriteSheetManager {
  return mainSpriteSheet
}
