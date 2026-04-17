import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingBag, Clock, CheckCircle, Truck, XCircle } from 'lucide-react';

export default function Orders() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  if (!user) return <div className="text-center py-12">يرجى تسجيل الدخول لعرض الطلبات</div>;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-orange-500" />;
      case 'confirmed': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'shipping': return <Truck className="w-5 h-5 text-purple-500" />;
      case 'delivered': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد المراجعة';
      case 'confirmed': return 'تم التأكيد';
      case 'shipping': return 'جاري الشحن';
      case 'delivered': return 'تم التوصيل';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <ShoppingBag className="w-8 h-8 text-blue-600" /> طلباتي
      </h2>

      <div className="space-y-6">
        {orders.map(order => (
          <div key={order.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-4 mb-4 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">رقم الطلب: <span className="font-mono text-gray-900 dark:text-gray-100">{order.id}</span></p>
                <p className="text-sm text-gray-500">{new Date(order.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {getStatusIcon(order.status)}
                <span className="font-semibold">{getStatusText(order.status)}</span>
              </div>
            </div>

            <div className="space-y-4">
              {order.products?.map((product: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {product.image ? <img src={product.image} alt={product.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">صورة</div>}
                    </div>
                    <div>
                      <p className="font-semibold">{product.title}</p>
                      <p className="text-sm text-gray-500">الكمية: {product.quantity}</p>
                    </div>
                  </div>
                  <p className="font-bold">{product.price.toLocaleString()} ج.م</p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <p className="font-medium text-gray-500">الإجمالي</p>
              <p className="text-2xl font-bold text-blue-600">{order.totalPrice?.toLocaleString()} ج.م</p>
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">لا توجد طلبات</h3>
            <p className="text-gray-500">لم تقم بإجراء أي طلبات حتى الآن.</p>
          </div>
        )}
      </div>
    </div>
  );
}
