import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';

// Auth Pages
import Login from '@/pages/Login';

// Parent Login
import ParentLogin from '@/pages/ParentLogin';
import ForceChangePassword from '@/pages/ForceChangePassword';

// Layouts (eager — needed for route structure)
import AdminLayout from '@/components/admin/AdminLayout';
import StudentLayout from '@/components/student/StudentLayout';
import ParentLayout from '@/components/parent/ParentLayout';
import SubjectGuard from '@/components/student/SubjectGuard';

// Admin Pages (lazy)
const AdminDashboardPage = lazy(() => import('@/pages/admin/Dashboard'));
const StudentManagement = lazy(() => import('@/components/admin/StudentManagement.jsx'));
const SubjectManagement = lazy(() => import('@/components/admin/SubjectManagement'));
const ClassCalendar = lazy(() => import('@/components/admin/ClassCalendar'));
const AdminProblems = lazy(() => import('@/pages/admin/AdminProblems'));
const AdminFeedback = lazy(() => import('@/pages/admin/AdminFeedback'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const TeacherStats = lazy(() => import('@/pages/admin/TeacherStats'));
const AttendanceBook = lazy(() => import('@/pages/admin/AttendanceBook'));
const LessonRecordSheet = lazy(() => import('@/pages/admin/LessonRecordSheet'));
const StudentSubmissions = lazy(() => import('@/pages/admin/StudentSubmissions'));
const UnitTeaching = lazy(() => import('@/pages/admin/UnitTeaching'));
// Student Pages (lazy)
const StudentHome = lazy(() => import('@/pages/student/StudentHome'));
const StudentAlgorithm = lazy(() => import('@/pages/student/StudentProblems'));
const StudentSettings = lazy(() => import('@/pages/student/StudentSettings'));
const StudentPythonUnits = lazy(() => import('@/pages/student/StudentPythonUnits'));
const StudentHTMLUnits = lazy(() => import('@/pages/student/StudentHTMLUnits'));
const StudentEntryUnits = lazy(() => import('@/pages/student/StudentEntryUnits'));
const BlockCodingPage = lazy(() => import('@/pages/student/BlockCodingPage'));
const StudentCOS = lazy(() => import('@/pages/student/StudentCOS'));
const StudentCppUnits = lazy(() => import('@/pages/student/StudentCppUnits'));
const StudentJuniorPythonUnits = lazy(() => import('@/pages/student/StudentJuniorPythonUnits'));
const StudentAlgorithmLearning = lazy(() => import('@/pages/student/StudentAlgorithmUnits'));

// Parent Pages (lazy)
const ParentHome = lazy(() => import('@/pages/parent/ParentHome'));
const ParentFeedback = lazy(() => import('@/pages/parent/ParentFeedback'));
const ParentClasses = lazy(() => import('@/pages/parent/ParentClasses'));

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
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* 기본 진입 = 학생 로그인 */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/parent-login" element={<ParentLogin />} />
            <Route path="/change-password" element={<ForceChangePassword />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="students" element={<StudentManagement />} />
              <Route path="subjects" element={<SubjectManagement />} />
              <Route path="calendar" element={<ClassCalendar />} />
              <Route path="feedback" element={<AdminFeedback />} />
              <Route path="problems" element={<AdminProblems />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="teacher-stats" element={<TeacherStats />} />
              <Route path="attendance" element={<AttendanceBook />} />
              <Route path="lesson-record" element={<LessonRecordSheet />} />
              <Route path="student-submissions" element={<StudentSubmissions />} />
              <Route path="teaching/:subjectType/:unitId" element={<UnitTeaching />} />
            </Route>

            {/* Student Routes */}
            <Route path="/student" element={<StudentLayout />}>
              <Route index element={<Navigate to="/student/home" replace />} />
              <Route path="home" element={<StudentHome />} />
              <Route path="algorithm" element={<SubjectGuard subjectKey="알고리즘"><StudentAlgorithm /></SubjectGuard>} />
              <Route path="problems" element={<Navigate to="/student/algorithm" replace />} />
              <Route path="settings" element={<StudentSettings />} />
              <Route path="python" element={<SubjectGuard subjectKey="Python"><StudentPythonUnits /></SubjectGuard>} />
              <Route path="cpp" element={<SubjectGuard subjectKey="C++"><StudentCppUnits /></SubjectGuard>} />
              <Route path="html" element={<SubjectGuard subjectKey="HTML"><StudentHTMLUnits /></SubjectGuard>} />
              <Route path="entry" element={<SubjectGuard subjectKey="엔트리"><StudentEntryUnits /></SubjectGuard>} />
              <Route path="junior-python" element={<SubjectGuard subjectKey="저학년 Python"><StudentJuniorPythonUnits /></SubjectGuard>} />
              <Route path="algorithm-learning" element={<SubjectGuard subjectKey="알고리즘 학습"><StudentAlgorithmLearning /></SubjectGuard>} />
              <Route path="block-coding" element={<SubjectGuard subjectKey="블록코딩"><BlockCodingPage /></SubjectGuard>} />
              <Route path="cos" element={<SubjectGuard subjectKey="COS"><StudentCOS /></SubjectGuard>} />
              {/* 미사용 페이지 — 직접 URL 접근 차단 */}
              <Route path="submissions" element={<Navigate to="/student/home" replace />} />
              <Route path="feedback" element={<Navigate to="/student/home" replace />} />
              <Route path="progress" element={<Navigate to="/student/home" replace />} />
              <Route path="classes" element={<Navigate to="/student/home" replace />} />
              <Route path="roadmap" element={<Navigate to="/student/home" replace />} />
              <Route path="visualizer" element={<Navigate to="/student/home" replace />} />
            </Route>

            {/* Parent Routes */}
            <Route path="/parent" element={<ParentLayout />}>
              <Route index element={<Navigate to="/parent/home" replace />} />
              <Route path="home" element={<ParentHome />} />
              <Route path="feedback" element={<ParentFeedback />} />
              <Route path="classes" element={<ParentClasses />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;