export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Force Asia/Ho_Chi_Minh timezone so every viewer (including admins browsing
 * from other countries) sees the same Vietnam-local time for messages/orders.
 * Without explicit timeZone, toLocaleString falls back to the browser's tz.
 */
const VN_TZ = 'Asia/Ho_Chi_Minh'

export function formatVNDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VN_TZ,
  }).format(new Date(date))
}

export function formatVNTime(date: string | Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VN_TZ,
  }).format(new Date(date))
}

/**
 * Relative "X phút trước" — server and client both see UTC ISO timestamps,
 * diff works regardless of tz. Callers should combine with a ticking hook
 * (useTick) so the display stays current between re-fetches.
 */
export function timeAgoVN(dateStr: string | Date): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return 'Vừa xong'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} giờ trước`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} ngày trước`
  return formatVNDateTime(dateStr)
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
