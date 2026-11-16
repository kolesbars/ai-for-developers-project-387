import { expect, test, type Page } from '@playwright/test'
import { createMeetingType, uniqueId } from '../support'

const HINT = 'Записаться можно не позже чем за 1 час до начала встречи.'
const HOUR_MS = 60 * 60 * 1000

type Slot = { startAt: string; status: string }

/** Открывает страницу записи и возвращает Слоты из ответа backend (то, что получила страница). */
async function openBookingPage(page: Page, meetingTypeId: string) {
  const slotsResponse = page.waitForResponse((r) =>
    r.url().includes(`/api/meeting-types/${meetingTypeId}/slots`),
  )
  await page.goto(`/book/${meetingTypeId}`)
  const slots: Slot[] = await (await slotsResponse).json()
  return slots.filter((slot) => slot.status === 'available')
}

test('Гость видит подсказку о запасе в 1 час и записывается на первый доступный Слот', async ({
  page,
  request,
}) => {
  const meetingType = await createMeetingType(request, {
    id: uniqueId('e2e-lead'),
    name: `Запас ${Date.now()}`,
    durationMinutes: 30,
  })
  const guestName = `Гость ${Date.now()}`

  await openBookingPage(page, meetingType.id)
  const times = page.getByRole('region', { name: 'Время' })
  await expect(times.getByText(HINT)).toBeVisible()

  // БД общая для параллельных тестов: если первый Слот успели занять (409), страница
  // обновляет расписание — повторяем с новым первым доступным Слотом.
  let label = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const first = times.getByRole('button', { name: /^\d\d:\d\d$/, disabled: false }).first()
    await expect(first).toBeVisible()
    label = await first.innerText()
    await first.click()
    await page.getByRole('button', { name: /^Продолжить · / }).click()

    const form = page.getByRole('form', { name: 'Ваши данные' })
    await form.getByRole('textbox', { name: 'Имя' }).fill(guestName)
    await form.getByRole('textbox', { name: 'Email' }).fill('guest@example.com')
    await form.getByRole('button', { name: 'Записаться' }).click()

    const booked = await page
      .waitForURL(/\/booking\/[0-9a-f-]{36}$/, { timeout: 10_000 })
      .then(() => true, () => false)
    if (booked) break
    if (attempt === 3) throw new Error('не удалось записаться на первый доступный Слот за 3 попытки')
  }

  await expect(page.getByRole('heading', { name: 'Вы записаны' })).toBeVisible()
  await expect(page.getByText(new RegExp(`, ${label}–\\d\\d:\\d\\d$`))).toBeVisible()
  await expect(page.getByText(`${guestName} · guest@example.com`)).toBeVisible()
})

test('На странице нет Слотов, которые начинаются раньше чем через 1 час', async ({
  page,
  request,
}) => {
  const meetingType = await createMeetingType(request, {
    id: uniqueId('e2e-lead-min'),
    name: `Запас-минимум ${Date.now()}`,
    durationMinutes: 30,
  })

  // Backend и тест работают на одних часах, поэтому now(backend) >= before.
  const before = Date.now()
  const available = await openBookingPage(page, meetingType.id)
  expect(available.length).toBeGreaterThan(0)
  for (const slot of available) {
    expect(Date.parse(slot.startAt)).toBeGreaterThanOrEqual(before + HOUR_MS)
  }

  // Все времена на странице — из ответа backend (в часовом поясе браузера), раньше запаса ничего нет.
  const shown = await page.evaluate(
    (starts) =>
      starts.map((iso) =>
        new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      ),
    available.map((slot) => slot.startAt),
  )
  const buttons = page
    .getByRole('region', { name: 'Время' })
    .getByRole('button', { name: /^\d\d:\d\d$/, disabled: false })
  await expect(buttons.first()).toBeVisible()
  for (const label of await buttons.allInnerTexts()) {
    expect(shown).toContain(label)
  }
})
