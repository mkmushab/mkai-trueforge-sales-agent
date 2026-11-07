import {
  type AppUpdateRuntimeState,
} from '../../../shared/appUpdate/constants';

export const shouldShowAppUpdateNotice = (_state: AppUpdateRuntimeState): boolean => {
  return false;
};

export const isAppUpdateReadyToInstall = (_state: AppUpdateRuntimeState): boolean => (
  false
);
