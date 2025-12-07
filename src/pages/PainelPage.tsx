import { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { Lead, Reminder } from '../lib/supabase';
import Layout from '../components/Layout';
import Dashboard from '../components/Dashboard';
import LeadsManager from '../components/LeadsManager';
import ContractsManager from '../components/ContractsManager';
import RemindersManagerEnhanced from '../components/RemindersManagerEnhanced';
import BlogTab from '../components/config/BlogTab';
import WhatsAppTab from '../components/communication/WhatsAppTab';
import ConfigPage from './ConfigPage';
import NotificationToast from '../components/NotificationToast';
import LeadNotificationToast from '../components/LeadNotificationToast';
import { notificationService } from '../lib/notificationService';
import { audioService } from '../lib/audioService';
import FinanceiroComissoesTab from '../components/finance/FinanceiroComissoesTab';
import FinanceiroAgendaTab from '../components/finance/FinanceiroAgendaTab';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import type { TabNavigationOptions } from '../types/navigation';

export default function PainelPage() {
  const { isObserver } = useAuth();
  const { leadOrigins, loading: configLoading } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<Reminder[]>([]);
  const [activeLeadNotifications, setActiveLeadNotifications] = useState<Lead[]>([]);
  const [hasActiveNotification, setHasActiveNotification] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [leadStatusFilter, setLeadStatusFilter] = useState<string[] | undefined>();
  const [leadIdFilter, setLeadIdFilter] = useState<string | undefined>();
  const [contractOperadoraFilter, setContractOperadoraFilter] = useState<string | undefined>();

  const validTabIds = useMemo(
    () =>
      new Set([
        'dashboard',
        'leads',
        'contracts',
        'financeiro-comissoes',
        'financeiro-agenda',
        'reminders',
        'whatsapp',
        'blog',
        'config',
      ]),
    [],
  );

  const updateSearchParamsForTab = useCallback(
    (tabId: string) => {
      setSearchParams(
        currentParams => {
          const currentTab = currentParams.get('tab');

          if (currentTab === tabId) {
            return currentParams;
          }

          const nextParams = new URLSearchParams(currentParams);
          nextParams.set('tab', tabId);
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const restrictedOriginNamesForObservers = useMemo(
    () => leadOrigins.filter((origin) => origin.visivel_para_observadores === false).map((origin) => origin.nome),
    [leadOrigins],
  );

  const isOriginVisibleToObserver = useCallback(
    (originName: string | null | undefined) => {
      if (!originName) {
        return true;
      }
      return !restrictedOriginNamesForObservers.includes(originName);
    },
    [restrictedOriginNamesForObservers],
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const requestedTab = tabParam && validTabIds.has(tabParam) ? tabParam : 'dashboard';

    setActiveTab(previous => (previous !== requestedTab ? requestedTab : previous));
  }, [searchParams, validTabIds]);

  useEffect(() => {
    const unsubscribeUnreadCount = notificationService.subscribeToUnreadCount(setUnreadReminders);
    notificationService.start(30000);

    const unsubscribe = notificationService.subscribe((reminder) => {
      setActiveNotifications((prev) => [...prev, reminder]);
      setHasActiveNotification(true);
      audioService.playNotificationSound();
    });

    return () => {
      notificationService.stop();
      unsubscribe();
      unsubscribeUnreadCount();
    };
  }, []);

  useEffect(() => {
    if (configLoading) {
      return;
    }

    const unsubscribeLeads = notificationService.subscribeToLeads((lead) => {
      if (isObserver && !isOriginVisibleToObserver(lead.origem)) {
        return;
      }

      setActiveLeadNotifications((prev) => [...prev, lead]);
      setNewLeadsCount((prev) => prev + 1);
      audioService.playNotificationSound();
    });

    return () => {
      unsubscribeLeads();
    };
  }, [configLoading, isObserver, isOriginVisibleToObserver]);

  const handleConvertLead = (lead: Lead) => {
    setLeadToConvert(lead);
    handleTabChange('contracts');
  };

  const handleCloseNotification = (index: number) => {
    setActiveNotifications((prev) => prev.filter((_, i) => i !== index));
    if (activeNotifications.length <= 1) {
      setHasActiveNotification(false);
    }
  };

  const handleViewReminders = () => {
    handleTabChange('reminders');
  };

  const handleTabChange = (tab: string, options?: TabNavigationOptions) => {
    setActiveTab(tab);
    updateSearchParamsForTab(tab);

    if (tab === 'reminders') {
      setHasActiveNotification(false);
      setActiveNotifications([]);
    }
    if (tab === 'leads') {
      setNewLeadsCount(0);
      setLeadStatusFilter(options?.leadsStatusFilter);
      setLeadIdFilter(options?.leadIdFilter);
    } else if (options?.leadsStatusFilter === undefined) {
      setLeadStatusFilter(undefined);
      setLeadIdFilter(undefined);
    }

    if (tab === 'contracts') {
      setContractOperadoraFilter(options?.contractOperadoraFilter);
    } else if (options?.contractOperadoraFilter === undefined) {
      setContractOperadoraFilter(undefined);
    }
  };

  const handleCloseLeadNotification = (index: number) => {
    setActiveLeadNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleViewLead = () => {
    handleTabChange('leads');
    setActiveLeadNotifications([]);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigateToTab={handleTabChange} />;
      case 'leads':
        return (
          <LeadsManager
            onConvertToContract={handleConvertLead}
            initialStatusFilter={leadStatusFilter}
            initialLeadIdFilter={leadIdFilter}
          />
        );
      case 'contracts':
        return (
          <ContractsManager
            leadToConvert={leadToConvert}
            onConvertComplete={() => setLeadToConvert(null)}
            initialOperadoraFilter={contractOperadoraFilter}
          />
        );
      case 'financeiro-comissoes':
        return <FinanceiroComissoesTab />;
      case 'financeiro-agenda':
        return <FinanceiroAgendaTab />;
      case 'reminders':
        return <RemindersManagerEnhanced />;
      case 'whatsapp':
        return <WhatsAppTab />;
      case 'blog':
        return <BlogTab />;
      case 'config':
        return <ConfigPage />;
      default:
        return <Dashboard />;
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>KS Workspace</title>
      </Helmet>
      <Layout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadReminders={unreadReminders}
        hasActiveNotification={hasActiveNotification}
        newLeadsCount={newLeadsCount}
      >
        {renderContent()}
      </Layout>

      {activeNotifications.map((reminder, index) => (
        <NotificationToast
          key={`${reminder.id}-${index}`}
          reminder={reminder}
          onClose={() => handleCloseNotification(index)}
          onViewReminders={handleViewReminders}
        />
      ))}

      {activeLeadNotifications.map((lead, index) => (
        <LeadNotificationToast
          key={`${lead.id}-${index}`}
          lead={lead}
          onClose={() => handleCloseLeadNotification(index)}
          onViewLead={handleViewLead}
        />
      ))}
    </>
  );
}
