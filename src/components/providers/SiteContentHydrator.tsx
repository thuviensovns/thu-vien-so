/**
 * Server component that injects site content from DB into localStorage
 * via an inline script. Runs BEFORE React hydration, preventing the
 * flash of default content → DB content.
 */
export function SiteContentHydrator({
  settings,
  categoryDescriptions,
}: {
  settings: Record<string, unknown> | null
  categoryDescriptions: Record<string, string> | null
}) {
  if (!settings && !categoryDescriptions) return null

  // Build a minimal script that sets localStorage only if DB has data
  const script = `(function(){try{${
    settings
      ? `localStorage.setItem('admin_site_settings',${JSON.stringify(JSON.stringify(settings))});`
      : ''
  }${
    categoryDescriptions
      ? `localStorage.setItem('admin_category_descriptions',${JSON.stringify(JSON.stringify(categoryDescriptions))});`
      : ''
  }}catch(e){}})();`

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  )
}
