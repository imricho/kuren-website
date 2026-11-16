<script setup lang="ts">
/**
 * Amplop Digital (optional): bank transfer, QRIS and gifts by post, each with
 * its own switch. A method that is off keeps its details (shown disabled, with
 * an explanation). While any method is on, an amber privacy note reminds the
 * couple that everyone with the link can see these details.
 *
 * Bank accounts are an inline repeater (client ids, ≤ 20, reorder, remove with
 * confirmation). Account numbers are strings exactly as typed (leading zeros
 * kept). Fully empty rows are dropped on save; half-filled rows are flagged and
 * hold autosave until fixed.
 */
import { computed, nextTick, ref } from 'vue'

import SwitchField from '@/components/ui/SwitchField.vue'
import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import ImageField from '@/features/cms/components/ImageField.vue'
import ReorderButtons from '@/features/cms/components/ReorderButtons.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import SectionHiddenNote from '@/features/cms/components/SectionHiddenNote.vue'
import SectionToggle from '@/features/cms/components/SectionToggle.vue'
import { useConfirm } from '@/features/cms/composables/useConfirm'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import {
  amplopForm,
  amplopPayload,
  isEmptyBankRow,
  MAX_BANK_ACCOUNTS,
  newRowId,
  type AmplopForm,
  type BankAccountForm,
} from '@/features/cms/universalForms'
import { fieldId, validateAmplop } from '@/features/cms/validation'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const { t } = useAppLocale()
const confirm = useConfirm()
useUnsavedChangesGuard()

/** Server paths count only the rows that were sent (empty rows are dropped): map them back to form rows. */
function mapServerField(field: string, f: AmplopForm): string {
  const bank = field.match(/^bankAccounts\.(\d+)\.(.+)$/)
  if (bank) {
    const sent = f.bankAccounts.map((b, i) => [b, i] as const).filter(([b]) => !isEmptyBankRow(b))
    const formIndex = sent[Number(bank[1])]?.[1]
    return formIndex === undefined ? field : `bankAccounts.${formIndex}.${bank[2]}`
  }
  if (field === 'qrisImage.alt') return 'qrisName'
  const physical = field.match(/^physicalGifts\.(recipient|address|phone|note)$/)
  return physical ? physical[1]! : field
}

let currentForm = (): AmplopForm | null => null
const draft = useSectionDraft({
  key: 'amplopDigital',
  source: () => amplopForm(store.content!.amplopDigital),
  toPayload: amplopPayload,
  validate: validateAmplop,
  save: async (payload) => void (await store.saveSection('amplopDigital', payload)),
  live: (value) => ({ kind: 'section', section: 'amplopDigital', value }),
  mapServerField: (field: string): string => {
    const f = currentForm()
    return f ? mapServerField(field, f) : field
  },
})
const { form, errors } = draft
currentForm = () => form.value

const anyMethodOn = computed(() => form.value.bankAccountsEnabled || form.value.qrisEnabled || form.value.physicalEnabled)
const rowName = (i: number) => t('bankAccountN', { n: i + 1 })

const labels = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {
    title: t('amplopTitle'),
    message: t('amplopMessage'),
    'qrisImage.src': t('qrisImage'),
    qrisName: t('qrisRecipient'),
    recipient: t('giftRecipient'),
    address: t('giftAddress'),
    phone: t('giftPhone'),
    note: t('giftNote'),
  }
  form.value.bankAccounts.forEach((_, i) => {
    out[`bankAccounts.${i}.bankName`] = `${rowName(i)} – ${t('bankName')}`
    out[`bankAccounts.${i}.accountHolder`] = `${rowName(i)} – ${t('accountHolder')}`
    out[`bankAccounts.${i}.accountNumber`] = `${rowName(i)} – ${t('accountNumber')}`
  })
  return out
})

/** Read-only line showing how a row appears on the invitation. */
function guestLine(b: BankAccountForm): string {
  return [b.bankName.trim(), b.accountNumber.trim(), b.accountHolder.trim()].filter(Boolean).join(' · ')
}

// --- Bank account rows ------------------------------------------------------------------
const announcement = ref('')
/** Clear first, so the same text twice in a row is announced again. */
function announce(text: string) {
  announcement.value = ''
  nextTick(() => (announcement.value = text))
}
const atLimit = computed(() => form.value.bankAccounts.length >= MAX_BANK_ACCOUNTS)

function addRow() {
  if (atLimit.value) return
  const row: BankAccountForm = { id: newRowId(), bankName: '', accountHolder: '', accountNumber: '' }
  form.value.bankAccounts = [...form.value.bankAccounts, row]
  const index = form.value.bankAccounts.length - 1
  nextTick(() => document.getElementById(fieldId(`bankAccounts.${index}.bankName`))?.focus())
}

function moveRow(index: number, direction: -1 | 1) {
  const rows = [...form.value.bankAccounts]
  const target = index + direction
  if (target < 0 || target >= rows.length) return
  ;[rows[index], rows[target]] = [rows[target]!, rows[index]!]
  form.value.bankAccounts = rows
  const id = rows[target]!.id
  announce(t('bankAccountMoved', { name: rows[target]!.bankName.trim() || rowName(target), position: target + 1, total: rows.length }))
  nextTick(() => {
    // Focus follows the moved row; at an edge, use the button that is still enabled.
    const preferred = document.querySelector<HTMLButtonElement>(`[data-reorder="${id}-${direction < 0 ? 'up' : 'down'}"]`)
    const other = document.querySelector<HTMLButtonElement>(`[data-reorder="${id}-${direction < 0 ? 'down' : 'up'}"]`)
    ;(preferred && !preferred.disabled ? preferred : other)?.focus()
  })
}

async function removeRow(index: number) {
  const row = form.value.bankAccounts[index]
  if (!row) return
  const name = row.bankName.trim() || rowName(index)
  if (!isEmptyBankRow(row)) {
    const ok = await confirm.ask({
      title: t('removeAccountTitle', { name }),
      message: t('removeAccountBody'),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      tone: 'danger',
    })
    if (!ok) return
  }
  form.value.bankAccounts = form.value.bankAccounts.filter((b) => b.id !== row.id)
  announce(t('bankAccountRemoved', { name }))
  nextTick(() => {
    const next = Math.min(index, form.value.bankAccounts.length - 1)
    const el = next >= 0 ? document.getElementById(fieldId(`bankAccounts.${next}.bankName`)) : document.querySelector<HTMLElement>('[data-action="add-bank-account"]')
    el?.focus()
  })
}

// Dim only the fields of a switched-off method (the explanation stays readable).
const panelClass = 'min-w-0 space-y-4 rounded-lg border border-line p-4 disabled:[&>:not(legend)]:opacity-70'
</script>

<template>
  <form class="space-y-8" novalidate data-testid="amplopDigital-form" @submit.prevent="draft.save()">
    <SectionHeader section="amplopDigital" :description="t('amplopIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="amplopDigital" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>
    <p class="sr-only" aria-live="polite" data-testid="amplop-status">{{ announcement }}</p>

    <div v-show="form.enabled" class="space-y-8" data-testid="section-fields">
      <p
        v-if="anyMethodOn"
        role="note"
        class="rounded-md border border-amber-700/30 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        data-testid="amplop-privacy"
      >
        {{ t('amplopPrivacy') }}
      </p>

      <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionHeading') }}</legend>
        <TextField :id="fieldId('title')" v-model="form.title" :label="t('amplopTitle')" :hint="t('optional')" :error="errors.title" />
        <TextAreaField :id="fieldId('message')" v-model="form.message" :label="t('amplopMessage')" :hint="t('optional')" :rows="3" :error="errors.message" />
      </fieldset>

      <section class="min-w-0 space-y-6 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" aria-labelledby="gift-methods">
        <h2 id="gift-methods" class="font-display text-xl font-semibold">{{ t('giftMethods') }}</h2>

        <!-- Bank transfer -->
        <div class="space-y-3" data-method="bank">
          <SwitchField :id="fieldId('bankAccountsEnabled')" v-model="form.bankAccountsEnabled" :label="t('bankTransfer')" :hint="t('bankTransferHint')" :described-by="!form.bankAccountsEnabled ? `${fieldId('bankAccountsEnabled')}-off` : undefined" />
          <p v-if="!form.bankAccountsEnabled" :id="`${fieldId('bankAccountsEnabled')}-off`" class="text-xs text-ink-700" data-testid="method-off-note">{{ t('methodOffNote') }}</p>
          <fieldset
            :disabled="!form.bankAccountsEnabled"
            :aria-labelledby="`${fieldId('bankAccountsEnabled')}-legend`"
            :class="panelClass"
            data-testid="bank-panel"
          >
            <legend :id="`${fieldId('bankAccountsEnabled')}-legend`" class="px-1 text-sm font-medium text-ink-700">{{ t('bankAccounts') }}</legend>
            <p v-if="form.bankAccounts.length === 0" class="text-sm text-ink-500">{{ t('noBankAccounts') }}</p>
            <ol class="space-y-4" data-testid="bank-rows">
              <li
                v-for="(row, i) in form.bankAccounts"
                :key="row.id"
                class="min-w-0 space-y-3 rounded-md bg-canvas p-3 ring-1 ring-line"
                :data-row="row.id"
                data-testid="bank-row"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h3 :id="`${row.id}-h`" class="text-sm font-semibold">{{ rowName(i) }}</h3>
                  <div class="flex items-center gap-2">
                    <ReorderButtons :index="i" :count="form.bankAccounts.length" :item-name="rowName(i)" :item-id="row.id" @move="(d) => moveRow(i, d)" />
                    <button
                      type="button"
                      :class="['min-h-11 rounded-md px-3 text-sm font-medium text-danger-600 hover:bg-danger-50 sm:min-h-9', FOCUS_RING]"
                      :aria-label="t('removeBankAccount', { name: rowName(i) })"
                      data-action="remove-bank-account"
                      @click="removeRow(i)"
                    >
                      {{ t('remove') }}
                    </button>
                  </div>
                </div>
                <fieldset class="min-w-0 space-y-3" :aria-labelledby="`${row.id}-h`">
                <div class="grid min-w-0 gap-3 sm:grid-cols-2">
                  <TextField
                    :id="fieldId(`bankAccounts.${i}.bankName`)"
                    v-model="row.bankName"
                    :label="t('bankName')"
                    autocomplete="off"
                    :error="errors[`bankAccounts.${i}.bankName`]"
                  />
                  <TextField
                    :id="fieldId(`bankAccounts.${i}.accountHolder`)"
                    v-model="row.accountHolder"
                    :label="t('accountHolder')"
                    autocomplete="off"
                    :error="errors[`bankAccounts.${i}.accountHolder`]"
                  />
                </div>
                <TextField
                  :id="fieldId(`bankAccounts.${i}.accountNumber`)"
                  v-model="row.accountNumber"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  :label="t('accountNumber')"
                  :hint="t('accountNumberHint')"
                  :extra-hint="guestLine(row) ? t('guestsWillSee', { value: guestLine(row) }) : undefined"
                  :error="errors[`bankAccounts.${i}.accountNumber`]"
                />
                </fieldset>
              </li>
            </ol>
            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                :class="[
                  'min-h-11 rounded-md border border-ink-500/85 bg-surface px-4 text-sm font-medium text-ink-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9',
                  FOCUS_RING,
                ]"
                :disabled="atLimit"
                data-action="add-bank-account"
                @click="addRow"
              >
                {{ t('addBankAccount') }}
              </button>
              <p v-if="atLimit" class="text-xs text-ink-500" data-testid="bank-limit">{{ t('bankLimitReached', { max: MAX_BANK_ACCOUNTS }) }}</p>
            </div>
          </fieldset>
        </div>

        <!-- QRIS -->
        <div class="space-y-3" data-method="qris">
          <SwitchField :id="fieldId('qrisEnabled')" v-model="form.qrisEnabled" :label="t('qris')" :hint="t('qrisHint')" :described-by="!form.qrisEnabled ? `${fieldId('qrisEnabled')}-off` : undefined" />
          <p v-if="!form.qrisEnabled" :id="`${fieldId('qrisEnabled')}-off`" class="text-xs text-ink-700" data-testid="method-off-note">{{ t('methodOffNote') }}</p>
          <fieldset
            :disabled="!form.qrisEnabled"
            :aria-labelledby="`${fieldId('qrisEnabled')}-legend`"
            :class="panelClass"
            data-testid="qris-panel"
          >
            <legend :id="`${fieldId('qrisEnabled')}-legend`" class="px-1 text-sm font-medium text-ink-700">{{ t('qris') }}</legend>
            <TextField :id="fieldId('qrisName')" v-model="form.qrisName" :label="t('qrisRecipient')" autocomplete="off" :error="errors.qrisName" />
            <ImageField
              v-model="form.qrisImage"
              path="qrisImage"
              :label="t('qrisImage')"
              :hint="t('qrisImageHint')"
              :errors="errors"
              upload="qris"
              :focal="false"
              :samples="false"
              :alt-field="false"
              fit="contain"
            />
          </fieldset>
        </div>

        <!-- Gifts by post -->
        <div class="space-y-3" data-method="physical">
          <SwitchField :id="fieldId('physicalEnabled')" v-model="form.physicalEnabled" :label="t('physicalGifts')" :hint="t('physicalGiftsHint')" :described-by="!form.physicalEnabled ? `${fieldId('physicalEnabled')}-off` : undefined" />
          <p v-if="!form.physicalEnabled" :id="`${fieldId('physicalEnabled')}-off`" class="text-xs text-ink-700" data-testid="method-off-note">{{ t('methodOffNote') }}</p>
          <fieldset
            :disabled="!form.physicalEnabled"
            :aria-labelledby="`${fieldId('physicalEnabled')}-legend`"
            :class="panelClass"
            data-testid="physical-panel"
          >
            <legend :id="`${fieldId('physicalEnabled')}-legend`" class="px-1 text-sm font-medium text-ink-700">{{ t('physicalGifts') }}</legend>
            <TextField :id="fieldId('recipient')" v-model="form.recipient" :label="t('giftRecipient')" autocomplete="off" :error="errors.recipient" />
            <TextAreaField :id="fieldId('address')" v-model="form.address" :label="t('giftAddress')" :rows="3" :error="errors.address" />
            <TextField
              :id="fieldId('phone')"
              v-model="form.phone"
              type="tel"
              inputmode="tel"
              autocomplete="off"
              :label="t('giftPhone')"
              :hint="t('optional')"
              :error="errors.phone"
            />
            <TextAreaField :id="fieldId('note')" v-model="form.note" :label="t('giftNote')" :hint="t('optional')" :rows="2" :error="errors.note" />
          </fieldset>
        </div>
      </section>
    </div>
  </form>
</template>
