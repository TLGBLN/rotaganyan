import AnalysisImporter from "@/components/admin/AnalysisImporter";

export default function ImportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">Analiz İmport</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          JSON formatındaki analiz verilerini yapıştır — sistem Hippodrome → RaceDay → Race →
          Runner → Prediction → Result zincirini otomatik oluşturur.
        </p>
      </div>
      <AnalysisImporter />
    </div>
  );
}
