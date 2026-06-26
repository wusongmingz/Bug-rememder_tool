import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: number
  progress?: number
  target?: number
}

interface AchievementState {
  achievements: Achievement[]
  whipCount: number
  catPetCount: number
  totalUsageMinutes: number
  zeroBugMinutes: number

  incrementWhipCount: () => void
  incrementCatPet: () => void
  addUsageMinute: () => void
  updateZeroBugTime: (hasActiveBugs: boolean) => void
  checkAndUnlock: () => Achievement | null
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      achievements: [
        {
          id: 'slacker_master',
          name: '摸鱼大师',
          description: '连续30分钟没有Bug',
          icon: '🐟',
          unlocked: false,
          progress: 0,
          target: 30,
        },
        {
          id: 'whip_maniac',
          name: '鞭策狂魔',
          description: '累计抽打同事100次',
          icon: '🔥',
          unlocked: false,
          progress: 0,
          target: 100,
        },
        {
          id: 'night_owl',
          name: '夜猫子',
          description: '22点后还在使用',
          icon: '🦉',
          unlocked: false,
        },
        {
          id: 'ghost_hour',
          name: '深夜幽灵',
          description: '凌晨2点后使用',
          icon: '👻',
          unlocked: false,
        },
        {
          id: 'team_zero',
          name: '团队清零',
          description: '所有人Bug归零',
          icon: '🎉',
          unlocked: false,
        },
        {
          id: 'cat_lover',
          name: '猫奴',
          description: '撸猫50次',
          icon: '🐱',
          unlocked: false,
          progress: 0,
          target: 50,
        },
        {
          id: 'overtime_king',
          name: '社畜之王',
          description: '累计使用480分钟(8小时)',
          icon: '👑',
          unlocked: false,
          progress: 0,
          target: 480,
        },
      ],
      whipCount: 0,
      catPetCount: 0,
      totalUsageMinutes: 0,
      zeroBugMinutes: 0,

      incrementWhipCount: () => set(state => ({ whipCount: state.whipCount + 1 })),
      incrementCatPet: () => set(state => ({ catPetCount: state.catPetCount + 1 })),
      addUsageMinute: () => set(state => ({ totalUsageMinutes: state.totalUsageMinutes + 1 })),
      updateZeroBugTime: (hasActiveBugs: boolean) => set(state => ({
        zeroBugMinutes: hasActiveBugs ? 0 : state.zeroBugMinutes + 1
      })),

      checkAndUnlock: () => {
        const state = get()
        const now = new Date()
        const hour = now.getHours()
        let newUnlock: Achievement | null = null

        const updated = state.achievements.map(a => {
          if (a.unlocked) return a

          switch (a.id) {
            case 'slacker_master':
              if (state.zeroBugMinutes >= 30) {
                newUnlock = { ...a, unlocked: true, unlockedAt: Date.now() }
                return newUnlock
              }
              return { ...a, progress: Math.min(state.zeroBugMinutes, 30) }

            case 'whip_maniac':
              if (state.whipCount >= 100) {
                newUnlock = { ...a, unlocked: true, unlockedAt: Date.now() }
                return newUnlock
              }
              return { ...a, progress: state.whipCount }

            case 'night_owl':
              if (hour >= 22 || hour < 2) {
                newUnlock = { ...a, unlocked: true, unlockedAt: Date.now() }
                return newUnlock
              }
              return a

            case 'ghost_hour':
              if (hour >= 2 && hour < 5) {
                newUnlock = { ...a, unlocked: true, unlockedAt: Date.now() }
                return newUnlock
              }
              return a

            case 'cat_lover':
              if (state.catPetCount >= 50) {
                newUnlock = { ...a, unlocked: true, unlockedAt: Date.now() }
                return newUnlock
              }
              return { ...a, progress: state.catPetCount }

            case 'overtime_king':
              if (state.totalUsageMinutes >= 480) {
                newUnlock = { ...a, unlocked: true, unlockedAt: Date.now() }
                return newUnlock
              }
              return { ...a, progress: state.totalUsageMinutes }

            default:
              return a
          }
        })

        set({ achievements: updated })
        return newUnlock
      }
    }),
    { name: 'pixel-office-achievements' }
  )
)
