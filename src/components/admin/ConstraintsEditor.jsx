import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

export default function ConstraintsEditor({ value, onChange }) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);

  const add = () => onChange([...items, ""]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, v) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-5 flex-shrink-0">{i + 1}.</span>
          <Input
            value={item}
            onChange={e => update(i, e.target.value)}
            placeholder={`예: 1 ≤ N ≤ 100,000`}
            className="flex-1 text-sm font-mono"
          />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="text-xs">
        <Plus className="w-3 h-3 mr-1" />제한 조건 추가
      </Button>
    </div>
  );
}