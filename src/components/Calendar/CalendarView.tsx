import { useState, useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBugStore } from '@/stores/bugStore'
import { useTodoStore } from '@/stores/todoStore'
import GlassCard from '@/components/Shared/GlassCard'
import DayDetail from './DayDetail'

interface DayData {
  bugCount: number
  todoCount: number
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const bugs = useBugStore((s) => s.bugs)
  const todos = useTodoStore((s) => s.todos)

  // 计算日历网格的所有日期
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth])

  // 聚合每天的数据
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>()

    bugs.forEach((bug) => {
      if (bug.createdDate) {
        const key = bug.createdDate.slice(0, 10) // YYYY-MM-DD
        const existing = map.get(key) || { bugCount: 0, todoCount: 0 }
        existing.bugCount++
        map.set(key, existing)
      }
    })

    todos.forEach((todo) => {
      if (todo.dueDate) {
        const key = todo.dueDate.slice(0, 10)
        const existing = map.get(key) || { bugCount: 0, todoCount: 0 }
        existing.todoCount++
        map.set(key, existing)
      }
    })

    return map
  }, [bugs, todos])

  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
  }

  const handleDayClick = (day: Date) => {
    if (selectedDate && isSameDay(selectedDate, day)) {
      setSelectedDate(null)
    } else {
      setSelectedDate(day)
    }
  }

  const getHeatmapBg = (total: number): string => {
    if (total >= 6) return 'rgba(0,255,136,0.2)'
    if (total >= 3) return 'rgba(0,255,136,0.1)'
    if (total >= 1) return 'rgba(0,255,136,0.05)'
    return 'transparent'
  }

  const weekDays = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <GlassCard className="!p-4 md:!p-6">
        {/* 月份导航 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-lg hover:bg-white/10 text-textSecondary hover:text-textPrimary transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-textPrimary min-w-[120px] text-center">
              {format(currentMonth, 'yyyy年M月', { locale: zhCN })}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-lg hover:bg-white/10 text-textSecondary hover:text-textPrimary transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
          >
            今天
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-[2px] mb-[2px]">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs text-textSecondary py-2 font-medium"
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日期网格 */}
        <div className="grid grid-cols-7 gap-[2px]">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const data = dayDataMap.get(dateKey) || { bugCount: 0, todoCount: 0 }
            const total = data.bugCount + data.todoCount
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
            const isTodayDate = isToday(day)

            return (
              <button
                key={dateKey}
                onClick={() => handleDayClick(day)}
                className={`
                  relative flex flex-col items-center justify-center
                  min-h-[50px] rounded-lg transition-all duration-150
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'bg-accent/20 border border-accent' : ''}
                  ${isTodayDate && !isSelected ? 'border border-accent/50' : ''}
                  ${!isSelected && !isTodayDate ? 'border border-transparent hover:bg-white/5' : ''}
                `}
                style={{
                  backgroundColor: isSelected ? undefined : getHeatmapBg(total),
                }}
              >
                <span
                  className={`text-sm ${
                    isTodayDate
                      ? 'text-accent font-bold'
                      : isCurrentMonth
                      ? 'text-textPrimary'
                      : 'text-textSecondary'
                  }`}
                >
                  {format(day, 'd')}
                </span>

                {/* 小圆点 */}
                {(data.bugCount > 0 || data.todoCount > 0) && (
                  <div className="flex gap-1 mt-1">
                    {data.bugCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    )}
                    {data.todoCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </GlassCard>

      {/* 日期详情面板 */}
      <DayDetail
        selectedDate={selectedDate}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  )
}
