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

      // Hide the preview control bar so it doesn't cover the theme in screenshots.
      await page.addStyleTag({ content: '[aria-label="Preview controls"]{display:none!important}' })

      await page.screenshot({ path: `test-results/screens/${themeId}-${device}.png`, fullPage: true })
      expect(errors).toEqual([])
    })
  }
}

test('phone frame in the dashboard shows the mobile layout (container queries)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/themes/classic/romantic-floral')
  await page.getByRole('button', { name: 'Phone' }).click()
  const frame = page.locator('.device-frame')
  await expect(frame.locator('.wedding-site > article')).toBeVisible()
  const { siteWidth, overflow } = await frame.evaluate((el) => ({
    siteWidth: el.querySelector('.wedding-site')!.getBoundingClientRect().width,
    overflow: el.scrollWidth - el.clientWidth,
  }))
  expect(siteWidth).toBeLessThan(400)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('unknown theme id falls back to the default theme with a notice', async ({ page }) => {
  await page.goto('/themes/does-not-exist/preview')
  await expect(page.locator('.wedding-site[data-theme="international"] > article')).toBeVisible()
  await expect(page.getByText(/doesn't exist/)).toBeVisible()
})

test.describe('theme selection flow: family → collection → template', () => {
  test('families page lists the six families with coming-soon badges', async ({ page }) => {
    await page.goto('/themes')
    const families = page.locator('[data-family-card]')
    await expect(families).toHaveCount(6)
    expect(await families.evaluateAll((els) => els.map((e) => e.getAttribute('data-family-card')))).toEqual([
      'traditional', 'international', 'classic', 'artistic', 'modern-minimalist', 'rustic-nature',
    ])
    await expect(page.locator('[data-family-card="modern-minimalist"]')).toContainText('Coming soon')
  })

  test('Traditional shows 13 collections and drills into a template', async ({ page }) => {
    await page.goto('/themes')
    await page.locator('[data-family-card="traditional"] a').click()
    await expect(page).toHaveURL(/\/themes\/traditional$/)
    await expect(page.locator('[data-collection-card]')).toHaveCount(13)

    await page.locator('[data-collection-card="nusantara-heritage"] a').click()
    await expect(page).toHaveURL(/\/themes\/traditional\/nusantara-heritage$/)
    await expect(page.locator('[data-theme-card]')).toHaveCount(2)

    await page.locator('[data-theme-card="ethnic"]').getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.locator('.device-frame .wedding-site[data-theme="ethnic"] > article')).toBeVisible()
    await page.locator('[data-theme-card="ethnic"]').getByRole('button', { name: 'Select template' }).click()
    await expect(page.getByTestId('selection-summary')).toContainText('Traditional › Nusantara Heritage › Woven Indigo')

    await page.goto('/dashboard')
    await expect(page.getByText('Selected: Traditional › Woven Indigo')).toBeVisible()
  })

  test('a single-collection family skips straight to its templates', async ({ page }) => {
    await page.goto('/themes/classic')
    await expect(page).toHaveURL(/\/themes\/classic\/romantic-floral$/)
    await expect(page.locator('[data-theme-card="conventional"]')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/Themes\s*\/\s*Classic$/)
  })

  test('coming-soon collections list planned templates that cannot be selected', async ({ page }) => {
    await page.goto('/themes/traditional/javanese')
    await expect(page.getByTestId('collection-reference')).toContainText('Central Java, Yogyakarta & East Java')
    await expect(page.getByTestId('collection-reference')).toContainText('cultural advisers')
    const planned = page.locator('[data-theme-card][data-status="coming_soon"]')
    await expect(planned).toHaveCount(2)
    await expect(planned.getByRole('button')).toHaveCount(0)
    await expect(page.locator('.device-frame')).toHaveCount(0)
  })

  test('coming-soon families explain that designs are in progress', async ({ page }) => {
    await page.goto('/themes/rustic-nature')
    await expect(page.getByTestId('family-coming-soon')).toBeVisible()
  })

  test('unknown families and collections show a friendly not-found message', async ({ page }) => {
    await page.goto('/themes/space-opera')
    await expect(page.getByRole('heading', { name: 'Theme family not found' })).toBeVisible()
    await page.goto('/themes/classic/javanese')
    await expect(page.getByRole('heading', { name: 'Collection not found' })).toBeVisible()
  })

  test('Workstream 2 preview URLs still work for every original template id', async ({ page }) => {
    for (const id of THEME_IDS) {
      await page.goto(`/themes/${id}/preview`)
      await expect(page.locator(`.wedding-site[data-theme="${id}"] > article`)).toBeVisible()
    }
  })

  test('picker pages fit a phone screen', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone)
    for (const path of ['/dashboard', '/account', '/themes', '/themes/traditional', '/themes/traditional/nusantara-heritage', '/themes/traditional/javanese']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${path} must not scroll horizontally`).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `test-results/screens/picker-${path.split('/').filter(Boolean).join('-')}-phone.png`, fullPage: true })
    }
  })
})
