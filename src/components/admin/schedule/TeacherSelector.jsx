import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TeacherSelector({ teachers, value, onChange }) {
  return (
    <div>
      <Label className="font-semibold text-gray-800">③ 담당 선생님</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5">
          <SelectValue placeholder="선생님 선택" />
        </SelectTrigger>
        <SelectContent>
          {teachers.map(t => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}