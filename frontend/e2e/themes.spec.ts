import { expect, test, type Page } from '@playwright/test'

const THEME_IDS = ['international', 'traditional', 'ethnic', 'conventional', 'artistic']

const VIEWPORTS = {
  phone: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const

// Text from the shared sample wedding that every theme must show.
const MUST_SHOW = [
  'Alexander Wijaya',
  'Sarah Putri',
  'The First Hello',
  'Akad Nikah',
  'Wedding Reception',
  'Kencana Grand Ballroom',
  'Moments',
  'Will You Join Us?',
  'With love, Alexander & Sarah',
]

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

async function openPreview(page: Page, themeId: string) {
  await page.goto(`/themes/${themeId}/preview`)
  await expect(page.locator(`.wedding-site[data-theme="${themeId}"] > article`)).toBeVisible()
  // Scroll through like a guest would, so lazy-loaded images are requested.
  await page.evaluate(async () => {
    const pause = () => new Promise((r) => setTimeout(r, 40))
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y)
      await pause()
      // Swipe through horizontal scrollers in view, then return them to the start.
      for (const el of document.querySelectorAll<HTMLElement>('.wedding-site *')) {
        if (el.scrollWidth > el.clientWidth && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX)) {
          el.scrollLeft = el.scrollWidth
          await pause()
          el.scrollLeft = 0
        }
      }
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle')
}

async function brokenImages(page: Page) {
  return page.evaluate(async () => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>('.wedding-site img')]
    const timeout = new Promise((r) => setTimeout(r, 5000))
    await Promise.all(imgs.map((img) => Promise.race([img.decode().catch(() => undefined), timeout])))
    return imgs.filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src)
  })
}

for (const themeId of THEME_IDS) {
  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    test(`${themeId} renders on ${device} without horizontal overflow`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.setViewportSize(viewport)
      await openPreview(page, themeId)

      const site = page.locator('.wedding-site')
      for (const text of MUST_SHOW) {
        await expect(site.getByText(text, { exact: false }).first()).toBeVisible()
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0)

      // Every text block must fit inside the viewport (catches clipped, too-wide content).
      const offenders = await page.evaluate(() => {
        const vw = window.innerWidth
        return [...document.querySelectorAll('.wedding-site h1, .wedding-site h2, .wedding-site h3, .wedding-site p')]
          .filter((el) => {
            // Content inside an intentional horizontal scroller (e.g. a swipeable timeline) is fine.
            for (let a = el.parentElement; a; a = a.parentElement) {
              if (['auto', 'scroll'].includes(getComputedStyle(a).overflowX)) return false
            }
            const r = el.getBoundingClientRect()
            return r.width > 0 && (r.left < -1 || r.right > vw + 1)
          })
          .map((el) => el.textContent?.trim().slice(0, 40))
      })
      expect(offenders, 'text must stay within the viewport').toEqual([])
      expect(await brokenImages(page), 'all images must load').toEqual([])


      await page.screenshot({ path: `test-results/screens/${themeId}-${device}.png`, fullPage: true })
      expect(errors).toEqual([])
    })
  }
}

test('phone frame in the dashboard shows the mobile layout (container queries)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/themes/classic/romantic-floral')
  await page.getByRole('radio', { name: 'Phone' }).check()
  const frame = page.locator('.device-frame')
  await expect(frame.locator('.wedding-site > article')).toBeVisible()
  const { siteWidth, overflow } = await frame.evaluate((el) => ({
    siteWidth: el.querySelector('.wedding-site')!.getBoundingClientRect().width,
    overflow: el.scrollWidth - el.clientWidth,
  }))
  expect(siteWidth).toBeLessThan(400)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('unknown template id falls back to the default template with a notice', async ({ page }) => {
  await page.goto('/themes/does-not-exist/preview')
  await expect(page).toHaveURL(/\/themes\/international\/editorial\/international\/preview\?notFound=does-not-exist$/)
  await expect(page.locator('.wedding-site[data-theme="international"] > article')).toBeVisible()
  await expect(page.getByTestId('preview-not-found')).toContainText("doesn't exist")
})

test.describe('theme selection flow: family → collection → template', () => {
  test('families page lists all six families with accurate availability', async ({ page }) => {
    await page.goto('/themes')
    const families = page.locator('[data-family-card]')
    await expect(families).toHaveCount(6)
    const states = await families.evaluateAll((els) => els.map((e) => [e.getAttribute('data-family-card'), e.getAttribute('data-status')]))
    expect(states).toEqual([
      ['traditional', 'available'],
      ['international', 'available'],
      ['classic', 'available'],
      ['artistic', 'available'],
      ['modern-minimalist', 'coming_soon'],
      ['rustic-nature', 'coming_soon'],
    ])
    await expect(page.locator('[data-family-card="classic"]')).toContainText('Conventional / Classic')
    await expect(page.locator('[data-family-card="traditional"]')).toContainText('2 templates available · 3 coming soon · 13 collections')
    await expect(page.locator('[data-family-card="rustic-nature"]')).toContainText('In development · No collections yet')
    // Each card exposes one concise link named after the family.
    await expect(page.getByRole('link', { name: 'Conventional / Classic', exact: true })).toBeVisible()
  })

  test('every family has an explicit collection step, even with a single collection', async ({ page }) => {
    for (const [familyId, collectionId] of [
      ['international', 'editorial'],
      ['classic', 'romantic-floral'],
      ['artistic', 'contemporary'],
    ]) {
      await page.goto(`/themes/${familyId}`)
      await expect(page).toHaveURL(new RegExp(`/themes/${familyId}$`))
      await expect(page.locator('[aria-current="step"]')).toContainText('Collection')
      await expect(page.locator(`[data-collection-card="${collectionId}"]`)).toBeVisible()
    }
  })

  test('Traditional separates Nusantara Heritage from the 12 regional collections', async ({ page }) => {
    await page.goto('/themes/traditional')
    const general = page.locator('section[aria-labelledby="general-heading"] [data-collection-card]')
    const regional = page.locator('section[aria-labelledby="regional-heading"] [data-collection-card]')
    await expect(general).toHaveCount(1)
    await expect(general.first()).toHaveAttribute('data-collection-card', 'nusantara-heritage')
    await expect(regional).toHaveCount(12)
    expect(await regional.evaluateAll((els) => els.every((e) => e.getAttribute('data-status') === 'coming_soon'))).toBe(true)
    await expect(page.getByTestId('regional-summary')).toContainText('0 of 12 available')
    await expect(page.locator('[data-collection-card="malay"]')).toContainText('Also known as Melayu')
    await expect(page.locator('[data-collection-card="javanese"]')).toContainText('2 templates coming soon')
    await expect(page.locator('[data-collection-card="dayak"]')).toContainText('In development')
  })

  test('preview before selecting, then select with consistent feedback everywhere', async ({ page }) => {
    await page.goto('/themes/traditional/nusantara-heritage')
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/Themes\s*\/\s*Traditional\s*\/\s*Nusantara Heritage/)
    await expect(page.locator('[data-theme-card]')).toHaveCount(2)

    // Preview does not select.
    await page.getByRole('button', { name: 'Preview Woven Indigo' }).click()
    await expect(page.locator('.device-frame .wedding-site[data-theme="ethnic"] > article')).toBeVisible()
    await expect(page.getByTestId('selection-summary')).not.toContainText('Woven Indigo')

    // Select from the card; card, inline preview and summary all agree.
    const select = page.locator('[data-theme-card="ethnic"] [data-action="select"]')
    await select.click()
    await expect(select).toHaveText('Selected')
    await expect(select).toHaveAttribute('aria-disabled', 'true')
    await expect(select).toBeFocused()
    await expect(page.locator('[data-theme-card="ethnic"]')).toContainText('Selected')
    await expect(page.getByRole('status').filter({ hasText: 'Selected' })).toContainText(
      'Traditional › Nusantara Heritage › Woven Indigo',
    )
    await expect(page.locator('#preview-heading ~ * [data-action="select"], section[aria-labelledby="preview-heading"] [data-action="select"]').first()).toHaveText('Selected')

    // Full-screen preview shows ownership and the same selected state.
    await page.getByRole('link', { name: /Full-screen preview/ }).click()
    await expect(page).toHaveURL(/\/themes\/traditional\/nusantara-heritage\/ethnic\/preview$/)
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Woven Indigo')
    await expect(page.locator('[data-action="select"]')).toHaveText('Selected')
    await expect(page.getByRole('link', { name: 'Back to Nusantara Heritage collection' })).toBeVisible()

    await page.goto('/dashboard')
    await expect(page.getByText('Selected: Traditional › Nusantara Heritage › Woven Indigo')).toBeVisible()
  })

  test('coming-soon collections list planned templates that cannot be previewed or selected', async ({ page }) => {
    await page.goto('/themes/traditional/javanese')
    await expect(page.getByTestId('collection-reference')).toContainText('Central Java, Yogyakarta & East Java')
    await expect(page.getByTestId('collection-reference')).toContainText('cultural advisers')
    await expect(page.getByTestId('collection-count')).toHaveText('2 templates coming soon')
    const planned = page.locator('[data-theme-card][data-status="coming_soon"]')
    await expect(planned).toHaveCount(2)
    await expect(planned.getByRole('button')).toHaveCount(0)
    await expect(planned.first()).toContainText('Not yet available to preview or select')
    await expect(page.locator('.device-frame')).toHaveCount(0)
    // A planned template's preview URL leads back to its collection rather than a broken preview.
    await page.goto('/themes/solo-basahan/preview')
    await expect(page).toHaveURL(/\/themes\/traditional\/javanese$/)
  })

  test('planned families show an explicit, empty collection step', async ({ page }) => {
    for (const id of ['modern-minimalist', 'rustic-nature']) {
      await page.goto(`/themes/${id}`)
      await expect(page.getByTestId('family-coming-soon')).toContainText('Collections in development')
      await expect(page.locator('[data-action="select"]')).toHaveCount(0)
    }
  })

  test('aliases and legacy URLs resolve to canonical routes', async ({ page }) => {
    await page.goto('/themes/conventional')
    await expect(page).toHaveURL(/\/themes\/classic$/)
    await page.goto('/themes/classic/javanese')
    await expect(page).toHaveURL(/\/themes\/traditional\/javanese$/)
    await page.goto('/themes/blush-garden/preview')
    await expect(page).toHaveURL(/\/themes\/classic\/romantic-floral\/conventional\/preview$/)
    await page.goto('/themes/artistic/wrong/conventional/preview')
    await expect(page).toHaveURL(/\/themes\/classic\/romantic-floral\/conventional\/preview$/)
    for (const id of THEME_IDS) {
      await page.goto(`/themes/${id}/preview`)
      await expect(page.locator(`.wedding-site[data-theme="${id}"] > article`)).toBeVisible()
    }
  })

  test('unknown families and collections show a friendly not-found message', async ({ page }) => {
    await page.goto('/themes/space-opera')
    await expect(page.getByRole('heading', { name: 'Theme family not found' })).toBeVisible()
    await page.goto('/themes/classic/no-such-collection')
    await expect(page.getByRole('heading', { name: 'Collection not found' })).toBeVisible()
  })
})

test.describe('responsive and accessible picker', () => {
  const PAGES = [
    '/dashboard',
    '/themes',
    '/themes/traditional',
    '/themes/classic',
    '/themes/traditional/nusantara-heritage',
    '/themes/traditional/javanese',
    '/themes/modern-minimalist',
  ]

  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    test(`picker pages fit a ${device} screen`, async ({ page }) => {
      await page.setViewportSize(viewport)
      for (const path of PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${path} must not scroll horizontally on ${device}`).toBeLessThanOrEqual(0)
        if (device === 'phone') {
          const name = path.split('/').filter(Boolean).join('-')
          await page.screenshot({ path: `test-results/screens/picker-${name}-${device}.png`, fullPage: true })
        }
      }
    })
  }

  test('device size is a single-choice radio group operable with arrow keys', async ({ page }) => {
    await page.goto('/themes/classic/romantic-floral')
    const group = page.getByRole('group', { name: 'Preview size' })
    await expect(group.getByRole('radio')).toHaveCount(3)
    const phone = group.getByRole('radio', { name: 'Phone' })
    await expect(phone).toBeChecked()
    await phone.focus()
    await page.keyboard.press('ArrowRight')
    await expect(group.getByRole('radio', { name: 'Tablet' })).toBeChecked()
    await expect(phone).not.toBeChecked()
    await expect(page.locator('.device-frame')).toHaveAttribute('data-device', 'tablet')
  })

  test('keyboard users see focus on cards and controls', async ({ page }) => {
    await page.goto('/themes')
    const link = page.getByRole('link', { name: 'Traditional', exact: true })
    await link.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(link).toBeFocused()
    const ring = await page
      .locator('[data-family-card="traditional"]')
      .evaluate((el) => getComputedStyle(el).boxShadow)
    expect(ring, 'focused card shows a ring').not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/themes\/traditional$/)
  })

  for (const viewport of [VIEWPORTS.phone, { width: 375, height: 560 }, VIEWPORTS.desktop]) {
    test(`full-screen preview controls never cover the invitation (${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/themes/classic/romantic-floral/conventional/preview')
      const site = page.locator('.wedding-site')
      await expect(site.locator('> article')).toBeVisible()
      const bar = page.getByRole('banner', { name: 'Preview controls' })

      // At load, the invitation starts below the bar, and full-height sections are sized to the
      // space left below the bar (content may still make a section taller than one screen).
      const barBox = (await bar.boundingBox())!
      const siteBox = (await site.boundingBox())!
      expect(siteBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1)
      const heroMin = await site.evaluate((el) => parseFloat(getComputedStyle(el.querySelector('article > header')!).minHeight))
      expect(Math.abs(heroMin - (viewport.height - barBox.height))).toBeLessThanOrEqual(1)

      // At the end of the page, the last line of the invitation is not under the bar.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const last = page.locator('.wedding-site footer p').last()
      const lastBox = (await last.boundingBox())!
      const barAfter = (await bar.boundingBox())!
      expect(lastBox.y).toBeGreaterThanOrEqual(barAfter.y + barAfter.height)
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(viewport.height + 1)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
