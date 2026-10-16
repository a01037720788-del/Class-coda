import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function COSUnitForm({ open, unit, nextOrder, onClose, onSaved }) {
  const [form, setForm] = useState({ title: "", description: "", order: 1, is_published: true });
  const { toast } = useToast();

  useEffect(() => {
    if (unit) {
      setForm({ title: unit.title || "", description: unit.description || "", order: unit.order ?? 1, is_published: unit.is_published !== false });
    } else {
      setForm({ title: "", description: "", order: nextOrder || 1, is_published: true });
    }
  }, [unit, nextOrder, open]);

  const save = async () => {
    if (!form.title.trim()) { toast({ title: "Unit 제목을 입력해주세요.", variant: "destructive" }); return; }
    if (unit) {
      await base44.entities.COSUnit.update(unit.id, form);
    } else {
      await base44.entities.COSUnit.create(form);
    }
    toast({ title: unit ? "Unit 수정 완료" : "Unit 추가 완료" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{unit ? "Unit 수정" : "Unit 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>순서</Label>
              <Input type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Unit 제목 *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="예: 기출유형파악하기 01" className="mt-1" />
            </div>
          </div>
          <div>
            <Label>설명</Label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Unit 설명..."
              className="mt-1 w-full border border-gray-200 rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-lg">
            <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
            <span className="text-sm text-gray-700">학생에게 공개</span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
            <Button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700">저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}