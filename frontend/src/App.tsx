import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Bills from "./pages/Bills";
import Analytics from "./pages/Analytics";
import CashFlow from "./pages/CashFlow";
import Settings from "./pages/Settings";
import Advisor from "./pages/Advisor";
import SecuritySetup from "./pages/SecuritySetup";
import SecurityQuestionsSetup from "./pages/SecurityQuestionsSetup";
import ForgotPassword from "./pages/ForgotPassword";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/security-questions-setup"
        element={
          <ProtectedRoute>
            <SecurityQuestionsSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security-setup"
        element={
          <ProtectedRoute>
            <SecuritySetup />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/cashflow" element={<CashFlow />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/advisor" element={<Advisor />} />
      </Route>
    </Routes>
  );
}
