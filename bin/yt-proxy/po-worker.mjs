// Isolated PO token generator. jsdom leaks memory, so we run it in a child
// process and throw the whole process away after one generation.
import { generate } from 'youtube-po-token-generator'

const timeout = setTimeout(() => {
  console.error(JSON.stringify({ error: 'timeout' }))
  process.exit(2)
}, 15_000)

try {
  const { poToken, visitorData } = await generate()
  process.stdout.write(JSON.stringify({ poToken, visitorData }))
  clearTimeout(timeout)
  process.exit(0)
} catch (e) {
  console.error(JSON.stringify({ error: String(e?.message || e) }))
  process.exit(1)
}
