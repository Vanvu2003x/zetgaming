export function navPath(center) {
  const left = Math.max(0, center - 57);
  const right = Math.min(355, center + 57);
  const leftSpan = center - left;
  const rightSpan = right - center;
  return `M0 8H${left.toFixed(2)}C${(left + leftSpan * .55).toFixed(2)} 8 ${(center - leftSpan * .6).toFixed(2)} 50 ${center.toFixed(2)} 50C${(center + rightSpan * .6).toFixed(2)} 50 ${(right - rightSpan * .55).toFixed(2)} 8 ${right.toFixed(2)} 8H355V80H0V8Z`;
}
