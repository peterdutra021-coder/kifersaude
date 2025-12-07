import { useMemo } from 'react';
import { Lead } from '../lib/supabase';
import { TrendingDown, Users } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { getContrastTextColor } from '../lib/colorUtils';

type LeadFunnelProps = {
  leads: Lead[];
};

export default function LeadFunnel({ leads }: LeadFunnelProps) {
  const { leadStatuses } = useConfig();

  const stages = useMemo(
    () => leadStatuses.filter(status => status.ativo).sort((a, b) => a.ordem - b.ordem),
    [leadStatuses]
  );

  const funnelLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          !lead.arquivado &&
          lead.status &&
          stages.some((stage) => stage.nome === lead.status)
      ),
    [leads, stages]
  );

  const getLeadsByStatus = (statusId: string) => {
    const statusObj = stages.find((s) => s.id === statusId);
    const statusName = statusObj?.nome;
    return funnelLeads.filter((lead) => lead.status === statusName);
  };

  const calculateConversionRate = (index: number): number => {
    if (index === 0) return 100;
    const previousCount = getLeadsByStatus(stages[index - 1].id).length;
    const currentCount = getLeadsByStatus(stages[index].id).length;
    if (previousCount === 0) return 0;
    return (currentCount / previousCount) * 100;
  };

  const totalLeads = funnelLeads.length;
  const maxWidth = 100;

  if (stages.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
        Configure os status do funil para visualizar este gráfico.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Funil de Vendas</h3>
          <p className="mt-1 text-sm text-slate-600">
            Visualização do pipeline e taxas de conversão
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:text-sm">
          <Users className="h-4 w-4 text-slate-500" />
          <span className="font-semibold text-slate-900">{totalLeads}</span>
          <span className="text-slate-600">leads ativos</span>
        </div>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const stageLeads = getLeadsByStatus(stage.id);
          const count = stageLeads.length;
          const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
          const width = totalLeads > 0 ? (count / totalLeads) * maxWidth : 0;
          const conversionRate = calculateConversionRate(index);
          const color = stage.cor || '#0ea5e9';
          const textColor = getContrastTextColor(color);

          return (
            <div key={stage.id} className="relative">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="font-medium text-slate-900">{stage.nome}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {index > 0 && (
                    <div className="flex items-center gap-1 text-xs sm:text-sm">
                      <TrendingDown className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-600">
                        {conversionRate.toFixed(0)}%
                      </span>
                    </div>
                  )}
                  <span className="font-semibold text-slate-900">{count}</span>
                  <span className="w-16 text-right text-slate-500">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="relative h-12 bg-slate-100 rounded-lg overflow-hidden">
                {width > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 flex items-center justify-center transition-all duration-500 ease-out"
                    style={{
                      width: `${width}%`,
                      backgroundColor: color,
                      color: textColor,
                    }}
                  >
                    {count > 0 && (
                      <span className="font-semibold text-sm px-3">
                        {count} {count === 1 ? 'lead' : 'leads'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {index < stages.length - 1 && (
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-10">
                  <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-300"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
