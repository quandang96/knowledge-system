// Who has a draft open right now. Volatile on purpose: it is a hint to avoid colliding edits,
// not a lock, and the revision check on save remains the source of truth.
export class Presence {
  private readonly seen = new Map<string, Map<string, number>>()
  constructor(
    private readonly ttl = 90_000,
    private readonly now = () => Date.now()
  ) {}
  touch(docId: string, user: string) {
    const users = this.seen.get(docId) ?? new Map<string, number>()
    users.set(user, this.now())
    this.seen.set(docId, users)
    return this.others(docId, user)
  }
  leave(docId: string, user: string) {
    this.seen.get(docId)?.delete(user)
  }
  others(docId: string, user: string) {
    const users = this.seen.get(docId)
    if (!users) return []
    for (const [name, at] of users) if (this.now() - at > this.ttl) users.delete(name)
    if (!users.size) this.seen.delete(docId)
    return [...users.keys()].filter((name) => name !== user).sort()
  }
}
