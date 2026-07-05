export type AvTargetType = 'star' | 'series' | 'studio' | 'label';

export function buildAvTargetRoute(targetType: AvTargetType, targetId: string): string {
  return `javbus/${targetType}/${targetId}`;
}

export function buildAvTargetUrl(targetType: AvTargetType, targetId: string): string {
  return `https://www.javbus.com/${targetType}/${targetId}`;
}

export function isAvBatchTarget(targetType: AvTargetType): boolean {
  return targetType === 'label' || targetType === 'studio';
}

export function getAvTargetTypeLabel(targetType: AvTargetType): string {
  switch (targetType) {
    case 'star':
      return '女优';
    case 'series':
      return '系列';
    case 'studio':
      return '制作商';
    case 'label':
      return '发行商';
  }
}
