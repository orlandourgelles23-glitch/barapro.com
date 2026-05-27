'use client';

import { L } from '@/lib/labels';
import { CostModule, type CostModuleConfig } from '@/components/barapro/cost-module';
import { SalarySubModule } from '@/components/barapro/salary-submodule';
import { useBaraproStore, type ResourceItem } from '@/lib/barapro-store';
import type { ModuleId } from '@/lib/barapro-store';
/**
 * Maps each operations module to its salary store key and action names.
 */
const SALARY_MAP: Record<string, {
  storeKey: string;
  add: string;
  update: string;
  delete: string;
  labelKey: string;
}> = {
  I: {
    storeKey: 'commercialSalaries',
    add: 'addCommercialSalary',
    update: 'updateCommercialSalary',
    delete: 'deleteCommercialSalary',
    labelKey: 'I',
  },
  J: {
    storeKey: 'adminSalaries',
    add: 'addAdminSalary',
    update: 'updateAdminSalary',
    delete: 'deleteAdminSalary',
    labelKey: 'J',
  },
  K: {
    storeKey: 'maintenanceSalaries',
    add: 'addMaintenanceSalary',
    update: 'updateMaintenanceSalary',
    delete: 'deleteMaintenanceSalary',
    labelKey: 'K',
  },
  L: {
    storeKey: 'indirectSalaries',
    add: 'addIndirectSalary',
    update: 'updateIndirectSalary',
    delete: 'deleteIndirectSalary',
    labelKey: 'L',
  },
};

interface OperationsModuleWrapperProps {
  config: CostModuleConfig;
}

export function OperationsModuleWrapper({ config }: OperationsModuleWrapperProps) {
  const store = useBaraproStore();
  const salaryConfig = SALARY_MAP[config.moduleId as string];

  const salaryItems: ResourceItem[] = salaryConfig
    ? (store[salaryConfig.storeKey as keyof typeof store] as ResourceItem[]) || []
    : [];

  const salaryLabel = salaryConfig
    ? L(`opsWrapper.salaryLabels.${salaryConfig.labelKey}`)
    : '';
  const salaryDescription = salaryConfig
    ? `${'Personal asignado a'} ${config.title}`
    : '';

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Main cost module */}
      <CostModule config={config} />

      {/* Salary sub-module for this operations section */}
      {salaryConfig && (
        <SalarySubModule
          title={salaryLabel}
          description={salaryDescription}
          items={salaryItems}
          onAdd={(item) => {
            const fn = (store as any)[salaryConfig.add];
            if (typeof fn === 'function') fn(item);
          }}
          onUpdate={(id, data) => {
            const fn = (store as any)[salaryConfig.update];
            if (typeof fn === 'function') fn(id, data);
          }}
          onDelete={(id) => {
            const fn = (store as any)[salaryConfig.delete];
            if (typeof fn === 'function') fn(id);
          }}
        />
      )}
    </div>
  );
}
