import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Users,
  FileText,
  LayoutDashboard,
  Bell,
  LogOut,
  Settings,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Briefcase,
  BookOpen,
  PiggyBank,
  DollarSign,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useNavigate } from 'react-router-dom';
import type { TabNavigationOptions } from '../types/navigation';

type TabConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeColor?: string;
  children?: TabConfig[];
};

type LayoutProps = {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string, options?: TabNavigationOptions) => void;
  unreadReminders: number;
  hasActiveNotification?: boolean;
  newLeadsCount?: number;
};

export default function Layout({
  children,
  activeTab,
  onTabChange,
  unreadReminders,
  hasActiveNotification,
  newLeadsCount = 0,
}: LayoutProps) {
  const { signOut, role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const navigate = useNavigate();
  const [expandedParent, setExpandedParent] = useState<string | null>(null);
  const [expandedMobileParent, setExpandedMobileParent] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const collapsedMenuDragStartY = useRef<number | null>(null);
  const [dropdownAlignment, setDropdownAlignment] = useState<Record<string, 'left' | 'right'>>({});
  const currentRole = role;

  const canView = (moduleId: string) => getRoleModulePermission(currentRole, moduleId).can_view;

  const crmChildren = [
    { id: 'leads', label: 'Leads', icon: Users, badge: newLeadsCount, badgeColor: 'bg-orange-500' },
    { id: 'contracts', label: 'Contratos', icon: FileText },
    { id: 'financeiro-agenda', label: 'Tarefas', icon: Calendar },
    { id: 'reminders', label: 'Lembretes', icon: Bell, badge: unreadReminders },
  ].filter(child => canView(child.id));

  const comunicacaoChildren = [
    { id: 'blog', label: 'Blog', icon: BookOpen },
  ].filter(child => canView(child.id));

  const financeiroChildren = [
    { id: 'financeiro-comissoes', label: 'Comissões', icon: DollarSign },
  ].filter(child => canView(child.id));

  const baseTabs: TabConfig[] = [];

  if (canView('dashboard')) {
    baseTabs.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
  }

  if (crmChildren.length > 0) {
    baseTabs.push({ id: 'crm', label: 'CRM', icon: Briefcase, children: crmChildren });
  }

  if (comunicacaoChildren.length > 0) {
    baseTabs.push({ id: 'comunicacao', label: 'Comunicação', icon: MessageCircle, children: comunicacaoChildren });
  }

  if (financeiroChildren.length > 0) {
    baseTabs.push({ id: 'financeiro', label: 'Financeiro', icon: PiggyBank, children: financeiroChildren });
  }

  const tabs = canView('config')
    ? [...baseTabs, { id: 'config', label: 'Configurações', icon: Settings }]
    : baseTabs;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleTabClick = (tab: TabConfig) => {
    if (tab.children && tab.children.length > 0) {
      setExpandedParent(expandedParent === tab.id ? null : tab.id);
    } else {
      onTabChange(tab.id);
      setExpandedParent(null);
      setIsMobileMenuOpen(false);
    }
  };

  const isParentActive = (tab: TabConfig) => {
    if (tab.id === activeTab) return true;
    if (tab.children) {
      return tab.children.some(child => child.id === activeTab);
    }
    return false;
  };

  const getTotalBadge = (tab: TabConfig): number => {
    if (!tab.children) return tab.badge || 0;
    return tab.children.reduce((sum, child) => sum + (child.badge || 0), 0);
  };

  const updateDropdownAlignment = useCallback(
    (parentId: string) => {
      const dropdown = dropdownRefs.current[parentId];
      const trigger = triggerRefs.current[parentId];

      if (!dropdown || !trigger) {
        return;
      }

      const dropdownRect = dropdown.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const dropdownWidth = dropdownRect.width;
      const viewportWidth = window.innerWidth;

      let alignment: 'left' | 'right' = 'left';
      const leftAlignedRightEdge = triggerRect.left + dropdownWidth;
      const rightAlignedLeftEdge = triggerRect.right - dropdownWidth;

      if (leftAlignedRightEdge > viewportWidth) {
        alignment = 'right';
      }

      if (alignment === 'right' && rightAlignedLeftEdge < 0) {
        alignment = 'left';
      }

      setDropdownAlignment((previous) => {
        if (previous[parentId] === alignment) {
          return previous;
        }

        return { ...previous, [parentId]: alignment };
      });
    },
    []
  );

  useLayoutEffect(() => {
    if (!expandedParent) {
      return;
    }

    updateDropdownAlignment(expandedParent);

    const handleResize = () => {
      updateDropdownAlignment(expandedParent);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [expandedParent, updateDropdownAlignment]);

  useEffect(() => {
    if (!expandedParent) {
      return;
    }

    const handleScroll = () => {
      updateDropdownAlignment(expandedParent);
    };

    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [expandedParent, updateDropdownAlignment]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
        setExpandedMobileParent(null);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setExpandedMobileParent(null);
  }, [activeTab]);

  const toggleMobileParent = (parentId: string) => {
    setExpandedMobileParent(current => (current === parentId ? null : parentId));
  };

  const renderMobileChildren = (tab: TabConfig) => {
    if (!tab.children || tab.children.length === 0 || expandedMobileParent !== tab.id) {
      return null;
    }

    return (
      <div className="mt-2 space-y-1 pl-10">
        {tab.children.map((child) => {
          const ChildIcon = child.icon;
          return (
            <button
              key={child.id}
              onClick={() => {
                onTabChange(child.id);
                setIsMobileMenuOpen(false);
                setExpandedMobileParent(null);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeTab === child.id ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <ChildIcon className="h-4 w-4" />
                <span>{child.label}</span>
              </div>
              {child.badge !== undefined && child.badge > 0 && (
                <span
                  className={`${
                    child.badgeColor || 'bg-orange-500'
                  } text-white text-xs font-semibold inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 ${
                    child.id === 'reminders' && hasActiveNotification ? 'animate-pulse' : ''
                  } ${child.id === 'leads' && child.badge > 0 ? 'animate-pulse' : ''}`}
                >
                  {child.badge > 9 ? '9+' : child.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const handleCollapsedMenuPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    collapsedMenuDragStartY.current = event.clientY;
  }, []);

  const handleCollapsedMenuPointerEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (collapsedMenuDragStartY.current === null) {
      return;
    }

    const dragDistance = event.clientY - collapsedMenuDragStartY.current;
    collapsedMenuDragStartY.current = null;

    if (dragDistance > 30) {
      setIsMenuCollapsed(false);
    }
  }, []);

  const handleCollapsedMenuPointerCancel = useCallback(() => {
    collapsedMenuDragStartY.current = null;
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50"
    >
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                <span className="text-lg font-bold text-white">K</span>
              </div>
              <span className="sr-only">Kifer Saúde - Sistema de Gestão</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(current => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 lg:hidden"
                aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <nav className="hidden items-center gap-2 lg:flex">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = isParentActive(tab);
                  const isExpanded = expandedParent === tab.id;
                  const totalBadge = getTotalBadge(tab);

                  return (
                    <div key={tab.id} className="relative">
                      <button
                        ref={(element) => {
                          triggerRefs.current[tab.id] = element;
                        }}
                        onClick={() => handleTabClick(tab)}
                        className={`relative flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors ${
                          isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        aria-expanded={isExpanded}
                        aria-haspopup={tab.children && tab.children.length > 0 ? 'menu' : undefined}
                        title={tab.label}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="hidden xl:inline">{tab.label}</span>
                        {tab.children && tab.children.length > 0 && (
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                        {totalBadge > 0 && (
                          <span
                            className={`absolute -top-1 -right-1 ${
                              tab.badgeColor || 'bg-orange-500'
                            } flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${
                              hasActiveNotification && (tab.id === 'crm' || activeTab === 'reminders') ? 'animate-pulse' : ''
                            } ${
                              (tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0 ? 'animate-pulse' : ''
                            }`}
                          >
                            {totalBadge > 9 ? '9+' : totalBadge}
                          </span>
                        )}
                      </button>

                      {tab.children && isExpanded && (
                        <div
                          ref={(element) => {
                            dropdownRefs.current[tab.id] = element;
                          }}
                          className={`absolute top-full mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl ${
                            dropdownAlignment[tab.id] === 'right' ? 'right-0 left-auto' : 'left-0'
                          }`}
                        >
                          {tab.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  onTabChange(child.id);
                                  setExpandedParent(null);
                                }}
                                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium transition-colors ${
                                  activeTab === child.id ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <ChildIcon className="h-4 w-4" />
                                  <span>{child.label}</span>
                                </div>
                                {child.badge !== undefined && child.badge > 0 && (
                                  <span
                                    className={`${
                                      child.badgeColor || 'bg-orange-500'
                                    } flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${
                                      child.id === 'reminders' && hasActiveNotification ? 'animate-pulse' : ''
                                    } ${child.id === 'leads' && child.badge > 0 ? 'animate-pulse' : ''}`}
                                  >
                                    {child.badge > 9 ? '9+' : child.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
              <button
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
                <span className="sr-only">Sair</span>
              </button>
            </div>
          </div>
          {isMobileMenuOpen && (
            <div className="absolute inset-x-0 top-full mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl lg:hidden">
              <nav className="flex flex-col gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const totalBadge = getTotalBadge(tab);
                  const isExpanded = expandedMobileParent === tab.id;
                  const isActive = isParentActive(tab);

                  return (
                    <div key={tab.id} className="flex flex-col">
                      <button
                        onClick={() => {
                          if (tab.children && tab.children.length > 0) {
                            toggleMobileParent(tab.id);
                          } else {
                            onTabChange(tab.id);
                          }
                        }}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                          isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full ${
                              isActive ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="flex flex-col text-left">
                            <span>{tab.label}</span>
                            {tab.children && tab.children.length > 0 && (
                              <span className="text-xs font-normal text-slate-500">
                                {isExpanded ? 'Recolher' : 'Expandir'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {totalBadge > 0 && (
                            <span
                              className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-semibold text-white ${
                                tab.badgeColor || 'bg-orange-500'
                              } ${
                                hasActiveNotification && (tab.id === 'crm' || activeTab === 'reminders')
                                  ? 'animate-pulse'
                                  : ''
                              } ${
                                (tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0
                                  ? 'animate-pulse'
                                  : ''
                              }`}
                            >
                              {totalBadge > 9 ? '9+' : totalBadge}
                            </span>
                          )}
                          {tab.children && tab.children.length > 0 && (
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </button>
                      {renderMobileChildren(tab)}
                    </div>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
