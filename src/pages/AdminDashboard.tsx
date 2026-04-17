import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { doc, updateDoc, collection, query, onSnapshot, orderBy, where, addDoc, serverTimestamp, getDocs, deleteDoc, setDoc, increment } from 'firebase/firestore';
import { db, uploadImage } from '../lib/firebase';
import { Key, Users, CreditCard, Package, Shield, LayoutDashboard, Send, MessageSquare, Activity, BarChart3, DollarSign, ShoppingBag, Settings, Image as ImageIcon, Plus, Trash2, Edit, Archive, X, AlertTriangle, ShieldCheck, Wallet, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { approveBuyerForMerchant } from '../lib/fraud';

export default function AdminDashboard() {
  const { user, profile } = useAuthStore();
  const [masterCode, setMasterCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Stats
  const [users, setUsers] = useState<any[]>([]);
  const [recharges, setRecharges] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [shippingMethods, setShippingMethods] = useState<any[]>([]);
  const [withdrawMethods, setWithdrawMethods] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>({ 
    rechargeEnabled: true, 
    withdrawEnabled: true,
    rechargeFee: 2,
    transferFee: 1,
    withdrawFee: 0,
    purchaseFee: 0,
    buyerVipPrice: 100,
    merchantVipPrice: 150,
    adPrice: 50
  });

  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');

  const moneyStats = React.useMemo(() => {
    let buyersTotal = 0;
    let merchantsTotal = 0;

    users.forEach(u => {
      if (u.role === 'buyer' || u.role === 'vip_buyer') {
        buyersTotal += (u.wallet_balance || 0);
      }
      if (u.role === 'merchant' || u.role === 'vip_merchant') {
        merchantsTotal += (u.merchant_balance || 0);
      }
    });

    return {
      buyersTotal,
      merchantsTotal,
      total: buyersTotal + merchantsTotal
    };
  }, [users]);
  const [analyticsData, setAnalyticsData] = useState<any>({ topProducts: [], activeUsers: 0, totalProfit: 0 });
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const cleanupOldRecords = async () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const collectionsToCleanup = [
        { path: 'recharge_requests', threshold: sevenDaysAgo },
        { path: 'withdrawal_requests', threshold: sevenDaysAgo },
        { path: 'tickets', threshold: thirtyDaysAgo },
        { path: 'wallet_transactions', threshold: thirtyDaysAgo, typeFilter: 'transfer' }
      ];

      for (const item of collectionsToCleanup) {
        try {
          // Use a simple query on createdAt to avoid needing composite indexes
          const q = query(collection(db, item.path), where('createdAt', '<', item.threshold));
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            for (const docRef of snap.docs) {
              const data = docRef.data();
              // If there's a type filter (like for transfers), check it in memory
              if (item.typeFilter && data.type !== item.typeFilter) continue;
              
              await deleteDoc(docRef.ref);
            }
          }
        } catch (error) {
          console.error(`Error cleaning up ${item.path}:`, error);
        }
      }
    };

    cleanupOldRecords();
  }, [profile?.role]);

  // Ticket reply state
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState('');

  const predefinedRoles = [
    { id: 'buyer', name: 'Buyer' },
    { id: 'merchant', name: 'Merchant' },
    { id: 'vip_buyer', name: 'VIP Buyer' },
    { id: 'vip_merchant', name: 'VIP Merchant' },
    { id: 'support', name: 'Support' }
  ];

  // Product creation/edit state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [orderFilter, setOrderFilter] = useState('all');
  const [rechargeFilter, setRechargeFilter] = useState('all');
  const [productForm, setProductForm] = useState({
    title: '',
    description: '',
    price: 0,
    stock: 0,
    images: [] as string[],
    category: 'general',
    isActive: true,
    deliveryType: 'manual',
    isDoubleCode: false,
    codePool: '',
    accountList: '',
    fileUrl: '',
    downloadLink: '',
    wholesalePrice: 0,
    wholesaleMinQty: 0
  });

  // Code creation state
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeForm, setCodeForm] = useState({
    code: '',
    type: 'role',
    roleKey: '',
    durationHours: 24,
    maxUses: 1,
    targetUserId: ''
  });

  // Events state
  const [showEventModal, setShowEventModal] = useState(false);
  const getInitialEventDate = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };
  
  const [eventForm, setEventForm] = useState({
    name: '',
    description: '',
    startDate: getInitialEventDate(),
    durationDays: 1,
    prizeDescription: '',
    reward1: 100,
    reward2: 50,
    reward3: 20
  });

  // Rank creation state
  const [showRankModal, setShowRankModal] = useState(false);
  const [editingRank, setEditingRank] = useState<any | null>(null);
  const [rankForm, setRankForm] = useState({
    id: '',
    name: '',
    commissionPercentage: 0,
    canSell: false,
    canSupport: false,
    canAddProfilePicture: false
  });

  // Shipping state
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    name: '',
    isActive: true
  });
  
  const [feesForm, setFeesForm] = useState({
    rechargeFee: 2,
    withdrawFee: 0,
    transferFee: 1,
    purchaseFee: 0,
    buyerVipPrice: 100,
    merchantVipPrice: 150,
    adPrice: 50
  });

  useEffect(() => {
    if (globalSettings) {
      setFeesForm({
        rechargeFee: globalSettings.rechargeFee ?? 2,
        withdrawFee: globalSettings.withdrawFee ?? 0,
        transferFee: globalSettings.transferFee ?? 1,
        purchaseFee: globalSettings.purchaseFee ?? 0,
        buyerVipPrice: globalSettings.buyerVipPrice ?? 100,
        merchantVipPrice: globalSettings.merchantVipPrice ?? 150,
        adPrice: globalSettings.adPrice ?? 50
      });
    }
  }, [globalSettings]);

  // Withdrawal settings state
  const [showWithdrawMethodModal, setShowWithdrawMethodModal] = useState(false);
  const [withdrawMethodForm, setWithdrawMethodForm] = useState({
    name: '',
    isActive: true
  });

  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [gatewayForm, setGatewayForm] = useState({
    phone: '',
    methodId: '',
    isActive: true
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMethodForGateway, setSelectedMethodForGateway] = useState<string>('');

  // Order Actions State
  const [orderActionModal, setOrderActionModal] = useState<{isOpen: boolean, type: 'accept' | 'reject' | null, orderId: string, userId: string}>({isOpen: false, type: null, orderId: '', userId: ''});
  const [orderActionMessage, setOrderActionMessage] = useState('');

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    let unsub: (() => void) | undefined;

    if (activeTab === 'overview') {
      const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsub = () => { unsubUsers(); unsubOrders(); unsubProducts(); };
    } else if (activeTab === 'users') {
      unsub = onSnapshot(collection(db, 'users'), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } else if (activeTab === 'recharges') {
      unsub = onSnapshot(query(collection(db, 'recharge_requests'), orderBy('createdAt', 'desc')), snap => {
        setRecharges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } else if (activeTab === 'transfers') {
      unsub = onSnapshot(query(collection(db, 'wallet_transactions'), where('type', '==', 'transfer'), orderBy('createdAt', 'desc')), snap => {
        setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } else if (activeTab === 'tickets') {
      unsub = onSnapshot(query(collection(db, 'tickets'), orderBy('createdAt', 'desc')), snap => {
        setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } else if (activeTab === 'orders') {
      const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubRecharges = onSnapshot(collection(db, 'recharge_requests'), snap => {
        setRecharges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsub = () => { unsubOrders(); unsubUsers(); unsubRecharges(); };
    } else if (activeTab === 'products') {
      unsub = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } else if (activeTab === 'ranks') {
      const unsubRanks = onSnapshot(collection(db, 'ranks'), snap => {
        setRanks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubCodes = onSnapshot(collection(db, 'codes'), snap => {
        setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsub = () => { unsubRanks(); unsubCodes(); };
    } else if (activeTab === 'withdrawals') {
      unsub = onSnapshot(query(collection(db, 'withdrawal_requests'), orderBy('createdAt', 'desc')), snap => {
        setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } else if (activeTab === 'settings') {
      const unsubMethods = onSnapshot(collection(db, 'shipping_methods'), snap => {
        setShippingMethods(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubWithdrawMethods = onSnapshot(collection(db, 'withdrawal_methods'), snap => {
        setWithdrawMethods(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubGateways = onSnapshot(collection(db, 'gateways'), snap => {
        setGateways(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsub = () => { unsubMethods(); unsubWithdrawMethods(); unsubGateways(); };
    } else if (activeTab === 'analytics') {
      const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsub = () => { unsubOrders(); unsubProducts(); unsubUsers(); };
    } else if (activeTab === 'events') {
      unsub = onSnapshot(query(collection(db, 'admin_events'), orderBy('createdAt', 'desc')), snap => {
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    // Global settings listener (always active)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), snap => {
      if (snap.exists()) setGlobalSettings(snap.data());
    });

    return () => {
      if (unsub) unsub();
      unsubSettings();
    };
  }, [profile?.role, activeTab]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const fetchAnalytics = async () => {
      const salesCount: Record<string, number> = {};
      orders.forEach(order => {
        order.products?.forEach((p: any) => {
          salesCount[p.productId] = (salesCount[p.productId] || 0) + p.quantity;
        });
      });

      const topProducts = products
        .map(p => ({ ...p, sales: salesCount[p.id] || 0 }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      // Total Profit (assuming 2% on recharges, 1% on transfers)
      const txSnap = await getDocs(collection(db, 'wallet_transactions'));
      let profit = 0;
      txSnap.docs.forEach(doc => {
        const tx = doc.data();
        if (tx.status === 'completed') {
          if (tx.type === 'recharge') profit += Math.abs(tx.amount) * 0.02;
          if (tx.type === 'transfer') profit += Math.abs(tx.amount) * 0.01;
        }
      });

      setAnalyticsData({
        topProducts,
        activeUsers: users.filter(u => !u.blocked).length, // Active users
        totalProfit: profit
      });
    };
    
    if (users.length > 0 && products.length > 0) {
      fetchAnalytics();
    }
  }, [profile, users, orders, products]);

  const logAction = async (action: string, metadata: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'logs'), {
        userId: user.id,
        action,
        metadata,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to log action', error);
    }
  };

  const notifyUser = async (userId: string, message: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        message,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to notify user', error);
    }
  };

  const handleMasterCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      if (masterCode === 'A7X-9KQ3-ZM81-PRO-MYSTORE-X99-ULTRA') {
        sessionStorage.setItem('adminSession', 'true');
        await updateDoc(doc(db, 'users', user.id), {
          originalRole: profile.role === 'admin' ? profile.originalRole || 'buyer' : profile.role,
          role: 'admin',
          masterCode: masterCode, // Temporarily needed for security rules
          permissions: ['manage_users', 'manage_orders', 'manage_wallet', 'manage_recharge', 'manage_transfers', 'manage_ranks', 'view_dashboard', 'block_users', 'manage_products', 'manage_settings']
        });
        toast.success('تم تفعيل صلاحيات المدير بنجاح!');
      } else {
        toast.error('كود غير صحيح');
      }
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ');
    }
    setLoading(false);
  };

  const approveRecharge = async (reqId: string, userId: string, amount: number) => {
    try {
      await updateDoc(doc(db, 'recharge_requests', reqId), { status: 'approved' });
      const userToUpdate = users.find(u => u.id === userId);
      if (userToUpdate) {
        const feePercent = globalSettings.rechargeFee ?? 2;
        const netAmount = amount * (1 - (feePercent / 100)); // dynamic fee
        const userUpdate: any = {
          wallet_balance: increment(netAmount)
        };

        // Referral Logic: Check if this is a charge > 100
        if (userToUpdate.referredBy && !userToUpdate.referralCharged && amount >= 100) {
          userUpdate.referralCharged = true;
          
          // If they already purchased > 100, complete the referral
          if (userToUpdate.referralPurchased) {
            userUpdate.referralCompleted = true;
            // Reward the referrer
            await updateDoc(doc(db, 'users', userToUpdate.referredBy), {
              points: increment(10),
              eventPoints: increment(10)
            });
            // Notify referrer
            await addDoc(collection(db, 'notifications'), {
              userId: userToUpdate.referredBy,
              message: `لقد حصلت على 10 نقاط مكافأة لأن ${userToUpdate.name || userId} أتم شروط الإحالة!`,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }

        await updateDoc(doc(db, 'users', userId), userUpdate);
        
        // Record transaction
        await addDoc(collection(db, 'wallet_transactions'), {
          userId: userId,
          type: 'recharge',
          amount: netAmount,
          status: 'completed',
          details: `شحن رصيد (تم خصم 2% رسوم)`,
          createdAt: serverTimestamp()
        });

        await logAction('approve_recharge', { reqId, userId, amount, netAmount });
        await notifyUser(userId, `تم قبول طلب شحن رصيد بقيمة ${amount} ج.م (تم إضافة ${netAmount} ج.م بعد خصم الرسوم)`);
      }
      toast.success('تم قبول الشحن');
    } catch (error) {
      console.error(error);
      toast.error('خطأ في القبول');
    }
  };

  const rejectRecharge = async (reqId: string, userId: string) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'recharge_requests', reqId), { status: 'rejected', adminReason: reason });
      await logAction('reject_recharge', { reqId, userId, reason });
      await notifyUser(userId, `تم رفض طلب الشحن الخاص بك. السبب: ${reason}`);
      toast.success('تم الرفض');
    } catch (error) {
      console.error(error);
    }
  };

  const approveWithdrawal = async (reqId: string, merchantId: string, amount: number) => {
    try {
      await updateDoc(doc(db, 'withdrawal_requests', reqId), { status: 'approved' });
      
      await logAction('approve_withdrawal', { reqId, merchantId, amount });
      await notifyUser(merchantId, `تم قبول طلب سحب الأرباح بقيمة ${amount} ج.م وتم تحويل المبلغ لك.`);
      toast.success('تم قبول طلب السحب');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ');
    }
  };

  const rejectWithdrawal = async (reqId: string, merchantId: string, amount: number) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'withdrawal_requests', reqId), { status: 'rejected' });
      
      // Refund the merchant balance
      const merchant = users.find(u => u.id === merchantId);
      if (merchant) {
        await updateDoc(doc(db, 'users', merchantId), {
          merchant_balance: increment(amount)
        });
      }

      await logAction('reject_withdrawal', { reqId, merchantId, reason });
      await notifyUser(merchantId, `تم رفض طلب سحب الأرباح الخاص بك وتم استرداد المبلغ. السبب: ${reason}`);
      toast.success('تم الرفض واسترداد المبلغ');
    } catch (error) {
      console.error(error);
    }
  };

  const approveTransfer = async (txId: string, senderId: string, receiverId: string, amount: number) => {
    try {
      const receiver = users.find(u => u.id === receiverId);
      
      if (!receiver) {
        toast.error('المستلم غير موجود');
        return;
      }
      
      const absAmount = Math.abs(amount);
      const feePercent = globalSettings.transferFee ?? 1;
      const netAmount = absAmount * (1 - (feePercent / 100)); // dynamic fee

      // Add to receiver (Sender already had funds deducted)
      await updateDoc(doc(db, 'users', receiverId), {
        wallet_balance: increment(netAmount)
      });

      // Mark transfer as completed
      await updateDoc(doc(db, 'wallet_transactions', txId), { status: 'completed' });
      
      // Record receiver transaction
      await addDoc(collection(db, 'wallet_transactions'), {
        userId: receiverId,
        type: 'transfer_received',
        amount: netAmount,
        status: 'completed',
        referenceId: senderId,
        details: `استلام تحويل من ${senderId} (تم خصم 1% رسوم)`,
        createdAt: serverTimestamp()
      });

      await logAction('approve_transfer', { txId, senderId, receiverId, amount, netAmount });
      await notifyUser(senderId, `تم تنفيذ تحويل مبلغ ${absAmount} ج.م بنجاح`);
      await notifyUser(receiverId, `تم استلام تحويل بمبلغ ${netAmount} ج.م`);

      toast.success('تم تنفيذ التحويل بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('خطأ في تنفيذ التحويل');
    }
  };

  const rejectTransfer = async (txId: string, senderId: string, amount: number) => {
    try {
      const sender = users.find(u => u.id === senderId);
      if (sender) {
        // Refund sender
        await updateDoc(doc(db, 'users', senderId), {
          wallet_balance: (sender.wallet_balance || 0) + Math.abs(amount)
        });
      }

      await updateDoc(doc(db, 'wallet_transactions', txId), { status: 'rejected' });
      await logAction('reject_transfer', { txId, senderId });
      await notifyUser(senderId, `تم رفض طلب التحويل الخاص بك وتم استرداد المبلغ`);
      toast.success('تم رفض التحويل واسترداد المبلغ للمرسل');
    } catch (error) {
      console.error(error);
    }
  };

  const replyToTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage || !user || !activeTicket) return;
    try {
      const newMessages = [...activeTicket.messages, {
        senderId: user.id,
        senderName: profile?.name || 'Admin',
        message: replyMessage,
        attachmentUrl: replyAttachmentUrl || null,
        timestamp: new Date().toISOString()
      }];
      await updateDoc(doc(db, 'tickets', activeTicket.id), {
        messages: newMessages,
        status: 'in_progress'
      });
      await notifyUser(activeTicket.userId, `تم الرد على تذكرتك: ${activeTicket.subject}`);
      setReplyMessage('');
      setReplyAttachmentUrl('');
    } catch (error) {
      console.error(error);
    }
  };

  const closeTicket = async (ticket: any) => {
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), { status: 'closed' });
      await notifyUser(ticket.userId, `تم إغلاق تذكرتك: ${ticket.subject}`);
    } catch (error) {
      console.error(error);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, userId: string, message?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const previousStatus = order.status;

    // Optimistic UI Update
    const previousOrders = [...orders];
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    toast.success('تم تحديث حالة الطلب');
    
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      
      // Add profit to merchants if order is completed or approved (if it was suspicious)
      if ((newStatus === 'completed' || newStatus === 'approved') && (previousStatus === 'pending' || previousStatus === 'pending_review')) {
        const merchantProfits: Record<string, number> = {};
        for (const item of order.products || []) {
          if (item.merchantId) {
            const merchantUser = users.find(u => u.id === item.merchantId);
            const merchantRank = ranks.find(r => r.id === merchantUser?.role) || { commissionPercentage: 0 };
            const siteFee = globalSettings.purchaseFee ?? 0;
            const commission = (merchantRank.commissionPercentage || 0) + siteFee;
            const netProfit = (item.price * item.quantity) * (1 - commission / 100);
            
            merchantProfits[item.merchantId] = (merchantProfits[item.merchantId] || 0) + netProfit;
          }
        }
        
        for (const [merchantId, profit] of Object.entries(merchantProfits)) {
          const merchantUser = users.find(u => u.id === merchantId);
          if (merchantUser) {
            const updates: any = { merchant_balance: increment(profit) };
            if (!merchantUser.firstProfitAt) {
              updates.firstProfitAt = serverTimestamp();
            }
            await updateDoc(doc(db, 'users', merchantId), updates);
            // If it was suspicious, we also approve the buyer for this merchant
            if (previousStatus === 'pending_review') {
              await approveBuyerForMerchant(userId, merchantId);
            }
          }
        }
      }

      // Return money if rejected and was paid via wallet
      if (newStatus === 'rejected' && (order.paymentMethod === 'wallet' || !order.paymentMethod)) {
        await updateDoc(doc(db, 'users', userId), {
          wallet_balance: increment(order.totalPrice)
        });
        await addDoc(collection(db, 'wallet_transactions'), {
          userId: userId,
          type: 'refund',
          amount: order.totalPrice,
          status: 'completed',
          referenceId: orderId,
          details: `استرجاع مبلغ الطلب المرفوض #${orderId}`,
          createdAt: serverTimestamp()
        });
      }

      let notificationMsg = `تم تحديث حالة طلبك إلى: ${newStatus}`;
      if (newStatus === 'approved') {
        notificationMsg = message ? `تم قبول طلبك. رسالة الإدارة: ${message}` : `تم قبول طلبك بنجاح.`;
        
        // Add points for transfer orders when approved
        if (order.paymentMethod === 'transfer' && previousStatus !== 'approved' && previousStatus !== 'completed') {
          const buyer = users.find(u => u.id === userId);
          if (buyer) {
            const earnedPoints = 10 + Math.floor(order.totalPrice / 1000) * 10;
            const buyerUpdate: any = {
              points: increment(earnedPoints),
              eventPoints: increment(earnedPoints)
            };

            // Referral Logic: Check if this is the first purchase > 100
            if (buyer.referredBy && !buyer.referralPurchased && order.totalPrice >= 100) {
              buyerUpdate.referralPurchased = true;
              
              // If they already charged > 100, complete the referral
              if (buyer.referralCharged) {
                buyerUpdate.referralCompleted = true;
                // Reward the referrer
                await updateDoc(doc(db, 'users', buyer.referredBy), {
                  points: increment(10),
                  eventPoints: increment(10)
                });
                // Notify referrer
                await addDoc(collection(db, 'notifications'), {
                  userId: buyer.referredBy,
                  message: `لقد حصلت على 10 نقاط مكافأة لأن ${buyer.name || userId} أتم شروط الإحالة!`,
                  read: false,
                  createdAt: serverTimestamp()
                });
              }
            }

            await updateDoc(doc(db, 'users', userId), buyerUpdate);
          }
        }
      } else if (newStatus === 'rejected') {
        notificationMsg = `تم رفض طلبك. السبب: ${message}`;
      }
      await notifyUser(userId, notificationMsg);
      await logAction('update_order', { orderId, newStatus, message });
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تحديث حالة الطلب');
      // Revert optimistic UI update
      setOrders(previousOrders);
    }
  };

  const handleOrderActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderActionModal.orderId || !orderActionModal.type) return;
    
    const newStatus = orderActionModal.type === 'accept' ? 'approved' : 'rejected';
    await updateOrderStatus(orderActionModal.orderId, newStatus, orderActionModal.userId, orderActionMessage);
    
    setOrderActionModal({isOpen: false, type: null, orderId: '', userId: ''});
    setOrderActionMessage('');
  };

  const deleteProduct = async (productId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
      await logAction('delete_product', { productId });
      toast.success('تم حذف المنتج');
    } catch (error) {
      console.error(error);
      toast.error('فشل حذف المنتج. تأكد من الصلاحيات.');
    }
  };

  const addGateway = (methodId?: string) => {
    if (shippingMethods.length === 0) {
      toast.error('يرجى إضافة وسيلة شحن أولاً');
      return;
    }
    setGatewayForm({ phone: '', methodId: methodId || '', isActive: true });
    setShowGatewayModal(true);
  };

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatewayForm.methodId) {
      toast.error('يرجى اختيار وسيلة الشحن');
      return;
    }
    try {
      await addDoc(collection(db, 'gateways'), {
        phone: gatewayForm.phone,
        methodId: gatewayForm.methodId,
        usedWeekly: 0,
        usedMonthly: 0,
        isActive: gatewayForm.isActive,
        createdAt: serverTimestamp()
      });
      setShowGatewayModal(false);
      setGatewayForm({ phone: '', methodId: '', isActive: true });
      toast.success('تم إضافة البوابة بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إضافة البوابة');
    }
  };

  const handleSaveShippingMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'shipping_methods'), {
        ...shippingForm,
        createdAt: serverTimestamp()
      });
      setShowShippingModal(false);
      setShippingForm({ name: '', isActive: true });
      toast.success('تم إضافة وسيلة الشحن');
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveFees = async () => {
    try {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'settings', 'global'), feesForm, { merge: true });
      toast.success('تم حفظ إعدادات الرسوم والأسعار بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    }
  };

  const handleSaveWithdrawMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'withdrawal_methods'), {
        ...withdrawMethodForm,
        createdAt: serverTimestamp()
      });
      setShowWithdrawMethodModal(false);
      setWithdrawMethodForm({ name: '', isActive: true });
      toast.success('تم إضافة وسيلة السحب');
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!eventForm.name || !eventForm.startDate) {
        toast.error('يرجى التأكد من ملء جميع الحقول المطلوبة');
        return;
      }

      const start = new Date(eventForm.startDate);
      if (isNaN(start.getTime())) {
        toast.error('تاريخ البداية غير صالح');
        return;
      }

      const end = new Date(start.getTime() + (eventForm.durationDays || 1) * 86400000);
      
      const newEvent = {
        name: eventForm.name,
        description: eventForm.description,
        prizeDescription: eventForm.prizeDescription,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        durationDays: eventForm.durationDays,
        rewards: {
          1: typeof eventForm.reward1 === 'number' ? eventForm.reward1 : 0,
          2: typeof eventForm.reward2 === 'number' ? eventForm.reward2 : 0,
          3: typeof eventForm.reward3 === 'number' ? eventForm.reward3 : 0
        },
        active: true,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'admin_events'), newEvent);
      setShowEventModal(false);
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      const dateStr = now.toISOString().slice(0, 16);
      setEventForm({ name: '', description: '', startDate: dateStr, durationDays: 1, prizeDescription: '', reward1: 100, reward2: 50, reward3: 20 });
      toast.success('تم إنشاء المسابقة وتشغيلها بنجاح');
      await logAction('create_event', { eventName: eventForm.name });
    } catch (error) {
      console.error('Error creating event:', error);
      if (error instanceof Error && error.message.includes('permission-denied')) {
        toast.error('خطأ في الصلاحيات: لا تملك إذن لإنشاء مسابقات (تأكد من تحديث القواعد)');
      } else {
        toast.error('حدث خطأ أثناء إنشاء المسابقة: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
      }
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let parsedCodePool: string[] = [];
      let parsedAccountList: any[] = [];
      let finalStock = productForm.stock;

      if (productForm.deliveryType === 'code') {
        parsedCodePool = productForm.codePool.split('\n').map(c => c.trim()).filter(c => c !== '');
        finalStock = productForm.isDoubleCode ? Math.floor(parsedCodePool.length / 2) : parsedCodePool.length;
      } else if (productForm.deliveryType === 'account') {
        parsedAccountList = productForm.accountList.split('\n').map(line => {
          const [username, password] = line.split(':').map(s => s.trim());
          return { username, password };
        }).filter(a => a.username && a.password);
        finalStock = productForm.isDoubleCode ? Math.floor(parsedAccountList.length / 2) : parsedAccountList.length;
      } else if (productForm.deliveryType === 'file' || productForm.deliveryType === 'link') {
        finalStock = 999999;
      }

      const baseData = {
        title: productForm.title,
        description: productForm.description,
        price: productForm.price,
        stock: finalStock,
        images: productForm.images,
        category: productForm.category,
        isActive: productForm.isActive,
        deliveryType: productForm.deliveryType,
        isDoubleCode: productForm.isDoubleCode,
        codePool: parsedCodePool,
        accountList: parsedAccountList,
        fileUrl: productForm.fileUrl,
        downloadLink: productForm.downloadLink,
        wholesalePrice: (productForm.deliveryType === 'file' || productForm.deliveryType === 'link') && productForm.wholesalePrice > 0 ? productForm.wholesalePrice : null,
        wholesaleMinQty: (productForm.deliveryType === 'file' || productForm.deliveryType === 'link') && productForm.wholesaleMinQty > 0 ? productForm.wholesaleMinQty : null
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), baseData);
        await logAction('edit_product', { productId: editingProduct.id });
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        await addDoc(collection(db, 'products'), {
          ...baseData,
          merchantId: profile?.userId,
          merchantName: profile?.name || 'Admin',
          ratingAverage: 0,
          salesCount: 0,
          createdAt: serverTimestamp()
        });
        await logAction('add_product', { productTitle: productForm.title });
        toast.success('تم إضافة المنتج بنجاح');
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({ 
        title: '', 
        description: '', 
        price: 0, 
        stock: 0, 
        images: [], 
        category: 'general', 
        isActive: true, 
        deliveryType: 'manual', 
        isDoubleCode: false,
        codePool: '',
        accountList: '',
        fileUrl: '',
        downloadLink: '',
        wholesalePrice: 0,
        wholesaleMinQty: 0
      });
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ المنتج');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'codes'), {
        ...codeForm,
        code: codeForm.code.trim().toUpperCase(),
        usedCount: 0,
        isActive: true,
        createdAt: serverTimestamp()
      });
      setShowCodeModal(false);
      setCodeForm({ code: '', type: 'role', roleKey: '', durationHours: 24, maxUses: 1, targetUserId: '' });
      toast.success('تم إنشاء الكود بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إنشاء الكود');
    }
  };

  const handleSaveRank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRank) {
        await updateDoc(doc(db, 'ranks', editingRank.id), rankForm);
      } else {
        await setDoc(doc(db, 'ranks', rankForm.id), rankForm);
      }
      setShowRankModal(false);
      setEditingRank(null);
      setRankForm({ 
        id: '', 
        name: '', 
        commissionPercentage: 0, 
        canSell: false, 
        canSupport: false, 
        canAddProfilePicture: false 
      });
      toast.success('تم حفظ الرتبة بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ الرتبة');
    }
  };

  const deleteRank = async (rankId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الرتبة؟')) return;
    try {
      await deleteDoc(doc(db, 'ranks', rankId));
      toast.success('تم حذف الرتبة');
    } catch (error) {
      console.error(error);
    }
  };

  const deleteCode = async (codeId: string) => {
    await deleteDoc(doc(db, 'codes', codeId));
  };

  if (!profile) return null;

  if (profile.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg text-center border border-gray-100 dark:border-gray-700">
        <Key className="w-16 h-16 mx-auto text-blue-600 mb-6" />
        <h2 className="text-2xl font-bold mb-2">لوحة التحكم الرئيسية</h2>
        <p className="text-gray-500 mb-6">أدخل الكود السري للوصول إلى لوحة الإدارة</p>
        <form onSubmit={handleMasterCode}>
          <input 
            type="password" 
            value={masterCode}
            onChange={e => setMasterCode(e.target.value)}
            placeholder="MASTER CODE"
            className="w-full p-3 text-center tracking-widest rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 mb-4 font-mono"
            required
          />
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
            {loading ? 'جاري التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sticky top-24">
          <h2 className="font-bold text-lg mb-4 px-4">لوحة الإدارة</h2>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'overview' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <LayoutDashboard className="w-5 h-5" /> نظرة عامة
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'analytics' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <BarChart3 className="w-5 h-5" /> التحليلات
            </button>
            <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'users' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Users className="w-5 h-5" /> المستخدمين
            </button>
            <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'orders' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <ShoppingBag className="w-5 h-5" /> الطلبات
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="mr-auto bg-blue-500 text-white text-xs px-2 py-1 rounded-full">{orders.filter(o => o.status === 'pending').length}</span>
              )}
            </button>
            <button onClick={() => setActiveTab('products')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'products' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Package className="w-5 h-5" /> المنتجات
            </button>
            <button onClick={() => setActiveTab('recharges')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'recharges' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <CreditCard className="w-5 h-5" /> طلبات الشحن
              {recharges.filter(r => r.status === 'pending').length > 0 && (
                <span className="mr-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">{recharges.filter(r => r.status === 'pending').length}</span>
              )}
            </button>
            <button onClick={() => setActiveTab('events')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'events' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Activity className="w-5 h-5" /> المسابقات
            </button>
            <button onClick={() => setActiveTab('withdrawals')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'withdrawals' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <DollarSign className="w-5 h-5" /> طلبات السحب
              {withdrawals.filter(w => w.status === 'pending').length > 0 && (
                <span className="mr-auto bg-green-500 text-white text-xs px-2 py-1 rounded-full">{withdrawals.filter(w => w.status === 'pending').length}</span>
              )}
            </button>
            <button onClick={() => setActiveTab('transfers')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'transfers' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Send className="w-5 h-5" /> التحويلات
              {transfers.filter(t => t.status === 'pending').length > 0 && (
                <span className="mr-auto bg-orange-500 text-white text-xs px-2 py-1 rounded-full">{transfers.filter(t => t.status === 'pending').length}</span>
              )}
            </button>
            <button onClick={() => setActiveTab('tickets')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'tickets' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <MessageSquare className="w-5 h-5" /> الدعم الفني
              {tickets.filter(t => t.status === 'open').length > 0 && (
                <span className="mr-auto bg-blue-500 text-white text-xs px-2 py-1 rounded-full">{tickets.filter(t => t.status === 'open').length}</span>
              )}
            </button>
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Settings className="w-5 h-5" /> إعدادات الشحن
            </button>
            <button onClick={() => setActiveTab('ads')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'ads' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <ImageIcon className="w-5 h-5" /> الإعلانات
            </button>
            <button onClick={() => setActiveTab('logs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'logs' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Activity className="w-5 h-5" /> سجل العمليات
            </button>
            <button onClick={() => setActiveTab('ranks')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'ranks' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
              <Shield className="w-5 h-5" /> الرتب والأكواد
            </button>
            <Link to="/roles-center" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300">
              <Shield className="w-5 h-5" /> مركز الرتب المتقدم
            </Link>
          </nav>
        </div>
      </aside>

      <main className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        {activeTab === 'overview' && (
          <div>
            <h3 className="text-2xl font-bold mb-6">نظرة عامة</h3>
            
            <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-100 dark:border-green-800">
              <h4 className="text-lg font-bold text-green-800 dark:text-green-400 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5" /> إحصائيات الأموال في النظام
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                  <p className="text-sm text-gray-500 mb-1">إجمالي أرصدة المشترين</p>
                  <p className="text-2xl font-bold text-blue-600">{moneyStats.buyersTotal.toLocaleString()} ج.م</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                  <p className="text-sm text-gray-500 mb-1">إجمالي أرباح التجار</p>
                  <p className="text-2xl font-bold text-purple-600">{moneyStats.merchantsTotal.toLocaleString()} ج.م</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-2 border-green-100 dark:border-green-800">
                  <p className="text-sm text-gray-500 mb-1">إجمالي أموال النظام</p>
                  <p className="text-2xl font-bold text-green-600">{moneyStats.total.toLocaleString()} ج.م</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <p className="text-blue-600 dark:text-blue-400 font-medium mb-2">إجمالي المستخدمين</p>
                <p className="text-4xl font-bold">{users.length}</p>
              </div>
              <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                <p className="text-green-600 dark:text-green-400 font-medium mb-2">طلبات الشحن المعلقة</p>
                <p className="text-4xl font-bold">{recharges.filter(r => r.status === 'pending').length}</p>
              </div>
              <div className="p-6 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
                <p className="text-orange-600 dark:text-orange-400 font-medium mb-2">تحويلات معلقة</p>
                <p className="text-4xl font-bold">{transfers.filter(t => t.status === 'pending').length}</p>
              </div>
              <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                <p className="text-purple-600 dark:text-purple-400 font-medium mb-2">إجمالي الطلبات</p>
                <p className="text-4xl font-bold">{orders.length}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">التحليلات والإحصائيات</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 dark:bg-gray-750 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-500"/> أرباح المنصة (الرسوم)</h3>
                <p className="text-4xl font-bold text-green-600">{analyticsData.totalProfit.toLocaleString()} <span className="text-lg text-gray-500">ج.م</span></p>
                <p className="text-sm text-gray-500 mt-2">محسوبة من رسوم الشحن (2%) والتحويل (1%)</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-750 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-purple-500"/> المستخدمين النشطين</h3>
                <p className="text-4xl font-bold text-purple-600">{analyticsData.activeUsers}</p>
                <p className="text-sm text-gray-500 mt-2">مستخدمين متصلين حالياً أو نشطين مؤخراً</p>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-4">المنتجات الأكثر مبيعاً</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="p-4 rounded-r-lg">المنتج</th>
                    <th className="p-4">السعر</th>
                    <th className="p-4">المبيعات</th>
                    <th className="p-4 rounded-l-lg">الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.topProducts?.map((p: any) => (
                    <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="p-4 font-medium">{p.title}</td>
                      <td className="p-4">{p.price} ج.م</td>
                      <td className="p-4 font-bold text-blue-600">{p.sales}</td>
                      <td className="p-4 text-green-600">{(p.price * p.sales).toLocaleString()} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h3 className="text-2xl font-bold mb-6">إدارة المستخدمين</h3>
            
            <div className="mb-6 flex flex-wrap gap-2">
              <button 
                onClick={() => setSelectedRoleFilter('all')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${selectedRoleFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                الكل ({users.length})
              </button>
              {Array.from(new Set(users?.map(u => u.role) || [])).map(role => (
                <button 
                  key={role}
                  onClick={() => setSelectedRoleFilter(role)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${selectedRoleFilter === role ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  {role === 'admin' ? 'مدير' : 
                   role === 'merchant' ? 'تاجر' : 
                   role === 'vip_merchant' ? 'تاجر VIP' : 
                   role === 'buyer' ? 'مشتري' : 
                   role === 'vip_buyer' ? 'مشتري VIP' : role} ({users.filter(u => u.role === role).length})
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-500">
                    <th className="pb-3 font-medium">الاسم</th>
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">البريد</th>
                    <th className="pb-3 font-medium">الرصيد</th>
                    <th className="pb-3 font-medium">الرتبة</th>
                    <th className="pb-3 font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => selectedRoleFilter === 'all' || u.role === selectedRoleFilter).map(u => (
                    <tr key={u.id} className="border-b border-gray-50 dark:border-gray-750">
                      <td className="py-4">{u.name}</td>
                      <td className="py-4 font-mono text-sm text-gray-500">{u.numericId || u.id}</td>
                      <td className="py-4 text-gray-500">{u.email}</td>
                      <td className="py-4 font-bold text-blue-600">{u.wallet_balance?.toLocaleString()} ج.م</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-md text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'merchant' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 flex gap-2">
                        <button 
                          onClick={() => setSelectedUser(u)}
                          className="text-sm px-3 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          إدارة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* User Management Modal */}
            {selectedUser && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl">إدارة المستخدم: {selectedUser.name}</h3>
                    <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm mb-1 text-gray-500">الاسم</label>
                      <input type="text" value={selectedUser.name} onChange={e => setSelectedUser({...selectedUser, name: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-gray-500">البريد الإلكتروني</label>
                      <input type="text" value={selectedUser.email} disabled className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-600 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-gray-500">الرصيد (ج.م)</label>
                      <input type="number" value={selectedUser.wallet_balance} onChange={e => setSelectedUser({...selectedUser, wallet_balance: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-gray-500">الرتبة</label>
                      <select value={selectedUser.role} onChange={e => setSelectedUser({...selectedUser, role: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                        {predefinedRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mb-6 border-t border-gray-100 dark:border-gray-700 pt-6">
                    <button 
                      onClick={async () => {
                        await updateDoc(doc(db, 'users', selectedUser.id), {
                          name: selectedUser.name,
                          wallet_balance: selectedUser.wallet_balance,
                          role: selectedUser.role
                        });
                        await logAction('edit_user', { targetUserId: selectedUser.id, updates: { name: selectedUser.name, balance: selectedUser.wallet_balance, role: selectedUser.role } });
                        toast.success('تم حفظ التعديلات');
                      }}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      حفظ التعديلات
                    </button>
                    <button 
                      onClick={async () => {
                        const reason = prompt('سبب الحظر/فك الحظر:');
                        if (reason !== null) {
                          try {
                            const newStatus = !selectedUser.blocked;
                            await updateDoc(doc(db, 'users', selectedUser.id), { 
                              blocked: newStatus,
                              banReason: newStatus ? reason : null,
                              bannedAt: newStatus ? serverTimestamp() : null
                            });
                            await logAction(newStatus ? 'block_user' : 'unblock_user', { targetUserId: selectedUser.id, reason });
                            setSelectedUser({...selectedUser, blocked: newStatus});
                            toast.success(newStatus ? 'تم حظر المستخدم بنجاح' : 'تم رفع الحظر بنجاح');
                          } catch (error: any) {
                            console.error(error);
                            toast.error(error.message || 'حدث خطأ أثناء تغيير حالة الحظر');
                          }
                        }
                      }}
                      className={`px-6 py-2 rounded-lg ${selectedUser.blocked ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {selectedUser.blocked ? 'رفع الحظر' : 'حظر المستخدم'}
                    </button>
                  </div>

                  <div>
                    <h4 className="font-bold text-lg mb-4">سجل عمليات المستخدم</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {logs.filter(l => l.userId === selectedUser.id || l.metadata?.targetUserId === selectedUser.id).map(log => (
                        <div key={log.id} className="p-3 bg-gray-50 dark:bg-gray-750 rounded-lg text-sm">
                          <span className="font-bold text-blue-600">{log.action}</span>
                          <span className="text-gray-500 text-xs mr-4">{new Date(log.createdAt?.toDate()).toLocaleString('ar-EG')}</span>
                        </div>
                      ))}
                      {logs.filter(l => l.userId === selectedUser.id || l.metadata?.targetUserId === selectedUser.id).length === 0 && <p className="text-gray-500 text-sm">لا توجد عمليات</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">إدارة الطلبات</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setOrderFilter('all')} className={`px-4 py-2 rounded-lg text-sm ${orderFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>الكل</button>
                <button onClick={() => setOrderFilter('pending_review')} className={`px-4 py-2 rounded-lg text-sm ${orderFilter === 'pending_review' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'} flex items-center gap-1`}><AlertTriangle className="w-4 h-4"/> مشبوهة</button>
                <button onClick={() => setOrderFilter('pending')} className={`px-4 py-2 rounded-lg text-sm ${orderFilter === 'pending' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'}`}>غير مراجعة</button>
                <button onClick={() => setOrderFilter('approved')} className={`px-4 py-2 rounded-lg text-sm ${orderFilter === 'approved' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}>مقبولة</button>
                <button onClick={() => setOrderFilter('completed')} className={`px-4 py-2 rounded-lg text-sm ${orderFilter === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>مكتملة</button>
                <button onClick={() => setOrderFilter('rejected')} className={`px-4 py-2 rounded-lg text-sm ${orderFilter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}>مرفوضة</button>
              </div>
            </div>
            <div className="space-y-4">
              {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).map(order => {
                const orderUser = users.find(u => u.id === order.userId);
                const userRechargesCount = recharges.filter(r => r.userId === order.userId && r.status === 'approved').length;
                
                return (
                <div key={order.id} className={`p-4 border rounded-xl ${order.status === 'pending_review' ? 'border-red-500 bg-red-50/30' : 'border-gray-100 dark:border-gray-700'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">طلب #{order.id}</p>
                        {order.isSuspicious && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-md">
                            <AlertTriangle className="w-3 h-3" /> مشبوه
                          </span>
                        )}
                      </div>
                      <div className="mt-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">معلومات العميل:</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">الاسم: {orderUser?.name || 'غير معروف'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">ID: {orderUser?.numericId || order.userId}</p>
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">
                          مرات الشحن السابقة: {userRechargesCount}
                        </p>
                        {order.suspicionReason && (
                          <p className="text-xs text-red-600 mt-2 font-bold">سبب الاشتباه: {order.suspicionReason}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{new Date(order.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(order.status === 'pending' || order.status === 'pending_review') && (
                        <>
                          <button 
                            onClick={() => setOrderActionModal({isOpen: true, type: 'accept', orderId: order.id, userId: order.userId})}
                            className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 font-medium flex items-center gap-1"
                          >
                            {order.status === 'pending_review' && <ShieldCheck className="w-4 h-4" />}
                            {order.status === 'pending_review' ? 'تأمين وقبول' : 'قبول'}
                          </button>
                          <button 
                            onClick={() => setOrderActionModal({isOpen: true, type: 'reject', orderId: order.id, userId: order.userId})}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 font-medium"
                          >
                            رفض وإرجاع
                          </button>
                        </>
                      )}
                      
                      {order.status !== 'pending' && order.status !== 'pending_review' && (
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          order.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'completed' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {order.status === 'approved' ? 'مقبول' : order.status === 'completed' ? 'مكتمل' : 'مرفوض'}
                        </span>
                      )}

                      {order.status !== 'pending' && (
                        <button 
                          onClick={async () => {
                            await deleteDoc(doc(db, 'orders', order.id));
                            await logAction('delete_order', { orderId: order.id });
                          }}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                          title="حذف الطلب نهائياً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      
                      {order.status === 'completed' && (
                        <button 
                          onClick={async () => {
                            await setDoc(doc(db, 'archive_orders', order.id), order);
                            await deleteDoc(doc(db, 'orders', order.id));
                            await logAction('archive_order', { orderId: order.id });
                          }}
                          className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                          title="أرشفة الطلب"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
                    <p className="font-semibold mb-2">المنتجات:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {order.products?.map((p: any, idx: number) => (
                        <li key={idx}>{p.title} (x{p.quantity}) - {p.price} ج.م</li>
                      ))}
                    </ul>
                    <p className="font-bold mt-4 text-blue-600">الإجمالي: {order.totalPrice} ج.م</p>
                  </div>
                </div>
              );
              })}
              {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).length === 0 && <p className="text-gray-500">لا توجد طلبات</p>}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">إدارة المنتجات</h3>
              <button onClick={() => {
                setEditingProduct(null);
                setProductForm({ 
        title: '', 
        description: '', 
        price: 0, 
        stock: 0, 
        images: [], 
        category: 'general',
        isActive: true,
        deliveryType: 'manual',
        isDoubleCode: false,
        codePool: '',
        accountList: '',
        fileUrl: '',
        downloadLink: '',
        wholesalePrice: 0,
        wholesaleMinQty: 0
      });
                setShowProductModal(true);
              }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2">
                <Plus className="w-4 h-4"/> إضافة منتج
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(product => (
                <div key={product.id} className={`p-4 border ${product.isActive ? 'border-gray-100 dark:border-gray-700' : 'border-red-200 dark:border-red-900 opacity-75'} rounded-xl flex flex-col`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-lg truncate">{product.title}</h4>
                    {!product.isActive && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">معطل</span>}
                  </div>
                  <p className="text-blue-600 font-bold mb-2">{product.price} ج.م</p>
                  <p className="text-sm text-gray-500 mb-4">المخزون: {product.stock}</p>
                  <div className="mt-auto flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingProduct(product);
                        setProductForm({
                          title: product.title,
                          description: product.description,
                          price: product.price,
                          stock: product.stock,
                          images: product.images || (product.imageUrl ? [product.imageUrl] : []),
                          category: product.category || 'general',
                          isActive: product.isActive ?? true,
                          deliveryType: product.deliveryType || 'manual',
                          isDoubleCode: product.isDoubleCode || false,
                          codePool: Array.isArray(product.codePool) ? product.codePool.join('\n') : '',
                          accountList: Array.isArray(product.accountList) ? product.accountList.map((a:any) => `${a.username}:${a.password}`).join('\n') : '',
                          fileUrl: product.fileUrl || '',
                          downloadLink: product.downloadLink || '',
                          wholesalePrice: product.wholesalePrice || 0,
                          wholesaleMinQty: product.wholesaleMinQty || 0
                        });
                        setShowProductModal(true);
                      }}
                      className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                    >
                      تعديل
                    </button>
                    <button onClick={() => deleteProduct(product.id)} className="py-2 px-4 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">
                      حذف
                    </button>
                  </div>
                </div>
              ))}
              {products.length === 0 && <p className="text-gray-500 col-span-full">لا توجد منتجات</p>}
            </div>

            {/* Product Modal */}
            {showProductModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
                  <button 
                    onClick={() => { setShowProductModal(false); setEditingProduct(null); }} 
                    className="absolute top-4 left-4 text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <h3 className="font-bold text-xl mb-6">{editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
                  <form onSubmit={handleSaveProduct} className="space-y-4">
                    <div>
                      <label className="block text-sm mb-1">اسم المنتج</label>
                      <input type="text" required value={productForm.title} onChange={e => setProductForm({...productForm, title: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">نوع التسليم</label>
                      <select 
                        required 
                        value={productForm.deliveryType || 'manual'} 
                        onChange={e => setProductForm({...productForm, deliveryType: e.target.value})} 
                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                      >
                        <option value="manual">تسليم يدوي</option>
                        <option value="code">أكواد تلقائية</option>
                        <option value="account">حسابات تلقائية</option>
                        <option value="file">رابط ملف</option>
                        <option value="link">رابط خارجي</option>
                      </select>
                    </div>

                    {productForm.deliveryType === 'code' && (
                      <div>
                        <label className="block text-sm mb-1">الأكواد (كود في كل سطر)</label>
                        <textarea 
                          value={productForm.codePool} 
                          onChange={e => setProductForm({...productForm, codePool: e.target.value})} 
                          className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 h-24"
                          placeholder="CODE1&#10;CODE2"
                        />
                      </div>
                    )}

                    {productForm.deliveryType === 'account' && (
                      <div>
                        <label className="block text-sm mb-1">الحسابات (user:pass في كل سطر)</label>
                        <textarea 
                          value={productForm.accountList} 
                          onChange={e => setProductForm({...productForm, accountList: e.target.value})} 
                          className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 h-24"
                          placeholder="user1:pass1&#10;user2:pass2"
                        />
                      </div>
                    )}

                    {productForm.deliveryType === 'file' && (
                      <div>
                        <label className="block text-sm mb-1">رابط الملف</label>
                        <input type="url" value={productForm.fileUrl} onChange={e => setProductForm({...productForm, fileUrl: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                      </div>
                    )}

                    {productForm.deliveryType === 'link' && (
                      <div>
                        <label className="block text-sm mb-1">الرابط</label>
                        <input type="url" value={productForm.downloadLink} onChange={e => setProductForm({...productForm, downloadLink: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm mb-1">الوصف</label>
                      <textarea required value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 h-24"></textarea>
                    </div>
                      <div className={productForm.deliveryType !== 'code' && productForm.deliveryType !== 'account' ? "grid grid-cols-2 gap-4" : ""}>
                        <div>
                          <label className="block text-sm mb-1">السعر (ج.م)</label>
                          <input type="number" min="0" required value={productForm.price} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                        </div>
                        {productForm.deliveryType !== 'code' && productForm.deliveryType !== 'account' && (
                          <div>
                            <label className="block text-sm mb-1">الكمية</label>
                            <input type="number" min="0" required value={productForm.stock} onChange={e => setProductForm({...productForm, stock: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                          </div>
                        )}
                      </div>

                    {(productForm.deliveryType === 'file' || productForm.deliveryType === 'link') && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm mb-1">سعر الجملة (اختياري)</label>
                          <input type="number" min="0" value={productForm.wholesalePrice} onChange={e => setProductForm({...productForm, wholesalePrice: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">أقل كمية للجملة</label>
                          <input type="number" min="0" value={productForm.wholesaleMinQty} onChange={e => setProductForm({...productForm, wholesaleMinQty: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm mb-1">القسم (Category)</label>
                      <input type="text" required value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" placeholder="مثال: ألعاب، بطاقات..." />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">صور المنتج</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        disabled={uploadingImage}
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          
                          setUploadingImage(true);
                          const uploadPromises = files.map((file: File) => {
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
                              setProductForm(prev => ({...prev, images: [...prev.images, ...urls]}));
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
                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" 
                      />
                      {uploadingImage && <p className="text-xs text-blue-500 mt-1 animate-pulse">جاري رفع الصور...</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {productForm.images.map((img, idx) => (
                          <div key={idx} className="relative w-16 h-16">
                            <img src={img} alt="" className="w-full h-full object-cover rounded-lg border" />
                            <button 
                              type="button" 
                              onClick={() => setProductForm(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}))}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="isActive" 
                          checked={productForm.isActive} 
                          onChange={e => setProductForm({...productForm, isActive: e.target.checked})} 
                          className="w-4 h-4"
                        />
                        <label htmlFor="isActive" className="text-sm">منتج نشط (يظهر للعملاء)</label>
                      </div>

                      {(productForm.deliveryType === 'code' || productForm.deliveryType === 'account') && (
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="isDoubleCode" 
                            checked={productForm.isDoubleCode} 
                            onChange={e => setProductForm({...productForm, isDoubleCode: e.target.checked})} 
                            className="w-4 h-4"
                          />
                          <label htmlFor="isDoubleCode" className="text-sm">تسليم مزدوج (تسليم 2 في الطلب الواحد)</label>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">حفظ المنتج</button>
                      <button type="button" onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300">إلغاء</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recharges' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">طلبات الشحن</h3>
              <div className="flex gap-2">
                <button onClick={() => setRechargeFilter('all')} className={`px-4 py-2 rounded-lg text-sm ${rechargeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>الكل</button>
                <button onClick={() => setRechargeFilter('pending')} className={`px-4 py-2 rounded-lg text-sm ${rechargeFilter === 'pending' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'}`}>غير مراجعة</button>
                <button onClick={() => setRechargeFilter('approved')} className={`px-4 py-2 rounded-lg text-sm ${rechargeFilter === 'approved' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>مقبولة</button>
                <button onClick={() => setRechargeFilter('rejected')} className={`px-4 py-2 rounded-lg text-sm ${rechargeFilter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}>مرفوضة</button>
              </div>
            </div>
            <div className="space-y-4">
              {recharges.filter(r => rechargeFilter === 'all' || r.status === rechargeFilter).map(req => (
                <div key={req.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-lg">{req.amount.toLocaleString()} ج.م</p>
                    <p className="text-sm text-gray-500">User ID: <span className="font-mono">{req.userId}</span></p>
                    <p className="text-sm text-gray-500">Transaction ID: <span className="font-mono">{req.transactionId}</span></p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(req.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                    {req.paymentProofImage && req.paymentProofImage !== 'https://via.placeholder.com/150' && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                          <ImageIcon className="w-4 h-4" /> إثبات الدفع:
                        </p>
                        <img 
                          src={req.paymentProofImage} 
                          alt="إثبات الدفع" 
                          className="max-w-[200px] max-h-[200px] rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedImage(req.paymentProofImage)}
                        />
                      </div>
                    )}
                  </div>
                    <div className="flex items-center gap-2">
                      {req.status === 'pending' ? (
                        <>
                          <button onClick={() => approveRecharge(req.id, req.userId, req.amount)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">قبول</button>
                          <button onClick={() => rejectRecharge(req.id, req.userId)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">رفض</button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm ${req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {req.status === 'approved' ? 'مقبول' : 'مرفوض'}
                          </span>
                          <button 
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'recharge_requests', req.id));
                                toast.success('تم حذف الطلب');
                              } catch (error) {
                                console.error(error);
                                toast.error('فشل حذف الطلب. تأكد من الصلاحيات.');
                              }
                            }}
                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                            title="حذف الطلب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                </div>
              ))}
              {recharges.length === 0 && <p className="text-gray-500">لا توجد طلبات شحن</p>}
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div>
            <h3 className="text-2xl font-bold mb-6">طلبات سحب الأرباح</h3>
            <div className="space-y-4">
              {withdrawals.map(req => {
                const merchant = users.find(u => u.id === req.merchantId);
                return (
                  <div key={req.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-lg">{req.amount.toLocaleString()} ج.م</p>
                      <p className="text-sm text-gray-500">التاجر: {merchant?.name || req.merchantId}</p>
                      <p className="text-sm text-gray-500">رقم فودافون كاش: <span className="font-mono">{req.phoneNumber}</span></p>
                      <p className="text-sm text-gray-500">الرسوم: {req.fee} ج.م | الصافي: {req.finalAmount} ج.م</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(req.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                    </div>
                      <div className="flex items-center gap-2">
                        {req.status === 'pending' ? (
                          <>
                            <button onClick={() => approveWithdrawal(req.id, req.merchantId, req.amount)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700">قبول</button>
                            <button onClick={() => rejectWithdrawal(req.id, req.merchantId, req.amount)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">رفض</button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm ${req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {req.status === 'approved' ? 'تم القبول' : 'تم الرفض'}
                            </span>
                            <button 
                              onClick={async () => {
                                try {
                                  await deleteDoc(doc(db, 'withdrawal_requests', req.id));
                                  toast.success('تم حذف الطلب');
                                } catch (error) {
                                  console.error(error);
                                  toast.error('فشل حذف الطلب. تأكد من الصلاحيات.');
                                }
                              }}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                              title="حذف الطلب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                  </div>
                );
              })}
              {withdrawals.length === 0 && <p className="text-gray-500 text-center py-8">لا توجد طلبات سحب.</p>}
            </div>
          </div>
        )}

        {activeTab === 'transfers' && (
          <div>
            <h3 className="text-2xl font-bold mb-6">التحويلات المالية</h3>
            <div className="space-y-4">
              {transfers.map(tx => (
                <div key={tx.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-lg text-orange-600">{Math.abs(tx.amount).toLocaleString()} ج.م</p>
                    <p className="text-sm text-gray-500">من: <span className="font-mono">{tx.userId}</span></p>
                    <p className="text-sm text-gray-500">إلى: <span className="font-mono">{tx.referenceId}</span></p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(tx.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.status === 'pending' ? (
                      <>
                        <button onClick={() => approveTransfer(tx.id, tx.userId, tx.referenceId, tx.amount)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">تنفيذ</button>
                        <button onClick={() => rejectTransfer(tx.id, tx.userId, tx.amount)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">إلغاء</button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm ${tx.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {tx.status === 'completed' ? 'مكتمل' : 'مرفوض'}
                        </span>
                        <button 
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'wallet_transactions', tx.id));
                              toast.success('تم حذف العملية');
                            } catch (error) {
                              console.error(error);
                              toast.error('فشل حذف العملية. تأكد من الصلاحيات.');
                            }
                          }}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                          title="حذف العملية"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {transfers.length === 0 && <p className="text-gray-500">لا توجد تحويلات</p>}
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="flex flex-col md:flex-row gap-6 h-[700px]">
            <div className="w-full md:w-1/3 flex flex-col">
              <h3 className="text-2xl font-bold mb-4">تذاكر الدعم الفني</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {tickets.map(ticket => (
                  <button 
                    key={ticket.id} 
                    onClick={() => setActiveTicket(ticket)}
                    className={`w-full text-right p-4 rounded-xl border transition-colors ${activeTicket?.id === ticket.id ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-750'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold truncate">{ticket.subject}</h4>
                      <span className={`px-2 py-1 rounded-md text-xs whitespace-nowrap ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : ticket.status === 'closed' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">User ID: {ticket.userId}</p>
                  </button>
                ))}
                {tickets.length === 0 && <p className="text-gray-500 text-center mt-8">لا توجد تذاكر</p>}
              </div>
            </div>
            <div className="w-full md:w-2/3 flex flex-col border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
              {activeTicket ? (
                <>
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-xl">{activeTicket.subject}</h3>
                      <p className="text-sm text-gray-500">حالة التذكرة: {activeTicket.status}</p>
                    </div>
                    <div className="flex gap-2">
                      {activeTicket.status !== 'closed' && (
                        <button onClick={() => closeTicket(activeTicket)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">إغلاق التذكرة</button>
                      )}
                      <button 
                        onClick={async () => {
                          await deleteDoc(doc(db, 'tickets', activeTicket.id));
                          await logAction('delete_ticket', { ticketId: activeTicket.id });
                          setActiveTicket(null);
                        }} 
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                      >
                        حذف التذكرة
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-800">
                    {activeTicket.messages?.map((msg: any, idx: number) => (
                      <div key={idx} className={`flex flex-col ${msg.senderId === profile?.userId ? 'items-start' : 'items-end'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl relative group ${msg.senderId === profile?.userId ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-none'}`}>
                          <button 
                            onClick={async () => {
                              const newMessages = activeTicket.messages.filter((_: any, i: number) => i !== idx);
                              await updateDoc(doc(db, 'tickets', activeTicket.id), { messages: newMessages });
                              setActiveTicket({...activeTicket, messages: newMessages});
                              await logAction('delete_ticket_message', { ticketId: activeTicket.id, messageIndex: idx });
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <p className="text-xs font-bold mb-1 opacity-70">{msg.senderName}</p>
                          <p>{msg.message}</p>
                          {msg.attachmentUrl && (
                            <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="block mt-2 text-xs text-blue-600 hover:underline">
                              عرض المرفق
                            </a>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleString('ar-EG')}</span>
                      </div>
                    ))}
                  </div>
                  {activeTicket.status !== 'closed' && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                      <form onSubmit={replyToTicket} className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input type="text" required value={replyMessage} onChange={e => setReplyMessage(e.target.value)} placeholder="اكتب ردك هنا..." className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" />
                          <button type="submit" className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"><Send className="w-5 h-5"/></button>
                        </div>
                        <input type="url" value={replyAttachmentUrl} onChange={e => setReplyAttachmentUrl(e.target.value)} placeholder="رابط المرفق (اختياري)" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                      </form>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-800">
                  <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                  <p>اختر تذكرة لعرض التفاصيل والرد عليها</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <h3 className="text-2xl font-bold mb-6 text-red-600 dark:text-red-400">إعدادات الشحن</h3>
            
            <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-bold mb-1 text-red-700 dark:text-red-300">حالة نظام الشحن</h4>
                  <p className="text-sm text-red-600 font-bold">إيقاف نظام الشحن سيمنع المستخدمين من إرسال طلبات شحن جديدة.</p>
                </div>
                <button 
                  onClick={async () => {
                    const { setDoc } = await import('firebase/firestore');
                    await setDoc(doc(db, 'settings', 'global'), { rechargeEnabled: !globalSettings.rechargeEnabled }, { merge: true });
                    await logAction(globalSettings.rechargeEnabled ? 'disable_recharge' : 'enable_recharge', {});
                  }}
                  className={`px-6 py-3 rounded-xl font-bold text-white transition-colors ${globalSettings.rechargeEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {globalSettings.rechargeEnabled ? 'إيقاف الشحن' : 'تفعيل الشحن'}
                </button>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xl font-bold text-red-600 dark:text-red-400">وسائل الشحن والبوابات</h4>
                <div className="flex gap-2">
                  <button onClick={() => setShowShippingModal(true)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 flex items-center gap-2 font-bold">
                    <Plus className="w-4 h-4" /> إضافة وسيلة شحن
                  </button>
                  <button onClick={addGateway} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 font-bold">
                    <Plus className="w-4 h-4" /> إضافة بوابة
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {shippingMethods?.map(method => (
                  <div key={method.id} className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-red-100 dark:border-red-800 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <CreditCard className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                          <h5 className="font-bold text-lg text-red-800 dark:text-red-200">{method.name}</h5>
                          <p className="text-xs text-red-400 font-mono">{method.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => addGateway(method.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="إضافة بوابة لهذه الوسيلة"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => await updateDoc(doc(db, 'shipping_methods', method.id), { isActive: !method.isActive })}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${method.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {method.isActive ? 'نشط' : 'متوقف'}
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm('هل أنت متأكد من حذف وسيلة الشحن هذه؟ سيتم حذف جميع البوابات المرتبطة بها.')) {
                              await deleteDoc(doc(db, 'shipping_methods', method.id));
                              const relatedGateways = gateways.filter(g => g.methodId === method.id);
                              for (const g of relatedGateways) {
                                await deleteDoc(doc(db, 'gateways', g.id));
                              }
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {gateways.filter(g => g.methodId === method.id).map(gw => (
                        <div key={gw.id} className="p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700">
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-bold font-mono">{gw.phone}</p>
                            <span className={`w-2 h-2 rounded-full ${gw.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button 
                              onClick={async () => await updateDoc(doc(db, 'gateways', gw.id), { isActive: !gw.isActive })}
                              className="flex-1 py-1 bg-white dark:bg-gray-800 rounded-lg text-xs hover:bg-gray-100"
                            >
                              {gw.isActive ? 'إيقاف' : 'تفعيل'}
                            </button>
                            <button 
                              onClick={async () => await deleteDoc(doc(db, 'gateways', gw.id))}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {gateways.filter(g => g.methodId === method.id).length === 0 && (
                        <p className="text-sm text-gray-500 italic col-span-full">لا توجد بوابات مضافة لهذه الوسيلة</p>
                      )}
                    </div>
                  </div>
                ))}
                {shippingMethods.length === 0 && <p className="text-gray-500 text-center py-8">لا توجد وسائل شحن مضافة</p>}
              </div>
            </div>

            <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="text-lg font-bold mb-1 text-red-700 dark:text-red-300">حالة نظام السحب</h4>
                  <p className="text-sm text-red-500/80">إيقاف نظام السحب سيمنع التجار من إرسال طلبات سحب جديدة.</p>
                </div>
                <button 
                  onClick={async () => {
                    const { setDoc } = await import('firebase/firestore');
                    await setDoc(doc(db, 'settings', 'global'), { withdrawEnabled: !globalSettings.withdrawEnabled }, { merge: true });
                    await logAction(globalSettings.withdrawEnabled ? 'disable_withdraw' : 'enable_withdraw', {});
                  }}
                  className={`px-6 py-3 rounded-xl font-bold text-white transition-colors ${globalSettings.withdrawEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {globalSettings.withdrawEnabled ? 'إيقاف السحب' : 'تفعيل السحب'}
                </button>
              </div>

              <div className="flex justify-between items-center mb-4 pt-6 border-t border-red-200 dark:border-red-800">
                <h4 className="text-xl font-bold text-red-600 dark:text-red-400">وسائل السحب للتجار</h4>
                <button onClick={() => setShowWithdrawMethodModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> إضافة وسيلة سحب
                </button>
              </div>

              <div className="space-y-4">
                {withdrawMethods?.map(method => (
                  <div key={method.id} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <Wallet className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h5 className="font-bold">{method.name}</h5>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          const { updateDoc } = await import('firebase/firestore');
                          await updateDoc(doc(db, 'withdrawal_methods', method.id), { isActive: !method.isActive });
                        }}
                        className={`px-3 py-1 rounded-lg text-sm font-bold ${method.isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                      >
                        {method.isActive ? 'إيقاف' : 'تفعيل'}
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('هل أنت متأكد من حذف وسيلة السحب؟')) {
                            const { deleteDoc } = await import('firebase/firestore');
                            await deleteDoc(doc(db, 'withdrawal_methods', method.id));
                          }
                        }}
                        className="p-1 px-3 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {withdrawMethods.length === 0 && <p className="text-gray-500 text-center py-4">لا توجد وسائل سحب مضافة</p>}
              </div>
            </div>

            <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800">
              <h4 className="text-lg font-bold mb-4 text-red-600 dark:text-red-400">إعدادات الرسوم والعمولات</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mb-8">
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-700 dark:text-red-300">رسوم الشحن (%)</label>
                  <input type="number" value={feesForm.rechargeFee} 
                    onChange={e => setFeesForm(prev => ({...prev, rechargeFee: Number(e.target.value)}))}
                    className="w-full p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 text-red-900 dark:text-red-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-700 dark:text-red-300">رسوم السحب (%)</label>
                  <input type="number" value={feesForm.withdrawFee} 
                    onChange={e => setFeesForm(prev => ({...prev, withdrawFee: Number(e.target.value)}))}
                    className="w-full p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 text-red-900 dark:text-red-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-700 dark:text-red-300">رسوم التحويل الداخلي (%)</label>
                  <input type="number" value={feesForm.transferFee} 
                    onChange={e => setFeesForm(prev => ({...prev, transferFee: Number(e.target.value)}))}
                    className="w-full p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 text-red-900 dark:text-red-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-700 dark:text-red-300">رسوم الشراء / عمولة الموقع (%)</label>
                  <input type="number" value={feesForm.purchaseFee} 
                    onChange={e => setFeesForm(prev => ({...prev, purchaseFee: Number(e.target.value)}))}
                    className="w-full p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 text-red-900 dark:text-red-100" />
                </div>
              </div>

              <h4 className="text-lg font-bold mb-4 pt-6 border-t border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">أسعار الرتب التلقائية والإعلانات</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-700 dark:text-red-300">سعر رتبة عميل VIP (ج.م)</label>
                  <input type="number" value={feesForm.buyerVipPrice} 
                    onChange={e => setFeesForm(prev => ({...prev, buyerVipPrice: Number(e.target.value)}))}
                    className="w-full p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 text-red-900 dark:text-red-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-700 dark:text-red-300">سعر رتبة تاجر VIP (ج.م)</label>
                  <input type="number" value={feesForm.merchantVipPrice} 
                    onChange={e => setFeesForm(prev => ({...prev, merchantVipPrice: Number(e.target.value)}))}
                    className="w-full p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 text-red-900 dark:text-red-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-700 dark:text-red-300">سعر الإعلان لكل 1000 مشاهدة (ج.م)</label>
                  <input type="number" value={feesForm.adPrice} 
                    onChange={e => setFeesForm(prev => ({...prev, adPrice: Number(e.target.value)}))}
                    className="w-full p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 text-red-900 dark:text-red-100" />
                </div>
              </div>
              <div className="pt-4 border-t border-red-200 dark:border-red-800">
                <button 
                  onClick={handleSaveFees}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  حفظ التعديلات
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ads' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">إدارة الإعلانات</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ads.map(ad => (
                <div key={ad.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="font-bold text-lg block mb-1">
                        {ad.type === 'text' ? 'إعلان نصي' : ad.type === 'image' ? 'إعلان صورة' : ad.type === 'video' ? 'إعلان فيديو' : 'إعلان منتج'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${ad.status === 'active' ? 'bg-green-100 text-green-700' : ad.status === 'finished' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                        {ad.status === 'active' ? 'نشط' : ad.status === 'finished' ? 'منتهي' : 'متوقف'}
                      </span>
                    </div>
                    <div className="text-left text-sm text-gray-500">
                      <p>المشاهدات: {ad.viewsLeft} / {ad.views}</p>
                      <p className="text-xs mt-1">{new Date(ad.createdAt?.toDate()).toLocaleString('ar-EG')}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4 bg-gray-50 dark:bg-gray-750 p-3 rounded-lg overflow-hidden">
                    {ad.type === 'text' && <p className="text-gray-700 dark:text-gray-300">{ad.content}</p>}
                    {ad.type === 'image' && <img src={ad.content} alt="Ad" className="max-h-32 object-contain rounded" />}
                    {ad.type === 'video' && <a href={ad.content} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{ad.content}</a>}
                    {ad.type === 'product' && <p className="text-sm font-mono">Product ID: {ad.productId}</p>}
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={async () => await updateDoc(doc(db, 'ads', ad.id), { status: ad.status === 'active' ? 'stopped' : 'active' })}
                      className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 font-bold"
                    >
                      {ad.status === 'active' ? 'إيقاف الإعلان' : 'تفعيل الإعلان'}
                    </button>
                    <button 
                      onClick={async () => {
                        if (window.confirm('هل أنت متأكد من حذف هذا الإعلان؟')) {
                          await deleteDoc(doc(db, 'ads', ad.id));
                        }
                      }}
                      className="py-2 px-4 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {ads.length === 0 && <p className="text-gray-500 col-span-full">لا توجد إعلانات</p>}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div>
            <h3 className="text-2xl font-bold mb-6">سجل العمليات (Audit Logs)</h3>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-blue-600 ml-2">{log.action}</span>
                    <span className="text-gray-500 font-mono text-xs">{log.userId}</span>
                  </div>
                  <span className="text-gray-400 text-xs">{new Date(log.createdAt?.toDate()).toLocaleString('ar-EG')}</span>
                </div>
              ))}
              {logs.length === 0 && <p className="text-gray-500">لا توجد سجلات</p>}
            </div>
          </div>
        )}

        {activeTab === 'ranks' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">إدارة الرتب والأكواد</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowRankModal(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700">
                  <Plus className="w-5 h-5" /> إضافة رتبة
                </button>
                <button onClick={() => setShowCodeModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                  <Plus className="w-5 h-5" /> إنشاء كود
                </button>
              </div>
            </div>

            <div className="mb-12">
              <h4 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield className="w-6 h-6 text-purple-600" /> الرتب المخصصة</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {ranks?.map(rank => (
                  <div key={rank.id} className="bg-gray-50 dark:bg-gray-750 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="font-bold text-lg">{rank.name}</h5>
                        <p className="text-sm text-gray-500 font-mono">{rank.id}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingRank(rank); setRankForm(rank); setShowRankModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => deleteRank(rank.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
                      {rank.canSell && <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md font-bold">بيع منتجات</span>}
                      {rank.canSupport && <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md font-bold">دعم فني</span>}
                      {rank.canAddProfilePicture && <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-md font-bold">صورة شخصية</span>}
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-xl">
                      <span className="text-sm text-gray-500">نسبة العمولة الخاصة:</span>
                      <span className="font-bold text-purple-600">%{rank.commissionPercentage} + %{globalSettings.purchaseFee ?? 0}</span>
                    </div>
                  </div>
                ))}
                {ranks.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">لا توجد رتب مخصصة بعد</p>}
              </div>
            </div>

            <h4 className="text-xl font-bold mb-4 flex items-center gap-2"><Key className="w-6 h-6 text-blue-600" /> الأكواد النشطة</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-500">
                    <th className="pb-3 font-medium">الكود</th>
                    <th className="pb-3 font-medium">النوع</th>
                    <th className="pb-3 font-medium">الرتبة/القيمة</th>
                    <th className="pb-3 font-medium">الاستخدام</th>
                    <th className="pb-3 font-medium">مخصص لـ (ID)</th>
                    <th className="pb-3 font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {codes?.map(code => (
                    <tr key={code.id} className="border-b border-gray-50 dark:border-gray-750">
                      <td className="py-4 font-mono font-bold text-blue-600">{code.code}</td>
                      <td className="py-4">{code.type === 'role' ? 'ترقية رتبة' : 'رصيد'}</td>
                      <td className="py-4 font-bold">{code.roleKey}</td>
                      <td className="py-4">{code.usedCount} / {code.maxUses}</td>
                      <td className="py-4 text-sm text-gray-500">{code.targetUserId || 'الكل'}</td>
                      <td className="py-4 flex gap-2">
                        <button 
                          onClick={async () => await updateDoc(doc(db, 'codes', code.id), { isActive: !code.isActive })}
                          className={`p-2 rounded-lg ${code.isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}`}
                        >
                          <ShieldCheck className="w-5 h-5" />
                        </button>
                        <button onClick={() => deleteCode(code.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {codes.length === 0 && <p className="text-gray-500 text-center py-8">لا توجد أكواد</p>}
            </div>
          </div>
        )}

        {/* Code Modal */}
        {showCodeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="font-bold text-xl mb-6">إنشاء كود جديد</h3>
              <form onSubmit={handleSaveCode} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">الكود</label>
                  <input type="text" required value={codeForm.code} onChange={e => setCodeForm({...codeForm, code: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 font-mono" />
                </div>
                <div>
                  <label className="block text-sm mb-1">الرتبة المستهدفة</label>
                  <select value={codeForm.roleKey} onChange={e => setCodeForm({...codeForm, roleKey: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <option value="">اختر رتبة</option>
                    {predefinedRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">مخصص لمستخدم معين (اختياري - أدخل ID)</label>
                  <input type="text" value={codeForm.targetUserId} onChange={e => setCodeForm({...codeForm, targetUserId: e.target.value})} placeholder="اتركه فارغاً للكل" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">عدد الساعات</label>
                    <input type="number" value={codeForm.durationHours} onChange={e => setCodeForm({...codeForm, durationHours: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">أقصى استخدام</label>
                    <input type="number" value={codeForm.maxUses} onChange={e => setCodeForm({...codeForm, maxUses: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">حفظ</button>
                  <button type="button" onClick={() => setShowCodeModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rank Modal */}
        {showRankModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="font-bold text-xl mb-6">{editingRank ? 'تعديل رتبة' : 'إضافة رتبة جديدة'}</h3>
              <form onSubmit={handleSaveRank} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">معرف الرتبة (ID - بالإنجليزية)</label>
                  <input type="text" required disabled={!!editingRank} value={rankForm.id} onChange={e => setRankForm({...rankForm, id: e.target.value.toLowerCase().replace(/\s+/g, '_')})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 font-mono" placeholder="vip_merchant" />
                </div>
                <div>
                  <label className="block text-sm mb-1">اسم الرتبة</label>
                  <input type="text" required value={rankForm.name} onChange={e => setRankForm({...rankForm, name: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" placeholder="تاجر ذهبي" />
                </div>
                <div>
                  <label className="block text-sm mb-1">نسبة العمولة (التي تخصم للمنصة)</label>
                  <div className="relative">
                    <input type="number" required value={rankForm.commissionPercentage} onChange={e => setRankForm({...rankForm, commissionPercentage: Number(e.target.value)})} className="w-full p-2 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                    <span className="absolute right-3 top-2 text-gray-500 font-bold">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">سيتم إضافة %{globalSettings.purchaseFee ?? 0} عمولة الموقع تلقائياً (الإجمالي: %{rankForm.commissionPercentage + (globalSettings.purchaseFee ?? 0)})</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <label className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-xl cursor-pointer border border-transparent hover:border-purple-200 transition-colors">
                    <input type="checkbox" checked={rankForm.canSell} onChange={e => setRankForm({...rankForm, canSell: e.target.checked})} className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold">بيع منتجات (Merchant)</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-xl cursor-pointer border border-transparent hover:border-purple-200 transition-colors">
                    <input type="checkbox" checked={rankForm.canSupport} onChange={e => setRankForm({...rankForm, canSupport: e.target.checked})} className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold">دعم فني (Supporter)</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-xl cursor-pointer border border-transparent hover:border-purple-200 transition-colors col-span-2">
                    <input type="checkbox" checked={rankForm.canAddProfilePicture} onChange={e => setRankForm({...rankForm, canAddProfilePicture: e.target.checked})} className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold">تغيير الصورة الشخصية وتنسيق البروفايل</span>
                  </label>
                </div>

                <div className="flex gap-3 mt-6">
                  <button type="submit" className="flex-1 py-2 bg-purple-600 text-white rounded-xl font-bold">حفظ</button>
                  <button type="button" onClick={() => { setShowRankModal(false); setEditingRank(null); }} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Order Action Modal */}
        {orderActionModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="font-bold text-xl mb-4">
                {orderActionModal.type === 'accept' ? 'قبول الطلب' : 'رفض الطلب'}
              </h3>
              <form onSubmit={handleOrderActionSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {orderActionModal.type === 'accept' ? 'رسالة تأكيد للمستخدم (اختياري)' : 'سبب الرفض (مطلوب)'}
                  </label>
                  <textarea
                    value={orderActionMessage}
                    onChange={(e) => setOrderActionMessage(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 min-h-[100px]"
                    placeholder={orderActionModal.type === 'accept' ? 'اكتب رسالة تأكيد...' : 'اكتب سبب الرفض...'}
                    required={orderActionModal.type === 'reject'}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button 
                    type="submit" 
                    className={`flex-1 py-2 text-white rounded-xl font-bold ${orderActionModal.type === 'accept' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                  >
                    تأكيد
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setOrderActionModal({isOpen: false, type: null, orderId: '', userId: ''});
                      setOrderActionMessage('');
                    }} 
                    className="py-2 px-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Image Modal */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setSelectedImage(null)}>
            <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={selectedImage} 
                alt="Preview" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Shipping Method Modal */}
        {showShippingModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="font-bold text-xl mb-6">إضافة وسيلة شحن جديدة</h3>
              <form onSubmit={handleSaveShippingMethod} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">اسم وسيلة الشحن</label>
                  <input type="text" required value={shippingForm.name} onChange={e => setShippingForm({...shippingForm, name: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" placeholder="مثال: فودافون كاش" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="methodActive" checked={shippingForm.isActive} onChange={e => setShippingForm({...shippingForm, isActive: e.target.checked})} className="w-4 h-4" />
                  <label htmlFor="methodActive" className="text-sm">نشطة</label>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="submit" className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-bold">حفظ</button>
                  <button type="button" onClick={() => setShowShippingModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">إدارة المسابقات</h3>
              <button 
                onClick={() => {
                  setEventForm(prev => ({ ...prev, startDate: getInitialEventDate() }));
                  setShowEventModal(true);
                }} 
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" /> مسابقة جديدة
              </button>
            </div>
            
            <div className="space-y-4">
              {events?.map((evt) => {
                const isActive = evt.active && new Date() >= new Date(evt.startDate) && new Date() < new Date(evt.endDate);
                const isFinished = new Date() > new Date(evt.endDate);
                
                return (
                  <div key={evt.id} className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Activity className={`w-6 h-6 ${isActive ? 'text-green-500' : isFinished ? 'text-gray-400' : 'text-blue-500'}`} />
                        <h4 className="text-xl font-bold">{evt.name}</h4>
                        {isActive ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">جارية الآن</span>
                        ) : isFinished ? (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-bold">منتهية</span>
                        ) : evt.active ? (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">مجدولة</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">متوقفة</span>
                        )}
                      </div>
                      {evt.prizeDescription && (
                        <div className="flex items-center gap-2 mb-2 text-sm text-purple-600 font-bold bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg w-fit">
                          <Trophy className="w-4 h-4" /> الجائزة الإضافية: {evt.prizeDescription}
                        </div>
                      )}
                      <p className="text-sm text-gray-500 mb-1">
                        تاريخ البدء: {new Date(evt.startDate).toLocaleString('ar-EG')}
                      </p>
                      <p className="text-sm text-gray-500 mb-2">
                        تاريخ الانتهاء: {new Date(evt.endDate).toLocaleString('ar-EG')}
                      </p>
                      <div className="flex gap-2">
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-md font-bold">المركز الأول: {evt.rewards?.[1]} ج.م</span>
                        <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-md font-bold">المركز الثاني: {evt.rewards?.[2]} ج.م</span>
                        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-md font-bold">المركز الثالث: {evt.rewards?.[3]} ج.م</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                      <button 
                        onClick={async () => {
                          const { updateDoc } = await import('firebase/firestore');
                          await updateDoc(doc(db, 'admin_events', evt.id), { active: !evt.active });
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex-1 md:flex-none text-center ${evt.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      >
                        {evt.active ? 'إيقاف التفعيل' : 'تفعيل'}
                      </button>
                      <button 
                        onClick={async () => {
                          if(confirm('هل أنت متأكد من حذف هذه المسابقة؟')) {
                            const { deleteDoc } = await import('firebase/firestore');
                            await deleteDoc(doc(db, 'admin_events', evt.id));
                          }
                        }}
                        className="p-2 border border-red-100 text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">لا توجد مسابقات حالية</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Event Modal */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl">إنشاء مسابقة جديدة</h3>
                <button onClick={() => setShowEventModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">اسم المسابقة</label>
                  <input type="text" required value={eventForm.name} onChange={e => setEventForm({...eventForm, name: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" placeholder="مسابقة أعلى مبيعات" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">وصف المسابقة والشروط</label>
                  <textarea rows={2} value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" placeholder="شرح مبسط للمسابقة..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الجائزة العينية (مثل: كوبون، تذكرة، هدية)</label>
                  <input type="text" value={eventForm.prizeDescription} onChange={e => setEventForm({...eventForm, prizeDescription: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" placeholder="مثال: تذكرة دخول VIP" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">وقت البداية</label>
                    <input type="datetime-local" required value={eventForm.startDate} onChange={e => setEventForm({...eventForm, startDate: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">المدة (بالأيام)</label>
                    <input type="number" required min="1" value={eventForm.durationDays} onChange={e => setEventForm({...eventForm, durationDays: Number(e.target.value)})} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 mt-4 text-purple-600 border-b pb-1">الجوائز (رصيد ج.م)</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs mb-1">المركز الأول</label>
                      <input type="number" required min="0" value={eventForm.reward1} onChange={e => setEventForm({...eventForm, reward1: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-yellow-50 dark:bg-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">المركز الثاني</label>
                      <input type="number" required min="0" value={eventForm.reward2} onChange={e => setEventForm({...eventForm, reward2: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">المركز الثالث</label>
                      <input type="number" required min="0" value={eventForm.reward3} onChange={e => setEventForm({...eventForm, reward3: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-orange-50 dark:bg-gray-700" />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">
                    حفظ وتشغيل
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowEventModal(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    رجوع
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Withdrawal Method Modal */}
        {showWithdrawMethodModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="font-bold text-xl mb-6">إضافة وسيلة سحب جديدة</h3>
              <form onSubmit={handleSaveWithdrawMethod} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">اسم وسيلة السحب</label>
                  <input type="text" required value={withdrawMethodForm.name} onChange={e => setWithdrawMethodForm({...withdrawMethodForm, name: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" placeholder="مثال: فودافون كاش" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="withdrawMethodActive" checked={withdrawMethodForm.isActive} onChange={e => setWithdrawMethodForm({...withdrawMethodForm, isActive: e.target.checked})} className="w-4 h-4" />
                  <label htmlFor="withdrawMethodActive" className="text-sm">نشطة</label>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">حفظ</button>
                  <button type="button" onClick={() => setShowWithdrawMethodModal(false)} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-bold">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Gateway Modal */}
        {showGatewayModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="font-bold text-xl mb-6">إضافة بوابة جديدة</h3>
              <form onSubmit={handleSaveGateway} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">رقم هاتف البوابة</label>
                  <input type="text" required value={gatewayForm.phone} onChange={e => setGatewayForm({...gatewayForm, phone: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" placeholder="مثال: 01012345678" />
                </div>
                <div>
                  <label className="block text-sm mb-1">وسيلة الشحن</label>
                  <select required value={gatewayForm.methodId} onChange={e => setGatewayForm({...gatewayForm, methodId: e.target.value})} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <option value="">اختر وسيلة الشحن</option>
                    {shippingMethods.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="gatewayActive" checked={gatewayForm.isActive} onChange={e => setGatewayForm({...gatewayForm, isActive: e.target.checked})} className="w-4 h-4" />
                  <label htmlFor="gatewayActive" className="text-sm">نشطة</label>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">حفظ</button>
                  <button type="button" onClick={() => setShowGatewayModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

