import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';

const MODULES = [
  { id: 'dashboard', label: 'Dashboard', description: 'Resumo geral das operações e indicadores-chave.' },
  { id: 'leads', label: 'Leads', description: 'Gestão completa do funil de leads.' },
  { id: 'contracts', label: 'Contratos', description: 'Gestão de contratos, titulares e dependentes.' },
  { id: 'reminders', label: 'Lembretes', description: 'Agenda e lembretes automáticos para acompanhamento.' },
  { id: 'email', label: 'Email', description: 'Comunicação via email e templates.' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Gestão de conversas e mensagens do WhatsApp.' },
  { id: 'blog', label: 'Blog', description: 'Gestão de conteúdo do blog e SEO.' },
  { id: 'config', label: 'Configurações', description: 'Personalização do sistema e cadastros auxiliares.' },
] as const;

const ensureRole = (roles: string[], role: string) => (roles.includes(role) ? roles : [...roles, role]);

export default function AccessControlManager() {
  const { profilePermissions, refreshProfilePermissions } = useConfig();

  const roles = useMemo(() => {
    const unique = Array.from(new Set(profilePermissions.map(rule => rule.role)));
    return ensureRole(ensureRole(unique, 'admin'), 'observer');
  }, [profilePermissions]);

  const getPermission = (role: string, module: string) => {
    const rule = profilePermissions.find(r => r.role === role && r.module === module);
    if (rule) return rule;
    if (role === 'admin') {
      return { id: '', role, module, can_view: true, can_edit: true, created_at: '', updated_at: '' };
    }
    return { id: '', role, module, can_view: false, can_edit: false, created_at: '', updated_at: '' };
  };

  const handleToggleView = async (role: string, module: string, current: boolean) => {
    const updates: Record<string, boolean> = { can_view: !current };
    if (current && getPermission(role, module).can_edit) {
      updates['can_edit'] = false;
    }
    const { error } = await configService.upsertProfilePermission(role, module, updates);
    if (error) {
      alert('Erro ao atualizar permissão');
    } else {
      await refreshProfilePermissions();
    }
  };

  const handleToggleEdit = async (role: string, module: string, current: boolean) => {
    const updates: Record<string, boolean> = { can_edit: !current };
    if (!current) {
      updates['can_view'] = true;
    }
    const { error } = await configService.upsertProfilePermission(role, module, updates);
    if (error) {
      alert('Erro ao atualizar permissão');
    } else {
      await refreshProfilePermissions();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-start space-x-3 mb-6">
        <ShieldCheck className="w-6 h-6 text-teal-600" />
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Permissões por Perfil</h3>
          <p className="text-sm text-slate-600">Defina quais módulos cada tipo de acesso pode visualizar ou editar.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Módulo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descrição</th>
              {roles.map(role => (
                <th key={role} className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {role === 'admin' ? 'Administradores' : role.charAt(0).toUpperCase() + role.slice(1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {MODULES.map(module => (
              <tr key={module.id}>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{module.label}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{module.description}</td>
                {roles.map(role => {
                  const permission = getPermission(role, module.id);
                  const canEdit = permission.can_edit;
                  const canView = permission.can_view;
                  return (
                    <td key={role} className="px-4 py-3">
                      <div className="flex items-center justify-center space-x-3">
                        <label className="inline-flex items-center space-x-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={canView}
                            onChange={() => handleToggleView(role, module.id, canView)}
                            className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                          />
                          <span>Ver</span>
                        </label>
                        <label className="inline-flex items-center space-x-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={canEdit}
                            onChange={() => handleToggleEdit(role, module.id, canEdit)}
                            className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                            disabled={!canView}
                          />
                          <span>Editar</span>
                        </label>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
