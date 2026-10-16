import { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Unit 순서 변경(드래그/↑↓ 버튼) 공용 훅
 *
 * - unit_number를 1부터 순차적으로 재설정하여 DB에 update
 * - 기존 Unit의 id와 내용은 절대 변경하지 않음 (unit_number만 patch)
 * - 저장 실패 시 onReload()로 DB 실제 상태를 다시 불러와 UI 복구
 *
 * @param {Object}   opts
 * @param {string}   opts.entityName  - Base44 entity 이름 (예: "PythonUnit")
 * @param {Function} opts.toast      - useToast의 toast 함수
 * @param {Function} opts.onReload   - 저장 실패 시 호출할 reload 함수
 * @returns {{ saving: boolean, saveOrder: Function }}
 */
export function useUnitReorder({ entityName, toast, onReload }) {
  const [saving, setSaving] = useState(false);

  const saveOrder = useCallback(
    async (reorderedUnits) => {
      if (saving) return false;
      setSaving(true);
      toast({ title: "Unit 순서 저장 중..." });
      try {
        // 각 Unit의 unit_number를 1부터 순차적으로 update (id 유지, 내용 변경 안 함)
        await Promise.all(
          reorderedUnits.map((unit, idx) =>
            base44.entities[entityName].update(unit.id, { unit_number: idx + 1 })
          )
        );
        toast({ title: "Unit 순서가 변경되었습니다." });
        return true;
      } catch (err) {
        console.error(`[useUnitReorder] ${entityName} 순서 저장 실패:`, err);
        toast({ title: "Unit 순서 변경에 실패했습니다.", variant: "destructive" });
        // DB에서 실제 상태를 다시 불러와 UI를 원래 순서로 복구
        if (onReload) await onReload();
        return false;
      } finally {
        setSaving(false);
      }
    },
    [entityName, toast, saving, onReload]
  );

  return { saving, saveOrder };
}