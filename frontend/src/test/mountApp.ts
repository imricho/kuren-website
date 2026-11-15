/**
 * Mount the CMS pages inside a real (memory-history) router + Pinia, like the app.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import ToastRegion from '@/components/ui/ToastRegion.vue'
import ConfirmHost from '@/features/cms/components/ConfirmHost.vue'
import ClosingPage from '@/pages/wedding/ClosingPage.vue'
import CouplePage from '@/pages/wedding/CouplePage.vue'
import EventsPage from '@/pages/wedding/EventsPage.vue'
import GalleryPage from '@/pages/wedding/GalleryPage.vue'
import OpeningPage from '@/pages/wedding/OpeningPage.vue'
import RsvpPage from '@/pages/wedding/RsvpPage.vue'
import StoryPage from '@/pages/wedding/StoryPage.vue'
import WeddingEditorLayout from '@/pages/wedding/WeddingEditorLayout.vue'
import WeddingPreviewPage from '@/pages/wedding/WeddingPreviewPage.vue'

const Stub = (name: string) => defineComponent({ name, render: () => h('div', { 'data-stub': name }) })

export function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'dashboard', component: Stub('dashboard') },
      { path: '/themes', name: 'themes', component: Stub('themes') },
      {
        path: '/wedding',
        name: 'wedding',
        component: WeddingEditorLayout,
        children: [
          { path: 'opening', name: 'wedding-opening', component: OpeningPage },
          { path: 'couple', name: 'wedding-couple', component: CouplePage },
          { path: 'story', name: 'wedding-story', component: StoryPage },
          { path: 'events', name: 'wedding-events', component: EventsPage },
          { path: 'gallery', name: 'wedding-gallery', component: GalleryPage },
          { path: 'rsvp', name: 'wedding-rsvp', component: RsvpPage },
          { path: 'closing', name: 'wedding-closing', component: ClosingPage },
        ],
      },
      { path: '/wedding/preview', name: 'wedding-preview', component: WeddingPreviewPage },
    ],
  })
}

export async function mountApp(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()
  const Root = defineComponent({ render: () => [h(RouterView), h(ToastRegion), h(ConfirmHost)] })
  const wrapper = mount(Root, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router, pinia }
}
