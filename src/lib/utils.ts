import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLevelTitle(points: number = 0): string {
  if (points < 100) return 'مبتدئ';
  if (points < 500) return 'متسوق نشط';
  if (points < 1000) return 'عضو مميز';
  if (points < 5000) return 'خبير تسوق';
  if (points < 10000) return 'VIP';
  return 'أسطورة';
}
