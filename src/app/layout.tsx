// Root layout — required by Next.js App Router when using route groups.
// Each route group ((frontend), (payload)) provides its own <html>/<body>.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
