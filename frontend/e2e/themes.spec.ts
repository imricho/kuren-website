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

test('phone frame in the studio shows the mobile layout (container queries)', async ({ page }) => {
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
  await expect(page).toHaveURL(/\/themes\/international\/editorial\/editorial-ivory\/preview\?notFound=does-not-exist$/)
  await expect(page.locator('.wedding-site[data-theme="international"] > article')).toBeVisible()
  await expect(page.getByTestId('preview-not-found')).toContainText("doesn't exist")
})

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Browse themes' })
const pane = (page: Page) => page.getByTestId('preview-pane')

test.describe('theme studio: sidebar (left) + live preview (right)', () => {
  test('desktop layout puts the sidebar on the left and the preview on the right', async ({ page }) => {
    for (const viewport of [VIEWPORTS.desktop, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport)
      await page.goto('/themes/classic/romantic-floral')
      const side = (await sidebar(page).boundingBox())!
      const prev = (await pane(page).boundingBox())!
      expect(side.x + side.width).toBeLessThanOrEqual(prev.x + 1)
      expect(Math.abs(side.y - prev.y)).toBeLessThan(80)
      // Both columns fit the screen; the invitation scrolls inside the preview, not the page.
      expect(prev.y + prev.height).toBeLessThanOrEqual(viewport.height + 1)
      const pageScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
      expect(pageScroll).toBeLessThanOrEqual(1)
    }
  })

  test('sidebar lists all six families with accurate names and availability', async ({ page }) => {
    await page.goto('/themes')
    const families = sidebar(page).locator('[data-family-card]')
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
    await expect(page.locator('[data-family-card="traditional"] [data-testid="family-summary"]')).toHaveText(
      '2 templates available · 12 regional collections in development',
    )
    await expect(page.locator('[data-family-card="modern-minimalist"] [data-testid="family-summary"]')).toHaveText(
      'In development — no collections yet',
    )
    await expect(page.locator('[aria-current="step"]')).toContainText('Family')
  })

  test('browse Family → Collection → Template with location and back links', async ({ page }) => {
    await page.goto('/themes')
    await page.getByRole('link', { name: 'Conventional / Classic', exact: true }).click()
    await expect(page).toHaveURL(/\/themes\/classic$/)
    await expect(page.locator('[aria-current="step"]')).toContainText('Collection')
    await expect(sidebar(page).getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/Themes\s*\/\s*Conventional \/ Classic/)
    // Explicit collection step even with a single collection.
    await expect(page.locator('[data-collection-card]')).toHaveCount(1)

    await sidebar(page).getByRole('link', { name: 'Romantic Floral', exact: true }).click()
    await expect(page).toHaveURL(/\/themes\/classic\/romantic-floral$/)
    await expect(page.locator('[aria-current="step"]')).toContainText('Template')
    await expect(sidebar(page).getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(
      /Themes\s*\/\s*Conventional \/ Classic\s*\/\s*Romantic Floral/,
    )

    await page.getByTestId('sidebar-back').click()
    await expect(page).toHaveURL(/\/themes\/classic$/)
    await page.getByTestId('sidebar-back').click()
    await expect(page).toHaveURL(/\/themes$/)
  })

  test('clicking a template previews it on the right without selecting it', async ({ page }) => {
    await page.goto('/themes/traditional/nusantara-heritage')
    await expect(page.locator('[data-theme-card]')).toHaveCount(2)
    await page.getByRole('link', { name: 'Preview Woven Indigo' }).click()
    await expect(page).toHaveURL(/\/themes\/traditional\/nusantara-heritage\/woven-indigo$/)
    await expect(pane(page).locator('.wedding-site[data-theme="ethnic"] > article')).toBeVisible()
    await expect(pane(page).getByRole('heading', { name: 'Woven Indigo' })).toBeVisible()
    await expect(page.locator('[data-theme-card="ethnic"] a')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByTestId('selection-summary')).not.toContainText('Woven Indigo')
    await expect(page.locator('[data-theme-card="ethnic"]')).not.toContainText('Selected')

    // Selecting is one explicit action in the preview pane, with feedback everywhere.
    const select = pane(page).locator('[data-action="select"]')
    await select.click()
    await expect(select).toHaveText('Selected')
    await expect(select).toHaveAttribute('aria-disabled', 'true')
    await expect(select).toBeFocused()
    await expect(page.locator('[data-theme-card="ethnic"]')).toContainText('Selected')
    await expect(page.getByRole('status').filter({ hasText: 'Selected' })).toContainText(
      'Traditional › Nusantara Heritage › Woven Indigo',
    )

    // Previewing another template keeps the selection.
    await page.getByRole('link', { name: 'Preview Royal Maroon' }).click()
    await expect(pane(page).getByRole('heading', { name: 'Royal Maroon' })).toBeVisible()
    await expect(pane(page).locator('[data-action="select"]')).toHaveText('Select template')
    await expect(page.getByTestId('selection-summary')).toContainText('Woven Indigo')

    // Full-screen preview matches family, collection and template.
    await page.getByRole('link', { name: 'Preview Woven Indigo' }).click()
    await pane(page).getByRole('link', { name: /Full-screen preview/ }).click()
    await expect(page).toHaveURL(/\/themes\/traditional\/nusantara-heritage\/woven-indigo\/preview$/)
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Woven Indigo')
    await expect(page.locator('[data-action="select"]')).toHaveText('Selected')
    await page.getByRole('link', { name: 'Back to Nusantara Heritage collection' }).click()
    await expect(page).toHaveURL(/\/themes\/traditional\/nusantara-heritage$/)

    await page.goto('/dashboard')
    await expect(page.getByText('Selected: Traditional › Nusantara Heritage › Woven Indigo')).toBeVisible()
  })

  test('Traditional separates Nusantara Heritage from the 12 planned regional collections', async ({ page }) => {
    await page.goto('/themes/traditional')
    const general = page.locator('section[aria-labelledby="sb-general"] [data-collection-card]')
    const regional = page.locator('section[aria-labelledby="sb-regional"] [data-collection-card]')
    await expect(general).toHaveCount(1)
    await expect(general.first()).toHaveAttribute('data-collection-card', 'nusantara-heritage')
    await expect(regional).toHaveCount(12)
    expect(await regional.evaluateAll((els) => els.every((e) => e.getAttribute('data-status') === 'coming_soon'))).toBe(true)
    await expect(page.getByTestId('regional-summary')).toContainText('0 of 12 available')
    await expect(page.getByTestId('regional-summary')).toContainText('reviewed with the community')
    await expect(page.locator('[data-collection-card="batak"] [data-testid="locality-hint"]')).toHaveText(
      'Needs a subtradition: Toba, Karo, Mandailing, Simalungun, Pakpak, Angkola',
    )
    await expect(page.locator('[data-collection-card="batak"]')).toContainText('In development')
    await expect(page.locator('[data-collection-card="malay"]')).toContainText('Also known as Melayu')
  })

  test('regional collections show their brief, stay in development and preview a neutral design', async ({ page }) => {
    await page.goto('/themes/traditional/javanese')
    await expect(page.getByTestId('collection-count')).toHaveText('2 templates planned')
    const planned = page.locator('[data-theme-card][data-status="coming_soon"]')
    await expect(planned).toHaveCount(2)
    await expect(planned.getByRole('link')).toHaveCount(0)
    await expect(planned.first()).toContainText('In development')

    // Brief: scope, status, locality requirement, and sourced vs research vs art direction kept apart.
    const brief = page.getByTestId('collection-brief')
    await expect(brief).toContainText('Central Java, Yogyakarta & East Java')
    await expect(page.getByTestId('review-status')).toHaveText('In development')
    await expect(brief).toContainText('Not yet reviewed by a cultural practitioner or organisation')
    await expect(page.getByTestId('locality-requirement')).toContainText('Required — not chosen yet')
    await page.getByTestId('brief-sources').locator('summary').click()
    await expect(page.getByTestId('brief-sources')).toContainText('0 of 2 verified')
    await expect(page.getByTestId('brief-sources')).toContainText('Confirmed cultural references: none yet')
    await expect(page.getByTestId('brief-sources').getByRole('link').first()).toHaveAttribute('rel', /noopener/)
    await page.getByTestId('brief-research').locator('summary').click()
    await expect(page.getByTestId('brief-research')).toContainText('not confirmed')
    await page.getByTestId('brief-art-direction').locator('summary').click()
    await expect(page.getByTestId('brief-art-direction')).toContainText('creative choices, not cultural claims')

    // Neutral preview, clearly labelled — never presented as a Javanese design.
    await expect(pane(page).locator('.wedding-site[data-theme="traditional"], .wedding-site[data-theme="ethnic"]')).toBeVisible()
    await expect(page.getByTestId('preview-notice')).toContainText('awaiting cultural review')
    await expect(page.getByTestId('preview-notice')).toContainText('culturally neutral design, not a Javanese design')

    await page.goto('/themes/solo-basahan/preview')
    await expect(page).toHaveURL(/\/themes\/traditional\/javanese$/)
  })

  test('every regional collection previews a neutral design until reviewed', async ({ page }) => {
    for (const id of ['javanese', 'sundanese', 'minangkabau', 'batak', 'bugis', 'betawi', 'malay', 'madura', 'balinese', 'dayak', 'ambon-maluku', 'papuan']) {
      await page.goto(`/themes/traditional/${id}`)
      await expect(page.getByTestId('collection-brief')).toBeVisible()
      await expect(pane(page).locator('.wedding-site')).toHaveAttribute('data-theme', /^(traditional|ethnic)$/)
      await expect(page.getByTestId('preview-notice')).toContainText('culturally neutral design')
    }
  })

  test('families in development have no selectable collections', async ({ page }) => {
    for (const id of ['modern-minimalist', 'rustic-nature']) {
      await page.goto(`/themes/${id}`)
      await expect(page.getByTestId('family-coming-soon')).toContainText('Collections in development')
      await expect(sidebar(page).locator('[data-collection-card], [data-theme-card]')).toHaveCount(0)
      await expect(page.getByTestId('preview-notice')).toContainText('has no templates to preview yet')
    }
  })

  test('the preview follows the family being browsed', async ({ page }) => {
    await page.goto('/themes/international/editorial/editorial-ivory')
    await expect(pane(page).getByRole('heading', { name: 'Editorial Ivory' })).toBeVisible()
    await page.goto('/themes')
    await page.getByRole('link', { name: 'Conventional / Classic', exact: true }).click()
    await expect(pane(page).getByRole('heading', { name: 'Blush Garden' })).toBeVisible()
  })

  test('Conventional / Classic has one canonical identity; aliases and legacy URLs redirect', async ({ page }) => {
    await page.goto('/themes/conventional')
    await expect(page).toHaveURL(/\/themes\/classic$/)
    await page.goto('/themes/conventional/romantic-floral/conventional')
    await expect(page).toHaveURL(/\/themes\/classic\/romantic-floral\/blush-garden$/)
    await page.goto('/themes/conventional/preview')
    await expect(page).toHaveURL(/\/themes\/classic\/romantic-floral\/blush-garden\/preview$/)
    await page.goto('/themes/classic/javanese')
    await expect(page).toHaveURL(/\/themes\/traditional\/javanese$/)
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

test.describe('responsive and accessible studio', () => {
  const PAGES = ['/dashboard', '/themes', '/themes/traditional', '/themes/classic', '/themes/traditional/nusantara-heritage', '/themes/traditional/javanese', '/themes/modern-minimalist']

  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    test(`studio pages fit a ${device} browser window`, async ({ page }) => {
      await page.setViewportSize(viewport)
      for (const path of PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${path} must not scroll horizontally on ${device}`).toBeLessThanOrEqual(0)
        const name = path.split('/').filter(Boolean).join('-')
        await page.screenshot({ path: `test-results/screens/studio-${name}-${device}.png`, fullPage: true })
      }
    })
  }

  test('narrow screens: selector above the preview collapses after choosing a template', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone)
    await page.goto('/themes/traditional/nusantara-heritage')
    const toggle = page.getByTestId('selector-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle).toContainText('Traditional › Nusantara Heritage')
    // Selector is above the preview.
    const sel = (await page.locator('#theme-sidebar').boundingBox())!
    const prev = (await pane(page).boundingBox())!
    expect(sel.y).toBeLessThan(prev.y)

    await page.getByRole('link', { name: 'Preview Woven Indigo' }).click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#theme-sidebar')).toBeHidden()
    await expect(pane(page).getByRole('heading', { name: 'Woven Indigo' })).toBeInViewport()
    await toggle.click()
    await expect(page.locator('#theme-sidebar')).toBeVisible()
  })

  test('device size is a single-choice radio group operable with arrow keys', async ({ page }) => {
    await page.goto('/themes/classic/romantic-floral')
    const group = page.getByRole('group', { name: 'Preview size' })
    await expect(group.getByRole('radio')).toHaveCount(3)
    const phone = group.getByRole('radio', { name: 'Phone' })
    await expect(phone).toBeChecked()
    await phone.focus()
    await page.keyboard.press('ArrowRight')
    await expect(group.getByRole('radio', { name: 'Tablet' })).toBeChecked()
    await expect(page.locator('.device-frame')).toHaveAttribute('data-device', 'tablet')
  })

  test('keyboard users see focus in the sidebar', async ({ page }) => {
    await page.goto('/themes')
    const link = page.getByRole('link', { name: 'Traditional', exact: true })
    await link.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(link).toBeFocused()
    const ring = await page.locator('[data-family-card="traditional"]').evaluate((el) => getComputedStyle(el).boxShadow)
    expect(ring, 'focused item shows a ring').not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/themes\/traditional$/)
  })

  test('preview controls never cover the invitation in the studio', async ({ page }) => {
    for (const viewport of [VIEWPORTS.desktop, VIEWPORTS.phone]) {
      await page.setViewportSize(viewport)
      await page.goto('/themes/classic/romantic-floral/blush-garden')
      const frame = page.locator('.device-frame')
      const header = (await pane(page).locator('header').first().boundingBox())!
      const frameBox = (await frame.boundingBox())!
      expect(frameBox.y).toBeGreaterThanOrEqual(header.y + header.height)
      // The invitation's full-height sections match the frame, and its end is reachable by scrolling the frame.
      await frame.evaluate((el) => el.scrollTo(0, el.scrollHeight))
      const last = frame.locator('.wedding-site footer p').last()
      const lastBox = (await last.boundingBox())!
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 1)
      expect(lastBox.y).toBeGreaterThanOrEqual(frameBox.y)
    }
  })

  for (const viewport of [VIEWPORTS.phone, { width: 375, height: 560 }, VIEWPORTS.desktop]) {
    test(`full-screen preview controls never cover the invitation (${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/themes/classic/romantic-floral/blush-garden/preview')
      const site = page.locator('.wedding-site')
      await expect(site.locator('> article')).toBeVisible()
      const bar = page.getByRole('banner', { name: 'Preview controls' })
      const barBox = (await bar.boundingBox())!
      const siteBox = (await site.boundingBox())!
      expect(siteBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1)
      const heroMin = await site.evaluate((el) => parseFloat(getComputedStyle(el.querySelector('article > header')!).minHeight))
      expect(Math.abs(heroMin - (viewport.height - barBox.height))).toBeLessThanOrEqual(1)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const lastBox = (await page.locator('.wedding-site footer p').last().boundingBox())!
      const barAfter = (await bar.boundingBox())!
      expect(lastBox.y).toBeGreaterThanOrEqual(barAfter.y + barAfter.height)
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(viewport.height + 1)
    })
  }
})
