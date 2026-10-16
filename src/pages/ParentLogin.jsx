import React, { useState } from "react";
import { loadAllStudents } from "@/lib/dataAccess";
import { Heart, Phone, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 인증 모드: "phone_only" | "phone_and_name"
// 나중에 "pin" | "sms_otp" 추가 가능
const AUTH_MODE = "phone_and_name";

function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}

export default function ParentLogin() {
  const [phone, setPhone] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    const inputPhone = normalizePhone(phone);
    if (!inputPhone || inputPhone.length < 10) {
      setError("올바른 전화번호를 입력해 주세요.");
      return;
    }
    if (AUTH_MODE === "phone_and_name" && !studentName.trim()) {
      setError("자녀 이름을 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const students = await loadAllStudents();
      let matched = students.filter(s =>
        normalizePhone(s.parent_phone) === inputPhone && s.is_active !== false
      );

      if (matched.length === 0) {
        setError("등록된 학부모 전화번호가 없습니다.");
        setLoading(false);
        return;
      }

      // phone_and_name 모드: 자녀 이름 추가 검증
      if (AUTH_MODE === "phone_and_name") {
        const nameInput = studentName.trim();
        const nameMatched = matched.filter(s => s.name === nameInput);
        if (nameMatched.length === 0) {
          setError("자녀 이름이 일치하지 않습니다.\n등록된 이름과 정확히 입력해 주세요.");
          setLoading(false);
          return;
        }
        matched = nameMatched;
      }

      const parentSession = {
        role: "parent",
        parent_phone: inputPhone,
        linked_student_ids: matched.map(s => s.id),
        name: matched[0].name + (matched.length > 1 ? " 외" : "") + " 학부모님",
      };
      localStorage.setItem("coda_parent_session", JSON.stringify(parentSession));
      window.location.href = "/parent/home";
    } catch {
      setError("로그인 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CODA Judge</h1>
          <p className="text-gray-500 text-sm mt-1">학부모 전용 포털</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-6 text-center">학부모 로그인</h2>

          <div className="space-y-4">
            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                학부모 전화번호
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="010-1234-5678"
                  className="pl-10 h-12 text-base"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {/* 자녀 이름 (phone_and_name 모드) */}
            {AUTH_MODE === "phone_and_name" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  자녀 이름
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    placeholder="홍길동"
                    className="pl-10 h-12 text-base"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
              </div>
            )}

            <Button
              onClick={handleLogin}
              disabled={loading || !phone.trim() || (AUTH_MODE === "phone_and_name" && !studentName.trim())}
              className="w-full h-12 text-base bg-pink-500 hover:bg-pink-600 text-white gap-2"
            >
              <LogIn className="w-4 h-4" />
              {loading ? "확인 중..." : "로그인"}
            </Button>
          </div>

          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 leading-relaxed">
              학생 등록 시 입력된 학부모 전화번호와 자녀 이름으로 로그인할 수 있습니다.<br />
              전화번호는 하이픈(-) 없이 입력해도 됩니다.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => { window.location.href = "/login"; }}
              className="w-full h-11 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              일반 로그인으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}