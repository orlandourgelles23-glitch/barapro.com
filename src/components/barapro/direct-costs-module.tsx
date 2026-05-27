'use client';

import { L } from '@/lib/labels';
import { useBaraproStore } from '@/lib/barapro-store';
import { CostModule, moduleDirectCostsConfig, modulePublicServicesConfig } from '@/components/barapro/cost-module';
import { SalarySubModule } from '@/components/barapro/salary-submodule';

export function DirectCostsModule() {
  const store = useBaraproStore();
  const { directCostSalaries, addDirectCostSalary, updateDirectCostSalary, deleteDirectCostSalary } = store;

  return (
    <div className="space-y-6 animate-slide-up">
      <CostModule config={moduleDirectCostsConfig} />
      <CostModule config={modulePublicServicesConfig} />
      <SalarySubModule
        title={L('directCostsModule.salaryTitle')}
        description={L('directCostsModule.salaryDescription')}
        items={directCostSalaries}
        onAdd={addDirectCostSalary}
        onUpdate={updateDirectCostSalary}
        onDelete={deleteDirectCostSalary}
      />
    </div>
  );
}
