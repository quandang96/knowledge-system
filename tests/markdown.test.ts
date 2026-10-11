import { describe,it,expect } from 'vitest'
import { checkRoundTrip,semanticSignature } from '../packages/ui/src/markdown-editor'
import { validateGraph } from '../apps/api/src/services/graph-validation'
describe('Tiptap Markdown round-trip',()=>{
  it.each([
    '# Heading\n\n## Purpose\n\n**Bold**, *italic* and `code`.\n\n- One\n- Two\n\n> **Lưu ý**\n> Example callout.',
    '| Role | View | Approve |\n| --- | --- | --- |\n| Manager | Yes | Conditional |',
    '![Màn hình](./assets/screenshot-abcdef.png)\n\n[Related](/screens/approval/SCR-APP-001/)',
    '```mermaid\nflowchart LR\n  A[Start] -->|Success| B[End]\n```\n\n```json\n{"a":1}\n```'
  ])('preserves supported Markdown semantics',source=>{const result=checkRoundTrip(source);expect(semanticSignature(result.output)).toBe(semanticSignature(source));expect(result.safe).toBe(true)})
  it('flags unsupported content rather than silently normalizing it',()=>{expect(checkRoundTrip('- [x] Done\n- [ ] Todo').safe).toBe(false)})
  it('rejects broken graph edges and duplicate IDs',()=>{const graph={schema_version:1,diagram_id:'DIA-TEST-001',type:'business-flow',title:'Demo',summary:'Flow summary',nodes:[{id:'a',type:'start',label:'A',position:{x:0,y:0}}],edges:[{id:'e1',source:'a',target:'missing',label:'Bad'}]};expect(()=>validateGraph(graph)).toThrow('không tồn tại');expect(()=>validateGraph({...graph,nodes:[graph.nodes[0],graph.nodes[0]],edges:[]})).toThrow('trùng')})
})
