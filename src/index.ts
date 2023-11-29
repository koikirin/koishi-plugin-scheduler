import { Awaitable, Context, Schema, Service } from 'koishi'
import { parseExpression } from 'cron-parser'

declare module 'koishi' {
  interface Context {
    scheduler: Scheduler
  }
}

export class Scheduler extends Service {
  static filter = false

  constructor(ctx: Context) {
    super(ctx, 'scheduler')
  }

  every(ms: number, callback: () => Awaitable<void>) {
    const timer = setInterval(callback, ms)
    return this[Context.current].collect('scheduler', () => (clearInterval(timer), true))
  }

  next(ms: number, callback: () => Awaitable<void>) {
    const timeout = setTimeout(callback, ms)
    return this[Context.current].collect('scheduler', () => (clearTimeout(timeout), true))
  }

  at(time: number | { getTime(): number }, callback: () => Awaitable<void>) {
    if (typeof time === 'number') return this.next(time - Date.now(), callback)
    else return this.next(time.getTime() - Date.now(), callback)
  }

  cron(crontab: string, callback: () => Awaitable<void>, startDate?: Date, endDate?: Date) {
    const cronitor = this.cronitor(crontab, startDate, endDate)
    let flag = true
    const task = () => {
      if (!flag) return
      callback()
      const next = cronitor.next()
      if (!next.done) this.at(next.value, task)
    }
    const next = cronitor.next()
    if (!next.done) {
      const timeout = setTimeout(task, next.value.getTime() - Date.now())
      return this[Context.current].collect('scheduler', () => (clearTimeout(timeout), flag = false, true))
    }
  }

  private cronitor(crontab: string, startDate?: Date, endDate?: Date) {
    return parseExpression(crontab, {
      startDate,
      endDate,
      iterator: true,
    })
  }
}

export namespace Scheduler {
  export interface Config { }
  export const Config: Schema<Config> = Schema.object({})
}

export default Scheduler
