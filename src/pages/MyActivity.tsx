import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Package, CreditCard, Send, ChevronDown, ChevronUp } from 'lucide-react';

export default function MyActivity() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [recharges, setRecharges] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubOrders = onSnapshot(query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')), snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRecharges = onSnapshot(query(collection(db, 'recharge_requests'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')), snap => {
      setRecharges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubTransfers = onSnapshot(query(collection(db, 'wallet_transactions'), where('userId', '==', user.uid), where('type', '==', 'transfer'), orderBy('createdAt', 'desc')), snap => {
      setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubOrders(); unsubRecharges(); unsubTransfers(); };
  }, [user]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">سجل النشاطات</h1>

      <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-colors ${activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'}`}
        >
          <Package className="w-5 h-5" /> الطلبات
        </button>
        <button 
          onClick={() => setActiveTab('recharges')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-colors ${activeTab === 'recharges' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'}`}
        >
          <CreditCard className="w-5 h-5" /> الشحن
        </button>
        <button 
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-colors ${activeTab === 'transfers' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'}`}
        >
          <Send className="w-5 h-5" /> التحويلات
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === 'orders' && (
          orders.length > 0 ? orders.map(order => (
            <div key={order.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                onClick={() => toggleExpand(order.id)}
              >
                <div>
                  <p className="font-bold text-lg">طلب #{order.id}</p>
                  <p className="text-sm text-gray-500">{new Date(order.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    order.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    order.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                    order.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {order.status === 'completed' ? 'مكتمل' : 
                     order.status === 'rejected' ? 'مرفوض' : 
                     order.status === 'approved' ? 'مقبول' : 'قيد المراجعة'}
                  </span>
                  <p className="font-bold text-blue-600">{order.totalPrice} ج.م</p>
                  {expandedId === order.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>
              {expandedId === order.id && (
                <div className="p-4 bg-gray-50 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold mb-2">المنتجات:</h4>
                  <ul className="space-y-2 mb-4">
                    {order.products?.map((p: any, idx: number) => (
                      <li key={idx} className="flex justify-between text-sm">
                        <span>{p.title} (x{p.quantity})</span>
                        <span className="font-bold">{p.price * p.quantity} ج.م</span>
                      </li>
                    ))}
                  </ul>
                  
                  {order.deliveredItems && order.deliveredItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <h4 className="font-bold mb-3 text-green-600 flex items-center gap-2"><Package className="w-5 h-5"/> المنتجات المسلمة:</h4>
                      <div className="space-y-4">
                        {order.deliveredItems.map((di: any, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="font-bold text-sm mb-2">{di.title}</p>
                            {di.deliveryType === 'code' && (
                              <div className="space-y-1">
                                {di.items.map((code: string, i: number) => (
                                  <div key={i} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono">
                                    <span>{code}</span>
                                    <button onClick={() => navigator.clipboard.writeText(code)} className="text-blue-600 hover:text-blue-800 text-xs font-bold">نسخ</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {di.deliveryType === 'account' && (
                              <div className="space-y-2">
                                {di.items.map((acc: any, i: number) => (
                                  <div key={i} className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono">
                                    <p>User: <span className="font-bold">{acc.username}</span></p>
                                    <p>Pass: <span className="font-bold">{acc.password}</span></p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {di.deliveryType === 'file' && (
                              <div className="space-y-1">
                                {di.items.map((url: string, i: number) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-bold">
                                    تحميل الملف
                                  </a>
                                ))}
                              </div>
                            )}
                            {di.deliveryType === 'link' && (
                              <div className="space-y-1">
                                {di.items.map((link: string, i: number) => (
                                  <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-bold">
                                    الذهاب للرابط
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )) : <p className="text-gray-500 text-center py-8">لا توجد طلبات</p>
        )}

        {activeTab === 'recharges' && (
          recharges.length > 0 ? recharges.map(req => (
            <div key={req.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                onClick={() => toggleExpand(req.id)}
              >
                <div>
                  <p className="font-bold text-lg">شحن رصيد</p>
                  <p className="text-sm text-gray-500">{new Date(req.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    req.status === 'approved' ? 'bg-green-100 text-green-700' : 
                    req.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {req.status === 'approved' ? 'مقبول' : 
                     req.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                  </span>
                  <p className="font-bold text-blue-600">{req.amount} ج.م</p>
                  {expandedId === req.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>
              {expandedId === req.id && (
                <div className="p-4 bg-gray-50 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700 text-sm">
                  <p><span className="text-gray-500">رقم العملية:</span> <span className="font-mono">{req.transactionId}</span></p>
                  {req.paymentProofImage && req.paymentProofImage !== 'https://via.placeholder.com/150' && (
                    <div className="mt-2">
                      <p className="text-gray-500 mb-1">إثبات الدفع:</p>
                      <img src={req.paymentProofImage} alt="Proof" className="h-32 object-contain rounded-lg border border-gray-200" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )) : <p className="text-gray-500 text-center py-8">لا توجد طلبات شحن</p>
        )}

        {activeTab === 'transfers' && (
          transfers.length > 0 ? transfers.map(tx => (
            <div key={tx.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                onClick={() => toggleExpand(tx.id)}
              >
                <div>
                  <p className="font-bold text-lg">تحويل رصيد</p>
                  <p className="text-sm text-gray-500">{new Date(tx.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    tx.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    tx.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {tx.status === 'completed' ? 'مكتمل' : 
                     tx.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                  </span>
                  <p className="font-bold text-orange-600">{Math.abs(tx.amount)} ج.م</p>
                  {expandedId === tx.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>
              {expandedId === tx.id && (
                <div className="p-4 bg-gray-50 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700 text-sm">
                  <p><span className="text-gray-500">إلى المستخدم:</span> <span className="font-mono">{tx.referenceId}</span></p>
                </div>
              )}
            </div>
          )) : <p className="text-gray-500 text-center py-8">لا توجد تحويلات</p>
        )}
      </div>
    </div>
  );
}
