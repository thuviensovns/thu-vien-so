'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Package, Trash2, Pencil, Eye, Star, RotateCcw,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatVND, formatDate } from '@/lib/format'
import { typeLabels } from '@/lib/config'
import type { DemoProduct } from '@/lib/demo-data'
import type { AdminProduct } from '@/lib/admin-helpers'

export type AnyProduct = (DemoProduct & { isCustom?: false; isDeleted?: boolean; isDb?: boolean }) | AdminProduct

interface ProductTableProps {
  products: AnyProduct[]
  demoOverrides: Record<string, Partial<AdminProduct>>
  onEdit: (product: AnyProduct) => void
  onDelete: (product: AnyProduct) => void
  onRestore: (id: string) => void
  onRestoreOriginal: (id: string) => void
}

export default function ProductTable({
  products, demoOverrides, onEdit, onDelete, onRestore, onRestoreOriginal,
}: ProductTableProps) {
  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Sản phẩm</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Danh mục</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Giá</th>
              <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Cập nhật</th>
              <th className="text-center p-3 font-medium text-muted-foreground w-36">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Không tìm thấy sản phẩm</p>
                </td>
              </tr>
            ) : (
              products.map((product, i) => {
                const isCustom = 'isCustom' in product && product.isCustom === true
                const isDeleted = 'isDeleted' in product && product.isDeleted
                const hasOverride = !isCustom && demoOverrides[product.id]
                return (
                  <tr
                    key={product.id}
                    className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                      isDeleted ? 'opacity-40 bg-destructive/5' : i % 2 === 0 ? '' : 'bg-muted/10'
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                          <Image
                            src={product.thumbnail?.url || '/images/placeholder.jpg'}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                            unoptimized={product.thumbnail?.url?.startsWith('data:')}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`font-medium truncate ${isDeleted ? 'line-through' : ''}`}>{product.name}</p>
                            {isCustom && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1 py-0 shrink-0">
                                Tùy chỉnh
                              </Badge>
                            )}
                            {hasOverride && (
                              <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px] px-1 py-0 shrink-0">
                                Đã sửa
                              </Badge>
                            )}
                            {isDeleted && (
                              <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1 py-0 shrink-0">
                                Đã xóa
                              </Badge>
                            )}
                            {product.featured && !isDeleted && (
                              <Star className="h-3 w-3 text-warning fill-warning shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            {typeLabels[product.type] || product.type}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[product.type] || product.type}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {product.pricing.price === 0 ? (
                        <Badge className="bg-success/10 text-success border-success/20 text-xs">
                          Miễn phí
                        </Badge>
                      ) : (
                        <div>
                          <span className="font-bold text-primary whitespace-nowrap">
                            {formatVND(product.pricing.price)}
                          </span>
                          {product.pricing.originalPrice && product.pricing.originalPrice > product.pricing.price && (
                            <span className="text-[10px] text-muted-foreground line-through ml-1">
                              {formatVND(product.pricing.originalPrice)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(product.updatedAt)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {isDeleted ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-success hover:text-success"
                            onClick={() => onRestore(product.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Khôi phục
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                              <Link href={`/san-pham/${product.slug}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary"
                              onClick={() => onEdit(product)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {hasOverride && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-warning hover:text-warning"
                                onClick={() => onRestoreOriginal(product.id)}
                                title="Khôi phục bản gốc"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => onDelete(product)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
