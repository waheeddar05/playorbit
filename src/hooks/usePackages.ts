'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { UserPackage, PackageValidationResponse } from '@/lib/schemas';

interface RawAdminPackage {
  id: string;
  package?: {
    name?: string;
    machineType?: string;
    ballType?: string;
    wicketType?: string;
    timingType?: string;
  };
  packageName?: string;
  machineType?: string;
  ballType?: string;
  wicketType?: string;
  timingType?: string;
  totalSessions: number;
  usedSessions: number;
  activationDate: string;
  expiryDate: string;
  status: string;
  amountPaid: number;
}

function normalizeAdminPackage(up: RawAdminPackage): UserPackage {
  return {
    id: up.id,
    packageName: up.package?.name || up.packageName || '',
    machineType: up.package?.machineType || up.machineType || '',
    ballType: up.package?.ballType || up.ballType || null,
    wicketType: up.package?.wicketType || up.wicketType || null,
    timingType: up.package?.timingType || up.timingType || '',
    totalSessions: up.totalSessions,
    usedSessions: up.usedSessions,
    remainingSessions: up.totalSessions - up.usedSessions,
    activationDate: up.activationDate,
    expiryDate: up.expiryDate,
    status: up.status,
    amountPaid: up.amountPaid,
  };
}

interface UsePackagesReturn {
  packages: UserPackage[];
  selectedPackageId: string;
  setSelectedPackageId: (id: string) => void;
  validation: PackageValidationResponse | null;
  isValidating: boolean;
  fetchPackages: (isAdmin: boolean, userId?: string | null) => Promise<void>;
  validatePackage: (params: {
    userPackageId: string;
    ballType: string;
    pitchType: string | null;
    startTime: string;
    numberOfSlots: number;
    userId?: string | null;
  }) => Promise<void>;
  reset: () => void;
}

export function usePackages(): UsePackagesReturn {
  const [packages, setPackages] = useState<UserPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [validation, setValidation] = useState<PackageValidationResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const fetchPackages = useCallback(async (isAdmin: boolean, userId?: string | null) => {
    try {
      const url = isAdmin && userId
        ? `/api/admin/packages/user-packages?userId=${userId}&status=ACTIVE`
        : '/api/packages/my';

      const data = await api.get<RawAdminPackage[] | UserPackage[]>(url);
      const pkgs = Array.isArray(data) ? data : [];

      if (isAdmin && userId) {
        setPackages(pkgs.map(p => normalizeAdminPackage(p as RawAdminPackage)));
      } else {
        setPackages(pkgs as UserPackage[]);
      }
    } catch {
      setPackages([]);
    }
  }, []);

  const validatePackage = useCallback(async (params: {
    userPackageId: string;
    ballType: string;
    pitchType: string | null;
    startTime: string;
    numberOfSlots: number;
    userId?: string | null;
  }) => {
    if (!params.userPackageId || params.numberOfSlots === 0) {
      setValidation(null);
      return;
    }

    setIsValidating(true);
    try {
      const body = {
        userPackageId: params.userPackageId,
        ballType: params.ballType,
        pitchType: params.pitchType,
        startTime: params.startTime,
        numberOfSlots: params.numberOfSlots,
        ...(params.userId ? { userId: params.userId } : {}),
      };
      const data = await api.post<PackageValidationResponse>('/api/packages/validate-booking', body);
      setValidation(data);
    } catch {
      setValidation(null);
    } finally {
      setIsValidating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSelectedPackageId('');
    setValidation(null);
  }, []);

  return {
    packages,
    selectedPackageId,
    setSelectedPackageId,
    validation,
    isValidating,
    fetchPackages,
    validatePackage,
    reset,
  };
}
