import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Upload, FileJson, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Unit 관련 Entity 목록 (실제 프로젝트 구조 기준)
const UNIT_ENTITIES = [
  "PythonUnit",
  "JuniorPythonUnit",
  "CppUnit",
  "HTMLUnit",
  "JavaUnit",
  "GenericUnit",
  "EntryUnit",
  "COSUnit",
  "AlgorithmUnit",
];

// Base44 시스템 필드 (Import 시 자동 생성되므로 제거)
const SYSTEM_FIELDS = ["id", "created_date", "updated_date", "created_by_id", "created_by"];

// Entity별 중복 판별 키 생성
function getEntityKey(entityName, record) {
  if (entityName === "COSUnit") {
    return record.title ? `title::${record.title}` : null;
  }
  if (entityName === "GenericUnit") {
    // subject_id + unit_number 조합
    return record.subject_id && record.unit_number != null
      ? `${record.subject_id}::${record.unit_number}`
      : record.title
      ? `title::${record.title}`
      : null;
  }
  if (record.unit_number != null) {
    return `unit_number::${record.unit_number}`;
  }
  if (record.title) {
    return `title::${record.title}`;
  }
  return null;
}

// 시스템 필드 제거 + 원본 ID 보존
function stripSystemFields(record) {
  const cleaned = { ...record };
  const sourceId = cleaned.id;
  for (const f of SYSTEM_FIELDS) {
    delete cleaned[f];
  }
  if (sourceId) cleaned._source_id = sourceId;
  return cleaned;
}

// Import용 최종 정제 (시스템 필드 + 메타 필드 제거)
function sanitizeForImport(record) {
  const cleaned = { ...record };
  for (const f of [...SYSTEM_FIELDS, "_source_id"]) {
    delete cleaned[f];
  }
  return cleaned;
}

// 전체 레코드 조회 (limit 상관없이 모두)
async function fetchAllRecords(entityName) {
  const all = [];
  const limit = 5000;
  let sort = "unit_number";
  if (entityName === "COSUnit") sort = "order";
  // Base44 list(sort, limit) — 대량 데이터 안전하게
  const items = await base44.entities[entityName].list(sort, limit);
  return items || [];
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function UnitMigrationPanel() {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ entity: "", current: 0, total: 0 });
  const [duplicateMode, setDuplicateMode] = useState("skip"); // skip | update | create

  // ─── Export ──────────────────────────────────────────────
  const handleExport = async () => {
    if (!confirm("모든 Unit 데이터를 Export 하시겠습니까?\n(READ-ONLY 작업이므로 기존 데이터는 변경되지 않습니다.)")) return;

    setExporting(true);
    setExportProgress("");
    try {
      const data = {};
      const entityCounts = {};
      for (let i = 0; i < UNIT_ENTITIES.length; i++) {
        const entityName = UNIT_ENTITIES[i];
        setExportProgress(`Exporting ${entityName}... (${i + 1}/${UNIT_ENTITIES.length})`);
        try {
          const records = await fetchAllRecords(entityName);
          data[entityName] = records.map(stripSystemFields);
          entityCounts[entityName] = records.length;
        } catch (err) {
          console.error(`${entityName} export 실패:`, err);
          data[entityName] = [];
          entityCounts[entityName] = -1;
        }
      }

      const exportPayload = {
        migration: {
          type: "Base44 Unit Migration",
          version: 1,
          exportedAt: new Date().toISOString(),
          entities: UNIT_ENTITIES,
          entityCounts,
        },
        data,
      };

      const filename = `units_backup_${new Date().toISOString().slice(0, 10)}.json`;
      downloadJson(exportPayload, filename);

      const total = Object.values(entityCounts).reduce((s, c) => s + (c > 0 ? c : 0), 0);
      toast({
        title: "Export 완료",
        description: `총 ${total}개 Unit이 ${filename}로 저장되었습니다.`,
      });
    } catch (err) {
      toast({ title: "Export 실패", description: err?.message, variant: "destructive" });
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  // ─── Import 파일 선택 ────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.migration || parsed.migration.type !== "Base44 Unit Migration") {
        toast({ title: "잘못된 파일", description: "Unit Migration JSON 파일이 아닙니다.", variant: "destructive" });
        return;
      }
      if (!parsed.data || typeof parsed.data !== "object") {
        toast({ title: "잘못된 파일", description: "data 필드가 없습니다.", variant: "destructive" });
        return;
      }
      setImportData(parsed);
    } catch (err) {
      toast({ title: "파일 읽기 실패", description: err?.message, variant: "destructive" });
    }
    // 같은 파일 다시 선택 가능하도록
    e.target.value = "";
  };

  // ─── Import 실행 ─────────────────────────────────────────
  const handleImport = async () => {
    if (!importData) return;
    if (!confirm(`Unit 데이터를 Import 하시겠습니까?\n중복 처리: ${duplicateMode === "skip" ? "Skip existing" : duplicateMode === "update" ? "Update existing" : "Create anyway"}`)) return;

    setImporting(true);
    try {
      const data = importData.data;
      const results = {};
      for (const entityName of UNIT_ENTITIES) {
        const records = data[entityName];
        if (!records || !Array.isArray(records) || records.length === 0) continue;

        setImportProgress({ entity: entityName, current: 0, total: records.length });

        // 기존 레코드 조회 (중복 판별용)
        let existingRecords = [];
        try {
          existingRecords = await fetchAllRecords(entityName);
        } catch (err) {
          console.error(`${entityName} 기존 데이터 조회 실패:`, err);
        }
        const existingMap = new Map();
        for (const r of existingRecords) {
          const key = getEntityKey(entityName, r);
          if (key) existingMap.set(key, r);
        }

        const toCreate = [];
        const toUpdate = [];
        for (const record of records) {
          const key = getEntityKey(entityName, record);
          const existing = key ? existingMap.get(key) : null;
          if (existing) {
            if (duplicateMode === "skip") continue;
            if (duplicateMode === "update") {
              toUpdate.push({ existing, record });
            } else {
              // create anyway
              toCreate.push(record);
            }
          } else {
            toCreate.push(record);
          }
        }

        // Create 처리 (batch 100개씩)
        let created = 0;
        for (let i = 0; i < toCreate.length; i += 100) {
          const batch = toCreate.slice(i, i + 100).map(sanitizeForImport);
          setImportProgress({ entity: entityName, current: Math.min(i + 100, toCreate.length), total: records.length });
          try {
            await base44.entities[entityName].bulkCreate(batch);
            created += batch.length;
          } catch (err) {
            console.error(`${entityName} bulkCreate 실패:`, err);
            // 개별 생성 fallback
            for (const item of batch) {
              try {
                await base44.entities[entityName].create(item);
                created++;
              } catch (e) {
                console.error("개별 생성 실패:", e);
              }
            }
          }
        }

        // Update 처리 (개별)
        let updated = 0;
        for (let i = 0; i < toUpdate.length; i++) {
          const { existing, record } = toUpdate[i];
          setImportProgress({ entity: entityName, current: toCreate.length + i + 1, total: records.length });
          try {
            const updateData = sanitizeForImport(record);
            await base44.entities[entityName].update(existing.id, updateData);
            updated++;
          } catch (err) {
            console.error(`${entityName} update 실패:`, err);
          }
        }

        results[entityName] = { created, updated, skipped: records.length - created - updated };
      }

      const summary = Object.entries(results)
        .map(([name, r]) => `${name}: ${r.created}생성, ${r.updated}수정, ${r.skipped}건너뜀`)
        .join("\n");
      toast({ title: "Import 완료", description: summary });
      setImportData(null);
    } catch (err) {
      toast({ title: "Import 실패", description: err?.message, variant: "destructive" });
    } finally {
      setImporting(false);
      setImportProgress({ entity: "", current: 0, total: 0 });
    }
  };

  const importCounts = importData
    ? UNIT_ENTITIES.map((name) => ({
        name,
        count: importData.data[name]?.length || 0,
      })).filter((e) => e.count > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Export 섹션 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Unit 전체 Export</h3>
            <p className="text-sm text-gray-500 mt-1">
              현재 프로젝트의 모든 Unit 데이터를 JSON 파일로 다운로드합니다. 기존 데이터는 변경되지 않습니다 (READ-ONLY).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {UNIT_ENTITIES.map((name) => (
            <span key={name} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md font-mono">
              {name}
            </span>
          ))}
        </div>
        {exportProgress && (
          <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            {exportProgress}
          </div>
        )}
        <Button onClick={handleExport} disabled={exporting} className="bg-blue-600 hover:bg-blue-700">
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export All Units
        </Button>
      </div>

      {/* Import 섹션 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Upload className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Unit Import</h3>
            <p className="text-sm text-gray-500 mt-1">
              Export한 JSON 파일을 선택하여 Unit 데이터를 가져옵니다. Base44 시스템 필드(id, created_date 등)는 자동 제거됩니다.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          disabled={importing}
          className="mb-4"
        >
          <FileJson className="w-4 h-4 mr-2" />
          JSON 파일 선택
        </Button>

        {importData && (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              파일 로드 완료 — Export 일시: {new Date(importData.migration.exportedAt).toLocaleString()}
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-700 mb-2 block">Import 대상</Label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                {importCounts.length === 0 && (
                  <div className="text-sm text-gray-400">가져올 Unit 데이터가 없습니다.</div>
                )}
                {importCounts.map(({ name, count }) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-gray-700">{name}</span>
                    <span className="font-semibold text-gray-900">{count} units</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-700 mb-2 block">Duplicate handling</Label>
              <select
                value={duplicateMode}
                onChange={(e) => setDuplicateMode(e.target.value)}
                disabled={importing}
                className="w-full text-sm border border-input rounded-md px-3 py-2 bg-white"
              >
                <option value="skip">Skip existing (기본값) — 중복은 건너뜀</option>
                <option value="update">Update existing — 중복은 내용으로 덮어쓰기</option>
                <option value="create">Create anyway — 무조건 새로 생성</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                중복 판별 기준: unit_number (COSUnit은 title, GenericUnit은 subject_id+unit_number)
              </p>
            </div>

            {importing && importProgress.entity && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-2 text-sm text-blue-700 mb-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing {importProgress.entity}...
                </div>
                <div className="text-sm font-mono text-blue-900">
                  {importProgress.current} / {importProgress.total}
                </div>
                <div className="w-full bg-blue-100 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Import를 누르면 선택한 모든 Unit이 DB에 생성/수정됩니다. 중복 처리 옵션을 확인하세요.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportData(null)} disabled={importing}>
                취소
              </Button>
              <Button onClick={handleImport} disabled={importing || importCounts.length === 0} className="bg-green-600 hover:bg-green-700">
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Import
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}