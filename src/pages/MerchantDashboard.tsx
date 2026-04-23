import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, orderBy, updateDoc } from 'firebase/firestore';
import { db, uploadImage } from '../lib/firebase';
import { Package, Plus, Trash2, Wallet, ArrowUpRight, Clock, CheckCircle, XCircle, Megaphone, Play, Edit3, Check, Crown, BarChart3, Search, Filter, Layers } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

import toast from 'react-hot-toast';

export default function MerchantDashboard() {
  const { user, profile } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [deliveryType, setDeliveryType] = useState('code');
  const [codePool, setCodePool] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [downloadLink, setDownloadLink] = useState('');
  const [accountList, setAccountList] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawMethodId, setWithdrawMethodId] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>({ withdrawEnabled: true, withdrawFee: 0 });
  const [withdrawalMethods, setWithdrawalMethods] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'products' | 'withdrawals' | 'ads' | 'analytics'>('products');
  
  // Wholesale & Code Logic State
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [wholesaleMinQty, setWholesaleMinQty] = useState('');
  const [isDoubleCode, setIsDoubleCode] = useState(false);
  const [usageCount, setUsageCount] = useState('1');

  const [ads, setAds] = useState<any[]>([]);
  const [adType, setAdType] = useState('text');
  const [adContent, setAdContent] = useState('');
  const [adProductId, setAdProductId] = useState('');
  const [adViews, setAdViews] = useState('1000');
  const [adLoading, setAdLoading] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [tempStockValue, setTempStockValue] = useState<string>('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const isVIP = (profile?.points || 0) >= 10000 || profile?.role === 'vip_merchant' || profile?.role === 'admin';

  // Analytics Data
  const [salesData, setSalesData] = useState<any[]>([]);

  const handleUpgradeToVIP = async () => {
    if (!user || !profile) return;
    if (profile.role === 'vip_merchant') {
      toast.error('أنت بالفعل تاجر VIP');
      return;
    }
    
    const cost = globalSettings.merchantVipPrice ?? 500;
    
    if (profile.wallet_balance < cost) {
      toast.error(`رصيدك غير كافٍ للترقية (التكلفة ${cost} ج.م)`);
      return;
    }

    setUpgradeLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: 'vip_merchant',
        wallet_balance: profile.wallet_balance - cost,
        originalRole: profile.role === 'admin' ? profile.originalRole || 'merchant' : profile.role
      });
      
      await addDoc(collection(db, 'wallet_transactions'), {
        userId: user.uid,
        type: 'upgrade',
        amount: -cost,
        status: 'completed',
        details: 'ترقية الحساب إلى تاجر VIP',
        createdAt: serverTimestamp()
      });

      toast.success('مبروك! تم ترقية حسابك إلى تاجر VIP بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الترقية');
    }
    setUpgradeLoading(false);
  };

  useEffect(() => {
    // Load saved withdraw method
    const savedMethod = localStorage.getItem(`withdrawMethod_${user?.uid}`);
    const savedPhone = localStorage.getItem(`withdrawPhone_${user?.uid}`);
    if (savedMethod) setWithdrawMethodId(savedMethod);
    if (savedPhone) setWithdrawPhone(savedPhone);
  }, [user]);

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const isBaseMerchant = ['merchant', 'vip_merchant'].includes(profile?.role || '');
    
    const verifyAccess = async () => {
      if (isBaseMerchant) {
        setHasAccess(true);
        return;
      }
      if (!profile?.role) {
        setHasAccess(false);
        return;
      }
      const { getDoc } = await import('firebase/firestore');
      const rankSnap = await getDoc(doc(db, 'ranks', profile.role));
      setHasAccess(rankSnap.exists() && rankSnap.data()?.canSell === true);
    };

    verifyAccess();

    const isMerchantRole = isBaseMerchant;
    
    // Also check if it's a custom rank
    const checkCustomRank = async () => {
      if (!profile?.role) return false;
      const { getDoc } = await import('firebase/firestore');
      const rankSnap = await getDoc(doc(db, 'ranks', profile.role));
      return rankSnap.exists() && rankSnap.data()?.canSell === true;
    };

    const initDashboard = async () => {
      const isCustom = await checkCustomRank();
      if (user && (isMerchantRole || isCustom)) {
        const q = query(collection(db, 'products'), where('merchantId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qW = query(collection(db, 'withdrawal_requests'), where('merchantId', '==', user.uid), orderBy('createdAt', 'desc'));
        const unsubW = onSnapshot(qW, (snapshot) => {
          setWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qAds = query(collection(db, 'ads'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
        const unsubAds = onSnapshot(qAds, (snapshot) => {
          setAds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Fetch sales for analytics
        const qSales = query(collection(db, 'orders'), where('merchantId', '==', user.uid), orderBy('createdAt', 'desc'));
        const unsubSales = onSnapshot(qSales, (snapshot) => {
          const orders = snapshot.docs.map(doc => doc.data());
          // Group by date for chart
          const grouped = orders.reduce((acc: any, order: any) => {
            const date = new Date(order.createdAt?.toDate()).toLocaleDateString('ar-EG');
            acc[date] = (acc[date] || 0) + (order.totalPrice || 0);
            return acc;
          }, {});
          const chartData = Object.entries(grouped).map(([date, amount]) => ({ date, amount })).reverse();
          setSalesData(chartData);
        });

        const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), snap => {
          if (snap.exists()) setGlobalSettings(snap.data());
        });

        const unsubWM = onSnapshot(query(collection(db, 'withdrawal_methods'), where('isActive', '==', true)), snap => {
          setWithdrawalMethods(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qTrans = query(collection(db, 'wallet_transactions'), where('userId', '==', user.uid));
        const unsubTrans = onSnapshot(qTrans, (snapshot) => {
          const trans = snapshot.docs.map(doc => doc.data());
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          
          let locked = 0;
          trans.forEach(t => {
            if (t.type === 'profit' && t.createdAt) {
              const tDate = t.createdAt.toDate();
              if (tDate > sevenDaysAgo) {
                locked += Number(t.amount || 0);
              }
            }
          });
          setLockedBalance(locked);
        });

        return () => { unsubscribe(); unsubW(); unsubAds(); unsubSales(); unsubSettings(); unsubWM(); unsubTrans(); };
      }
    };

    const cleanup = initDashboard();
    return () => { cleanup.then(unsub => unsub?.()); };
  }, [user, profile]);

  const [lockedBalance, setLockedBalance] = useState<number>(0);
  const availableBalance = Math.max(0, (profile?.merchant_balance || 0) - lockedBalance);

  const [status, setStatus] = useState<'active' | 'draft'>('active');

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      let parsedCodePool: string[] = [];
      let parsedAccountList: any[] = [];

      if (deliveryType === 'code') {
        parsedCodePool = codePool.split('\n').map(c => c.trim()).filter(c => c !== '');
        if (parsedCodePool.length === 0) {
          toast.error('يرجى إضافة أكواد للمنتج');
          setLoading(false);
          return;
        }
        // If double code, ensure even number of codes
        if (isDoubleCode && parsedCodePool.length % 2 !== 0) {
          toast.error('في نظام الكود المزدوج، يجب إدخال عدد زوجي من الأكواد (كل كودين معاً)');
          setLoading(false);
          return;
        }
      } else if (deliveryType === 'account') {
        parsedAccountList = accountList.split('\n').map(line => {
          const [username, password] = line.split(':').map(s => s.trim());
          return { username, password };
        }).filter(a => a.username && a.password);
        if (parsedAccountList.length === 0) {
          toast.error('يرجى إضافة حسابات للمنتج (username:password)');
          setLoading(false);
          return;
        }
        // If double account, ensure even number of accounts
        if (isDoubleCode && parsedAccountList.length % 2 !== 0) {
          toast.error('في نظام التسليم المزدوج، يجب إدخال عدد زوجي من الحسابات (كل حسابين معاً)');
          setLoading(false);
          return;
        }
      } else if (deliveryType === 'file' && !fileUrl) {
        toast.error('يرجى إضافة رابط الملف');
        setLoading(false);
        return;
      } else if (deliveryType === 'link' && !downloadLink) {
        toast.error('يرجى إضافة رابط التحميل');
        setLoading(false);
        return;
      }

      let calculatedStock = Number(stock);
      if (deliveryType === 'code') {
        calculatedStock = isDoubleCode ? Math.floor(parsedCodePool.length / 2) : parsedCodePool.length;
      } else if (deliveryType === 'account') {
        calculatedStock = isDoubleCode ? Math.floor(parsedAccountList.length / 2) : parsedAccountList.length;
      } else if (deliveryType === 'file' || deliveryType === 'link') {
        calculatedStock = 999999; // Represent infinite stock
      }

      // Wholesale fields only apply to files and links
      const isDigitalContent = deliveryType === 'file' || deliveryType === 'link';
      
      const productData = {
        title,
        price: Number(price),
        stock: calculatedStock,
        description,
        category,
        deliveryType,
        codePool: parsedCodePool,
        fileUrl,
        downloadLink,
        accountList: parsedAccountList,
        maxDownloads: Number(maxDownloads) || 1,
        wholesalePrice: isDigitalContent && wholesalePrice ? Number(wholesalePrice) : null,
        wholesaleMinQty: isDigitalContent && wholesaleMinQty ? Number(wholesaleMinQty) : null,
        isDoubleCode,
        usageCount: Number(usageCount) || 1,
        images,
        isActive: status === 'active',
      };

      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), {
          ...productData,
          updatedAt: serverTimestamp()
        });
        toast.success('تم تعديل المنتج بنجاح');
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          merchantId: user.uid,
          ratingAverage: 0,
          createdAt: serverTimestamp()
        });
        toast.success('تم إضافة المنتج بنجاح');
      }
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحفظ');
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setPrice('');
    setStock('');
    setDescription('');
    setCategory('general');
    setCodePool('');
    setFileUrl('');
    setDownloadLink('');
    setAccountList('');
    setMaxDownloads('');
    setWholesalePrice('');
    setWholesaleMinQty('');
    setImages([]);
    setIsDoubleCode(false);
    setUsageCount('1');
    setStatus('active');
    setEditingProductId(null);
  };

  const handleUpdateStock = async (productId: string) => {
    if (isNaN(Number(tempStockValue))) {
      toast.error('يرجى إدخال رقم صحيح');
      return;
    }
    try {
      await updateDoc(doc(db, 'products', productId), {
        stock: Number(tempStockValue)
      });
      setEditingStockId(null);
      toast.success('تم تحديث المخزون');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء التحديث');
    }
  };

  const handleEdit = (product: any) => {
    setEditingProductId(product.id);
    setTitle(product.title);
    setPrice(product.price.toString());
    setStock(product.stock.toString());
    setDescription(product.description || '');
    setCategory(product.category || 'general');
    setDeliveryType(product.deliveryType || 'code');
    setCodePool(product.codePool ? product.codePool.join('\n') : '');
    setFileUrl(product.fileUrl || '');
    setDownloadLink(product.downloadLink || '');
    setAccountList(product.accountList ? product.accountList.map((a: any) => `${a.username}:${a.password}`).join('\n') : '');
    setMaxDownloads(product.maxDownloads ? product.maxDownloads.toString() : '');
    setWholesalePrice(product.wholesalePrice ? product.wholesalePrice.toString() : '');
    setWholesaleMinQty(product.wholesaleMinQty ? product.wholesaleMinQty.toString() : '');
    setIsDoubleCode(product.isDoubleCode || false);
    setUsageCount(product.usageCount ? product.usageCount.toString() : '1');
    setImages(product.images || []);
    setStatus(product.isActive === false ? 'draft' : 'active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    // Optimistic UI Update
    const previousProducts = [...products];
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('تم حذف المنتج');
    
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحذف. يرجى المحاولة مرة أخرى.');
      // Revert optimistic UI update
      setProducts(previousProducts);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (globalSettings.withdrawEnabled === false) {
      toast.error('🚫 السحب غير متاح حالياً');
      return;
    }

    if (!withdrawMethodId) {
      toast.error('الرجاء اختيار وسيلة السحب');
      return;
    }

    const amount = Number(withdrawAmount);
    if (amount < 1000) {
      toast.error('الحد الأدنى للسحب هو 1,000 ج.م');
      return;
    }
    if (amount > availableBalance) {
      toast.error('الرصيد المتاح للسحب غير كافٍ');
      return;
    }

    // Save to localStorage
    localStorage.setItem(`withdrawMethod_${user.uid}`, withdrawMethodId);
    localStorage.setItem(`withdrawPhone_${user.uid}`, withdrawPhone);

    setWithdrawLoading(true);
    try {
      const feePercent = globalSettings.withdrawFee ?? 0;
      const fee = (amount * feePercent) / 100;
      const finalAmount = amount - fee;

      const selectedMethod = withdrawalMethods.find(m => m.id === withdrawMethodId);

      await addDoc(collection(db, 'withdrawal_requests'), {
        merchantId: user.uid,
        amount,
        fee,
        finalAmount,
        phoneNumber: withdrawPhone,
        methodId: withdrawMethodId,
        methodName: selectedMethod?.name || 'غير معروف',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', user.uid), {
        merchant_balance: (profile.merchant_balance || 0) - amount
      });

      setWithdrawAmount('');
      toast.success('تم إرسال طلب السحب بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إرسال الطلب');
    }
    setWithdrawLoading(false);
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    const views = Number(adViews);
    if (views < 1000) {
      toast.error('الحد الأدنى 1000 مشاهدة');
      return;
    }

    const isVip = (profile.points || 0) >= 10000;
    const isFreeAd = isVip && !profile.hasUsedFreeAd;
    
    // Calculate cost: 50 EGP per 1000 views
    const cost = isFreeAd ? Math.max(0, ((views - 1000) / 1000) * 50) : (views / 1000) * 50;

    if (cost > 0 && (profile.wallet_balance || 0) < cost) {
      toast.error(`رصيد المحفظة غير كافٍ. تكلفة الإعلان: ${cost} ج.م`);
      return;
    }

    setAdLoading(true);
    try {
      await addDoc(collection(db, 'ads'), {
        type: adType,
        content: adContent,
        productId: adType === 'product' ? adProductId : null,
        views: views,
        viewsLeft: views,
        ownerId: user.uid,
        status: 'active',
        createdAt: serverTimestamp()
      });

      if (cost > 0) {
        await updateDoc(doc(db, 'users', user.uid), {
          wallet_balance: profile.wallet_balance - cost
        });
      }

      if (isFreeAd) {
        await updateDoc(doc(db, 'users', user.uid), {
          hasUsedFreeAd: true
        });
      }

      toast.success('تم إنشاء الإعلان بنجاح');
      setAdContent('');
      setAdProductId('');
      setAdViews('1000');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إنشاء الإعلان');
    }
    setAdLoading(false);
  };

  if (hasAccess === null) return <div className="text-center py-12">جاري التحقق من الصلاحيات...</div>;
  if (!hasAccess) {
    return <div className="text-center py-12">غير مصرح لك بالدخول. هذه الصفحة للتجار فقط.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold flex items-center gap-2"><Package className="w-8 h-8 text-blue-600" /> لوحة التاجر</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">المنتجات</p>
              <p className="text-2xl font-bold">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">رصيد الأرباح الكلي</p>
              <p className="text-2xl font-bold">{profile?.merchant_balance?.toLocaleString() || 0} ج.م</p>
              <div className="mt-1 flex gap-2 text-xs">
                 <span className="text-green-500 font-bold">متاح: {availableBalance.toLocaleString()} ج.م</span>
                 <span className="text-orange-500">معلق: {lockedBalance.toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">الإعلانات</p>
              <p className="text-2xl font-bold">{ads.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${isVIP ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">حالة VIP</p>
                <p className={`text-lg font-bold ${isVIP ? 'text-yellow-600' : 'text-gray-400'}`}>
                  {isVIP ? 'تاجر VIP' : 'تاجر عادي'}
                </p>
              </div>
            </div>
            {!isVIP && (
              <button 
                onClick={handleUpgradeToVIP}
                disabled={upgradeLoading}
                className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
              >
                {upgradeLoading ? '...' : 'ترقية'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
        <button onClick={() => setActiveTab('products')} className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === 'products' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>إدارة المنتجات</button>
        <button onClick={() => setActiveTab('withdrawals')} className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === 'withdrawals' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>سحب الأرباح</button>
        <button onClick={() => setActiveTab('ads')} className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === 'ads' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>الإعلانات</button>
        <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === 'analytics' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>التحليلات</button>
      </div>

      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5" /> {editingProductId ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم المنتج</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">السعر (ج.م)</label>
                <input type="number" required min="1" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
              </div>
              {(deliveryType === 'file' || deliveryType === 'link') && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">الكمية المتاحة (المخزون)</label>
                    <input type="number" required min="1" value={stock} onChange={e => setStock(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">سعر الجملة (اختياري)</label>
                      <input type="number" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" placeholder="السعر عند شراء كمية" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">أقل كمية للجملة</label>
                      <input type="number" value={wholesaleMinQty} onChange={e => setWholesaleMinQty(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" placeholder="مثلاً: 10" />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">القسم (Category)</label>
                <input type="text" required value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" placeholder="مثال: ألعاب، بطاقات، حسابات..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع التسليم</label>
                <select value={deliveryType} onChange={e => setDeliveryType(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                  <option value="code">أكواد</option>
                  <option value="file">ملف</option>
                  <option value="link">رابط</option>
                  <option value="account">حسابات</option>
                </select>
              </div>

              {deliveryType === 'code' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">الأكواد (كل كود في سطر)</label>
                    <textarea required value={codePool} onChange={e => setCodePool(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 h-24" placeholder="CODE1&#10;CODE2"></textarea>
                  </div>
                  <div className="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isDoubleCode} onChange={e => setIsDoubleCode(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                      <span className="text-sm font-medium">بيع كود مزدوج (كودين معاً)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">عدد مرات الاستخدام:</span>
                      <input type="number" min="1" value={usageCount} onChange={e => setUsageCount(e.target.value)} className="w-16 p-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                    </div>
                  </div>
                </div>
              )}

              {deliveryType === 'file' && (
                <div>
                  <label className="block text-sm font-medium mb-1">رابط الملف</label>
                  <input type="url" required value={fileUrl} onChange={e => setFileUrl(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                </div>
              )}

              {deliveryType === 'link' && (
                <div>
                  <label className="block text-sm font-medium mb-1">الرابط</label>
                  <input type="url" required value={downloadLink} onChange={e => setDownloadLink(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                </div>
              )}

              {deliveryType === 'account' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">الحسابات (username:password في كل سطر)</label>
                    <textarea required value={accountList} onChange={e => setAccountList(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 h-24" placeholder="user1:pass1&#10;user2:pass2"></textarea>
                  </div>
                  <div className="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isDoubleCode} onChange={e => setIsDoubleCode(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                      <span className="text-sm font-medium">بيع حساب مزدوج (حسابين معاً)</span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">صور المنتج</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []) as File[];
                    if (files.length === 0) return;
                    
                    setUploadingImage(true);
                    const uploadPromises = files.map(file => {
                      return new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 800;
                            const MAX_HEIGHT = 800;
                            let width = img.width;
                            let height = img.height;

                            if (width > height) {
                              if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                            } else {
                              if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, width, height);
                            
                            canvas.toBlob(async (blob) => {
                              if (!blob) {
                                reject(new Error("Failed to create blob"));
                                return;
                              }
                              try {
                                const path = `products/${Date.now()}_${file.name}`;
                                const url = await uploadImage(blob, path);
                                resolve(url);
                              } catch (err) {
                                reject(err);
                              }
                            }, 'image/jpeg', 0.8);
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      });
                    });

                    Promise.all(uploadPromises)
                      .then(urls => {
                        setImages(prev => [...prev, ...urls]);
                        toast.success('تم رفع الصور بنجاح');
                      })
                      .catch(err => {
                        console.error(err);
                        toast.error('فشل رفع الصور');
                      })
                      .finally(() => {
                        setUploadingImage(false);
                      });
                  }} 
                  className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" 
                />
                {uploadingImage && <p className="text-xs text-blue-500 mt-1 animate-pulse">جاري رفع الصور...</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16">
                      <img src={img} alt="" className="w-full h-full object-cover rounded-lg border dark:border-gray-600" />
                      <button 
                        type="button" 
                        onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">الوصف</label>
                <textarea required value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 h-24"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">حالة المنتج</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                >
                  <option value="active">نشط (يظهر للجميع)</option>
                  <option value="draft">مسودة (حفظ فقط)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                  {loading ? 'جاري الحفظ...' : (editingProductId ? 'حفظ التعديلات' : 'إضافة المنتج')}
                </button>
                {editingProductId && (
                  <button type="button" onClick={resetForm} className="py-3 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                    إلغاء
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ArrowUpRight className="w-5 h-5" /> سحب الأرباح</h3>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ (ج.م)</label>
                <input type="number" required min="100" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                {globalSettings.withdrawFee > 0 && <p className="text-xs text-gray-500 mt-1">سيتم خصم {globalSettings.withdrawFee}% رسوم سحب</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">وسيلة السحب</label>
                <select required value={withdrawMethodId} onChange={e => setWithdrawMethodId(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                  <option value="">اختر وسيلة السحب</option>
                  {withdrawalMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رقم الحساب / المحفظة</label>
                <input type="text" required value={withdrawPhone} onChange={e => setWithdrawPhone(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
              </div>
              <button type="submit" disabled={withdrawLoading} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                {withdrawLoading ? 'جاري الإرسال...' : 'طلب سحب'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div>
            <h3 className="text-xl font-bold mb-4">منتجاتي ({products.length})</h3>
            <div className="space-y-4">
              {products.map(product => (
                <div key={product.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      {product.title}
                      {product.stock < 5 && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full animate-pulse">مخزون منخفض!</span>
                      )}
                    </h4>
                    <p className="text-blue-600 font-semibold">
                      {product.price.toLocaleString()} ج.م
                      {product.wholesalePrice && (
                        <span className="text-xs text-gray-500 mr-2">(جملة: {product.wholesalePrice} ج.م من {product.wholesaleMinQty} قطع)</span>
                      )}
                    </p>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <span>المخزون:</span>
                      {editingStockId === product.id ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            value={tempStockValue} 
                            onChange={e => setTempStockValue(e.target.value)}
                            className="w-16 p-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateStock(product.id)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingStockId(null)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            { (product.deliveryType === 'file' || product.deliveryType === 'link') ? '∞' : product.stock }
                          </span>
                          { (product.deliveryType !== 'code' && product.deliveryType !== 'account' && product.deliveryType !== 'file' && product.deliveryType !== 'link') && (
                            <button 
                              onClick={() => {
                                setEditingStockId(product.id);
                                setTempStockValue(product.stock.toString());
                              }}
                              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                              title="تحديث المخزون"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      <span className="mx-1">|</span>
                      <span>النوع: {product.deliveryType}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(product)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                      تعديل
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {products.length === 0 && <p className="text-gray-500 text-center py-8">لم تقم بإضافة أي منتجات بعد.</p>}
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-24">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ArrowUpRight className="w-5 h-5" /> طلب سحب أرباح</h3>
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">المبلغ (ج.م)</label>
                  <input type="number" required min="1000" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" placeholder="الحد الأدنى 1000" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">وسيلة السحب</label>
                  <select required value={withdrawMethodId} onChange={e => setWithdrawMethodId(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                    <option value="">اختر وسيلة السحب</option>
                    {withdrawalMethods.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">رقم الحساب / المحفظة</label>
                  <input type="text" required value={withdrawPhone} onChange={e => setWithdrawPhone(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" placeholder="010..." />
                </div>
                <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                  <p>سيتم خصم {globalSettings.withdrawFee ?? 0}% رسوم تحويل.</p>
                  {withdrawAmount && Number(withdrawAmount) >= 1000 && (
                    <p className="mt-1 font-bold text-gray-700 dark:text-gray-300">
                      الصافي: {(Number(withdrawAmount) * (1 - (globalSettings.withdrawFee ?? 0) / 100)).toFixed(2)} ج.م
                    </p>
                  )}
                </div>
                <button type="submit" disabled={withdrawLoading} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                  {withdrawLoading ? 'جاري الإرسال...' : 'طلب سحب'}
                </button>
              </form>
            </div>
          </div>
          <div className="lg:col-span-2">
            <h3 className="text-xl font-bold mb-4">سجل السحوبات</h3>
            <div className="space-y-4">
              {withdrawals.map(w => (
                <div key={w.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">{w.amount} ج.م</p>
                    <p className="text-sm text-gray-500">الرسوم: {w.fee} ج.م | الصافي: {w.finalAmount} ج.م</p>
                    <p className="text-xs text-gray-400">{new Date(w.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.status === 'pending' && <span className="flex items-center gap-1 text-orange-500 bg-orange-50 px-2 py-1 rounded-md text-sm"><Clock className="w-4 h-4"/> قيد المراجعة</span>}
                    {w.status === 'approved' && <span className="flex items-center gap-1 text-green-500 bg-green-50 px-2 py-1 rounded-md text-sm"><CheckCircle className="w-4 h-4"/> مقبول</span>}
                    {w.status === 'rejected' && <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-1 rounded-md text-sm"><XCircle className="w-4 h-4"/> مرفوض</span>}
                  </div>
                </div>
              ))}
              {withdrawals.length === 0 && <p className="text-gray-500 text-center py-8">لا توجد طلبات سحب.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ads' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-24">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Megaphone className="w-5 h-5" /> إنشاء إعلان جديد</h3>
              <form onSubmit={handleCreateAd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">نوع الإعلان</label>
                  <select value={adType} onChange={e => setAdType(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                    <option value="text">نصي</option>
                    <option value="image">صورة</option>
                    <option value="video">فيديو</option>
                    <option value="product">منتج</option>
                  </select>
                </div>
                
                {adType === 'product' ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">اختر المنتج</label>
                    <select required value={adProductId} onChange={e => setAdProductId(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                      <option value="">اختر منتجاً...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {adType === 'text' ? 'نص الإعلان' : adType === 'image' ? 'رابط الصورة' : 'رابط الفيديو'}
                    </label>
                    {adType === 'text' ? (
                      <textarea required value={adContent} onChange={e => setAdContent(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 h-24"></textarea>
                    ) : (
                      <input type="url" required value={adContent} onChange={e => setAdContent(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" placeholder="https://..." />
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">عدد المشاهدات (الحد الأدنى 1000)</label>
                  <input type="number" required min="1000" step="1000" value={adViews} onChange={e => setAdViews(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                </div>

                <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                  <p>التكلفة: 50 ج.م لكل 1000 مشاهدة</p>
                  {(isVIP && !profile?.hasUsedFreeAd) && (
                    <p className="text-green-600 font-bold mt-1">أنت VIP! أول 1000 مشاهدة مجاناً لك.</p>
                  )}
                  <p className="mt-1 font-bold text-gray-700 dark:text-gray-300">
                    الإجمالي: {
                      (isVIP && !profile?.hasUsedFreeAd) 
                        ? Math.max(0, ((Number(adViews) - 1000) / 1000) * 50) 
                        : (Number(adViews) / 1000) * 50
                    } ج.م
                  </p>
                </div>

                <button type="submit" disabled={adLoading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                  {adLoading ? 'جاري الإنشاء...' : 'إنشاء إعلان'}
                </button>
              </form>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <h3 className="text-xl font-bold mb-4">إعلاناتي</h3>
            <div className="space-y-4">
              {ads.map(ad => (
                <div key={ad.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">
                        {ad.type === 'text' ? 'نصي' : ad.type === 'image' ? 'صورة' : ad.type === 'video' ? 'فيديو' : 'منتج'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-md ${ad.status === 'active' ? 'bg-green-100 text-green-700' : ad.status === 'finished' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                        {ad.status === 'active' ? 'نشط' : ad.status === 'finished' ? 'منتهي' : 'متوقف'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">المشاهدات المتبقية: {ad.viewsLeft} من {ad.views}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(ad.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                  </div>
                </div>
              ))}
              {ads.length === 0 && <p className="text-gray-500 text-center py-8">لم تقم بإنشاء أي إعلانات بعد.</p>}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-blue-600" /> تحليل المبيعات والأرباح</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value} ج.م`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h4 className="font-bold mb-4">أكثر المنتجات مبيعاً</h4>
              <div className="space-y-4">
                {products.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold">{i+1}</span>
                      <span className="text-sm font-medium">{p.title}</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600">{p.salesCount || 0} مبيعة</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h4 className="font-bold mb-4">تنبيهات المخزون</h4>
              <div className="space-y-4">
                {products.filter(p => p.stock < 10).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                    <span className="text-sm font-medium">{p.title}</span>
                    <span className={`text-xs font-bold ${p.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {p.stock === 0 ? 'نفذ المخزون' : `متبقي ${p.stock} فقط`}
                    </span>
                  </div>
                ))}
                {products.filter(p => p.stock < 10).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">المخزون سليم لجميع المنتجات.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
