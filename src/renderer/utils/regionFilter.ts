import { PlatformRegistry } from '@shared/platform';

/**
 *   IM  
 */
export const getVisibleIMPlatforms = (language: 'zh' | 'en'): readonly string[] => {
  if (language === 'zh') {
    return PlatformRegistry.platformsByRegion('china');
  }
  return PlatformRegistry.platforms;
};
