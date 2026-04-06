import * as repo from './template.repository'

export type Template = repo.Template

function normalize(value: string | null | undefined): string {
  return value?.trim() || ''
}

export function buildTemplatePayload(values: Partial<Template>) {
  const name = normalize(values.name)
  const openingHook = normalize(values.opening_hook)

  if (!name) throw new Error('Template name is required')
  if (!openingHook) throw new Error('Opening hook is required')

  return {
    name,
    description: normalize(values.description),
    subject_line: normalize(values.subject_line),
    opening_hook: openingHook,
    why_choose_us: normalize(values.why_choose_us),
    urgency_notice: normalize(values.urgency_notice),
    closing_cta: normalize(values.closing_cta),
    is_built_in: false,
  }
}

export async function fetchCustomTemplates() {
  return repo.getCustomTemplates()
}

export async function createTemplate(values: Partial<Template>) {
  return repo.createTemplate(buildTemplatePayload(values))
}

export async function updateTemplate(id: number, values: Partial<Template>) {
  return repo.updateTemplate(id, {
    ...buildTemplatePayload(values),
    updated_at: new Date().toISOString(),
  } as Partial<Template> & { updated_at: string })
}

export async function removeTemplate(id: number) {
  return repo.deleteTemplate(id)
}
