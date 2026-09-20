import { notFound } from "next/navigation";
import { getAdminProductById } from "@/server/services/product.service";
import ProductForm from "@/components/admin/ProductForm";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditUrunPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getAdminProductById(id);
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold">Ürün Düzenle</h1>
        <Badge variant={product.active ? "default" : "secondary"}>
          {product.active ? "Vitrinde" : "Taslak"}
        </Badge>
      </div>
      <ProductForm
        productId={product.id}
        defaultValues={{
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          price: String(product.price),
          image: product.image ?? "",
          category: product.category ?? "",
          stock: String(product.stock),
        }}
      />
    </div>
  );
}
