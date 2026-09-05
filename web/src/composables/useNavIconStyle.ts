import { useLocalStorage } from '@vueuse/core';

export type NavIconStyle = 'playful-line' | 'gradient';

const navIconStyle = useLocalStorage<NavIconStyle>('notinews-nav-icon-style', 'playful-line');

export function useNavIconStyle() {
  function toggleNavIconStyle(): void {
    navIconStyle.value = navIconStyle.value === 'playful-line' ? 'gradient' : 'playful-line';
  }

  function setNavIconStyle(style: NavIconStyle): void {
    navIconStyle.value = style;
  }

  return {
    navIconStyle,
    toggleNavIconStyle,
    setNavIconStyle,
  };
}
