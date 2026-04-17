import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Home from './pages/Home';
import Wallet from './pages/Wallet';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import MerchantDashboard from './pages/MerchantDashboard';
import Orders from './pages/Orders';
import Support from './pages/Support';
import Notifications from './pages/Notifications';
import Recharge from './pages/Recharge';
import Leaderboard from './pages/Leaderboard';
import MyActivity from './pages/MyActivity';
import Cart from './pages/Cart';
import RolesCenter from './pages/RolesCenter';
import SupportDashboard from './pages/SupportDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="recharge" element={<Recharge />} />
          <Route path="orders" element={<Orders />} />
          <Route path="cart" element={<Cart />} />
          <Route path="support" element={<Support />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="my-activity" element={<MyActivity />} />
          <Route path="roles-center" element={<RolesCenter />} />
          <Route path="admin/*" element={<AdminDashboard />} />
          <Route path="merchant/*" element={<MerchantDashboard />} />
          <Route path="support-dashboard" element={<SupportDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
