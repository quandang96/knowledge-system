// Map a saved caret through text edits while an image upload is in flight.
export function mapSourcePosition(position: number, before: string, after: string) {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  let oldEnd = before.length
  let newEnd = after.length
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  if (position < start) return position
  if (position >= oldEnd) return position + newEnd - oldEnd
  return newEnd
}
