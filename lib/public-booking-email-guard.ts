import { normalizeEmail, validateEmailDomain } from './email-domain.ts'
import { publicBookingEmailError } from './customer-email.ts'

type DomainResult = Awaited<ReturnType<typeof validateEmailDomain>>

type GuardDependencies = {
  validateDomain: (email: string) => Promise<DomainResult>
  hasActiveBlock: (organizationId: string, normalizedEmail: string) => Promise<boolean>
  logError?: (message: string, error: unknown) => void
}

async function defaultHasActiveBlock(
  organizationId: string,
  normalizedEmail: string
): Promise<boolean> {
  const { createServiceClient } = await import('./supabase/server.ts')
  const service = createServiceClient()
  const { data, error } = await service
    .from('customer_email_blocks')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('normalized_email', normalizedEmail)
    .is('unblocked_at', null)
    .limit(1)

  if (error) throw error
  return Boolean(data?.length)
}

const defaultDependencies: GuardDependencies = {
  validateDomain: (email) => validateEmailDomain(email),
  hasActiveBlock: defaultHasActiveBlock,
  logError: (message, error) => console.error(message, error),
}

export async function guardPublicBookingEmail(
  input: {
    email: string
    organizationId: string
    locationPhone?: string | null
  },
  dependencies: GuardDependencies = defaultDependencies
) {
  const normalizedEmail = normalizeEmail(input.email)
  let domain: DomainResult
  try {
    domain = await dependencies.validateDomain(normalizedEmail)
  } catch (error) {
    dependencies.logError?.('Customer email domain lookup failed:', error)
    return {
      ok: false as const,
      status: 503,
      body: publicBookingEmailError('contact', input.locationPhone),
    }
  }

  if (domain.status === 'invalid') {
    return {
      ok: false as const,
      status: 400,
      body: publicBookingEmailError('invalid'),
    }
  }

  if (domain.status === 'temporary_failure') {
    return {
      ok: false as const,
      status: 503,
      body: publicBookingEmailError('contact', input.locationPhone),
    }
  }

  try {
    const isBlocked = await dependencies.hasActiveBlock(
      input.organizationId,
      normalizedEmail
    )
    if (isBlocked) {
      return {
        ok: false as const,
        status: 503,
        body: publicBookingEmailError('contact', input.locationPhone),
      }
    }
  } catch (error) {
    dependencies.logError?.('Customer email block lookup failed:', error)
    return {
      ok: false as const,
      status: 503,
      body: publicBookingEmailError('contact', input.locationPhone),
    }
  }

  return { ok: true as const, normalizedEmail }
}
