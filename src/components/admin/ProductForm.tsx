"use client";

import { useForm } from "react-hook-form";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertProduct } from "@/server/actions/product.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload } from "lucide-react";

// ArticleForm.tsx'teki slugify ile AYNI desen (Türkçe karakter transliterasyonu).
function slugify(input: string): string {
  const trMap: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
  return input
    .split("")
    .map((ch) => trMap[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type FormData = {
  name: string;
  slug: string;
  description: string;
  price: string;
  image: string;
  category: string;
  stock: string;
};

type Props = {
  productId?: string;
  defaultValues?: Partial<FormData>;
};

export default function ProductForm({ productId, defaultValues }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [slugAutoSync, setSlugAutoSync] = useState(!defaultValues?.slug);

  const { register, handleSubmit, setValue, watch } = useForm<FormData>({
    defaultValues: {
      name: defaultValues?.name ?? "",
      slug: defaultValues?.slug ?? "",
      description: defaultValues?.description ?? "",
      price: defaultValues?.price ?? "",
      image: defaultValues?.image ?? "",
      category: defaultValues?.category ?? "",
      stock: defaultValues?.stock ?? "0",
    },
  });

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    register("name").onChange(e);
    if (slugAutoSync) setValue("slug", slugify(e.target.value));
  }
  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugAutoSync(false);
    register("slug").onChange(e);
  }

  async function onImageFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-product-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Yükleme başarısız");
      setValue("image", data.url);
      toast.success("Görsel yüklendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görsel yüklenemedi");
    } finally {
      setUploadingImage(false);
    }
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const cleanSlug = slugify(data.slug) || slugify(data.name) || `urun-${Date.now()}`;
      const result = await upsertProduct(productId ?? null, {
        name: data.name,
        slug: cleanSlug,
        description: data.description || undefined,
        price: parseFloat(data.price.replace(",", ".")) || 0,
        image: data.image || undefined,
        category: data.category || undefined,
        stock: parseInt(data.stock, 10) || 0,
      });
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Ürün kaydedildi");
      if (!productId && result?.id) {
        router.push(`/admin/urunler/${result.id}`);
      } else {
        router.push("/admin/urunler");
      }
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-5">
      <div className="space-y-1.5">
        <Label>Ürün Adı</Label>
        <Input {...register("name")} onChange={handleNameChange} placeholder="Rotaganyan Şapka" required />
      </div>

      <div className="space-y-1.5">
        <Label>Slug (URL)</Label>
        <Input {...register("slug")} onChange={handleSlugChange} placeholder="rotaganyan-sapka" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Fiyat (TL)</Label>
          <Input {...register("price")} type="text" inputMode="decimal" placeholder="149,90" required />
        </div>
        <div className="space-y-1.5">
          <Label>Stok</Label>
          <Input {...register("stock")} type="number" min={0} placeholder="0" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Kategori</Label>
        <Input {...register("category")} placeholder="Şapka / Anahtarlık / Tişört…" />
      </div>

      <div className="space-y-1.5">
        <Label>Açıklama</Label>
        <Textarea {...register("description")} rows={4} placeholder="Ürün açıklaması…" />
      </div>

      <div className="space-y-1.5">
        <Label>Görsel</Label>
        <div className="flex items-center gap-2">
          <Input type="url" placeholder="https://… (veya bilgisayardan yükle)" {...register("image")} />
          <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageFileSelected} />
          <Button type="button" variant="outline" size="icon" disabled={uploadingImage} onClick={() => imageFileInputRef.current?.click()}>
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
        </div>
        {watch("image") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={watch("image")} alt="" className="mt-2 h-28 rounded-md border object-cover" />
        )}
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
      </Button>
    </form>
  );
}
