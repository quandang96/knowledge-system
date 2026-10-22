// Run in an authenticated browser-fixture session (admin / qa-admin).
// Hold real requests to make layout shifts and intermediate states observable.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
async page => {
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const origin = 'http://127.0.0.1:5174'
  const requests = []
  const collect = request => {
    if (new URL(request.url()).pathname === '/api/catalog') requests.push(request.url())
  }
  page.on('request', collect)
  let release = () => {}; let entered; let gate; let requested
  const reset = () => {
    gate = new Promise(resolve => { release = resolve })
    requested = new Promise(resolve => { entered = resolve })
  }
  const hold = async route => { entered(); await gate; await route.continue() }
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(origin + '/library/?q=SCR')
    await page.locator('.catalog-content[aria-busy="false"]').waitFor()
    // Allow the old 180ms initialization debounce to surface a duplicate load.
    await page.waitForTimeout(400)
    assert(requests.length === 1, `Catalog initialization sent ${requests.length} requests`)
    await page.getByRole('button', { name: 'Dạng danh sách', exact: true }).click()
    await page.locator('.catalog-table').waitFor()

    reset()
    await page.route('**/api/documents/*/connections', hold)
    try {
      await page.locator('.catalog-table a[href*="/screens/"]').first().click()
      await requested
      await page.locator('.document-article').waitFor()
      assert(await page.locator('.document-loading').count() === 0, 'Skeleton rendered above the loaded document')
      const before = await page.locator('.document-article').boundingBox()
      const response = page.waitForResponse(item => item.url().endsWith('/connections'))
      release(); await response
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const after = await page.locator('.document-article').boundingBox()
      assert(Math.abs(after.y - before.y) < 1, `Connections moved the article by ${after.y - before.y}px`)
    } finally {
      release(); await page.unroute('**/api/documents/*/connections', hold)
    }

    reset()
    await page.route('**/api/catalog?*', hold)
    try {
      await page.locator('nav[aria-label="Điều hướng tri thức"] a[href="/library/"]').click()
      await requested
      await page.locator('.catalog-loading .v-skeleton-loader').waitFor()
      assert(await page.locator('.catalog-table, .catalog-grid').count() === 0, 'Empty results rendered alongside the catalog skeleton')
      assert(await page.locator('.empty-state').count() === 0, 'Empty state appeared before the catalog response')
      release()
      await page.locator('.catalog-content[aria-busy="false"]').waitFor()

      const tableBefore = await page.locator('.catalog-table').boundingBox()
      reset()
      await page.getByRole('textbox', { name: 'Lọc tài liệu' }).fill('SCR')
      await requested
      await page.locator('.catalog-progress').waitFor()
      const tableWhileLoading = await page.locator('.catalog-table').boundingBox()
      assert(Math.abs(tableWhileLoading.y - tableBefore.y) < 1, 'Filter progress moved the existing results')
      release()
      await page.locator('.catalog-content[aria-busy="false"]').waitFor()

      // Catalog is reused when switching categories. Capture every DOM mutation
      // so a one-frame empty-state flash also fails this check.
      await page.evaluate(() => {
        window.__catalogEmptyFlash = false
        window.__catalogObserver = new MutationObserver(() => {
          if (document.querySelector('.catalog-content .empty-state')) window.__catalogEmptyFlash = true
        })
        window.__catalogObserver.observe(document.querySelector('#main'), { childList: true, subtree: true })
      })
      reset()
      const beforeRequests = requests.length
      await page.locator('nav[aria-label="Điều hướng tri thức"] a[href="/screens/"]').click()
      await requested
      await page.locator('.catalog-loading .v-skeleton-loader').waitFor()
      assert(!await page.evaluate(() => window.__catalogEmptyFlash), 'Category navigation flashed an empty state')
      release()
      await page.locator('.catalog-content[aria-busy="false"]').waitFor()
      await page.waitForTimeout(250)
      assert(requests.length - beforeRequests === 1, 'Category navigation sent duplicate catalog requests')
      await page.evaluate(() => window.__catalogObserver.disconnect())
    } finally {
      release(); await page.unroute('**/api/catalog?*', hold)
    }
    return { documentShiftPx: 0, filterShiftPx: 0, exclusiveSkeletons: true, noEmptyFlash: true, oneRequestPerNavigation: true }
  } finally {
    release()
    page.off('request', collect)
    await page.evaluate(() => window.__catalogObserver?.disconnect())
  }
}
