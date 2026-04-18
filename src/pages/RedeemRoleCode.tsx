import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { doc, updateDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Key, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function RedeemRoleCode() {
  const { user, profile } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleActivateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!user || !cleanCode) return;
    
    if (!profile) {
      toast.error('جاري تحميل بيانات ملفك الشخصي، يرجى الانتظار للحظة...');
      return;
    }

    setLoading(true);
    try {
      // Check for master code via Firestore or hardcoded fallback
      const { getDoc } = await import('firebase/firestore');
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
      if (codeData.targetUserId && codeData.targetUserId !== profile.numericId && codeData.targetUserId !== user.uid) {
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

        // If giving admin role via admin code
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
        navigate('/');
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
        navigate('/wallet');
      }
    } catch (error: any) {
      console.error("Activation error:", error);
      toast.error(error.message || 'حدث خطأ أثناء تفعيل الكود');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Key className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{t('redeem_code')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">أدخل كود الترقية الخاص بك للحصول على صلاحيات جديدة</p>

        <form onSubmit={handleActivateCode} className="space-y-4">
          <div>
            <input 
              type="text" 
              required 
              value={code} 
              onChange={e => setCode(e.target.value)} 
              placeholder={t('enter_code')}
              className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 font-mono text-center text-xl tracking-widest uppercase" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !code} 
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            <ShieldCheck className="w-5 h-5" /> {t('activate')}
          </button>
        </form>
      </div>
    </div>
  );
}
