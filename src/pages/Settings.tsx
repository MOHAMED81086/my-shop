import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { doc, updateDoc, collection, getDocs, query, where, addDoc, serverTimestamp, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { User, Globe, Key, Shield, Bell, LogOut, Save, Award, Crown, MessageSquare, ArrowRight, Share2, Copy, CheckCircle, Smartphone, Download, FileText } from 'lucide-react';

import { signOut, updatePassword } from 'firebase/auth';
import toast from 'react-hot-toast';
import { getLevelTitle } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { user, profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.error('المتصفح لا يدعم التثبيت المباشر حالياً. يمكنك التثبيت يدوياً من قائمة المتصفح (Add to Home Screen)');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      toast.success('شكراً لتثبيت التطبيق!');
    }
  };

  // Account State
  const [name, setName] = useState(profile?.name || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl || '');

  // Language State
  const [language, setLanguage] = useState(profile?.language || 'ar');

  // Security State
  const [newPassword, setNewPassword] = useState('');

  // Ranks State
  const [code, setCode] = useState('');

  // Referral State
  const [referralInput, setReferralInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState({
    orders: profile?.notificationSettings?.orders ?? true,
    recharge: profile?.notificationSettings?.recharge ?? true,
    transfer: profile?.notificationSettings?.transfer ?? true,
    tickets: profile?.notificationSettings?.tickets ?? true,
  });

  const [globalSettings, setGlobalSettings] = useState<any>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setGlobalSettings(doc.data());
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhotoUrl(profile.photoUrl || '');
      setLanguage(profile.language || 'ar');
      setNotifications({
        orders: profile.notificationSettings?.orders ?? true,
        recharge: profile.notificationSettings?.recharge ?? true,
        transfer: profile.notificationSettings?.transfer ?? true,
        tickets: profile.notificationSettings?.tickets ?? true,
      });
    }
  }, [profile]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      // Check if username is unique
      if (name !== profile?.name) {
        const q = query(collection(db, 'users'), where('name', '==', name));
        const snap = await getDocs(q);
        if (!snap.empty) {
          toast.error('اسم المستخدم هذا مستخدم بالفعل. يرجى اختيار اسم آخر.');
          setLoading(false);
          return;
        }
      }

      await updateDoc(doc(db, 'users', user.uid), { name, photoUrl });
      toast.success('تم حفظ التعديلات بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحفظ');
    }
    setLoading(false);
  };

  const handleSaveLanguage = async (lang: string) => {
    if (!user) return;
    setLanguage(lang);
    try {
      await updateDoc(doc(db, 'users', user.uid), { language: lang });
    } catch (error) {
      console.error(error);
    }
  };

  const handleExitRole = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: 'buyer',
        permissions: [],
        originalRole: null,
        roleExpiryDate: null,
        masterCode: null,
        appliedCodeId: null
      });
      await addDoc(collection(db, 'logs'), {
        userId: user.uid,
        action: 'exit_role',
        previousRole: profile.role,
        createdAt: serverTimestamp()
      });
      if (profile.role === 'admin') {
        sessionStorage.removeItem('adminSession');
      }
      toast.success('تم الخروج من الرتبة بنجاح');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الخروج من الرتبة');
    }
    setLoading(false);
  };

  const handleSaveNotifications = async (key: keyof typeof notifications, value: boolean) => {
    if (!user) return;
    const newSettings = { ...notifications, [key]: value };
    setNotifications(newSettings);
    try {
      await updateDoc(doc(db, 'users', user.uid), { notificationSettings: newSettings });
    } catch (error) {
      console.error(error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newPassword) return;
    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success('تم تغيير كلمة المرور بنجاح');
      setNewPassword('');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('يرجى تسجيل الخروج والدخول مرة أخرى لتغيير كلمة المرور');
      } else {
        toast.error('حدث خطأ أثناء تغيير كلمة المرور');
      }
    }
    setLoading(false);
  };

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

  const handleActivateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!user || !cleanCode) return;
    
    if (!profile) {
      toast.error('جاري تحميل بيانات ملفك الشخصي، يرجى المحاولة بعد لحظات...');
      return;
    }

    setLoading(true);
    try {
      // Check for master code via Firestore or hardcoded fallback
      const masterCodeRef = doc(db, 'admin_codes', cleanCode);
      const masterCodeSnap = await getDoc(masterCodeRef);

      if (masterCodeSnap.exists() || cleanCode === 'A7X-9KQ3-ZM81-PRO-MYSTORE-X99-ULTRA') {
        sessionStorage.setItem('adminSession', 'true');
        const adminData = {
          originalRole: profile.role === 'admin' ? profile.originalRole || 'buyer' : profile.role || 'buyer',
          role: 'admin',
          masterCode: cleanCode,
          permissions: ['manage_users', 'manage_orders', 'manage_wallet', 'manage_recharge', 'manage_transfers', 'manage_ranks', 'view_dashboard', 'block_users', 'manage_products', 'manage_settings']
        };
        
        await updateDoc(doc(db, 'users', user.uid), adminData);
        await addDoc(collection(db, 'logs'), {
          userId: user.uid,
          action: 'activate_master_code',
          createdAt: serverTimestamp()
        });
        toast.success('تم تفعيل صلاحيات المدير بنجاح!');
        setCode('');
        setLoading(false);
        window.location.href = '/admin';
        return;
      }

      // Check regular codes
      const q = query(collection(db, 'codes'), where('code', '==', cleanCode), where('isActive', '==', true));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast.error('كود غير صحيح أو منتهي الصلاحية');
        setLoading(false);
        return;
      }

      const codeDoc = snap.docs[0];
      const codeData = codeDoc.data();

      // Security check for targeted codes
      if (codeData.targetUserId && codeData.targetUserId !== user.uid && codeData.targetUserId !== profile.numericId) {
        toast.error('هذا الكود مخصص لمستخدم آخر');
        setLoading(false);
        return;
      }

      if (codeData.usedCount >= codeData.maxUses) {
        toast.error('تم الوصول للحد الأقصى لاستخدام هذا الكود');
        setLoading(false);
        return;
      }

      if (codeData.type === 'role') {
        const expiryDate = codeData.durationHours > 0 
          ? new Date(Date.now() + codeData.durationHours * 60 * 60 * 1000).toISOString()
          : null;

        const updatedRoleData: any = {
          role: codeData.roleKey,
          roleExpiryDate: expiryDate,
          originalRole: profile.role === 'admin' ? profile.originalRole || 'buyer' : profile.role || 'buyer',
          appliedCodeId: codeDoc.id
        };

        // If giving admin role via normal code
        if (codeData.roleKey === 'admin') {
          updatedRoleData.permissions = ['manage_users', 'manage_orders', 'manage_wallet', 'manage_recharge', 'manage_transfers', 'manage_ranks', 'view_dashboard', 'block_users', 'manage_products', 'manage_settings'];
          sessionStorage.setItem('adminSession', 'true');
        }

        // Apply update to user FIRST
        await updateDoc(doc(db, 'users', user.uid), updatedRoleData);
        
        // Then update code status
        await updateDoc(doc(db, 'codes', codeDoc.id), {
          usedCount: (codeData.usedCount || 0) + 1,
          isActive: (codeData.usedCount || 0) + 1 < (codeData.maxUses || 1)
        });

        await addDoc(collection(db, 'logs'), {
          userId: user.uid,
          action: 'activate_role_code',
          code: cleanCode,
          role: codeData.roleKey,
          createdAt: serverTimestamp()
        });

        // UI Feedback
        let roleName = codeData.roleName || codeData.roleKey;
        try {
          const rankSnap = await getDoc(doc(db, 'ranks', codeData.roleKey));
          if (rankSnap.exists()) {
            roleName = rankSnap.data().name;
          }
        } catch (e) {}

        toast.success(`تم تفعيل رتبة ${roleName} بنجاح!`);
        setCode('');
      } else if (codeData.type === 'balance') {
        const amount = Number(codeData.amount || 0);
        
        // Update user balance
        await updateDoc(doc(db, 'users', user.uid), {
          wallet_balance: (profile.wallet_balance || 0) + amount
        });

        // Update code status
        await updateDoc(doc(db, 'codes', codeDoc.id), {
          usedCount: (codeData.usedCount || 0) + 1,
          isActive: (codeData.usedCount || 0) + 1 < (codeData.maxUses || 1)
        });

        await addDoc(collection(db, 'wallet_transactions'), {
          userId: user.uid,
          amount: amount,
          type: 'recharge',
          status: 'completed',
          description: `شحن رصيد عبر كود: ${cleanCode}`,
          createdAt: serverTimestamp()
        });

        toast.success(`تم إضافة ${amount} ج.م إلى رصيدك بنجاح!`);
        setCode('');
      }
    } catch (error: any) {
      console.error("Activation error:", error);
      toast.error(error.message || 'حدث خطأ أثناء تفعيل الكود');
    }
    setLoading(false);
  };
  
  const handleDirectUpgrade = async (role: string, cost: number) => {
    if (!user || !profile) return;
    if (profile.role === role) {
      toast.error('أنت بالفعل تمتلك هذه الرتبة');
      return;
    }
    if ((profile.wallet_balance || 0) < cost) {
      toast.error(`رصيدك غير كافٍ. التكلفة: ${cost} ج.م`);
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: role,
        wallet_balance: profile.wallet_balance - cost,
        originalRole: profile.role === 'admin' ? profile.originalRole || 'buyer' : profile.role
      });
      
      await addDoc(collection(db, 'wallet_transactions'), {
        userId: user.uid,
        type: 'upgrade',
        amount: -cost,
        status: 'completed',
        details: `ترقية الحساب إلى ${role}`,
        createdAt: serverTimestamp()
      });

      toast.success(`تم ترقية حسابك إلى ${role} بنجاح!`);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الترقية');
    }
    setLoading(false);
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !referralInput) return;
    if (referralInput === profile.referralCode) {
      toast.error('لا يمكنك استخدام كود الإحالة الخاص بك');
      return;
    }
    if (profile.referredBy) {
      toast.error('لقد قمت بالفعل باستخدام كود إحالة');
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'public_users'), where('referralCode', '==', referralInput.toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error('كود الإحالة غير موجود');
        setLoading(false);
        return;
      }

      const referrerId = snap.docs[0].id;
      await updateDoc(doc(db, 'users', user.uid), {
        referredBy: referrerId
      });

      toast.success('تم تطبيق كود الإحالة بنجاح!');
      setReferralInput('');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تطبيق كود الإحالة');
    }
    setLoading(false);
  };

  const handleCopyReferral = () => {
    if (profile?.referralCode) {
      navigator.clipboard.writeText(profile.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('تم نسخ كود الإحالة');
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sticky top-24">
          <h2 className="font-bold text-lg mb-4 px-4">الإعدادات</h2>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('account')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'account' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <User className="w-5 h-5" /> الحساب
            </button>
            <button onClick={() => setActiveTab('language')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'language' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Globe className="w-5 h-5" /> اللغة
            </button>
            <button onClick={() => setActiveTab('ranks')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'ranks' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Key className="w-5 h-5" /> الرتب والأكواد
            </button>
            <button onClick={() => setActiveTab('notifications')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'notifications' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Bell className="w-5 h-5" /> الإشعارات
            </button>
            <button onClick={() => setActiveTab('referral')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'referral' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Share2 className="w-5 h-5" /> نظام الإحالة
            </button>
            <button onClick={() => setActiveTab('support')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'support' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <MessageSquare className="w-5 h-5" /> الدعم الفني
            </button>
            <button onClick={() => setActiveTab('app')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'app' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Smartphone className="w-5 h-5" /> تثبيت التطبيق
            </button>
          </nav>
        </div>
      </aside>

      <main className="flex-1">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 min-h-[500px]">
          
          {activeTab === 'account' && (
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-6">إعدادات الحساب</h3>
              <div className="flex items-center gap-6 mb-8 p-6 bg-gray-50 dark:bg-gray-750 rounded-2xl">
                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl font-bold overflow-hidden shrink-0">
                  {photoUrl ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-gray-500 text-sm mb-1">{profile.email}</p>
                  <p className="text-gray-500 text-sm mb-1 font-mono">ID: {profile.numericId || profile.userId}</p>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">{profile.wallet_balance?.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md font-semibold">{profile.role}</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-md font-semibold flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      {getLevelTitle(profile.points || 0)} ({profile.points || 0} نقطة)
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الاسم</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">رابط الصورة (اختياري)</label>
                  <input type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                </div>
                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                  <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" /> حفظ التعديلات
                  </button>
                </div>
              </form>

              <form onSubmit={handleChangePassword} className="space-y-4 mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-gray-500" />
                  تغيير كلمة المرور
                </h4>
                <div>
                  <input 
                    type="password" 
                    required 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    placeholder="أدخل كلمة المرور الجديدة" 
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/40">
                  تحديث كلمة المرور
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
                  {profile.role !== 'buyer' && (
                    <button type="button" onClick={handleExitRole} disabled={loading} className="px-6 py-3 bg-orange-100 text-orange-700 rounded-xl font-bold hover:bg-orange-200 flex items-center justify-center gap-2 w-full sm:w-auto">
                      <LogOut className="w-5 h-5" /> الخروج من الرتبة
                    </button>
                  )}
                  <button type="button" onClick={handleLogout} className="px-6 py-3 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 flex items-center justify-center gap-2 w-full sm:w-auto">
                    <LogOut className="w-5 h-5" /> تسجيل خروج
                  </button>
              </div>

            </div>
          )}

          {activeTab === 'language' && (
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-6">إعدادات اللغة</h3>
              <div className="space-y-4">
                <button 
                  onClick={() => handleSaveLanguage('ar')}
                  className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-colors ${language === 'ar' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                >
                  <span className="font-bold text-lg">العربية (RTL)</span>
                  {language === 'ar' && <div className="w-4 h-4 rounded-full bg-blue-600"></div>}
                </button>
                <button 
                  onClick={() => handleSaveLanguage('en')}
                  className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-colors ${language === 'en' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                >
                  <span className="font-bold text-lg">English (LTR)</span>
                  {language === 'en' && <div className="w-4 h-4 rounded-full bg-blue-600"></div>}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ranks' && (
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-6">الرتب والأكواد</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  أدخل كود التفعيل لترقية حسابك إلى رتبة أعلى (مثل VIP أو Premium).
                  <br />
                  إذا كان لديك كود الإدارة، يمكنك إدخاله هنا للحصول على صلاحيات لوحة التحكم.
                </p>
              </div>
              <form onSubmit={handleActivateCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">كود التفعيل</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="أدخل الكود هنا..."
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !code}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {loading ? 'جاري التفعيل...' : 'تفعيل الكود'}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-lg mb-4">ترقية مباشرة</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-5 h-5 text-yellow-600" />
                      <span className="font-bold">عميل VIP</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">بدون إعلانات، لقب مميز، هدايا شهرية.</p>
                    <button 
                      onClick={() => handleDirectUpgrade('vip_buyer', globalSettings.buyerVipPrice ?? 300)}
                      disabled={loading}
                      className="w-full py-2 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 transition-colors"
                    >
                      ترقية ({globalSettings.buyerVipPrice ?? 300} ج.م)
                    </button>
                  </div>
                  <div className="p-4 border border-blue-200 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-5 h-5 text-blue-600" />
                      <span className="font-bold">تاجر VIP</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">أول 1000 مشاهدة إعلان مجاناً، رسوم سحب أقل.</p>
                    <button 
                      onClick={() => handleDirectUpgrade('vip_merchant', globalSettings.merchantVipPrice ?? 500)}
                      disabled={loading}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                    >
                      ترقية ({globalSettings.merchantVipPrice ?? 500} ج.م)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-6">إعدادات الإشعارات</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750">
                  <div>
                    <p className="font-bold">تحديثات الطلبات</p>
                    <p className="text-sm text-gray-500">إشعارات عند تغيير حالة طلباتك</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifications.orders} 
                    onChange={e => handleSaveNotifications('orders', e.target.checked)} 
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                  />
                </label>
                <label className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750">
                  <div>
                    <p className="font-bold">طلبات الشحن</p>
                    <p className="text-sm text-gray-500">إشعارات عند قبول أو رفض الشحن</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifications.recharge} 
                    onChange={e => handleSaveNotifications('recharge', e.target.checked)} 
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                  />
                </label>
                <label className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750">
                  <div>
                    <p className="font-bold">التحويلات المالية</p>
                    <p className="text-sm text-gray-500">إشعارات عند استلام أو إرسال أموال</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifications.transfer} 
                    onChange={e => handleSaveNotifications('transfer', e.target.checked)} 
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                  />
                </label>
                <label className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750">
                  <div>
                    <p className="font-bold">تذاكر الدعم الفني</p>
                    <p className="text-sm text-gray-500">إشعارات عند الرد على تذاكرك</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifications.tickets} 
                    onChange={e => handleSaveNotifications('tickets', e.target.checked)} 
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'referral' && (
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-6">نظام الإحالة</h3>
              
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl text-white mb-8">
                <h4 className="font-bold text-lg mb-2">شارك واربح!</h4>
                <p className="text-blue-100 text-sm mb-6">شارك كود الإحالة الخاص بك مع أصدقائك واحصل على 10 نقاط عندما يشحنون ويشترون بأكثر من 100 ج.م.</p>
                
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-200 mb-1">كود الإحالة الخاص بك</p>
                    <p className="text-2xl font-mono font-bold">{profile.referralCode}</p>
                  </div>
                  <button 
                    onClick={handleCopyReferral}
                    className="p-3 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-colors"
                  >
                    {copied ? <CheckCircle className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                  </button>
                </div>
              </div>

              {!profile.referredBy ? (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h4 className="font-bold mb-4">هل لديك كود إحالة؟</h4>
                  <form onSubmit={handleApplyReferral} className="flex gap-2">
                    <input 
                      type="text" 
                      value={referralInput}
                      onChange={e => setReferralInput(e.target.value)}
                      placeholder="أدخل الكود هنا"
                      className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 uppercase"
                    />
                    <button 
                      type="submit"
                      disabled={loading || !referralInput}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                    >
                      تطبيق
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-800 dark:text-green-300">تم تفعيل كود الإحالة</p>
                    <p className="text-sm text-green-700 dark:text-green-400">أنت الآن جزء من نظام المكافآت.</p>
                  </div>
                </div>
              )}

              <div className="mt-8 space-y-4">
                <h4 className="font-bold text-lg">شروط المكافأة:</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                    يجب أن يشحن الصديق بأكثر من 100 ج.م.
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                    يجب أن يشتري الصديق منتجات بأكثر من 100 ج.م.
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                    تحصل على 10 نقاط فور اكتمال الشروط.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'app' && (
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-6">تثبيت التطبيق على الهاتف</h3>
              <div className="bg-blue-600 text-white p-8 rounded-3xl mb-8 relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-2xl font-bold mb-2">اجعل تجربتك أسرع!</h4>
                  <p className="opacity-90 mb-6">قم بتثبيت التطبيق على شاشة هاتفك الرئيسية للوصول السريع لمنتجاتك ومحفظتك في أي وقت.</p>
                  <button 
                    onClick={handleInstall}
                    className="bg-white text-blue-600 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg"
                  >
                    <Download className="w-5 h-5" /> تثبيت الآن
                  </button>
                </div>
                <Smartphone className="w-48 h-48 absolute -bottom-12 -right-12 opacity-10 rotate-12" />
              </div>

              <div className="space-y-6">
                <h4 className="font-bold text-lg">طريقة التثبيت اليدوي:</h4>
                <div className="space-y-4">
                  <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-750 rounded-2xl">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold shrink-0">1</div>
                    <p className="text-sm">اضغط على زر القائمة في متصفحك (ثلاث نقاط أو سهم المشاركة).</p>
                  </div>
                  <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-750 rounded-2xl">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold shrink-0">2</div>
                    <p className="text-sm">اختر "إضافة إلى الشاشة الرئيسية" أو "Add to Home Screen".</p>
                  </div>
                  <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-750 rounded-2xl">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold shrink-0">3</div>
                    <p className="text-sm">اضغط "إضافة" وسيظهر التطبيق بجانب تطبيقاتك الأخرى.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-6">الدعم الفني</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-600 text-white rounded-xl">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">هل تحتاج لمساعدة؟</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300">فريق الدعم الفني متواجد لمساعدتك في أي وقت.</p>
                  </div>
                </div>
                <Link 
                  to="/support" 
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                >
                  فتح تذكرة دعم جديدة <ArrowRight className="w-5 h-5" />
                </Link>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-lg px-2">الأسئلة الشائعة</h4>
                <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700">
                  <p className="font-bold mb-1">كيف يمكنني شحن رصيدي؟</p>
                  <p className="text-sm text-gray-500">يمكنك الشحن من خلال قسم "المحفظة" ثم اختيار "شحن الرصيد" واتباع التعليمات.</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700">
                  <p className="font-bold mb-1">ما هي مدة مراجعة طلبات الشحن؟</p>
                  <p className="text-sm text-gray-500">يتم مراجعة الطلبات عادةً خلال 5-30 دقيقة خلال ساعات العمل الرسمية.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
