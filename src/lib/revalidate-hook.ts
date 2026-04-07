import { revalidatePath, revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/** Revalidate all customer-facing pages */
function revalidateAll() {
  revalidatePath('/', 'layout')
  revalidatePath('/san-pham', 'page')
  revalidatePath('/tim-kiem', 'page')
  revalidatePath('/danh-muc', 'page')
  revalidatePath('/blog', 'page')
  revalidatePath('/gioi-thieu', 'page')
  revalidateTag('products')
  revalidateTag('categories')
  revalidateTag('blog')
  revalidateTag('site-content')
}

/** afterChange hook for Products collection */
export const revalidateAfterProductChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateAll()
  if (doc?.slug) {
    revalidatePath(`/san-pham/${doc.slug}`, 'page')
  }
  return doc
}

/** afterDelete hook for Products collection */
export const revalidateAfterProductDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateAll()
  return doc
}

/** afterChange hook for Categories collection */
export const revalidateAfterCategoryChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateAll()
  if (doc?.slug) {
    revalidatePath(`/danh-muc/${doc.slug}`, 'page')
  }
  return doc
}

/** afterChange hook for BlogPosts collection */
export const revalidateAfterBlogChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateAll()
  if (doc?.slug) {
    revalidatePath(`/blog/${doc.slug}`, 'page')
  }
  return doc
}

/** afterChange hook for SiteContent global */
export const revalidateAfterSiteContentChange: GlobalAfterChangeHook = ({ doc }) => {
  revalidateAll()
  return doc
}

/** afterChange hook for BankConfig global */
export const revalidateAfterBankConfigChange: GlobalAfterChangeHook = ({ doc }) => {
  revalidatePath('/nap-tien', 'page')
  revalidateTag('site-content')
  return doc
}
