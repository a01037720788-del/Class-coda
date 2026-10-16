import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, MessageSquare, Phone, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function buildMessage(student, enrollment) {
  const paid = enrollment.paid_lessons || 0;
  const completed = enrollment.completed_lessons || 0;
  const remaining = enrollment.remaining_lessons ?? (paid - completed);
  return `안녕하세요, 학부모님.
${student.name} 학생의 ${enrollment.subject_name} 수업이 결제하신 ${paid}차시 중 ${completed}차시까지 모두 진행되어 안내드립니다.

현재 남은 차시는 ${remaining}회이며, 이후 수업을 계속 진행하기 위해서는 재결제가 필요합니다.

확인 부탁드립니다.
감사합니다.`;
}

export default function RepaymentModal({ open, onClose, student, enrollment }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!student || !enrollment) return null;

  const message = buildMessage(student, enrollment);
  const parentPhone = (student.parent_phone || "").replace(/[^0-9]/g, "");

  const copyText = async (text, label) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: `${label} 복사됨`, description: "클립보드에 복사되었습니다." });
    setTimeout(() => setCopied(false), 2000);
  };

  const sendSMS = () => {
    if (!parentPhone) {
      toast({ title: "전화번호 없음", description: "학부모 전화번호를 먼저 입력해주세요.", variant: "destructive" });
      return;
    }
    const encoded = encodeURIComponent(message);
    // iOS: sms:번호&body=... / Android: sms:번호?body=...
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const sep = isIOS ? "&" : "?";
    window.location.href = `sms:${parentPhone}${sep}body=${encoded}`;
  };

  const sendKakao = async () => {
    await navigator.clipboard.writeText(message);
    toast({ title: "문구 복사 완료", description: "카카오톡 채팅방에 붙여넣어 보내주세요." });
    // 카카오톡 앱 열기 시도
    setTimeout(() => {
      window.location.href = "kakaotalk://";
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600" />
            재결제 안내 문구
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 학생/과목 정보 */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="flex gap-4 flex-wrap">
              <div><span className="text-gray-500">학생:</span> <span className="font-semibold text-gray-900">{student.name}</span></div>
              <div><span className="text-gray-500">과목:</span> <span className="font-semibold text-gray-900">{enrollment.subject_name}</span></div>
              <div><span className="text-gray-500">결제:</span> <span className="font-semibold text-blue-700">{enrollment.paid_lessons || 0}회</span></div>
              <div><span className="text-gray-500">수업:</span> <span className="font-semibold text-green-700">{enrollment.completed_lessons || 0}회</span></div>
              <div><span className="text-gray-500">남은:</span> <span className={`font-semibold ${(enrollment.remaining_lessons ?? (enrollment.paid_lessons || 0) - (enrollment.completed_lessons || 0)) <= 0 ? "text-red-600" : "text-gray-700"}`}>
                {enrollment.remaining_lessons ?? ((enrollment.paid_lessons || 0) - (enrollment.completed_lessons || 0))}회
              </span></div>
            </div>
          </div>

          {/* 학부모 전화번호 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">학부모 전화번호</span>
              <button
                onClick={() => copyText(student.parent_phone || "", "전화번호")}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> 복사
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 border border-gray-200">
              {student.parent_phone || <span className="text-gray-400">전화번호 없음</span>}
            </div>
          </div>

          {/* 안내 문구 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">안내 문구</span>
              <button
                onClick={() => copyText(message, "문구")}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {copied ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <Textarea
              value={message}
              readOnly
              className="text-sm h-44 resize-none bg-gray-50 font-mono"
            />
          </div>

          {/* 버튼들 */}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={sendSMS} className="gap-2 bg-green-600 hover:bg-green-700">
              <MessageSquare className="w-4 h-4" /> 문자로 보내기
            </Button>
            <Button onClick={sendKakao} className="gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900">
              <Send className="w-4 h-4" /> 카톡으로 보내기
            </Button>
            <Button onClick={() => copyText(message, "문구")} variant="outline" className="gap-2">
              <Copy className="w-4 h-4" /> 문구 복사
            </Button>
            <Button onClick={() => copyText(student.parent_phone || "", "전화번호")} variant="outline" className="gap-2">
              <Phone className="w-4 h-4" /> 전화번호 복사
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}