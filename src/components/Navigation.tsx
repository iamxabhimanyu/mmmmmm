import React from 'react';
import { Home, Calendar, Map, Bell, Sparkles, MoreHorizontal } from 'lucide-react';
import { ActiveTabType } from '../types';

interface NavigationProps {
  activeTab: ActiveTabType;
  onChangeTab: (tab: ActiveTabType) => void;
  hasActiveAlerts?: boolean;
  isDark?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  hasActiveAlerts = false,
  isDark = false,
}) => {
  const navItems = [
    { id: 'home' as ActiveTabType, label: 'Home', icon: Home },
    { id: 'forecast' as ActiveTabType, label: 'Forecast', icon: Calendar },
    { id: 'radar' as ActiveTabType, label: 'Radar', icon: Map },
    { id: 'alerts' as ActiveTabType, label: 'Alerts', icon: Bell, badge: hasActiveAlerts },
    { id: 'more' as ActiveTabType, label: 'Explore', icon: Sparkles },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav
        id="mobile-bottom-navigation"
        className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t sm:hidden pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] px-1 transition-colors duration-300 ${
          isDark
            ? 'bg-slate-950/90 border-white/[0.08] shadow-[0_-4px_16px_rgba(0,0,0,0.5)]'
            : 'bg-white/95 border-slate-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]'
        }`}
      >
        <div className="flex items-center justify-between w-full max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                onClick={() => onChangeTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all duration-150 relative select-none active:scale-95 ${
                  isActive
                    ? isDark
                      ? 'text-white font-semibold'
                      : 'text-slate-900 font-semibold'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                aria-label={item.label}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 ${
                      isActive
                        ? isDark
                          ? 'text-sky-400 stroke-[2.2]'
                          : 'text-sky-600 stroke-[2.2]'
                        : 'stroke-[1.8]'
                    }`}
                  />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-1 leading-none font-medium">
                  {item.label}
                </span>
                {isActive && (
                  <span className={`w-1 h-1 rounded-full mt-1 ${isDark ? 'bg-sky-400' : 'bg-sky-600'}`} />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Centered Segmented Navigation Bar */}
      <div className="hidden sm:flex justify-center w-full max-w-2xl mx-auto px-4 mt-2 mb-1">
        <div
          className={`inline-flex items-center p-1 rounded-full backdrop-blur-md border shadow-xs gap-1 transition-colors duration-300 ${
            isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-black/[0.05]'
          }`}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all select-none relative ${
                  isActive
                    ? isDark
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-slate-900 text-white shadow-xs'
                    : isDark
                    ? 'text-slate-300 hover:text-white hover:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
