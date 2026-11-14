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

test('theme picker lists all five themes', async ({ page }) => {
  await page.goto('/themes')
  await expect(page.locator('[data-theme-card]')).toHaveCount(THEME_IDS.length)
  const ids = await page.locator('[data-theme-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-theme-card')))
  expect(ids.sort()).toEqual([...THEME_IDS].sort())
})

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
  await page.goto('/themes')
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
