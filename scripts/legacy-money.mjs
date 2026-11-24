export function convertLegacyMoney(value, unit) {
  if (!['vnd', 'cents'].includes(unit)) throw new Error('Set LEGACY_MONEY_UNIT explicitly to vnd or cents');
  const amount=Number(value);
  const converted=amount*(unit==='vnd'?100:1);
  if (!Number.isSafeInteger(amount)||!Number.isSafeInteger(converted)) throw new Error('Legacy amount is not a safe integer');
  return converted;
}
