/**
 * Mount the CMS pages inside a real (memory-history) router + Pinia, like the app.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { invitationRoutes } from '@/router/invitationRoutes'

import ToastRegion from '@/components/ui/ToastRegion.vue'
import ConfirmHost from '@/features/cms/components/ConfirmHost.vue'
import ClosingPage from '@/pages/wedding/ClosingPage.vue'
import CouplePage from '@/pages/wedding/CouplePage.vue'
import EventsPage from '@/pages/wedding/EventsPage.vue'
import GalleryPage from '@/pages/wedding/GalleryPage.vue'
import AmplopDigitalPage from '@/pages/wedding/AmplopDigitalPage.vue'
import GreetingPage from '@/pages/wedding/GreetingPage.vue'
import HolyRecitePage from '@/pages/wedding/HolyRecitePage.vue'
import WeddingDatePage from '@/pages/wedding/WeddingDatePage.vue'
import WishesPage from '@/pages/wedding/WishesPage.vue'
import OpeningPage from '@/pages/wedding/OpeningPage.vue'
import PublishPage from '@/pages/wedding/PublishPage.vue'
import PublicInvitationPage from '@/pages/PublicInvitationPage.vue'
import InvitationsPage from '@/pages/invitation/InvitationsPage.vue'
import AgendaPage from '@/pages/invitation/AgendaPage.vue'
import MilestonePage from '@/pages/invitation/MilestonePage.vue'
import NewInvitationPage from '@/pages/invitation/NewInvitationPage.vue'
import OrganizationPage from '@/pages/invitation/OrganizationPage.vue'
import ProfilesPage from '@/pages/invitation/ProfilesPage.vue'
import ResponsesPage from '@/pages/invitation/ResponsesPage.vue'
import SettingsPage from '@/pages/invitation/SettingsPage.vue'
import SpeakersPage from '@/pages/invitation/SpeakersPage.vue'
import RsvpPage from '@/pages/wedding/RsvpPage.vue'
import StoryPage from '@/pages/wedding/StoryPage.vue'
import WeddingEditorLayout from '@/pages/wedding/WeddingEditorLayout.vue'
import WeddingPreviewPage from '@/pages/wedding/WeddingPreviewPage.vue'

const Stub = (name: string) => defineComponent({ name, render: () => h('div', { 'data-stub': name }) })
/** Stands in for AppLayout: just renders the child route. */
const Shell = defineComponent({ name: 'TestShell', render: () => h(RouterView) })

/** Same route names/paths/meta as src/router/index.ts (both built by router/invitationRoutes). */
export function createTestRouter() {
  const invitation = invitationRoutes({
    list: InvitationsPage,
    create: NewInvitationPage,
    responses: ResponsesPage,
    editorLayout: WeddingEditorLayout,
    preview: WeddingPreviewPage,
    pages: {
      opening: OpeningPage,
      couple: CouplePage,
      story: StoryPage,
      events: EventsPage,
      gallery: GalleryPage,
      rsvp: RsvpPage,
      closing: ClosingPage,
      holyRecite: HolyRecitePage,
      greeting: GreetingPage,
      date: WeddingDatePage,
      wishes: WishesPage,
      gifts: AmplopDigitalPage,
      publish: PublishPage,
      settings: SettingsPage,
      profiles: ProfilesPage,
      milestone: MilestonePage,
      organization: OrganizationPage,
      agenda: AgendaPage,
      speakers: SpeakersPage,
    },
  })
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'dashboard', redirect: { name: 'invitations' } },
      { path: '/themes', name: 'themes', component: Stub('themes') },
      { path: '/', component: Shell, children: invitation.inLayout },
      ...invitation.standalone,
      { path: '/i/:slug', name: 'public-invitation', component: PublicInvitationPage, props: true, meta: { publicPage: true } },
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
