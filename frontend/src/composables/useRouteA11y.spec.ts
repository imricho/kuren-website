import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { useAppLocale } from './useAppLocale'
import { focusMainHeading, useRouteA11y } from './useRouteA11y'

enableAutoUnmount(afterEach)

const page = (title: string) => defineComponent({ render: () => h('div', [h('a', { href: '#', id: `link-${title}` }, 'x'), h('h1', title)]) })

async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'dashboard', component: page('Dash'), meta: { titleKey: 'dashboard' } },
      { path: '/account', name: 'account', component: page('Acct'), meta: { titleKey: 'account' } },
      { path: '/plain', component: page('Plain') },
    ],
  })
  await router.push('/dashboard')
  await router.isReady()
  const Root = defineComponent({
    setup() {
      useRouteA11y()
      return () => h('main', [h(RouterView)])
    },
  })
  const wrapper = mount(Root, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms))

describe('useRouteA11y', () => {
  afterEach(() => useAppLocale().setLocale('en'))

  it('sets a localized "<Page> · Kuren" title and follows the UI language', async () => {
    const { router } = await setup()
    expect(document.title).toBe('Dashboard · Kuren')
    useAppLocale().setLocale('id')
    await flushPromises()
    expect(document.title).toBe('Dasbor · Kuren')
    await router.push('/plain')
    await flushPromises()
    expect(document.title).toBe('Kuren · Situs pernikahan')
  })

  it('does not move focus on first load, but focuses the new h1 after navigating', async () => {
    const { router } = await setup()
    await tick()
    expect(document.activeElement).toBe(document.body)
    await router.push('/account')
    await flushPromises()
    await tick()
    expect(document.activeElement?.textContent).toBe('Acct')
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1')
  })

  it('leaves focus alone if the user moved it meanwhile', async () => {
    document.body.innerHTML = '<main><button id="b">b</button></main>'
    const pending = focusMainHeading(3, 5)
    ;(document.getElementById('b') as HTMLButtonElement).focus()
    expect(await pending).toBeNull()
    expect(document.activeElement?.id).toBe('b')
    document.body.innerHTML = ''
  })
})
