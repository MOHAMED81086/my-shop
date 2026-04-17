import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shield, Users, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function RolesCenter() {
  const { profile } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const { t } = useTranslation();

  const predefinedRoles = [
    { id: 'admin', name: 'مدير النظام', permissions: ['manage_users', 'manage_orders', 'manage_wallet', 'manage_recharge', 'manage_transfers', 'manage_ranks', 'view_dashboard', 'block_users', 'manage_products', 'manage_settings'] },
    { id: 'merchant', name: 'تاجر', permissions: ['create_product', 'edit_product', 'delete_product', 'view_merchant_dashboard', 'manage_withdrawals'] },
    { id: 'vip_merchant', name: 'تاجر VIP', permissions: ['create_product', 'edit_product', 'delete_product', 'view_merchant_dashboard', 'manage_withdrawals', 'priority_support'] },
    { id: 'vip_buyer', name: 'عميل VIP', permissions: ['buy_products', 'create_tickets', 'no_ads', 'premium_badge'] },
    { id: 'support', name: 'دعم فني', permissions: ['manage_tickets', 'view_users'] },
    { id: 'buyer', name: 'مشتري', permissions: ['buy_products', 'create_tickets'] }
  ];

  useEffect(() => {
    if (profile?.role === 'admin') {
      const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubCodes = onSnapshot(collection(db, 'codes'), snap => {
        setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubRanks = onSnapshot(collection(db, 'ranks'), snap => {
        setRanks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => {
        unsubUsers();
        unsubCodes();
        unsubRanks();
      };
    }
  }, [profile]);

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500 font-bold">غير مصرح لك بالدخول</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Shield className="w-8 h-8 text-blue-600" />
        {t('roles_center')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...predefinedRoles, ...ranks.map(r => ({ ...r, permissions: ['create_product', 'edit_product', 'delete_product', 'view_merchant_dashboard', 'manage_withdrawals'] }))].map(role => {
          const roleUsers = users.filter(u => u.role === role.id);
          const roleCodes = codes.filter(c => c.roleKey === role.id);

          return (
            <div key={role.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{role.name}</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold font-mono">{role.id}</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Users className="w-5 h-5" />
                    <span>المستخدمين</span>
                  </div>
                  <span className="font-bold text-lg">{roleUsers.length}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Key className="w-5 h-5" />
                    <span>الأكواد النشطة</span>
                  </div>
                  <span className="font-bold text-lg">{roleCodes.filter(c => c.isActive).length}</span>
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-gray-500 mb-2">الصلاحيات:</h4>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map(perm => (
                      <span key={perm} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md text-xs">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
