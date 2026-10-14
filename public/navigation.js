export function navPath(center) {
  const left = Math.max(20, center - 57);
  const right = Math.min(335, center + 57);
  const leftSpan = center - left;
  const rightSpan = right - center;
  return `M20 8H${left.toFixed(2)}C${(left + leftSpan * .55).toFixed(2)} 8 ${(center - leftSpan * .6).toFixed(2)} 56 ${center.toFixed(2)} 56C${(center + rightSpan * .6).toFixed(2)} 56 ${(right - rightSpan * .55).toFixed(2)} 8 ${right.toFixed(2)} 8H335C346 8 354 17 354 28V59C354 70 346 79 335 79H20C9 79 1 70 1 59V28C1 17 9 8 20 8Z`;
}
