import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, updateDoc, doc, increment, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowDownRight, ArrowUpRight, Plus, Send, Clock, CheckCircle, XCircle, Award } from 'lucide-react';

import { Link } from 'react-router-dom';
import { getLevelTitle } from '../lib/utils';

export default function Wallet() {
  const { user, profile } = useAuthStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'transfer'>('history');

  // Transfer state
  const [transferUserId, setTransferUserId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>({ rechargeEnabled: true });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'wallet_transactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), snap => {
      if (snap.exists()) setGlobalSettings(snap.data());
    });
    return () => { unsubscribe(); unsubSettings(); };
  }, [user]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const amount = Number(transferAmount);
    if (amount <= 0 || amount > profile.wallet_balance) {
      toast.error('رصيد غير كافٍ أو مبلغ غير صالح');
      return;
    }
    if (transferUserId === user.uid) {
      toast.error('لا يمكنك التحويل لنفسك');
      return;
    }
    setTransferLoading(true);
    try {
      const { getDoc } = await import('firebase/firestore');
      // Verify user exists
      const targetUserRef = doc(db, 'users', transferUserId);
      const targetUserSnap = await getDoc(targetUserRef);
      if (!targetUserSnap.exists()) {
        toast.error('المستخدم غير موجود');
        setTransferLoading(false);
        return;
      }

      // Deduct from sender immediately to hold funds
      const senderRef = doc(db, 'users', user.uid);
      await updateDoc(senderRef, {
        wallet_balance: increment(-amount)
      });

      const targetUserData = targetUserSnap.data();

      // Log transaction for sender as pending
      await addDoc(collection(db, 'wallet_transactions'), {
        userId: user.uid,
        type: 'transfer',
        amount: -amount,
        status: 'pending',
        referenceId: transferUserId,
        details: `طلب تحويل إلى ${targetUserData.name || transferUserId}`,
        createdAt: serverTimestamp(),
      });

      // Notify admin
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        message: `طلب تحويل جديد بقيمة ${amount} ج.م من ${profile.name}`,
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success('تم إرسال طلب التحويل بنجاح، في انتظار موافقة الإدارة.');
      setTransferAmount('');
      setTransferUserId('');
      setActiveTab('history');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء طلب التحويل');
    }
    setTransferLoading(false);
  };

  if (!user) return <div className="text-center py-12">يرجى تسجيل الدخول لعرض المحفظة</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white mb-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-lg opacity-90 mb-2">الرصيد المتاح</h2>
            <div className="text-5xl font-bold mb-6">{profile?.wallet_balance?.toLocaleString('en-US')} <span className="text-2xl font-normal">ج.م</span></div>
            
            <div className="flex gap-4">
              <Link to="/recharge" className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${globalSettings.rechargeEnabled ? 'bg-blue-700/50 hover:bg-blue-700' : 'bg-gray-500/50 cursor-not-allowed'}`}>
                <Plus className="w-5 h-5" /> شحن الرصيد
              </Link>
              <button onClick={() => setActiveTab('transfer')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'transfer' ? 'bg-white text-blue-700' : 'bg-blue-700/50 hover:bg-blue-700'}`}>
                <Send className="w-5 h-5" /> تحويل أموال
              </button>
            </div>
          </div>
          <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20 text-center min-w-[200px]">
            <Award className="w-12 h-12 mx-auto mb-2 text-yellow-400" />
            <h3 className="text-xl font-bold mb-1">{getLevelTitle(profile?.points || 0)}</h3>
            <p className="text-blue-200">{profile?.points || 0} نقطة</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        {activeTab === 'history' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">سجل المعاملات</h3>
              <Link to="/recharge" className="text-blue-600 font-bold flex items-center gap-1 hover:underline">
                <Plus className="w-4 h-4" /> شحن الرصيد
              </Link>
            </div>
            <div className="space-y-4">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${tx.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.amount > 0 ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="font-semibold">{tx.type === 'recharge' ? 'شحن رصيد' : tx.type === 'transfer' ? 'تحويل أموال' : 'مشتريات'}</p>
                      <p className="text-sm text-gray-500">{new Date(tx.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-lg ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('en-US')} ج.م
                    </p>
                    <div className="flex items-center gap-1 justify-end text-sm mt-1">
                      {tx.status === 'completed' && <><CheckCircle className="w-4 h-4 text-green-500"/> <span className="text-green-500">مكتمل</span></>}
                      {tx.status === 'pending' && <><Clock className="w-4 h-4 text-orange-500"/> <span className="text-orange-500">قيد المراجعة</span></>}
                      {tx.status === 'rejected' && <><XCircle className="w-4 h-4 text-red-500"/> <span className="text-red-500">مرفوض</span></>}
                    </div>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-center text-gray-500 py-8">لا توجد معاملات سابقة</p>}
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-bold mb-4">تحويل أموال لمستخدم آخر</h3>
            {globalSettings.transferFee > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl mb-6 text-sm text-orange-800 dark:text-orange-200 flex justify-between items-center">
                <p>يتم خصم رسوم {globalSettings.transferFee}% على مبلغ التحويل للمستلم.</p>
                <Link to="/recharge" className="flex items-center gap-1 text-blue-600 font-bold hover:underline">
                  <Plus className="w-4 h-4" /> شحن الرصيد
                </Link>
              </div>
            )}
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">معرف المستخدم المستلم (User ID)</label>
                <input type="text" required value={transferUserId} onChange={e => setTransferUserId(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ (ج.م)</label>
                <input type="number" required min="1" max={profile?.wallet_balance} value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
              </div>
              <button type="submit" disabled={transferLoading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
                {transferLoading ? 'جاري التحويل...' : 'تأكيد التحويل'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
