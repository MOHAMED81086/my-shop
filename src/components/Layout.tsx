import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { ShoppingCart, Wallet, User as UserIcon, LogOut, LayoutDashboard, ShieldAlert, Bell, MessageSquare, Settings, Key, Award, Plus, Trophy } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { getLevelTitle } from '../lib/utils';
import AdModal from './AdModal';
import LoginModal from './LoginModal';

export default function Layout() {
  const { user, profile, loading, initialize } = useAuthStore();
  const { totalItems } = useCartStore();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [customRank, setCustomRank] = useState<any>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (profile?.role && !['admin', 'merchant', 'support', 'buyer'].includes(profile.role)) {
       onSnapshot(doc(db, 'ranks', profile.role), snap => {
         if (snap.exists()) setCustomRank(snap.data());
       });
    } else {
       setCustomRank(null);
    }
  }, [profile]);

  const handleLogout = async () => {
    try {
      if (profile?.role === 'admin') {
        const revertedRole = profile.originalRole || 'buyer';
        await updateDoc(doc(db, 'users', user!.uid), {
          role: revertedRole,
          masterCode: null
        });
      }
      sessionStorage.removeItem('adminSession');
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">جاري التحميل...</div>;
  }

  if (profile?.blocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">تم حظر حسابك</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">يرجى التواصل مع الإدارة لمزيد من التفاصيل.</p>
        <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">تسجيل الخروج</button>
      </div>
    );
  }

  const isMerchant = ['merchant', 'vip_merchant', 'admin'].includes(profile?.role || '') || customRank?.canSell;
  const isSupport = ['support', 'admin'].includes(profile?.role || '') || customRank?.canSupport;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100" dir={i18n.language === 'en' ? 'ltr' : 'rtl'}>
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-blue-600 dark:text-blue-400">{t('app_name')}</Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="hover:text-blue-600 font-medium transition-colors">{t('home')}</Link>
            <Link to="/leaderboard" className="hover:text-blue-600 font-medium flex items-center gap-1 transition-colors"><Trophy className="w-4 h-4"/> المتصدرين</Link>
            {user && <Link to="/my-activity" className="hover:text-blue-600 font-medium transition-colors">{t('my_activity')}</Link>}
            {user && <Link to="/wallet" className="hover:text-blue-600 font-medium flex items-center gap-1 transition-colors"><Wallet className="w-4 h-4"/> {t('wallet')}</Link>}
            {profile?.role === 'admin' && <Link to="/admin" className="hover:text-blue-600 font-medium flex items-center gap-1 transition-colors"><LayoutDashboard className="w-4 h-4"/> {t('admin_panel')}</Link>}
            {isMerchant && <Link to="/merchant" className="hover:text-blue-600 font-medium flex items-center gap-1 transition-colors"><LayoutDashboard className="w-4 h-4"/> {t('merchant_panel')}</Link>}
            {isSupport && <Link to="/support-dashboard" className="hover:text-blue-600 font-medium flex items-center gap-1 transition-colors"><MessageSquare className="w-4 h-4"/> لوحة الدعم</Link>}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/cart" className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative transition-colors">
                  <ShoppingCart className="w-5 h-5" />
                  {totalItems() > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800">
                      {totalItems()}
                    </span>
                  )}
                </Link>
                <Link to="/notifications" className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative transition-colors">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <div className="text-sm hidden sm:block text-right">
                  <p className="font-bold text-black dark:text-white flex items-center justify-end gap-1">
                    {profile?.name}
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title={`${profile?.points || 0} نقطة`}>
                      <Award className="w-3 h-3" />
                      {getLevelTitle(profile?.points || 0)}
                    </span>
                  </p>
                  <p className="text-black dark:text-white font-mono text-xs">ID: {profile?.numericId || profile?.userId.substring(0, 10)}</p>
                  <p className="text-blue-600 dark:text-blue-400 font-bold">{profile?.wallet_balance?.toLocaleString('en-US')} {t('price')}</p>
                </div>
                <Link to="/settings" className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Settings className="w-5 h-5" />
                </Link>
                <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsLoginModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors">
                {t('login')}
              </button>
            )}
          </div>
        </div>
      </header>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <AdModal />
    </div>
  );
}
