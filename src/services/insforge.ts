import { createClient } from '@insforge/sdk'

const baseUrl = import.meta.env.VITE_INSFORGE_BASE_URL || 'https://k3km7cgm.us-west.insforge.app'
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || ''

if (!anonKey) {
  console.warn('VITE_INSFORGE_ANON_KEY is not set. Please set it in your .env file.')
}

export const insforge = createClient({
  baseUrl,
  anonKey,
})
