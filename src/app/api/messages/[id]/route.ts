import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Verify admin role — returns payload instance + user, or error response */
async function requireAdmin(req: NextRequest) {
  const payload = await getPayloadForApi()
  let isAdmin = false
  try {
    const { user } = await payload.auth({ headers: req.headers })
    isAdmin = user?.role === 'admin'
  } catch { /* auth failed */ }

  if (!isAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { payload }
}

// GET single message (admin only)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req)
    if ('error' in auth) return auth.error

    const { id } = await params
    const message = await auth.payload.findByID({
      collection: 'contact-messages',
      id,
      overrideAccess: true,
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error('Get message error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH update message status/note (admin only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req)
    if ('error' in auth) return auth.error

    const { id } = await params

    let body: { status?: string; adminNote?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const updateData: Record<string, string> = {}
    const validStatuses = ['new', 'processing', 'replied', 'closed']
    if (body.status && validStatuses.includes(body.status)) updateData.status = body.status
    if (body.adminNote !== undefined) updateData.adminNote = body.adminNote

    const updated = await auth.payload.update({
      collection: 'contact-messages',
      id,
      data: updateData,
      overrideAccess: true,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update message error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE message (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req)
    if ('error' in auth) return auth.error

    const { id } = await params
    await auth.payload.delete({
      collection: 'contact-messages',
      id,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete message error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
