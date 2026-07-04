import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { Login } from "./pages/Login";
import { ForcePasswordChange } from "./pages/ForcePasswordChange";
import { Dashboard } from "./pages/Dashboard";
import { MeetingDetail } from "./pages/MeetingDetail";
import { Notifications } from "./pages/Notifications";
import { UserManagement } from "./pages/UserManagement";

// Electron loads the built app from file:// where history-based routing breaks;
// use hash routing there and keep clean URLs on the web.
const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

export default function App() {
  const { user } = useAuth();

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : user.mustChangePassword ? (
        <ForcePasswordChange />
      ) : (
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/meetings/:id" element={<MeetingDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </Router>
  );
}
