import React, { useState, useMemo } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Eye,
  ShieldCheck,
  Cpu,
  Database,
  CloudSun,
  MapPin,
  Sliders,
  Check,
  Flame,
  CloudRain,
  Wind,
  Layers,
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { Notification, NotificationSeverity, NotificationSourceType } from '../types/database';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  onOpenAuth?: () => void;
  isDark?: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenAuth,
  isDark = false,
}) => {
  const {
    user,
    notifications,
    unreadNotificationCount,
    isNotificationsLoading,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [selectedHazard, setSelectedHazard] = useState<string>('all');

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (activeTab === 'unread' && notif.is_read) return false;
      if (selectedHazard !== 'all' && notif.hazard !== selectedHazard) return false;
      return true;
    });
  }, [notifications, activeTab, selectedHazard]);

  // Unique hazards for filtering
  const availableHazards = useMemo(() => {
    const set = new Set<string>();
    notifications.forEach((n) => {
      if (n.hazard) set.add(n.hazard);
    });
    return Array.from(set);
  }, [notifications]);

  if (!isOpen) return null;

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = Date.now();
      const time = new Date(isoString).getTime();
      const diffMs = now - time;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const renderSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Critical Alert
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3 h-3 shrink-0" />
            Warning
          </span>
        );
      case 'watch':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border border-yellow-500/20">
            <Eye className="w-3 h-3 shrink-0" />
            Watch Advisory
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
            <Info className="w-3 h-3 shrink-0" />
            Information
          </span>
        );
    }
  };

  const renderSourceBadge = (source: string, sourceType: NotificationSourceType) => {
    switch (sourceType) {
      case 'official':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
            title="Officially published bulletin from meteorological department"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Official: {source}
          </span>
        );
      case 'provider':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
            title="Direct data feed from numerical weather provider"
          >
            <Database className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            Provider: {source}
          </span>
        );
      case 'derived':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
            title="Calculated by MAUSAM Convective/Thermal/AQI intelligence algorithms"
          >
            <Cpu className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            Derived: {source}
          </span>
        );
      case 'demo':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
            <CloudSun className="w-3 h-3 text-slate-500" />
            Simulation: {source}
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-center-title"
    >
      <div
        className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 sm:px-5 py-3.5 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-100 text-sky-700'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </div>
            <div>
              <h2 id="notification-center-title" className="text-base sm:text-lg font-bold tracking-tight">
                Alerts & Notifications
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unreadNotificationCount === 0
                  ? 'All notifications are caught up'
                  : `${unreadNotificationCount} unread alert${unreadNotificationCount > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadNotificationCount > 0 && (
              <button
                id="notif-mark-all-read-btn"
                onClick={() => markAllNotificationsRead()}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                    : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}

            <button
              id="notif-close-btn"
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
              aria-label="Close notification center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Mode Banner */}
        <div
          className={`px-4 sm:px-5 py-2 text-xs flex items-center justify-between border-b ${
            user
              ? isDark
                ? 'bg-emerald-950/30 border-emerald-900/30 text-emerald-300'
                : 'bg-emerald-50/80 border-emerald-100 text-emerald-800'
              : isDark
              ? 'bg-amber-950/30 border-amber-900/30 text-amber-300'
              : 'bg-amber-50/80 border-amber-100 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                user ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              {user ? (
                <>
                  <strong className="font-semibold">Cloud Synced</strong> with Supabase Database
                </>
              ) : (
                <>
                  <strong className="font-semibold">Guest Device Mode</strong> • History saved locally
                </>
              )}
            </span>
          </div>

          {!user && onOpenAuth && (
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="font-medium underline hover:opacity-80 transition-opacity"
            >
              Sign in to sync
            </button>
          )}
        </div>

        {/* Tabs and Hazard Filters */}
        <div className="px-4 sm:px-5 pt-3 pb-2 flex flex-col gap-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            {/* All vs Unread Tabs */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium">
              <button
                id="notif-tab-all"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-md transition-all ${
                  activeTab === 'all'
                    ? isDark
                      ? 'bg-slate-700 text-white shadow-xs font-semibold'
                      : 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                id="notif-tab-unread"
                onClick={() => setActiveTab('unread')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'unread'
                    ? isDark
                      ? 'bg-slate-700 text-white shadow-xs font-semibold'
                      : 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Unread</span>
                {unreadNotificationCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Link to Notification Settings */}
            {onOpenSettings && (
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                  isDark ? 'text-sky-400 hover:text-sky-300' : 'text-sky-600 hover:text-sky-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Alert Settings</span>
              </button>
            )}
          </div>

          {/* Hazard Chips if multiple exist */}
          {availableHazards.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar text-xs">
              <button
                onClick={() => setSelectedHazard('all')}
                className={`px-2.5 py-0.5 rounded-full border text-[11px] whitespace-nowrap transition-colors ${
                  selectedHazard === 'all'
                    ? isDark
                      ? 'bg-sky-500/20 border-sky-400/40 text-sky-300 font-semibold'
                      : 'bg-sky-50 border-sky-200 text-sky-700 font-semibold'
                    : isDark
                    ? 'border-slate-800 text-slate-400 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Categories
              </button>
              {availableHazards.map((hz) => (
                <button
                  key={hz}
                  onClick={() => setSelectedHazard(hz)}
                  className={`px-2.5 py-0.5 rounded-full border text-[11px] whitespace-nowrap transition-colors ${
                    selectedHazard === hz
                      ? isDark
                        ? 'bg-sky-500/20 border-sky-400/40 text-sky-300 font-semibold'
                        : 'bg-sky-50 border-sky-200 text-sky-700 font-semibold'
                      : isDark
                      ? 'border-slate-800 text-slate-400 hover:bg-slate-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {hz}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-[220px]">
          {isNotificationsLoading && notifications.length === 0 ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-24 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center p-6">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                  isDark ? 'bg-slate-800/80 text-slate-500' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Check className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                {activeTab === 'unread' ? 'No unread notifications' : 'No notifications in history'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                {activeTab === 'unread'
                  ? 'All recent severe weather warnings, rain nowcasts, and air quality advisories have been read.'
                  : 'Atmospheric conditions across your monitored locations are normal. Alerts will arrive automatically when adverse weather is detected.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isUnread = !notif.is_read;
              return (
                <div
                  key={notif.id}
                  id={`notification-card-${notif.id}`}
                  className={`relative p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isUnread
                      ? isDark
                        ? 'bg-slate-800/70 border-sky-500/30 shadow-xs'
                        : 'bg-sky-50/40 border-sky-200/80 shadow-xs'
                      : isDark
                      ? 'bg-slate-900/40 border-slate-800/80 opacity-90'
                      : 'bg-white border-slate-200/80'
                  }`}
                >
                  {/* Top line: Severity + Hazard + Relative Time */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {renderSeverityBadge(notif.severity)}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {notif.hazard}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatRelativeTime(notif.created_at)}
                      </span>
                      {isUnread && (
                        <button
                          onClick={() => markNotificationRead(notif.id)}
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${
                            isDark
                              ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
                              : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                          }`}
                          title="Mark as read"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Message */}
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {notif.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {notif.message}
                  </p>

                  {/* Bottom Meta Bar: Location + Exact Source with Source Type */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {notif.location_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({notif.latitude.toFixed(2)}°, {notif.longitude.toFixed(2)}°)
                      </span>
                    </div>

                    <div>{renderSourceBadge(notif.source, notif.source_type)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-4 sm:px-5 py-3 border-t flex items-center justify-between text-xs ${
            isDark ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-100 bg-slate-50/60 text-slate-500'
          }`}
        >
          <span>
            Showing {filteredNotifications.length} of {notifications.length} notifications
          </span>
          <button
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              isDark
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
