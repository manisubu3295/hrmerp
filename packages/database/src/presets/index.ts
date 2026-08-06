import type { IndustryPreset } from '@sankoerp/shared';
import { manpowerStaffingPreset } from './manpower-staffing';
import { constructionPreset } from './construction';
import { manufacturingPreset } from './manufacturing';
import { genericServicesPreset } from './generic-services';

export const INDUSTRY_PRESETS: Record<string, IndustryPreset> = {
  [manpowerStaffingPreset.key]: manpowerStaffingPreset,
  [constructionPreset.key]: constructionPreset,
  [manufacturingPreset.key]: manufacturingPreset,
  [genericServicesPreset.key]: genericServicesPreset,
};

export { manpowerStaffingPreset, constructionPreset, manufacturingPreset, genericServicesPreset };
