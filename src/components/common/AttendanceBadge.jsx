import React from "react";
import { Badge } from "@/components/ui/badge";

const ATTENDANCE_CONFIG = {
  "출석":    { className: "bg-green-100 text-green-700 border-0 hover:bg-green-100" },
  "결석":    { className: "bg-red-100 text-red-700 border-0 hover:bg-red-100" },
  "지각":    { className: "bg-yellow-100 text-yellow-700 border-0 hover:bg-yellow-100" },
  "보강 예정": { className: "bg-blue-100 text-blue-700 border-0 hover:bg-blue-100" },
  "취소":    { className: "bg-gray-100 text-gray-500 border-0 hover:bg-gray-100" },
};

export default function AttendanceBadge({ status }) {
  if (!status) return null;
  const config = ATTENDANCE_CONFIG[status] || { className: "bg-gray-100 text-gray-500 border-0" };
  return (
    <Badge className={`text-xs ${config.className}`}>{status}</Badge>
  );
}

export { ATTENDANCE_CONFIG };