/** Bounded local undo history. It never changes the server revision baseline. */
export class SnapshotHistory<T> {
  private items: string[] = []
  private index = -1
  private limit: number
  constructor(limit = 50) {
    this.limit = Math.max(2, limit)
  }
  get canUndo() {
    return this.index > 0
  }
  get canRedo() {
    return this.index >= 0 && this.index < this.items.length - 1
  }
  reset(value: T) {
    this.items = [JSON.stringify(value)]
    this.index = 0
  }
  record(value: T) {
    const serialized = JSON.stringify(value)
    if (serialized === this.items[this.index]) return
    this.items = this.items.slice(0, this.index + 1)
    this.items.push(serialized)
    if (this.items.length > this.limit) this.items.shift()
    this.index = this.items.length - 1
  }
  undo(): T | null {
    return this.canUndo ? JSON.parse(this.items[--this.index]) : null
  }
  redo(): T | null {
    return this.canRedo ? JSON.parse(this.items[++this.index]) : null
  }
}
