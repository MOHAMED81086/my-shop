import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface FraudCheckResult {
  isSuspicious: boolean;
  reason: string | null;
}

export async function checkFraud(buyerId: string, merchantId: string): Promise<FraudCheckResult> {
  // 1. Check Hourly Limit (100 purchases per hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyQuery = query(
    collection(db, 'orders'),
    where('userId', '==', buyerId),
    where('createdAt', '>', Timestamp.fromDate(oneHourAgo))
  );
  const hourlySnap = await getDocs(hourlyQuery);
  if (hourlySnap.size >= 100) {
    return {
      isSuspicious: true,
      reason: 'تجاوز حد الشراء الساعي (أكثر من 100 عملية في الساعة). يتطلب مراجعة الأدمن.'
    };
  }

  // 2. Check Same Seller Limit
  const trustDocId = `${buyerId}_${merchantId}`;
  const trustRef = doc(db, 'buyer_merchant_trust', trustDocId);
  const trustSnap = await getDoc(trustRef);

  let currentCount = 0;
  let approvedLimit = 5;

  if (trustSnap.exists()) {
    const data = trustSnap.data();
    currentCount = data.currentCount || 0;
    approvedLimit = data.approvedLimit || 5;
  }

  if (currentCount >= approvedLimit) {
    return {
      isSuspicious: true,
      reason: `تجاوز حد الشراء من نفس التاجر (${approvedLimit} عمليات). يتطلب موافقة الأدمن للمتابعة.`
    };
  }

  return { isSuspicious: false, reason: null };
}

export async function incrementPurchaseCount(buyerId: string, merchantId: string) {
  const trustDocId = `${buyerId}_${merchantId}`;
  const trustRef = doc(db, 'buyer_merchant_trust', trustDocId);
  const trustSnap = await getDoc(trustRef);

  if (!trustSnap.exists()) {
    await setDoc(trustRef, {
      buyerId,
      merchantId,
      currentCount: 1,
      approvedLimit: 5,
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(trustRef, {
      currentCount: increment(1),
      updatedAt: serverTimestamp()
    });
  }
}

export async function approveBuyerForMerchant(buyerId: string, merchantId: string) {
  const trustDocId = `${buyerId}_${merchantId}`;
  const trustRef = doc(db, 'buyer_merchant_trust', trustDocId);
  
  // When admin approves, we allow 10 more purchases
  await updateDoc(trustRef, {
    approvedLimit: increment(10),
    updatedAt: serverTimestamp()
  });
}
