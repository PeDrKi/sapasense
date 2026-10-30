/** Base URL of the Cloudflare Worker API (places, reviews, sync). Empty = everything stays in the browser. */
export const API_URL: string = ((import.meta.env.VITE_API_URL || import.meta.env.VITE_SYNC_URL || '') as string).replace(/\/$/, '')
