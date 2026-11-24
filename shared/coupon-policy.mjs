export function applyCoupon(grossCents, couponCents) {
  const gross = Math.max(0, Number(grossCents) || 0);
  const coupon = Math.max(0, Number(couponCents) || 0);
  const discount = Math.min(gross, coupon);
  return {
    gross_cents: gross,
    coupon_cents: coupon,
    discount_cents: discount,
    payable_cents: gross - discount,
    exceeds_order: coupon > gross,
    unused_cents: Math.max(0, coupon - gross),
  };
}
