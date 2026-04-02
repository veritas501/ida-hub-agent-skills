import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/components/I18nProvider";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import AgentConfigPage from "@/pages/AgentConfigPage";
import IDAConfigPage from "@/pages/IDAConfigPage";

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/agent_config" element={<AgentConfigPage />} />
          <Route path="/ida_config" element={<IDAConfigPage />} />
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </I18nProvider>
    </BrowserRouter>
  );
}
