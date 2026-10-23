declare module '*.md?raw' {
  const content: string
  export default content
}
// Vite's import.meta.glob, without pulling in all of vite/client.
interface ImportMeta {
  glob<T = unknown>(pattern: string, options: { eager: true; query?: string; import?: string }): Record<string, T>
}
