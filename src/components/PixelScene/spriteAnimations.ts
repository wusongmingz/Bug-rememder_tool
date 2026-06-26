/**
 * Sprite Animations - 角色动画帧坐标映射
 *
 * 基于精灵图 programmer-sprites.png (1024 x 1536 px)
 * 干净透明背景版，10列 x 12行网格布局。
 *
 * 网格参数:
 *   列数: 10, 列宽: 102.4px (1024/10, 用 Math.round(col*102.4) 计算每列X)
 *   行数: 12, 行高: 128px (1536/12 = 128)
 *
 * 行内容:
 *   行0: CODE/TYPE - 坐在桌前打字(9帧) + 机器人(1帧)
 *   行1: IDLE - 坐在桌前轻松姿态(9帧) + 机器人
 *   行2: COFFEE - 站立/端咖啡(9帧) + 机器人
 *   行3: DOCS - 坐在桌前看文档(9帧) + 机器人
 *   行4: THINK - 坐在桌前思考(9帧) + 机器人
 *   行5: ALERT - 桌前+头顶红色Bug图标(9帧) + 机器人
 *   行6: TIRED - 桌前疲惫(9帧) + 机器人
 *   行7: MEETING - 桌前交流(9帧) + 机器人
 *   行8: 道具 - 10个道具帧
 *   行9: 特效 - 10个特效帧
 *   行10: 表情头像 - 小尺寸(20个小头, 每个约51x64)
 *   行11: 大道具 - 10个大道具帧
 */

import type { AnimationDef, SpriteRegion } from './spriteSheet'

// ========== 帧尺寸常量 ==========
// 精灵图为 1024x1536, 10列x12行
// 列宽 = 1024/10 = 102.4px (非整数! 必须用浮点计算避免累积误差)
const SHEET_W = 1024
const COLS = 10
const COL_WIDTH = SHEET_W / COLS  // 102.4

const FRAME_H = 128   // 1536 / 12 (整除，无误差)

// 表情帧尺寸 (行10, 半尺寸)
const EXPR_W = 51     // ~102 / 2
const EXPR_H = 64     // 128 / 2

// ========== 辅助函数 ==========

/**
 * 计算指定列的精确起始X坐标
 * 使用 Math.round(col * 102.4) 消除累积舍入误差
 */
function colX(col: number): number {
  return Math.round(col * COL_WIDTH)
}

/**
 * 计算指定列的实际像素宽度 (102 或 103，总和恰好=1024)
 */
function colW(col: number): number {
  return colX(col + 1) - colX(col)
}

/** 生成一行中连续N帧的区域数组 */
function frameRow(row: number, startCol: number, count: number): SpriteRegion[] {
  const regions: SpriteRegion[] = []
  for (let i = 0; i < count; i++) {
    const col = startCol + i
    regions.push({
      x: colX(col),
      y: row * FRAME_H,
      w: colW(col),
      h: FRAME_H,
    })
  }
  return regions
}

/** 单帧区域 */
function cell(row: number, col: number, w?: number, h: number = FRAME_H): SpriteRegion {
  return { x: colX(col), y: row * FRAME_H, w: w ?? colW(col), h }
}

/** 单帧作为动画定义 */
function staticFrame(row: number, col: number): AnimationDef {
  return { frames: [cell(row, col)], fps: 1, loop: false }
}

// ============================================================
// 基础动作 (行0-4, 前6帧用于动画)
// ============================================================

/** 打字/编码 - 行0: 6帧循环 */
export const CODE: AnimationDef = {
  frames: frameRow(0, 0, 6),
  fps: 4,
  loop: true,
}

/** 空闲 - 行1: 6帧循环 */
export const IDLE: AnimationDef = {
  frames: frameRow(1, 0, 6),
  fps: 3,
  loop: true,
}

/** 喝咖啡 - 行2: 6帧循环 */
export const COFFEE: AnimationDef = {
  frames: frameRow(2, 0, 6),
  fps: 3,
  loop: true,
}

/** 看文档 - 行3: 6帧循环 */
export const DOCS: AnimationDef = {
  frames: frameRow(3, 0, 6),
  fps: 3,
  loop: true,
}

/** 思考 - 行4: 6帧循环 */
export const THINK: AnimationDef = {
  frames: frameRow(4, 0, 6),
  fps: 3,
  loop: true,
}

// ============================================================
// 互动动作 (行5)
// ============================================================

/** 发现Bug/警报 - 行5: 6帧不循环 */
export const ALERT: AnimationDef = {
  frames: frameRow(5, 0, 6),
  fps: 4,
  loop: false,
}

/** 修复Bug - 行5: 后3帧(帧6-8) */
export const FIX_BUG: AnimationDef = {
  frames: frameRow(5, 6, 3),
  fps: 6,
  loop: false,
}

/** 完成任务 - 用行1的后段帧(帧6-8)模拟 */
export const DONE: AnimationDef = {
  frames: frameRow(1, 6, 3),
  fps: 6,
  loop: false,
}

/** 升级 - 用行2的后段帧(帧6-8)模拟 */
export const LEVEL_UP: AnimationDef = {
  frames: frameRow(2, 6, 3),
  fps: 8,
  loop: false,
}

// ============================================================
// 情绪状态 (行6)
// ============================================================

/** 疲惫 - 行6: 6帧循环 */
export const TIRED: AnimationDef = {
  frames: frameRow(6, 0, 6),
  fps: 3,
  loop: true,
}

/** 泪奔/悲伤 - 行6: 后段帧(帧3-8) */
export const SAD: AnimationDef = {
  frames: frameRow(6, 3, 6),
  fps: 4,
  loop: true,
}

/** 兴奋 - 行7: 后段帧(帧3-8) */
export const EXCITED: AnimationDef = {
  frames: frameRow(7, 3, 6),
  fps: 6,
  loop: true,
}

// ============================================================
// 工作状态 (行7)
// ============================================================

/** 开会 - 行7: 6帧循环 */
export const MEETING: AnimationDef = {
  frames: frameRow(7, 0, 6),
  fps: 3,
  loop: true,
}

// ============================================================
// 兼容别名
// ============================================================

/** 行走 - 使用IDLE */
export const WALK: AnimationDef = IDLE

/** 坐下 - 使用IDLE的前4帧 */
export const SIT: AnimationDef = {
  frames: frameRow(1, 0, 4),
  fps: 6,
  loop: false,
}

/** TYPE 别名 -> CODE */
export const TYPE: AnimationDef = CODE

// ============================================================
// 表情 (行10 - 小帧, 每个51x64, 共20个)
// ============================================================

function exprFrame(index: number): SpriteRegion {
  // 表情行(行10)采用半尺寸帧: 约51x64, 20个小头像
  return {
    x: Math.round(index * (SHEET_W / 20)),
    y: 10 * FRAME_H,
    w: EXPR_W,
    h: EXPR_H,
  }
}

/** 普通表情 */
export const EXPRESSION_NORMAL: AnimationDef = { frames: [exprFrame(0)], fps: 1, loop: false }
/** 开心表情 */
export const EXPRESSION_HAPPY: AnimationDef = { frames: [exprFrame(1)], fps: 1, loop: false }
/** 惊讶表情 */
export const EXPRESSION_SURPRISED: AnimationDef = { frames: [exprFrame(2)], fps: 1, loop: false }
/** 困惑表情 */
export const EXPRESSION_CONFUSED: AnimationDef = { frames: [exprFrame(3)], fps: 1, loop: false }
/** 生气表情 */
export const EXPRESSION_ANGRY: AnimationDef = { frames: [exprFrame(4)], fps: 1, loop: false }
/** 疲惫表情 */
export const EXPRESSION_TIRED: AnimationDef = { frames: [exprFrame(5)], fps: 1, loop: false }
/** 无奈表情 */
export const EXPRESSION_HELPLESS: AnimationDef = { frames: [exprFrame(6)], fps: 1, loop: false }
/** 震惊表情 */
export const EXPRESSION_SHOCKED: AnimationDef = { frames: [exprFrame(7)], fps: 1, loop: false }
/** 自豪表情 */
export const EXPRESSION_PROUD: AnimationDef = { frames: [exprFrame(8)], fps: 1, loop: false }
/** 专注表情 */
export const EXPRESSION_FOCUSED: AnimationDef = { frames: [exprFrame(9)], fps: 1, loop: false }

// ============================================================
// 道具 (行8: 10帧)
// 电脑/笔记本/猫/企鹅/恐龙/大象/机器人/背包等
// ============================================================

/** 台式电脑 */
export const PROP_COMPUTER: AnimationDef = staticFrame(8, 0)
/** 笔记本电脑 */
export const PROP_LAPTOP: AnimationDef = staticFrame(8, 1)
/** 键盘 */
export const PROP_KEYBOARD: AnimationDef = staticFrame(8, 2)
/** 鼠标 */
export const PROP_MOUSE: AnimationDef = staticFrame(8, 3)
/** 显示器 */
export const PROP_MONITOR: AnimationDef = staticFrame(8, 4)
/** 手机 */
export const PROP_PHONE: AnimationDef = staticFrame(8, 5)
/** 咖啡杯 */
export const PROP_COFFEE_CUP: AnimationDef = staticFrame(8, 6)
/** 植物 */
export const PROP_PLANT: AnimationDef = staticFrame(8, 7)
/** 文件夹/背包 */
export const PROP_FOLDER: AnimationDef = staticFrame(8, 8)
/** 书本 */
export const PROP_BOOK: AnimationDef = staticFrame(8, 9)

// 大道具 (行11: 10帧) - 代码屏/火花/机器人/奖杯/绿植/水晶球/台灯/书/背包
/** 便利贴 (大道具行) */
export const PROP_STICKY_NOTE: AnimationDef = staticFrame(11, 0)
/** 耳机 (大道具行) */
export const PROP_HEADPHONES: AnimationDef = staticFrame(11, 1)
/** 水杯 (大道具行) */
export const PROP_WATER_BOTTLE: AnimationDef = staticFrame(11, 2)
/** 零食 (大道具行) */
export const PROP_SNACK: AnimationDef = staticFrame(11, 3)
/** 奖杯 (大道具行) */
export const PROP_TROPHY: AnimationDef = staticFrame(11, 4)
/** 时钟/台灯 (大道具行) */
export const PROP_CLOCK: AnimationDef = staticFrame(11, 5)

// ============================================================
// 宠物
// 行0-7的第10帧(col=9)都是机器人宠物
// 行8中有猫/企鹅/恐龙等
// ============================================================

/** 机器人 - 行0 col9 */
export const PET_ROBOT: AnimationDef = {
  frames: [cell(0, 9)],
  fps: 4, loop: true,
}

/** 橘猫 - 行8 col2 (假设猫在道具行) */
export const PET_ORANGE_CAT: AnimationDef = {
  frames: [cell(8, 2)],
  fps: 4, loop: true,
}

/** 黑猫 - 行8 col3 */
export const PET_BLACK_CAT: AnimationDef = {
  frames: [cell(8, 3)],
  fps: 4, loop: true,
}

/** 柴犬 - 行8 col4 */
export const PET_SHIBA: AnimationDef = {
  frames: [cell(8, 4)],
  fps: 4, loop: true,
}

/** 小恐龙 - 行8 col5 */
export const PET_DINOSAUR: AnimationDef = {
  frames: [cell(8, 5)],
  fps: 4, loop: true,
}

/** 企鹅 - 行8 col6 */
export const PET_PENGUIN: AnimationDef = {
  frames: [cell(8, 6)],
  fps: 4, loop: true,
}

// ============================================================
// 特效 (行9: 10帧)
// 白板/星星/云朵/青蛙/Bug爆炸/心形/礼物等
// ============================================================

/** 通知弹出特效 */
export const EFFECT_NOTIFICATION: AnimationDef = staticFrame(9, 0)
/** 升级光效 */
export const EFFECT_LEVEL_UP_GLOW: AnimationDef = staticFrame(9, 1)
/** 完成特效 */
export const EFFECT_COMPLETE: AnimationDef = staticFrame(9, 2)
/** Bug出现特效 */
export const EFFECT_BUG_APPEAR: AnimationDef = staticFrame(9, 3)
/** 能量恢复特效 */
export const EFFECT_ENERGY_RESTORE: AnimationDef = staticFrame(9, 4)
/** 经验值增加特效 */
export const EFFECT_EXP_PLUS: AnimationDef = staticFrame(9, 5)
/** 星星特效 */
export const EFFECT_STAR: AnimationDef = staticFrame(9, 6)
/** 心形特效 */
export const EFFECT_HEART: AnimationDef = staticFrame(9, 7)
/** 礼物特效 */
export const EFFECT_GIFT: AnimationDef = staticFrame(9, 8)
/** 爆炸特效 */
export const EFFECT_EXPLOSION: AnimationDef = staticFrame(9, 9)
/** 指派特效（程序化渲染，占位用） */
export const EFFECT_ASSIGN: AnimationDef = staticFrame(9, 3) // 复用bugAppear帧作为占位，实际走程序化渲染

// ============================================================
// 动画组集合（便于按类别查找）
// ============================================================

/** 所有基础动作 */
export const BASE_ACTIONS = {
  IDLE,
  WALK,
  SIT,
  TYPE,
  CODE,
  THINK,
  COFFEE,
  DOCS,
} as const

/** 所有工作状态 */
export const WORK_STATES = {
  COFFEE,
  CODE,
  DOCS,
  MEETING,
  TYPE: CODE,
  WALK: IDLE,
  SIT: IDLE,
} as const

/** 所有互动动作 */
export const INTERACTIVE_ACTIONS = {
  ALERT,
  FIX_BUG,
  DONE,
  LEVEL_UP,
} as const

// Backward compat alias
export const INTERACTIONS = INTERACTIVE_ACTIONS

/** 所有情绪状态 */
export const EMOTIONAL_STATES = {
  TIRED,
  SAD,
  EXCITED,
} as const

// Backward compat alias
export const EMOTIONS = EMOTIONAL_STATES

/** 所有表情 */
export const EXPRESSIONS = {
  EXPRESSION_NORMAL,
  EXPRESSION_HAPPY,
  EXPRESSION_SURPRISED,
  EXPRESSION_CONFUSED,
  EXPRESSION_ANGRY,
  EXPRESSION_TIRED,
  EXPRESSION_HELPLESS,
  EXPRESSION_SHOCKED,
  EXPRESSION_PROUD,
  EXPRESSION_FOCUSED,
} as const

/** 所有道具 */
export const PROPS = {
  PROP_COMPUTER,
  PROP_LAPTOP,
  PROP_KEYBOARD,
  PROP_MOUSE,
  PROP_MONITOR,
  PROP_PHONE,
  PROP_COFFEE_CUP,
  PROP_PLANT,
  PROP_FOLDER,
  PROP_BOOK,
  PROP_STICKY_NOTE,
  PROP_HEADPHONES,
  PROP_WATER_BOTTLE,
  PROP_SNACK,
  PROP_TROPHY,
  PROP_CLOCK,
} as const

/** 所有宠物 */
export const PETS = {
  PET_ROBOT,
  PET_ORANGE_CAT,
  PET_BLACK_CAT,
  PET_SHIBA,
  PET_DINOSAUR,
  PET_PENGUIN,
} as const

/** 所有特效 */
export const EFFECTS = {
  EFFECT_NOTIFICATION,
  EFFECT_LEVEL_UP_GLOW,
  EFFECT_COMPLETE,
  EFFECT_BUG_APPEAR,
  EFFECT_ENERGY_RESTORE,
  EFFECT_EXP_PLUS,
  EFFECT_STAR,
  EFFECT_HEART,
  EFFECT_GIFT,
  EFFECT_EXPLOSION,
  EFFECT_ASSIGN,
} as const
