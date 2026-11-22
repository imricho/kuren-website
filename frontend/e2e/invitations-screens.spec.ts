/**
 * Visual-review screenshots + axe-core scan for the invitation engine. Opt-in (not part of the
 * merge-blocking suite):  QA_SCREENS=1 npx playwright test e2e/invitations-screens.spec.ts
 * Screens go to frontend/test-results/invitations-screens/ (gitignored).
 * axe runs when AXE_PATH points at axe.min.js; results go to axe-results.json next to the screens.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { createInvitation, postRsvp, publishedInvitation, putSection, type Json } from './invitation-helpers'

const OUT = new URL('../test-results/invitations-screens/', import.meta.url).pathname
const AXE = process.env.AXE_PATH
test.skip(!process.env.QA_SCREENS, 'set QA_SCREENS=1 to capture review screenshots')
test.describe.configure({ timeout: 300_000 })
mkdirSync(OUT, { recursive: true })

const axeResults: Record<string, Json[]> = {}
async function axe(page: Page, label: string) {
  if (!AXE || !existsSync(AXE)) return
  await page.addScriptTag({ content: readFileSync(AXE, 'utf8') })
  const res = await page.evaluate(async () => {
    // @ts-expect-error injected
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map((v: Json) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n: Json) => n.target.join(' ')) }))
  })
  axeResults[label] = res
  writeFileSync(`${OUT}axe-${label}.json`, JSON.stringify(res, null, 2))
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: true })

async function guest(browser: Browser, width: number) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  return { ctx, page: await ctx.newPage() }
}

test('wizard steps, desktop and 375px', async ({ page, freshUser }) => {
  void freshUser
  for (const [w, tag] of [[1280, 'desktop'], [375, 'm375']] as const) {
    await page.setViewportSize({ width: w, height: 900 })
    const steps: Array<[string, string]> = [
      ['category', '/invitations/new'],
      ['variant', '/invitations/new?step=variant&category=celebration'],
      ['template', '/invitations/new?step=template&category=celebration&variant=birthday'],
      ['template-incompatible', '/invitations/new?step=template&category=corporate&variant=seminar&template=temuvibe-festive'],
      ['name', '/invitations/new?step=name&category=celebration&variant=birthday&template=temuvibe-festive'],
    ]
    for (const [name, url] of steps) {
      await page.goto(url)
      await expect(page.getByTestId('new-invitation')).toBeVisible()
      await shot(page, `wizard-${name}-${tag}`)
      if (tag === 'desktop') await axe(page, `cms-wizard-${name}`)
    }
  }
})

test('list, editors (birthday, seminar) and responses', async ({ page, freshUser }) => {
  void freshUser
  const b = await publishedInvitation(page, 'birthday', { themeId: 'temuvibe-festive', title: 'Nadia 7th birthday', rsvp: { capacity: 40 } })
  const s = await publishedInvitation(page, 'seminar', { themeId: 'temuvibe-corporate', title: 'Tech Seminar 2027' })
  await createInvitation(page, 'khitanan', { title: 'Khitanan Rizky (draft)' })
  await putSection(page, s.id, 'closing', { message: 'Changed after publish' })
  await postRsvp(s.slug!, { name: 'Andi Wijaya', attendance: 'attending', partySize: 1, email: 'andi@example.com', answers: { company: 'PT Maju' }, message: 'Looking forward' })
  await postRsvp(s.slug!, { name: 'Rina', attendance: 'not_attending', email: 'rina@example.com' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/invitations')
  await expect(page.locator('[data-invitation]')).toHaveCount(3)
  await shot(page, 'list-desktop')
  await axe(page, 'cms-list')
  await page.setViewportSize({ width: 375, height: 812 })
  await shot(page, 'list-m375')
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const [inv, slug, name] of [[b, 'profiles', 'birthday-profiles'], [b, 'milestone', 'birthday-milestone'], [s, 'speakers', 'seminar-speakers'], [s, 'agenda', 'seminar-agenda'], [s, 'rsvp', 'seminar-rsvp-builder'], [s, 'settings', 'seminar-settings']] as const) {
    await page.goto(`/invitations/${inv.id}/edit/${slug}`)
    await expect(page.getByTestId('editor-layout')).toBeVisible()
    await expect(page.getByTestId('save-status').first()).toBeVisible()
    await shot(page, `editor-${name}`)
    await axe(page, `cms-editor-${name}`)
  }
  await page.goto(`/invitations/${s.id}/responses`)
  await expect(page.getByTestId('responses-table')).toBeVisible()
  await shot(page, 'responses-desktop')
  await axe(page, 'cms-responses')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.reload()
  await expect(page.getByTestId('responses-cards')).toBeVisible()
  await shot(page, 'responses-m375')
})

const PUBLIC: Array<[string, string[]]> = [
  ['wedding_reception', ['temuvibe-elegant', 'temuvibe-minimal']],
  ['birthday', ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-festive']],
  ['family_reunion', ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-festive', 'temuvibe-corporate']],
  ['seminar', ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-corporate']],
]
for (const [variant, presets] of PUBLIC) {
  test(`public ${variant} on every compatible temuvibe preset`, async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, variant, { themeId: presets[0], rsvp: { enabled: true } })
    for (const preset of presets) {
      expect((await page.request.patch(`/api/v1/invitations/${pub.id}`, { data: { themeId: preset } })).ok()).toBe(true)
      expect((await page.request.post(`/api/v1/invitations/${pub.id}/publish`)).ok()).toBe(true)
      for (const [w, tag] of [[1280, 'desktop'], [375, 'm375']] as const) {
        const { ctx, page: g } = await guest(browser, w)
        await g.goto(`/i/${pub.slug}?to=Budi%20Santoso`)
        await expect(g.getByTestId('public-invitation').locator('[data-section="closing"]').first()).toBeAttached({ timeout: 20_000 })
        await shot(g, `public-${variant}-${preset}-${tag}`)
        if (tag === 'desktop') await axe(g, `public-${variant}-${preset}`)
        await ctx.close()
      }
    }
  })
}

test('legacy theme RSVP form on black-tie, gilded-vow and afterglow', async ({ page, browser, freshUser }) => {
  void freshUser
  for (const theme of ['black-tie', 'gilded-vow', 'afterglow']) {
    const pub = await publishedInvitation(page, 'wedding_ceremony', { themeId: theme, rsvp: { enabled: true } })
    for (const [w, tag] of [[1280, 'desktop'], [375, 'm375']] as const) {
      const { ctx, page: g } = await guest(browser, w)
      await g.goto(`/i/${pub.slug}`)
      const form = g.getByTestId('rsvp-live')
      await expect(form).toBeVisible({ timeout: 20_000 })
      await form.scrollIntoViewIfNeeded()
      await form.screenshot({ path: `${OUT}legacy-rsvp-${theme}-${tag}.png` })
      if (tag === 'desktop') {
        await shot(g, `legacy-public-${theme}-desktop`)
        await axe(g, `public-legacy-${theme}`)
      }
      await ctx.close()
    }
  }
})

test.afterAll(() => {
  if (Object.keys(axeResults).length) {
    const prev = existsSync(`${OUT}axe-results.json`) ? JSON.parse(readFileSync(`${OUT}axe-results.json`, 'utf8')) : {}
    writeFileSync(`${OUT}axe-results.json`, JSON.stringify({ ...prev, ...axeResults }, null, 2))
  }
})
