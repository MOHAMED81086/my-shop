import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * دالة حسابية صارمة (Strict Math Rule) مخصصة لحساب العمولات.
 * تضمن الدقة وتمنع ظهور أخطاء الخصم بنسب عالية.
 */
export function calculateFee(amount: number | string, percentage: number | string): { originalAmount: number, feeAmount: number, netAmount: number } {
  const safeAmount = Number(amount);
  const safePercentage = Number(percentage);

  if (isNaN(safeAmount) || isNaN(safePercentage) || safeAmount < 0 || safePercentage < 0) {
    throw new Error("Financial Error: قيم حسابية غير صحيحة، تم إيقاف العملية.");
  }

  // التدقيق المالي: نحد من العمولات العالية (مثلاً لحل مشكلة خصم 20% بدلاً من 2%)
  // نحدد الحد الأقصى للعمولة بـ 10% لضمان الأمان في كل مكان وتجنب أي خطأ كـ 0.2 بدلا من 0.02
  if (safePercentage > 10) {
    console.error(`Error Log: Attempted to charge dangerous fee (${safePercentage}%) on amount ${safeAmount}.`);
    throw new Error("Financial Error: عمولة تتجاوز المسموح به، هناك خطأ تقني في احتساب الرسوم.");
  }

  // حساب دقيق للعمولة باستخدام Math.round لمنع مشاكل الكسور في جافاسكريبت
  const factor = safePercentage / 100;
  let fee = safeAmount * factor;
  fee = Math.round((fee + Number.EPSILON) * 100) / 100;

  let netAmount = safeAmount - fee;
  netAmount = Math.round((netAmount + Number.EPSILON) * 100) / 100;

  return { originalAmount: safeAmount, feeAmount: fee, netAmount: netAmount };
}

export function getLevelTitle(points: number = 0): string {
  if (points < 100) return 'مبتدئ';
  if (points < 500) return 'متسوق نشط';
  if (points < 1000) return 'عضو مميز';
  if (points < 5000) return 'خبير تسوق';
  if (points < 10000) return 'VIP';
  return 'أسطورة';
}
