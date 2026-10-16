import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';

// Auth Pages
import Login from '@/pages/Login';
import ForceChangePassword from '@/pages/ForceChangePassword';

// Layouts (eager — needed for route structure)
import AdminLayout from '@/components/admin/AdminLayout';
import StudentLayout from '@/components/student/StudentLayout';
import SubjectGuard from '@/components/student/SubjectGuard';

// Admin Pages (lazy) — 학생 관리 전용
const AdminStudents = lazy(() => import('@/pages/admin/AdminStudents'));
const AdminSubjects = lazy(() => import('@/pages/admin/AdminSubjects'));

// Student Pages (lazy) — Python / 저학년 Python / C++ 3과목
const StudentHome = lazy(() => import('@/pages/student/StudentHome'));
const StudentSettings = lazy(() => import('@/pages/student/StudentSettings'));
const StudentPythonUnits = lazy(() => import('@/pages/student/StudentPythonUnits'));
const StudentJuniorPythonUnits = lazy(() => import('@/pages/student/StudentJuniorPythonUnits'));
const StudentCppUnits = lazy(() => import('@/pages/student/StudentCppUnits'));

// Fallback spinner
function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      불러오는 중...
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* 기본 진입 = 로그인 */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ForceChangePassword />} />

            {/* Admin Routes — 학생 관리 전용 */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/students" replace />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="subjects" element={<AdminSubjects />} />
              <Route path="*" element={<Navigate to="/admin/students" replace />} />
            </Route>

            {/* Student Routes */}
            <Route path="/student" element={<StudentLayout />}>
              <Route index element={<Navigate to="/student/home" replace />} />
              <Route path="home" element={<StudentHome />} />
              <Route path="settings" element={<StudentSettings />} />
              <Route path="python" element={<SubjectGuard subjectKey="Python"><StudentPythonUnits /></SubjectGuard>} />
              <Route path="junior-python" element={<SubjectGuard subjectKey="저학년 Python"><StudentJuniorPythonUnits /></SubjectGuard>} />
              <Route path="cpp" element={<SubjectGuard subjectKey="C++"><StudentCppUnits /></SubjectGuard>} />
              <Route path="*" element={<Navigate to="/student/home" replace />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </Router>
      <Toaster />
    </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;