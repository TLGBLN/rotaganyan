import ArticleForm from "@/components/admin/ArticleForm";
import { X_CONFIGURED } from "@/lib/x";

export default function YeniMakalePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Yeni Makale</h1>
      <ArticleForm xConnected={X_CONFIGURED} />
    </div>
  );
}
