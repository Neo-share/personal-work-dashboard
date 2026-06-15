import type { NavigationAction } from '@project-manager/shared';
import { useNavigate } from 'react-router-dom';

export function useNavigationAction() {
  const navigate = useNavigate();

  return (action?: NavigationAction) => {
    if (!action) return;

    switch (action.type) {
      case 'openWorkbench':
        navigate('/');
        break;
      case 'openScanCenter':
        navigate('/scan');
        break;
      case 'openGraph':
        if (action.payload?.requirementId) {
          navigate(`/graph?requirementId=${action.payload.requirementId}`);
        } else {
          navigate('/graph');
        }
        break;
      case 'openRequirementDetail':
        if (action.payload?.requirementId) {
          navigate(`/requirements/${action.payload.requirementId}`);
        }
        break;
      case 'filterRequirements': {
        const params = new URLSearchParams();
        if (action.payload?.riskOnly) params.set('riskOnly', '1');
        if (action.payload?.keyword) params.set('keyword', String(action.payload.keyword));
        if (action.payload?.status) params.set('status', String(action.payload.status));
        if (action.payload?.beforeTesting) params.set('beforeTesting', '1');
        if (action.payload?.personId) params.set('personId', String(action.payload.personId));
        if (action.payload?.repositoryId) {
          params.set('repositoryId', String(action.payload.repositoryId));
        }
        if (action.payload?.releaseFrom) {
          params.set('releaseFrom', String(action.payload.releaseFrom));
        }
        if (action.payload?.releaseTo) params.set('releaseTo', String(action.payload.releaseTo));
        navigate(`/requirements?${params.toString()}`);
        break;
      }
      default:
        break;
    }
  };
}
