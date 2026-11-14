import React from "react";
import { Link } from "react-router-dom";
export default function AccountHelp() {
  return <main className="min-h-screen flex items-center justify-center p-6"><div className="max-w-md w-full rounded-xl border p-6 text-center space-y-4"><h1 className="text-xl font-bold">CODA 계정 안내</h1><p>CODA 학생 계정은 학원 관리자가 발급하고 비밀번호를 재설정합니다. 학원 관리자에게 문의해 주세요.</p><Link to="/login" className="inline-block underline">로그인으로 돌아가기</Link></div></main>;
}
