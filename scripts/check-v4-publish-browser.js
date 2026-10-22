// Publishes/restores only synthetic documents in npm run test:browser:v4.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
async page => {
  const assert=(condition,message)=>{if(!condition)throw new Error(message)}
  const origin='http://127.0.0.1:5174';const id='SCR-V4-BROWSER-001'
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+`/studio/?doc=${id}`);await page.locator('.tiptap').waitFor()
  const before=await page.evaluate(async id=>({draft:(await(await fetch(`/api/documents/${id}/draft`)).json()).data,published:(await(await fetch(`/api/documents/${id}`)).json()).data}),id)
  await page.getByRole('button',{name:'Xuất bản',exact:true}).click()
  await page.waitForFunction(()=>[...document.querySelectorAll('.upload-status')].some(element=>element.textContent.includes('Đợt')))
  await page.screenshot({path:'output/playwright/v4-publish-progress.png',fullPage:true})
  await page.waitForFunction(()=>[...document.querySelectorAll('.upload-status')].some(element=>/Hoàn tất|Thất bại/.test(element.textContent)),{},{timeout:120000})
  const status=await page.locator('.upload-status').first().innerText();assert(status.includes('Hoàn tất'),status)
  const published=await page.evaluate(async id=>(await(await fetch(`/api/documents/${id}`)).json()).data,id)
  assert(published.body===before.draft.body,'Publication reordered or changed Markdown image blocks')
  assert(!published.body.includes('blob:')&&!published.body.includes('/draft-assets/'),'A temporary image URL leaked into Published')
  assert(published.metadata.screen.screenshot.gallery.length===0,'Publication generated implicit Gallery entries')
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}})
  try {
    const login=await context.request.post(origin+'/api/auth/login',{data:{username:'reader',password:'qa-reader'}});assert(login.ok(),'Reader login failed')
    const reader=await context.newPage();await reader.goto(origin+published.url);await reader.locator('.document-article').waitFor()
    await reader.waitForFunction(()=>[...document.querySelectorAll('.document-body img')].every(image=>image.complete&&image.naturalWidth>0))
    const expected=[...published.body.matchAll(/!\[[^\]]*\]\((\.\/assets\/[^ )]+)/g)].map(match=>match[1].split('/').pop())
    const actual=await reader.locator('.document-body img').evaluateAll(images=>images.map(image=>new URL(image.src).pathname.split('/').pop()))
    assert(JSON.stringify(actual)===JSON.stringify(expected),'A new browser session changed image order')
    assert(await reader.getByRole('link',{name:'Chỉnh sửa',exact:true}).count()===0,'Reader was offered an edit action')
    await reader.locator('.document-body .mermaid-svg svg').waitFor();await reader.screenshot({path:'output/playwright/v4-published-reader.png',fullPage:true})
    await reader.setViewportSize({width:390,height:844});await reader.screenshot({path:'output/playwright/v4-published-mobile.png',fullPage:true});assert(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Published content overflowed mobile')
  } finally {await context.close()}
  const restored=await page.evaluate(async({id,revision})=>{const session=(await(await fetch('/api/auth/session')).json()).data;const response=await fetch(`/api/documents/${id}/restore`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({revision})});const result=await response.json();if(!response.ok)throw new Error(result.error.message);return result.data},{id,revision:before.published.published_revision})
  assert(restored.revision!==published.published_revision,'Restore did not create a new revision')
  const afterRestore=await page.evaluate(async id=>(await(await fetch(`/api/documents/${id}`)).json()).data,id)
  assert(afterRestore.body===before.published.body,'Restore changed image order, paths or surrounding text')
  await page.goto(origin+afterRestore.url);await page.locator('.document-article').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.document-body img')].every(image=>image.complete&&image.naturalWidth>0))
  return {published:true,relativePaths:true,independentReaderSession:true,imageOrderPreserved:true,mobile:true,mermaid:true,restore:true}
}
