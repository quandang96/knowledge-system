// Retry/cancel/drop/library regressions on the isolated V4 fixture only.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
async page => {
  const assert=(value,message)=>{if(!value)throw new Error(message)}
  const id='SCR-V4-BROWSER-001'
  await page.setViewportSize({width:1440,height:1000});await page.goto(`http://127.0.0.1:5174/studio/?doc=${id}`);await page.locator('.tiptap').waitFor()
  const rich=page.locator('.tiptap');const input=page.getByLabel('Chọn ảnh chèn vào nội dung',{exact:true})
  const count=()=>rich.locator('.editor-image-node').count()
  const save=async()=>{await page.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.studio-status')?.textContent?.startsWith('Đã lưu'))}
  const before=await count();const paragraphText=async()=>JSON.stringify(await rich.locator(':scope > p').allTextContents());const text=await paragraphText()
  const denied=route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{message:'Lỗi upload fixture có chủ đích.'}})})
  await page.route(`**/api/documents/${id}/assets`,denied)
  try {
    await rich.locator(':scope > p').first().click({position:{x:12,y:10}})
    await input.setInputFiles('.cache/v3-assets/approval.webp');await page.locator('.atlas-editor .v-alert').waitFor()
    assert(await count()===before && await paragraphText()===text,'A failed upload changed existing content')
    await page.locator('.atlas-editor .v-alert').getByRole('button',{name:'Hủy',exact:true}).click();assert(await page.locator('.atlas-editor .v-alert').count()===0,'Cancel did not clear the upload error')
    await input.setInputFiles('.cache/v3-assets/approval.webp');await page.locator('.atlas-editor .v-alert').waitFor()
  } finally {await page.unroute(`**/api/documents/${id}/assets`,denied)}
  await page.locator('.atlas-editor .v-alert').getByRole('button',{name:'Thử tải lại',exact:true}).click()
  await page.waitForFunction(n=>document.querySelectorAll('.tiptap .editor-image-node').length===n+1,before);await save()
  const beforeDrop=await count()
  await page.evaluate(async()=>{const element=document.querySelector('.tiptap > p');const image=document.querySelector('.tiptap img');const bytes=await(await fetch(image.src)).arrayBuffer();const transfer=new DataTransfer();transfer.items.add(new File([bytes],'drop.png',{type:'image/png'}));const rect=element.getBoundingClientRect();element.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true,clientX:rect.x+12,clientY:rect.y+10}))})
  await page.waitForFunction(n=>document.querySelectorAll('.tiptap .editor-image-node').length===n+1,beforeDrop);await save()
  const beforeLibrary=await count()
  await rich.locator(':scope > p').first().click({position:{x:12,y:10}});await page.keyboard.press('Home')
  await page.getByRole('button',{name:'Thư viện ảnh tài liệu',exact:true}).click();await page.locator('.image-library button').first().click();await page.keyboard.type('Văn bản sau chọn ảnh. ')
  assert(await count()===beforeLibrary+1,'Typing after library insertion replaced the image')
  await save()
  const persisted=await page.evaluate(async id=>(await(await fetch(`/api/documents/${id}/draft`)).json()).data,id)
  assert(persisted.body.includes('Văn bản sau chọn ảnh.'),'Library insertion lost subsequent typing')
  assert(persisted.metadata.screen.screenshot.gallery.length===0&&!persisted.metadata.screen.screenshot.cover,'A media action generated Gallery/Cover metadata')
  return {errorPreservedContent:true,cancel:true,retry:true,drop:true,libraryCaret:true,noImplicitGallery:true}
}
