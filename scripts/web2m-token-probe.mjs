/**
 * Probe Web2M with both tokens + URL pattern variations to find the working combo.
 */
const account = '20919821'
const password = 'Anhdungpro1@'
const tokens = [
  'D8AEF60B-1238-BDDD-1B3E-B3EE675CF796',
  '0F64A05A-3D8A-1470-8159-15925F79FA3C',
]

const urlPatterns = [
  // ACB variants
  (p, a, t) => `https://api.web2m.com/historyapiacb/${encodeURIComponent(p)}/${a}/${t}`,
  (p, a, t) => `https://api.web2m.com/historyapiacbv3/${encodeURIComponent(p)}/${a}/${t}`,
  (p, a, t) => `https://api.web2m.com/historyapiacbv2/${encodeURIComponent(p)}/${a}/${t}`,
  (p, a, t) => `https://api.web2m.com/historyapiacbv1/${encodeURIComponent(p)}/${a}/${t}`,
  (p, a, t) => `https://api.web2m.com/historyapi/acb/${encodeURIComponent(p)}/${a}/${t}`,
  // Order variant: account before password (some docs show this)
  (p, a, t) => `https://api.web2m.com/historyapiacb/${a}/${encodeURIComponent(p)}/${t}`,
  // Raw password without URL-encoding (@ → @)
  (p, a, t) => `https://api.web2m.com/historyapiacb/${p}/${a}/${t}`,
]

const labels = [
  'historyapiacb (current default)',
  'historyapiacbv3',
  'historyapiacbv2',
  'historyapiacbv1',
  'historyapi/acb',
  'historyapiacb (account first)',
  'historyapiacb (unencoded password)',
]

for (const [ti, token] of tokens.entries()) {
  console.log(`\n======== TOKEN ${ti + 1}: ${token} ========`)
  for (const [i, build] of urlPatterns.entries()) {
    const url = build(password, account, token)
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      const text = await res.text()
      const preview = text.slice(0, 140).replace(/\n/g, ' ')
      console.log(`  [${labels[i]}] HTTP ${res.status}: ${preview}`)
    } catch (e) {
      console.log(`  [${labels[i]}] fetch err: ${e.message}`)
    }
  }
}
