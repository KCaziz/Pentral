import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Scan from "./pages/scan";
import Scan_no_user from "./pages/scan_no_user";
import Scan_reason from "./pages/scan_reason";
import Scan_user from "./pages/scan_user";
import NewScan from "./pages/subpages/NewScans";

import Home from "./pages/home";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Signup from "./pages/Signup";
import AddProject from "./pages/subpages/project/addproject";
import ProjectDashboard from "./pages/subpages/project/ProjectDashboard";
import Gestionproject from "./pages/subpages/project/Gestionproject";
import Report from "./pages/subpages/Report";
import Gestionscans from "./pages/subpages/Gestionscans";
import Historique from "./pages/subpages/Historique";

import UserSettings from "./pages/subpages/Settings";
import Password from "./pages/subpages/Password";

import Admin from "./pages/Admin";
import AdminStatsDashboard from "./pages/subpages/AdminStat";
const App = () => {
  return (
 
    <Routes>
      <Route path="/" element={<Home/>} />
      <Route path="/scan" element={<Scan/>} />
      <Route path="/scan_no_user/:scanId" element={<Scan_no_user/>} />
      <Route path="/scan_reason/:scanId" element={<Scan_reason/>} />
      <Route path="/scan_user/:scanId" element={<Scan_user/>} />
      
      <Route path="/login" element={<Login/>} />
      <Route path="/signup" element={<Signup/>} />
      <Route path="/dashboard" element={<Dashboard/>} />
      <Route path="/add-project" element={<AddProject/>} />
      <Route path="/project-dashboard/:projectId" element={<ProjectDashboard/>} />
      <Route path="/gestionproject" element={<Gestionproject/>} />
      <Route path="/report" element={<Report/>} />
      <Route path="/gestionscans" element={<Gestionscans/>} />
      <Route path="/historique" element={<Historique/>} />
      <Route path="/settings" element={<UserSettings/>} />
      <Route path="/password" element={<Password/>} />
      <Route path="/newscan" element={<NewScan/>} />

      <Route path="/admin" element={<Admin/>} />
      <Route path="/admin/stats" element={<AdminStatsDashboard/>} />




      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  )
};
export default App