import type { PaymentRequired, PaymentRequirements } from '@t402/core/types'

export type { PaymentRequired, PaymentRequirements }

export interface ContentItem {
  id: string
  title: string
  preview: string
  price: string
  network: string
}

export interface PremiumContent {
  id: string
  title: string
  body: string
  author: string
}

export type PaymentStatus = 'idle' | 'loading' | 'paying' | 'success' | 'error'
