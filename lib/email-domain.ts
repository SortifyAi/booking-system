import * as dns from 'node:dns/promises'

export type EmailDomainStatus = 'valid' | 'invalid' | 'temporary_failure'

export interface DnsResolver {
  resolveMx(hostname: string): Promise<Array<{ exchange: string; priority: number }>>
  resolve4(hostname: string): Promise<string[]>
  resolve6(hostname: string): Promise<string[]>
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : ''
}

const ABSENT_DNS_CODES = new Set(['ENODATA', 'ENOTFOUND', 'ENONAME'])

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('DNS timeout'), { code: 'ETIMEOUT' }))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function validateEmailDomain(
  email: string,
  options: { resolver?: DnsResolver; timeoutMs?: number } = {}
): Promise<{ status: EmailDomainStatus; domain: string }> {
  const normalized = normalizeEmail(email)
  const at = normalized.lastIndexOf('@')
  const domain = at > 0 ? normalized.slice(at + 1) : ''

  if (!domain || domain.includes('@')) {
    return { status: 'invalid', domain }
  }

  const resolver = options.resolver ?? dns
  const timeoutMs = options.timeoutMs ?? 2500

  try {
    const records = await withTimeout(resolver.resolveMx(domain), timeoutMs)
    const mailExchangers = records.filter((record) => record.exchange && record.exchange !== '.')
    if (mailExchangers.length > 0) return { status: 'valid', domain }
    if (records.length > 0) return { status: 'invalid', domain }
  } catch (error) {
    const code = errorCode(error)
    if (!ABSENT_DNS_CODES.has(code)) {
      return { status: 'temporary_failure', domain }
    }
    if (code === 'ENOTFOUND' || code === 'ENONAME') {
      return { status: 'invalid', domain }
    }
  }

  const fallbackResults = await Promise.allSettled([
    withTimeout(resolver.resolve4(domain), timeoutMs),
    withTimeout(resolver.resolve6(domain), timeoutMs),
  ])

  if (
    fallbackResults.some(
      (result) => result.status === 'fulfilled' && result.value.length > 0
    )
  ) {
    return { status: 'valid', domain }
  }

  const failureCodes = fallbackResults
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => errorCode(result.reason))

  return {
    status: failureCodes.every((code) => ABSENT_DNS_CODES.has(code))
      ? 'invalid'
      : 'temporary_failure',
    domain,
  }
}
