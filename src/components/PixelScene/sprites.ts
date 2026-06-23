// 颜色调色板
export const PALETTE = {
  skin: '#ffdbac',
  hair: '#3d2314',
  shirt: '#4a90d9',
  pants: '#2c3e50',
  desk: '#8b6914',
  deskDark: '#6b4f10',
  monitor: '#2c3e50',
  monitorFrame: '#1a1a2e',
  screenOn: '#00ff88',
  screenCode: '#00cc66',
  screenOff: '#1a1a2e',
  chair: '#444444',
  chairDark: '#333333',
  coffee: '#6f4e37',
  fire: '#ff6b35',
  fireYellow: '#ffd93d',
  smoke: '#888888',
  smokeDark: '#666666',
  sweat: '#66ccff',
  boss: '#c0392b',
  bossDark: '#962d22',
  bossSkin: '#ffc8a0',
  bossTie: '#f1c40f',
  wall: '#2a2a40',
  wallAccent: '#3a3a55',
  floor: '#3d2b1f',
  floorLight: '#4d3b2f',
  windowSky: '#1a3a5c',
  windowFrame: '#555555',
  white: '#ffffff',
  black: '#000000',
  keyboard: '#333333',
  phoneScreen: '#4488ff',
}

// 像素精灵定义 - 每行是一行像素，用调色板key或null（透明）
// 程序员尺寸: 14x20

type PixelRow = (string | null)[]

export interface SpriteFrame {
  width: number
  height: number
  pixels: PixelRow[]
}

// Helper: 快速创建像素行
function row(...colors: (string | null)[]): PixelRow {
  return colors
}

const _ = null // 透明
const S = PALETTE.skin
const H = PALETTE.hair
const B = PALETTE.shirt
const P = PALETTE.pants
const K = PALETTE.black

// ============ 程序员精灵帧 ============

// idle帧1 - 坐在椅子上正常坐姿
export const PROGRAMMER_IDLE_1: SpriteFrame = {
  width: 14,
  height: 20,
  pixels: [
    row(_, _, _, _, H, H, H, H, H, _, _, _, _, _),   // 头发顶
    row(_, _, _, H, H, H, H, H, H, H, _, _, _, _),   // 头发
    row(_, _, _, H, S, S, S, S, S, H, _, _, _, _),   // 额头
    row(_, _, _, S, K, S, S, S, K, S, _, _, _, _),   // 眼睛(睁开)
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),   // 鼻子
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),   // 嘴
    row(_, _, _, _, S, S, S, S, S, _, _, _, _, _),   // 下巴
    row(_, _, _, _, _, B, B, B, _, _, _, _, _, _),   // 脖子/衣领
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),   // 肩膀
    row(_, _, S, B, B, B, B, B, B, B, S, _, _, _),   // 上身+手臂
    row(_, _, S, B, B, B, B, B, B, B, S, _, _, _),   // 中身
    row(_, _, _, S, B, B, B, B, B, S, _, _, _, _),   // 手在键盘上
    row(_, _, _, _, B, B, B, B, B, _, _, _, _, _),   // 腰
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),   // 裤子
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),   // 裤子
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),   // 大腿
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),   // 膝盖
    row(_, _, _, P, P, _, _, _, P, P, _, _, _, _),   // 小腿
    row(_, _, _, K, K, _, _, _, K, K, _, _, _, _),   // 鞋
    row(_, _, K, K, K, _, _, _, K, K, K, _, _, _),   // 鞋底
  ],
}

// idle帧2 - 眨眼
export const PROGRAMMER_IDLE_2: SpriteFrame = {
  width: 14,
  height: 20,
  pixels: [
    row(_, _, _, _, H, H, H, H, H, _, _, _, _, _),
    row(_, _, _, H, H, H, H, H, H, H, _, _, _, _),
    row(_, _, _, H, S, S, S, S, S, H, _, _, _, _),
    row(_, _, _, S, S, K, S, K, S, S, _, _, _, _),   // 眼睛(闭合-横线)
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, _, S, S, S, S, S, _, _, _, _, _),
    row(_, _, _, _, _, B, B, B, _, _, _, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),
    row(_, _, S, B, B, B, B, B, B, B, S, _, _, _),
    row(_, _, S, B, B, B, B, B, B, B, S, _, _, _),
    row(_, _, _, S, B, B, B, B, B, S, _, _, _, _),
    row(_, _, _, _, B, B, B, B, B, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, P, P, _, _, _, P, P, _, _, _, _),
    row(_, _, _, K, K, _, _, _, K, K, _, _, _, _),
    row(_, _, K, K, K, _, _, _, K, K, K, _, _, _),
  ],
}

// relaxed - 端咖啡
const C = PALETTE.coffee
export const PROGRAMMER_RELAXED: SpriteFrame = {
  width: 14,
  height: 20,
  pixels: [
    row(_, _, _, _, H, H, H, H, H, _, _, _, _, _),
    row(_, _, _, H, H, H, H, H, H, H, _, _, _, _),
    row(_, _, _, H, S, S, S, S, S, H, _, _, _, _),
    row(_, _, _, S, K, S, S, S, K, S, _, _, _, _),
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, S, S, S, K, S, S, S, _, _, _, _),   // 微笑
    row(_, _, _, _, S, S, S, S, S, _, _, _, _, _),
    row(_, _, _, _, _, B, B, B, _, _, _, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),
    row(_, _, S, B, B, B, B, B, B, B, _, _, _, _),
    row(_, _, S, B, B, B, B, B, B, S, _, _, _, _),
    row(_, _, _, S, B, B, B, B, S, C, C, _, _, _),   // 右手端咖啡
    row(_, _, _, _, B, B, B, B, S, C, C, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, P, P, _, _, _, P, P, _, _, _, _),
    row(_, _, _, K, K, _, _, _, K, K, _, _, _, _),
    row(_, _, K, K, K, _, _, _, K, K, K, _, _, _),
  ],
}

// working帧1 - 打字左手
export const PROGRAMMER_WORKING_1: SpriteFrame = {
  width: 14,
  height: 20,
  pixels: [
    row(_, _, _, _, H, H, H, H, H, _, _, _, _, _),
    row(_, _, _, H, H, H, H, H, H, H, _, _, _, _),
    row(_, _, _, H, S, S, S, S, S, H, _, _, _, _),
    row(_, _, _, S, K, S, S, S, K, S, _, _, _, _),
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, _, S, S, S, S, S, _, _, _, _, _),
    row(_, _, _, _, _, B, B, B, _, _, _, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),
    row(_, S, S, B, B, B, B, B, B, B, S, _, _, _),   // 手臂伸出
    row(_, S, _, B, B, B, B, B, B, B, _, S, _, _),
    row(_, _, S, B, B, B, B, B, B, _, S, _, _, _),   // 左手按键
    row(_, _, _, _, B, B, B, B, B, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, P, P, _, _, _, P, P, _, _, _, _),
    row(_, _, _, K, K, _, _, _, K, K, _, _, _, _),
    row(_, _, K, K, K, _, _, _, K, K, K, _, _, _),
  ],
}

// working帧2 - 打字右手
export const PROGRAMMER_WORKING_2: SpriteFrame = {
  width: 14,
  height: 20,
  pixels: [
    row(_, _, _, _, H, H, H, H, H, _, _, _, _, _),
    row(_, _, _, H, H, H, H, H, H, H, _, _, _, _),
    row(_, _, _, H, S, S, S, S, S, H, _, _, _, _),
    row(_, _, _, S, K, S, S, S, K, S, _, _, _, _),
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, _, S, S, S, S, S, _, _, _, _, _),
    row(_, _, _, _, _, B, B, B, _, _, _, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),
    row(_, _, S, B, B, B, B, B, B, B, S, S, _, _),
    row(_, _, S, _, B, B, B, B, B, B, _, S, _, _),
    row(_, _, _, S, _, B, B, B, B, B, S, _, _, _),   // 右手按键
    row(_, _, _, _, B, B, B, B, B, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, P, P, _, _, _, P, P, _, _, _, _),
    row(_, _, _, K, K, _, _, _, K, K, _, _, _, _),
    row(_, _, K, K, K, _, _, _, K, K, K, _, _, _),
  ],
}

// anxious - 抓头
export const PROGRAMMER_ANXIOUS: SpriteFrame = {
  width: 14,
  height: 20,
  pixels: [
    row(_, _, S, _, H, H, H, H, H, _, _, _, _, _),   // 手在头上
    row(_, _, S, H, H, H, H, H, H, H, _, _, _, _),
    row(_, _, _, H, S, S, S, S, S, H, _, _, _, _),
    row(_, _, _, S, K, S, S, S, K, S, _, _, _, _),
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, S, S, K, K, K, S, S, _, _, _, _),   // 张嘴焦虑
    row(_, _, _, _, S, S, S, S, S, _, _, _, _, _),
    row(_, _, _, _, _, B, B, B, _, _, _, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),
    row(_, _, S, B, B, B, B, B, B, B, S, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, S, _, _, _),
    row(_, _, _, S, B, B, B, B, B, S, _, _, _, _),
    row(_, _, _, _, B, B, B, B, B, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, P, P, _, _, _, P, P, _, _, _, _),
    row(_, _, _, K, K, _, _, _, K, K, _, _, _, _),
    row(_, _, K, K, K, _, _, _, K, K, K, _, _, _),
  ],
}

// crazy - 抓狂(双手抓头)
export const PROGRAMMER_CRAZY: SpriteFrame = {
  width: 14,
  height: 20,
  pixels: [
    row(_, S, S, _, H, H, H, H, H, _, S, S, _, _),   // 双手抓头
    row(_, _, S, H, H, H, H, H, H, H, S, _, _, _),
    row(_, _, _, H, S, S, S, S, S, H, _, _, _, _),
    row(_, _, _, S, K, S, S, S, K, S, _, _, _, _),   // 圆眼
    row(_, _, _, S, S, S, S, S, S, S, _, _, _, _),
    row(_, _, _, S, K, K, K, K, K, S, _, _, _, _),   // 大张嘴
    row(_, _, _, _, S, S, S, S, S, _, _, _, _, _),
    row(_, _, _, _, _, B, B, B, _, _, _, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),
    row(_, _, _, B, B, B, B, B, B, B, _, _, _, _),
    row(_, _, _, _, B, B, B, B, B, _, _, _, _, _),
    row(_, _, _, _, B, B, B, B, B, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, P, P, _, _, _, P, P, _, _, _, _),
    row(_, _, _, K, K, _, _, _, K, K, _, _, _, _),
    row(_, _, K, K, K, _, _, _, K, K, K, _, _, _),
  ],
}

// collapse - 趴在桌上
export const PROGRAMMER_COLLAPSE: SpriteFrame = {
  width: 14,
  height: 12,
  pixels: [
    row(_, _, _, _, _, _, _, _, _, _, _, _, _, _),
    row(_, _, _, _, H, H, H, H, H, _, _, _, _, _),   // 头趴着(侧面)
    row(_, _, _, H, H, H, H, H, H, H, _, _, _, _),
    row(_, _, _, S, S, S, S, S, H, H, _, _, _, _),
    row(_, _, _, S, S, K, S, S, S, S, _, _, _, _),   // 闭眼侧脸
    row(_, _, S, S, S, S, S, S, S, _, _, _, _, _),
    row(_, S, S, B, B, B, B, B, _, _, _, _, _, _),   // 手臂摊开
    row(_, _, _, B, B, B, B, B, B, B, B, S, _, _),
    row(_, _, _, B, B, B, B, B, B, B, B, S, _, _),   // 上身趴平
    row(_, _, _, _, P, P, P, P, P, _, _, _, _, _),
    row(_, _, _, _, P, P, _, P, P, _, _, _, _, _),
    row(_, _, _, K, K, _, _, _, K, K, _, _, _, _),
  ],
}

// ============ 老板精灵帧 ============
const BS = PALETTE.bossSkin
const BR = PALETTE.boss
const BT = PALETTE.bossTie

// 老板走路帧1
export const BOSS_WALK_1: SpriteFrame = {
  width: 12,
  height: 22,
  pixels: [
    row(_, _, _, _, K, K, K, K, _, _, _, _),   // 头发
    row(_, _, _, K, K, K, K, K, K, _, _, _),
    row(_, _, _, K, BS, BS, BS, BS, K, _, _, _),
    row(_, _, _, BS, K, BS, BS, K, BS, _, _, _),   // 眼睛（严肃）
    row(_, _, _, BS, BS, BS, BS, BS, BS, _, _, _),
    row(_, _, _, BS, BS, K, K, BS, BS, _, _, _),   // 抿嘴
    row(_, _, _, _, BS, BS, BS, BS, _, _, _, _),
    row(_, _, _, _, _, BR, BR, _, _, _, _, _),     // 脖子/领带
    row(_, _, _, BR, BR, BT, BT, BR, BR, _, _, _),
    row(_, _, BR, BR, BR, BT, BT, BR, BR, BR, _, _),
    row(_, _, BR, BR, BR, BR, BR, BR, BR, BR, _, _),
    row(_, BS, BR, BR, BR, BR, BR, BR, BR, BR, BS, _),
    row(_, BS, _, BR, BR, BR, BR, BR, BR, _, BS, _),
    row(_, _, _, BR, BR, BR, BR, BR, BR, _, _, _),
    row(_, _, _, _, K, K, K, K, K, _, _, _),       // 裤子
    row(_, _, _, _, K, K, K, K, K, _, _, _),
    row(_, _, _, _, K, K, _, K, K, _, _, _),
    row(_, _, _, _, K, K, _, K, K, _, _, _),
    row(_, _, _, _, K, K, _, _, K, K, _, _),       // 走路左脚前
    row(_, _, _, K, K, _, _, _, K, K, _, _),
    row(_, _, _, K, K, _, _, _, _, K, K, _),
    row(_, _, K, K, K, _, _, _, _, K, K, _),
  ],
}

// 老板走路帧2
export const BOSS_WALK_2: SpriteFrame = {
  width: 12,
  height: 22,
  pixels: [
    row(_, _, _, _, K, K, K, K, _, _, _, _),
    row(_, _, _, K, K, K, K, K, K, _, _, _),
    row(_, _, _, K, BS, BS, BS, BS, K, _, _, _),
    row(_, _, _, BS, K, BS, BS, K, BS, _, _, _),
    row(_, _, _, BS, BS, BS, BS, BS, BS, _, _, _),
    row(_, _, _, BS, BS, K, K, BS, BS, _, _, _),
    row(_, _, _, _, BS, BS, BS, BS, _, _, _, _),
    row(_, _, _, _, _, BR, BR, _, _, _, _, _),
    row(_, _, _, BR, BR, BT, BT, BR, BR, _, _, _),
    row(_, _, BR, BR, BR, BT, BT, BR, BR, BR, _, _),
    row(_, _, BR, BR, BR, BR, BR, BR, BR, BR, _, _),
    row(_, BS, BR, BR, BR, BR, BR, BR, BR, BR, BS, _),
    row(_, BS, _, BR, BR, BR, BR, BR, BR, _, BS, _),
    row(_, _, _, BR, BR, BR, BR, BR, BR, _, _, _),
    row(_, _, _, _, K, K, K, K, K, _, _, _),
    row(_, _, _, _, K, K, K, K, K, _, _, _),
    row(_, _, _, _, K, K, _, K, K, _, _, _),
    row(_, _, _, _, K, K, _, K, K, _, _, _),
    row(_, _, _, K, K, _, _, K, K, _, _, _),       // 走路右脚前
    row(_, _, K, K, _, _, _, _, K, K, _, _),
    row(_, _, K, K, _, _, _, _, K, K, _, _),
    row(_, K, K, K, _, _, _, K, K, K, _, _),
  ],
}

// 老板拍桌帧
export const BOSS_SLAM: SpriteFrame = {
  width: 12,
  height: 22,
  pixels: [
    row(_, _, _, _, K, K, K, K, _, _, _, _),
    row(_, _, _, K, K, K, K, K, K, _, _, _),
    row(_, _, _, K, BS, BS, BS, BS, K, _, _, _),
    row(_, _, _, BS, K, BS, BS, K, BS, _, _, _),
    row(_, _, _, BS, BS, BS, BS, BS, BS, _, _, _),
    row(_, _, _, BS, K, K, K, K, BS, BS, _, _, _),   // 怒吼
    row(_, _, _, _, BS, BS, BS, BS, _, _, _, _),
    row(_, _, _, _, _, BR, BR, _, _, _, _, _),
    row(_, _, _, BR, BR, BT, BT, BR, BR, _, _, _),
    row(_, BS, BR, BR, BR, BT, BT, BR, BR, _, _, _),  // 左手举起拍桌
    row(_, BS, BR, BR, BR, BR, BR, BR, BR, _, _, _),
    row(BS, _, BR, BR, BR, BR, BR, BR, BR, _, _, _),
    row(BS, _, _, BR, BR, BR, BR, BR, BR, _, _, _),   // 手向下拍
    row(_, _, _, BR, BR, BR, BR, BR, BR, _, _, _),
    row(_, _, _, _, K, K, K, K, K, _, _, _),
    row(_, _, _, _, K, K, K, K, K, _, _, _),
    row(_, _, _, _, K, K, _, K, K, _, _, _),
    row(_, _, _, _, K, K, _, K, K, _, _, _),
    row(_, _, _, _, K, K, _, K, K, _, _, _),
    row(_, _, _, _, K, K, _, K, K, _, _, _),
    row(_, _, _, K, K, K, _, K, K, K, _, _),
    row(_, _, _, K, K, K, _, K, K, K, _, _),
  ],
}

// 精灵集合映射
export const PROGRAMMER_SPRITES = {
  idle: [PROGRAMMER_IDLE_1, PROGRAMMER_IDLE_2],
  relaxed: [PROGRAMMER_RELAXED],
  working: [PROGRAMMER_WORKING_1, PROGRAMMER_WORKING_2],
  anxious: [PROGRAMMER_ANXIOUS],
  crazy: [PROGRAMMER_CRAZY],
  collapse: [PROGRAMMER_COLLAPSE],
}

export const BOSS_SPRITES = {
  walk: [BOSS_WALK_1, BOSS_WALK_2],
  slam: [BOSS_SLAM],
}
