// Run against npm run test:browser:v4, with the Playwright connector or CLI.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
async page => {
  const origin='http://127.0.0.1:5174';const id='SCR-V4-BROWSER-001'
  const assert=(value,message)=>{if(!value)throw new Error(message)}
  const api=(url,payload)=>page.evaluate(async({url,payload})=>{const session=(await(await fetch('/api/auth/session')).json()).data;const response=await fetch(url,{method:payload?'PUT':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},...(payload?{body:JSON.stringify(payload)}:{})});const result=await response.json();if(!response.ok)throw new Error(result.error.message);return result.data},{url,payload})
  const draft=()=>api(`/api/documents/${id}/draft`)
  const save=async()=>{const response=page.waitForResponse(result=>result.url().includes(`/api/documents/${id}/draft`)&&result.request().method()==='PUT');await page.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();assert((await response).ok(),'Draft save failed');await page.waitForFunction(()=>document.querySelector('.studio-status')?.textContent?.startsWith('Đã lưu'))}
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/screens/')
  if(await page.getByRole('textbox',{name:'Tài khoản',exact:true}).count()){await page.getByRole('textbox',{name:'Tài khoản',exact:true}).fill('admin');await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('qa-admin');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click()}
  await page.locator('.project-switch .v-select .v-field').click();await page.getByRole('option',{name:'Demo Workflow System',exact:true}).click()
  await page.locator('.screen-catalog[aria-busy="false"]').waitFor()
  assert(await page.locator('nav[aria-label="Điều hướng tri thức"] a').count()===3,'Main navigation is not limited to three entries')
  const search=page.getByRole('textbox',{name:'Lọc tài liệu',exact:true})
  await search.fill('TRAN-DET-001');await page.waitForResponse(result=>result.url().includes('/api/catalog?')&&new URL(result.url()).searchParams.get('q')==='TRAN-DET-001');await page.locator('.screen-catalog[aria-busy="false"]').waitFor()
  assert(await page.locator('.screen-catalog tbody tr').count()===1,'Function code did not find its Screen')
  await page.locator('.screen-catalog a.document-key').click();await page.locator('#screen-functions tbody tr').waitFor()
  assert((await page.locator('#screen-functions').innerText()).includes('TRAN-DET-001'),'Screen mapping missing')
  const order=await page.evaluate(()=>[...document.querySelector('.document-intro').querySelectorAll('p,figure')].map(element=>element.tagName==='FIGURE'?'IMAGE':element.textContent))
  assert(order.indexOf('Văn bản trước ảnh tổng quan.')<order.indexOf('IMAGE')&&order.indexOf('IMAGE')<order.indexOf('Văn bản sau ảnh tổng quan.'),'Reader moved the inline image away from its paragraphs')
  await page.screenshot({path:'output/playwright/v4-after-detail.png',fullPage:true})
  await page.locator('#screen-functions a.document-key').click();await page.locator('.linked-screens a').waitFor();assert((await page.locator('.document-kicker').innerText()).includes('TRAN-DET-001'),'Function ID opened the wrong detail')
  await page.locator('nav[aria-label="Điều hướng tri thức"] a[href="/function-ids/"]').click();await page.locator('.function-registry .catalog-content[aria-busy="false"]').waitFor();await page.getByRole('tab',{name:'Ví dụ',exact:true}).click()
  assert((await page.locator('.convention-content').innerText()).includes('BILL-INQ-002'),'Managed convention examples not visible')
  await page.screenshot({path:'output/playwright/v4-after-registry-examples.png',fullPage:true})
  await page.goto(origin+`/studio/?doc=${id}`);await page.locator('.tiptap').waitFor()
  const current=await draft();const published=await api(`/api/documents/${id}`)
  await api(`/api/documents/${id}/draft`,{metadata:{...current.metadata,screen:{...current.metadata.screen,screenshot:{gallery:[]}}},body:published.body,base_revision:current.revision});await page.reload();await page.locator('.tiptap').waitFor()
  const rich=page.locator('.tiptap');let release=()=>{};let entered;let gate;let requested
  const reset=()=>{gate=new Promise(resolve=>release=resolve);requested=new Promise(resolve=>entered=resolve)}
  const hold=async route=>{entered();await gate;await route.continue()}
  const initialImages=await rich.locator('.editor-image-node').count()
  reset();await page.route(`**/api/documents/${id}/assets`,hold)
  try {
    await rich.locator(':scope > p').first().click();await page.keyboard.press('End')
    await page.getByLabel('Chọn ảnh chèn vào nội dung',{exact:true}).setInputFiles('.cache/v3-assets/approval.png');await requested
    assert(await rich.locator('.image-upload-placeholder').isVisible(),'Inline upload placeholder missing')
    assert(await page.getByRole('button',{name:'Lưu bản nháp',exact:true}).isDisabled(),'Save accepted an unfinished upload')
    await rich.locator(':scope > p').first().click({position:{x:12,y:10}});await page.keyboard.press('Home');await page.keyboard.type('Giữ nội dung khi tải ảnh. ')
    assert((await rich.innerText()).includes('Giữ nội dung khi tải ảnh.'),'Typing did not reach the editable paragraph')
    release();await page.waitForFunction(count=>document.querySelectorAll('.tiptap .editor-image-node').length===count+1,initialImages)
  } finally {release();await page.unroute(`**/api/documents/${id}/assets`,hold)}
  const image=rich.locator('.editor-image-node').first();await image.getByRole('button',{name:'Alt text / Caption',exact:true}).click()
  const dialog=page.locator('.v-overlay--active .new-doc-form');await dialog.getByLabel('Alt text',{exact:true}).fill('Ảnh chèn giữa nội dung');await dialog.getByLabel('Caption',{exact:true}).fill('Vị trí do người biên tập chọn');await dialog.getByRole('button',{name:'Áp dụng',exact:true}).click()
  await save();let persisted=await draft()
  assert(persisted.metadata.screen.screenshot.gallery.length===0&&!persisted.metadata.screen.screenshot.cover,'Inline image was silently added to Gallery/Cover')
  assert(persisted.body.includes('Giữ nội dung khi tải ảnh.')&&persisted.body.includes('Vị trí do người biên tập chọn'),'Upload/save lost text or caption')
  const paths=text=>[...text.matchAll(/!\[[^\]]*\]\((\.\/assets\/[^ )]+)/g)].map(match=>match[1]).join('|')
  const beforePaths=paths(persisted.body)
  for(let cycle=0;cycle<2;cycle++){
    await page.getByRole('tab',{name:'Markdown Source',exact:true}).click();assert(paths(await page.getByRole('textbox',{name:'Markdown Source',exact:true}).inputValue())===beforePaths,'Source round-trip moved image blocks')
    await page.getByRole('tab',{name:'Xem trước',exact:true}).click();await page.getByText('Vị trí do người biên tập chọn',{exact:true}).first().waitFor()
    await page.getByRole('tab',{name:'Soạn thảo',exact:true}).click();await rich.waitFor()
  }
  // Paste uses real image bytes and the authenticated upload API.
  const beforePaste=await rich.locator('.editor-image-node').count();await rich.locator(':scope > p').last().click();await page.keyboard.press('End')
  await page.evaluate(async()=>{const image=document.querySelector('.tiptap .media-image img');const bytes=await(await fetch(image.src)).arrayBuffer();const transfer=new DataTransfer();transfer.items.add(new File([bytes],'pasted.png',{type:'image/png'}));document.querySelector('.tiptap').dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}))})
  await page.waitForFunction(count=>document.querySelectorAll('.tiptap .editor-image-node').length===count+1,beforePaste)
  await save()
  const afterPastePaths=paths((await draft()).body)
  assert(afterPastePaths.split('|').length===beforePaste+1,'Paste was visible but not persisted')
  // @ lookup accepts business codes but stores the canonical document key.
  await rich.locator(':scope > p').last().click();await page.keyboard.press('End');await page.keyboard.type(' @')
  const picker=page.locator('.reference-picker');await picker.waitFor();await picker.getByLabel('Tìm tài liệu để liên kết',{exact:true}).fill('TRAN-DET-001');await page.waitForFunction(()=>document.querySelector('#reference-results')?.getAttribute('aria-busy')==='false');await picker.locator('.reference-result').first().click();await picker.getByRole('button',{name:/^Thêm liên kết/}).click();await picker.waitFor({state:'hidden'});await save()
  persisted=await draft();assert(persisted.body.includes('/document/?id=FUNC-V4-BROWSER-001'),'@ did not store a canonical key');assert(persisted.metadata.relations.filter(edge=>edge.kind==='implements').length===1,'@ changed the typed mapping')
  assert(paths(persisted.body)===afterPastePaths,'@ insertion changed existing image blocks')
  // Source uploads retain the saved caret even when the user types before it.
  await page.getByRole('tab',{name:'Markdown Source',exact:true}).click();const source=page.getByRole('textbox',{name:'Markdown Source',exact:true})
  await source.evaluate(element=>{const at=element.value.indexOf('## Hành vi chính');element.focus();element.setSelectionRange(at,at)})
  reset();await page.route(`**/api/documents/${id}/assets`,hold)
  try {
    // Avoid a native chooser in MCP: use the real button to capture the caret,
    // then supply a file to its input just as the chooser would.
    await page.getByLabel('Chọn ảnh chèn vào Markdown Source',{exact:true}).evaluate(input=>input.addEventListener('click',event=>event.preventDefault(),{once:true}))
    await page.getByRole('button',{name:'Chèn ảnh tại con trỏ',exact:true}).click();await page.getByLabel('Chọn ảnh chèn vào Markdown Source',{exact:true}).setInputFiles('.cache/v3-assets/approval.jpeg');await requested
    await source.press('Control+Home');await page.keyboard.type('Bổ sung đầu bài.\n\n');release();await page.waitForFunction(()=>!document.querySelector('button.v-btn--loading'))
    await page.waitForFunction(()=>document.querySelector('.markdown-textarea')?.value.includes('Ảnh minh họa'))
  } finally {release();await page.unroute(`**/api/documents/${id}/assets`,hold)}
  await save();persisted=await draft();const sourceImage=persisted.body.lastIndexOf('![Ảnh minh họa]');assert(sourceImage>persisted.body.indexOf('Văn bản sau ảnh tổng quan.')&&sourceImage<persisted.body.indexOf('## Hành vi chính'),'Source upload lost its caret when text changed')
  assert(persisted.metadata.screen.screenshot.gallery.length===0,'Source upload changed Gallery')
  for(const path of afterPastePaths.split('|'))assert(paths(persisted.body).includes(path),'Source upload removed an existing image')
  await page.getByRole('tab',{name:'Soạn thảo',exact:true}).click();await rich.waitFor()
  await page.screenshot({path:'output/playwright/v4-after-editor.png',fullPage:true})
  await page.reload();await rich.waitFor();assert((await rich.innerText()).includes('Bổ sung đầu bài.'),'Reload lost the latest text')
  // Mobile scroll belongs to each table/editor block, never the whole page.
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/playwright/v4-editor-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Editor overflows mobile')
  await page.goto(origin+'/screens/approval/'+id+'/');await page.locator('.document-article').waitFor();await page.screenshot({path:'output/playwright/v4-detail-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Reader overflows mobile')
  await page.goto(origin+'/function-ids/');await page.locator('.function-registry').waitFor();await page.screenshot({path:'output/playwright/v4-registry-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Registry overflows mobile')
  return {mainNavigation:3,screenFunctionLookup:true,managedExamples:true,caretUpload:true,noImplicitGallery:true,sourceRoundTrip:true,paste:true,canonicalMention:true,sourceCaretMapping:true,mobileOverflow:false}
}
