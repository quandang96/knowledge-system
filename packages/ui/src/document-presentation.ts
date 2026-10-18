import type MarkdownIt from 'markdown-it'
type Token=ReturnType<MarkdownIt['parse']>[number]

// Presentation only: the original Markdown stays available in export/history/editor.
const retiredHeadings=new Set(['kich ban kiem thu','kiem thu lien quan','related test cases','test cases','testing guide'])
export function businessContent(tokens:Token[]) {
  const visible:Token[]=[];let skippedLevel=0;let retired=false
  for(let index=0;index<tokens.length;index++) {
    const token=tokens[index]
    if(token.type==='heading_open') {
      const level=Number(token.tag.slice(1))
      if(skippedLevel&&level<=skippedLevel)skippedLevel=0
      const title=(tokens[index+1]?.content||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
      if(!skippedLevel&&retiredHeadings.has(title)){skippedLevel=level;retired=true}
    }
    if(!skippedLevel)visible.push(token)
  }
  return {tokens:visible,retired}
}
