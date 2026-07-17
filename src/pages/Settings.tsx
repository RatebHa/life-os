import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDomainStore } from '../store/useDomainStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useGoalStore } from '../store/useGoalStore';
import { useNoteStore } from '../store/useNoteStore';
import { useInboxStore } from '../store/useInboxStore';
import { useTemplateStore } from '../store/useTemplateStore';
import { useFocusStore } from '../store/useFocusStore';
import { useFrictionStore } from '../store/useFrictionStore';
import { useUpdaterStore } from '../store/useUpdaterStore';
import { getVersion } from '@tauri-apps/api/app';
import { db } from '../lib/db';
import type { BackupHealthStatus, BackupHistoryItem, BackupPreview, Goal, InboxItem, Note, SyncBootstrapStatus } from '../lib/types';
import { Modal } from '../components/shared/Modal';
import { PageHeader } from '../components/shared/PageHeader';
import { PanelHeader } from '../components/shared/PanelHeader';
import { getDomainThemeStyle } from '../lib/domain-utils';
import { formatDateTimeDisplay } from '../lib/date-format';
import { syncService } from '../lib/sync/service';
import { FormField, TextInput, Select } from '../components/shared/form';

type BackupActionMode = 'import' | 'restore-latest';

interface PendingBackupAction {
  mode: BackupActionMode;
  preview: BackupPreview;
  rawData?: string;
  fileLabel: string;
}

interface DomainDraft {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const EMPTY_DOMAIN_DRAFT: Omit<DomainDraft, 'id'> = {
  name: '',
  icon: '[D]',
  color: '#7C6CFF',
};

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

const rowLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-muted)',
  letterSpacing: 1,
  lineHeight: 1.6,
};

function formatAge(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return 'UNKNOWN';
  if (hours < 1) return 'LESS THAN 1 HOUR';
  if (hours < 24) return `${hours} HOURS AGO`;
  const days = Math.floor(hours / 24);
  return `${days} DAY${days === 1 ? '' : 'S'} AGO`;
}

function compareIsoDates(left?: string | null, right?: string | null): number {
  if (!left || !right) return 0;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) return 0;
  return leftMs - rightMs;
}

function buildConflictWarnings(preview: BackupPreview, health: BackupHealthStatus | null): string[] {
  const warnings = [...preview.warnings];
  if (health?.latest_backup?.exported_at && preview.exported_at) {
    if (compareIsoDates(preview.exported_at, health.latest_backup.exported_at) < 0) {
      warnings.push('This backup appears older than the newest snapshot already available on this device.');
    }
  }
  if (health?.last_backup_at && preview.modified_at) {
    if (compareIsoDates(preview.modified_at, health.last_backup_at) < 0) {
      warnings.push('The file timestamp is older than your latest local backup activity. Restore only if you intentionally want to roll back.');
    }
  }
  return warnings;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function formatTimestamp(value: string | null | undefined): string {
  return formatDateTimeDisplay(value);
}

export const SettingsPage: React.FC = () => {
  const { appState, saveApiKey, resetData, loadAppState } = useAppStore();
  const { loadDomains, domains, createDomain, updateDomainProfile, deleteDomain } = useDomainStore();
  const { loadTasks } = useTaskStore();
  const { loadHabits } = useHabitStore();
  const { loadGoals } = useGoalStore();
  const { loadNotes } = useNoteStore();
  const { loadInbox } = useInboxStore();
  const { loadTaskTemplates } = useTemplateStore();
  const { loadFocusSessions } = useFocusStore();
  const { loadTaskFrictionLogs } = useFrictionStore();
  const { status: updateStatus, version: updateVersion, error: updateError, checkNow, download, restart } = useUpdaterStore();
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    void getVersion().then(setCurrentVersion);
  }, []);

  const [apiKeyInput, setApiKeyInput] = useState(appState?.api_key ?? '');
  const [backupDirectoryInput, setBackupDirectoryInput] = useState(appState?.backup_directory ?? '');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(appState?.auto_backup_enabled ?? false);
  const [textScale, setTextScale] = useState(appState?.text_scale ?? 'normal');
  const [uiDensity, setUiDensity] = useState(appState?.ui_density ?? 'comfortable');
  const [syncUrlInput, setSyncUrlInput] = useState(appState?.sync_supabase_url ?? '');
  const [syncAnonKeyInput, setSyncAnonKeyInput] = useState(appState?.sync_supabase_anon_key ?? '');
  const [syncEmailInput, setSyncEmailInput] = useState(appState?.sync_user_email ?? '');
  const [syncPasswordInput, setSyncPasswordInput] = useState('');
  const [syncBootstrapStatus, setSyncBootstrapStatus] = useState<SyncBootstrapStatus | null>(null);
  const [syncActionLabel, setSyncActionLabel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [syncSaved, setSyncSaved] = useState(false);
  const [displaySaved, setDisplaySaved] = useState(false);
  const [domainSaved, setDomainSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [backupHealth, setBackupHealth] = useState<BackupHealthStatus | null>(null);
  const [latestBackupPreview, setLatestBackupPreview] = useState<BackupPreview | null>(null);
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [deletedGoals, setDeletedGoals] = useState<Goal[]>([]);
  const [deletedInboxItems, setDeletedInboxItems] = useState<InboxItem[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingBackupAction | null>(null);
  const [domainDrafts, setDomainDrafts] = useState<DomainDraft[]>([]);
  const [newDomainDraft, setNewDomainDraft] = useState<Omit<DomainDraft, 'id'>>(EMPTY_DOMAIN_DRAFT);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setApiKeyInput(appState?.api_key ?? '');
    setBackupDirectoryInput(appState?.backup_directory ?? '');
    setAutoBackupEnabled(appState?.auto_backup_enabled ?? false);
    setTextScale(appState?.text_scale ?? 'normal');
    setUiDensity(appState?.ui_density ?? 'comfortable');
    setSyncUrlInput(appState?.sync_supabase_url ?? '');
    setSyncAnonKeyInput(appState?.sync_supabase_anon_key ?? '');
    setSyncEmailInput(appState?.sync_user_email ?? '');
  }, [
    appState?.api_key,
    appState?.backup_directory,
    appState?.auto_backup_enabled,
    appState?.text_scale,
    appState?.ui_density,
    appState?.sync_supabase_url,
    appState?.sync_supabase_anon_key,
    appState?.sync_user_email,
  ]);

  useEffect(() => {
    setDomainDrafts(
      domains.map((domain) => ({
        id: domain.id,
        name: domain.name,
        icon: domain.icon,
        color: domain.color,
      })),
    );
  }, [domains]);

  const refreshBackupData = async () => {
    try {
      const [history, health] = await Promise.all([
        db.listBackups().catch(() => []),
        db.getBackupHealthStatus().catch(() => null),
      ]);
      setBackupHistory(history);
      setBackupHealth(health);
      if (history.length > 0) {
        try {
          setLatestBackupPreview(await db.previewLatestBackup());
        } catch {
          setLatestBackupPreview(null);
        }
      } else {
        setLatestBackupPreview(null);
      }
    } catch (error) {
      setStatusMessage(`BACKUP STATUS ERROR: ${formatError(error)}`);
    }
  };

  const refreshRecoveryBin = async () => {
    try {
      const [notes, goals, inboxItems] = await Promise.all([
        db.getDeletedNotes().catch(() => []),
        db.getDeletedGoals().catch(() => []),
        db.getDeletedInboxItems().catch(() => []),
      ]);
      setDeletedNotes(notes);
      setDeletedGoals(goals);
      setDeletedInboxItems(inboxItems);
    } catch (error) {
      setStatusMessage(`RECOVERY BIN ERROR: ${formatError(error)}`);
    }
  };

  const refreshSyncStatus = async (stateOverride?: typeof appState) => {
    const sourceState = stateOverride ?? appState;
    if (!sourceState || !syncService.hasSession(sourceState)) {
      setSyncBootstrapStatus(null);
      return;
    }

    try {
      setSyncBootstrapStatus(await syncService.getBootstrapStatus(sourceState));
    } catch (error) {
      setSyncBootstrapStatus(null);
      setStatusMessage(`SYNC STATUS ERROR: ${formatError(error)}`);
    }
  };

  useEffect(() => {
    void refreshBackupData();
    void refreshRecoveryBin();
  }, [appState?.backup_directory, appState?.last_backup_at, appState?.auto_backup_enabled]);

  useEffect(() => {
    void refreshSyncStatus();
  }, [
    appState?.sync_supabase_url,
    appState?.sync_supabase_anon_key,
    appState?.sync_access_token,
    appState?.sync_refresh_token,
    appState?.sync_user_id,
    appState?.sync_last_sync_at,
  ]);

  const reloadAllData = async () => {
    await Promise.all([
      loadDomains(),
      loadTasks(),
      loadHabits(),
      loadGoals(),
      loadAppState(),
      loadNotes(),
      loadInbox(),
      loadTaskTemplates(),
      loadFocusSessions(),
      loadTaskFrictionLogs(),
    ]);
    await refreshBackupData();
    await refreshRecoveryBin();
  };

  const handleRestoreNote = async (id: string) => {
    try {
      await db.restoreNote(id);
      await Promise.all([loadNotes(), refreshRecoveryBin()]);
      setStatusMessage('NOTE RESTORED');
    } catch (error) {
      setStatusMessage(`NOTE RESTORE FAILED: ${formatError(error)}`);
    }
  };

  const handleRestoreGoal = async (id: string) => {
    try {
      await db.restoreGoal(id);
      await Promise.all([loadGoals(), refreshRecoveryBin()]);
      setStatusMessage('GOAL RESTORED');
    } catch (error) {
      setStatusMessage(`GOAL RESTORE FAILED: ${formatError(error)}`);
    }
  };

  const handleRestoreInboxItem = async (id: string) => {
    try {
      await db.restoreInboxItem(id);
      await Promise.all([loadInbox(), refreshRecoveryBin()]);
      setStatusMessage('INBOX ITEM RESTORED');
    } catch (error) {
      setStatusMessage(`INBOX RESTORE FAILED: ${formatError(error)}`);
    }
  };

  const handleExport = async () => {
    try {
      const data = await db.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `life-os-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage('EXPORT READY');
    } catch (error) {
      setStatusMessage(`EXPORT FAILED: ${formatError(error)}`);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const path = await db.createBackup();
      await loadAppState();
      await refreshBackupData();
      setStatusMessage(`BACKUP CREATED: ${path}`);
    } catch (error) {
      setStatusMessage(`BACKUP FAILED: ${formatError(error)}`);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) return;
    try {
      const path = await db.createNamedSnapshot(snapshotName);
      setSnapshotName('');
      await loadAppState();
      await refreshBackupData();
      setStatusMessage(`SNAPSHOT CREATED: ${path}`);
    } catch (error) {
      setStatusMessage(`SNAPSHOT FAILED: ${formatError(error)}`);
    }
  };

  const handleSafetyBackup = async (label = 'manual-safety') => {
    try {
      const path = await db.backupBeforeRiskyAction(label);
      await loadAppState();
      await refreshBackupData();
      setStatusMessage(`SAFETY BACKUP CREATED: ${path}`);
    } catch (error) {
      setStatusMessage(`SAFETY BACKUP FAILED: ${formatError(error)}`);
    }
  };

  const handleSaveKey = async () => {
    try {
      await saveApiKey(apiKeyInput.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setStatusMessage(`SAVE KEY FAILED: ${formatError(error)}`);
    }
  };

  const handleSaveSyncSettings = async () => {
    try {
      await db.updateBackupSettings(
        backupDirectoryInput.trim() || null,
        autoBackupEnabled,
      );
      await loadAppState();
      await refreshBackupData();
      setSyncSaved(true);
      setStatusMessage('SYNC SETTINGS SAVED');
      setTimeout(() => setSyncSaved(false), 2000);
    } catch (error) {
      setStatusMessage(`SYNC SAVE FAILED: ${formatError(error)}`);
    }
  };

  const handleSyncSignIn = async () => {
    if (!syncUrlInput.trim() || !syncAnonKeyInput.trim() || !syncEmailInput.trim() || !syncPasswordInput) {
      setStatusMessage('SYNC SIGN-IN FAILED: COMPLETE THE URL, ANON KEY, EMAIL, AND PASSWORD FIRST.');
      return;
    }

    setSyncActionLabel('CONNECTING');
    try {
      const nextState = await syncService.signIn({
        url: syncUrlInput.trim(),
        anonKey: syncAnonKeyInput.trim(),
        email: syncEmailInput.trim(),
        password: syncPasswordInput,
      });
      setSyncPasswordInput('');
      await loadAppState();
      await refreshSyncStatus(nextState);
      setStatusMessage(`SYNC CONNECTED: ${nextState.sync_user_email ?? syncEmailInput.trim()}`);
    } catch (error) {
      await loadAppState();
      setStatusMessage(`SYNC SIGN-IN FAILED: ${formatError(error)}`);
    } finally {
      setSyncActionLabel(null);
    }
  };

  const handleSyncSignOut = async () => {
    setSyncActionLabel('DISCONNECTING');
    try {
      await syncService.signOut();
      setSyncPasswordInput('');
      await loadAppState();
      setSyncBootstrapStatus(null);
      setStatusMessage('SYNC SESSION CLEARED');
    } catch (error) {
      setStatusMessage(`SYNC SIGN-OUT FAILED: ${formatError(error)}`);
    } finally {
      setSyncActionLabel(null);
    }
  };

  const handleSyncNow = async () => {
    if (!appState) return;
    setSyncActionLabel('SYNCING NOW');
    try {
      const counts = await syncService.syncNow(appState);
      await reloadAllData();
      await refreshSyncStatus();
      setStatusMessage(`SYNC COMPLETE: ${counts.total} ACTIVE RECORDS IN STEP`);
    } catch (error) {
      await loadAppState();
      setStatusMessage(`SYNC FAILED: ${formatError(error)}`);
    } finally {
      setSyncActionLabel(null);
    }
  };

  const handleUploadThisDevice = async () => {
    if (!appState) return;
    if (!window.confirm('Upload this device to cloud?\n\nUse this when cloud is empty or you intentionally want cloud to match this desktop state. A safety backup will be created first.')) return;
    setSyncActionLabel('UPLOADING DEVICE');
    try {
      await handleSafetyBackup('before-sync-upload');
      const counts = await syncService.uploadThisDevice(appState);
      await loadAppState();
      await refreshSyncStatus();
      setStatusMessage(`DEVICE UPLOADED: ${counts.total} ACTIVE RECORDS SENT TO CLOUD`);
    } catch (error) {
      await loadAppState();
      setStatusMessage(`UPLOAD FAILED: ${formatError(error)}`);
    } finally {
      setSyncActionLabel(null);
    }
  };

  const handleReplaceLocalWithCloud = async () => {
    if (!appState) return;
    if (!window.confirm('Replace this desktop with cloud data?\n\nThis rewrites the synced tables on this device. A safety backup will be created first.')) return;
    setSyncActionLabel('REPLACING LOCAL');
    try {
      await handleSafetyBackup('before-sync-replace-local');
      const counts = await syncService.replaceLocalWithCloud(appState);
      await reloadAllData();
      await refreshSyncStatus();
      setStatusMessage(`LOCAL DATA REPLACED FROM CLOUD: ${counts.total} ACTIVE RECORDS`);
    } catch (error) {
      await loadAppState();
      setStatusMessage(`REPLACE LOCAL FAILED: ${formatError(error)}`);
    } finally {
      setSyncActionLabel(null);
    }
  };

  const handleSaveDisplaySettings = async () => {
    try {
      await db.updateUiPreferences('medium', textScale, uiDensity);
      await loadAppState();
      setDisplaySaved(true);
      setStatusMessage('DISPLAY PROFILE SAVED');
      setTimeout(() => setDisplaySaved(false), 2000);
    } catch (error) {
      setStatusMessage(`DISPLAY SAVE FAILED: ${formatError(error)}`);
    }
  };

  const handleDomainDraftChange = (id: string, key: keyof Omit<DomainDraft, 'id'>, value: string) => {
    setDomainDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, [key]: value } : draft));
  };

  const handleSaveDomains = async () => {
    const invalidDraft = domainDrafts.find((draft) => !isHexColor(draft.color));
    if (invalidDraft) {
      setStatusMessage(`DOMAIN SAVE FAILED: INVALID COLOR FOR ${invalidDraft.name.toUpperCase() || invalidDraft.id.toUpperCase()}`);
      return;
    }

    try {
      await Promise.all(domainDrafts.map((draft) => updateDomainProfile({
        id: draft.id,
        name: draft.name.trim(),
        icon: draft.icon.trim(),
        color: draft.color.trim(),
      })));
      await loadDomains();
      setDomainSaved(true);
      setStatusMessage('DOMAIN PROFILES SAVED');
      setTimeout(() => setDomainSaved(false), 2000);
    } catch (error) {
      setStatusMessage(`DOMAIN SAVE FAILED: ${formatError(error)}`);
    }
  };

  const handleCreateDomain = async () => {
    if (!newDomainDraft.name.trim()) {
      setStatusMessage('DOMAIN CREATE FAILED: NAME IS REQUIRED');
      return;
    }
    if (!isHexColor(newDomainDraft.color)) {
      setStatusMessage('DOMAIN CREATE FAILED: INVALID COLOR');
      return;
    }

    try {
      await createDomain({
        name: newDomainDraft.name.trim(),
        icon: newDomainDraft.icon.trim() || '[D]',
        color: newDomainDraft.color.trim(),
      });
      await loadDomains();
      setNewDomainDraft(EMPTY_DOMAIN_DRAFT);
      setStatusMessage('DOMAIN CREATED');
    } catch (error) {
      setStatusMessage(`DOMAIN CREATE FAILED: ${formatError(error)}`);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    const domain = domains.find((entry) => entry.id === id);
    if (!window.confirm(`DELETE DOMAIN "${domain?.name ?? id}"?\n\nThis can affect work and history tied to that domain. A safety backup will be created first.`)) return;
    setDeletingDomainId(id);
    try {
      await handleSafetyBackup(`before-delete-domain-${id}`);
      await deleteDomain(id);
      await loadDomains();
      setStatusMessage('DOMAIN DELETED');
    } catch (error) {
      setStatusMessage(`DOMAIN DELETE FAILED: ${formatError(error)}`);
    } finally {
      setDeletingDomainId(null);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const contents = await file.text();
      const preview = await db.previewImportData(contents);
      setPendingAction({
        mode: 'import',
        rawData: contents,
        fileLabel: file.name,
        preview: {
          ...preview,
          file_name: preview.file_name ?? file.name,
          backup_name: preview.backup_name === 'selected-backup' ? file.name.replace(/\.json$/i, '') : preview.backup_name,
        },
      });
    } catch (error) {
      setStatusMessage(`IMPORT PREVIEW FAILED: ${formatError(error)}`);
    } finally {
      event.target.value = '';
    }
  };

  const handlePrepareRestoreLatest = async () => {
    try {
      const preview = await db.previewLatestBackup();
      setPendingAction({
        mode: 'restore-latest',
        preview,
        fileLabel: preview.file_name ?? 'LATEST BACKUP',
      });
    } catch (error) {
      setStatusMessage(`RESTORE PREVIEW FAILED: ${formatError(error)}`);
    }
  };

  const handleConfirmBackupAction = async () => {
    if (!pendingAction) return;
    setIsImporting(true);
    try {
      if (pendingAction.mode === 'import' && pendingAction.rawData) {
        await db.importData(pendingAction.rawData);
        await reloadAllData();
        setStatusMessage(`IMPORT COMPLETE: ${pendingAction.fileLabel}`);
      } else if (pendingAction.mode === 'restore-latest') {
        const restoredFrom = await db.restoreLatestBackup();
        await reloadAllData();
        setStatusMessage(`RESTORED LATEST BACKUP: ${restoredFrom}`);
      }
      setPendingAction(null);
    } catch (error) {
      setStatusMessage(`RESTORE FAILED: ${formatError(error)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetData();
      await refreshBackupData();
      setShowResetConfirm(false);
    } catch (error) {
      setStatusMessage(`RESET FAILED: ${formatError(error)}`);
    }
  };

  const modalWarnings = useMemo(
    () => pendingAction ? buildConflictWarnings(pendingAction.preview, backupHealth) : [],
    [pendingAction, backupHealth],
  );

  const latestBackupSummary = latestBackupPreview ?? pendingAction?.preview ?? null;
  const recoveryBinCount = deletedNotes.length + deletedGoals.length + deletedInboxItems.length;
  const backupStatusColor = backupHealth?.status_label === 'healthy'
    ? 'var(--color-accent)'
    : backupHealth?.status_label === 'critical'
      ? 'var(--color-danger)'
      : 'var(--color-warning)';
  const backupStatusMessage = backupHealth?.status_label === 'healthy'
    ? 'Backups look current. You can restore with confidence if needed.'
    : backupHealth?.status_label === 'critical'
      ? 'Backups need attention before you trust risky actions.'
      : 'Backups exist, but they should be checked before major changes.';
  const syncConnected = syncService.hasSession(appState);
  const syncStateLabel = syncBootstrapStatus?.state === 'remote_empty'
    ? 'CLOUD EMPTY'
    : syncBootstrapStatus?.state === 'local_empty'
      ? 'LOCAL EMPTY'
      : syncBootstrapStatus?.state === 'both_have_data'
        ? 'CHOICE REQUIRED'
        : syncConnected
          ? 'READY'
          : 'OFFLINE';

  return (
    <div className="page-content fade-in">
      <PageHeader title="SETTINGS" subtitle="SYSTEM CONFIGURATION + BACKUP CONTROL" />

      <hr className="page-sep" />

      <div className="card" style={{ marginBottom: 'var(--space-3)', borderColor: backupStatusColor }}>
        <PanelHeader
          title={<span style={{ color: backupStatusColor }}>SAFETY STATUS</span>}
          style={{ borderColor: backupStatusColor }}
          right={<span style={{ ...rowLabelStyle, color: backupStatusColor }}>{backupHealth?.status_label?.toUpperCase() ?? 'UNKNOWN'}</span>}
        />
        <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: backupStatusColor }}>
            {backupStatusMessage}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-2)' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>LAST BACKUP</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{formatTimestamp(appState?.last_backup_at)}</span>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>LATEST SNAPSHOT AGE</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{formatAge(backupHealth?.latest_backup_age_hours)}</span>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>RECOVERY BIN</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: recoveryBinCount > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>{recoveryBinCount} ITEM{recoveryBinCount === 1 ? '' : 'S'}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
            Before restore, import, domain deletion, or reset, create a safety backup if the latest snapshot does not feel current enough.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
        <PanelHeader
          title="UPDATES"
          right={<span style={rowLabelStyle}>{currentVersion ? `v${currentVersion}` : '...'}</span>}
        />
        <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
            {updateStatus === 'idle' && 'No check has run yet this session.'}
            {updateStatus === 'checking' && 'Checking for a newer version...'}
            {updateStatus === 'up_to_date' && 'You are running the latest version.'}
            {updateStatus === 'available' && `Version ${updateVersion} is available.`}
            {updateStatus === 'downloading' && 'Downloading the update...'}
            {updateStatus === 'ready' && 'Update downloaded. Restart to install it.'}
            {updateStatus === 'error' && `Could not check for updates: ${updateError ?? 'unknown error'}`}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => void checkNow()} disabled={updateStatus === 'checking' || updateStatus === 'downloading'}>
              {updateStatus === 'checking' ? 'CHECKING...' : 'CHECK FOR UPDATES'}
            </button>
            {updateStatus === 'available' && (
              <button className="btn btn-primary" onClick={() => void download()}>
                DOWNLOAD UPDATE
              </button>
            )}
            {updateStatus === 'ready' && (
              <button className="btn btn-primary" onClick={() => void restart()}>
                RESTART TO UPDATE
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <PanelHeader
          title="SYNC ACCOUNT"
          right={<span style={{ ...rowLabelStyle, color: syncConnected ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{syncStateLabel}</span>}
        />
        <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: syncConnected ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
            Optional cross-device sync stays local-first. Sign in, compare this desktop with cloud, then choose a safe direction before you let both sides converge.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <FormField label="Supabase URL">
              <TextInput value={syncUrlInput} onChange={(event) => setSyncUrlInput(event.target.value)} placeholder="https://project.supabase.co" />
            </FormField>
            <FormField label="Anon Key">
              <TextInput value={syncAnonKeyInput} onChange={(event) => setSyncAnonKeyInput(event.target.value)} placeholder="eyJ..." />
            </FormField>
            <FormField label="Email">
              <TextInput value={syncEmailInput} onChange={(event) => setSyncEmailInput(event.target.value)} placeholder="you@example.com" />
            </FormField>
            <FormField label="Password">
              <TextInput type="password" value={syncPasswordInput} onChange={(event) => setSyncPasswordInput(event.target.value)} placeholder="Required to connect" />
            </FormField>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => void handleSyncSignIn()} disabled={Boolean(syncActionLabel)}>
              {syncActionLabel === 'CONNECTING' ? 'CONNECTING...' : syncConnected ? 'REFRESH SESSION' : 'CONNECT TO SYNC'}
            </button>
            <button className="btn btn-ghost" onClick={() => void handleSyncNow()} disabled={!syncConnected || Boolean(syncActionLabel)}>
              {syncActionLabel === 'SYNCING NOW' ? 'SYNCING...' : 'SYNC NOW'}
            </button>
            <button className="btn btn-ghost" onClick={() => void handleUploadThisDevice()} disabled={!syncConnected || Boolean(syncActionLabel)}>
              {syncActionLabel === 'UPLOADING DEVICE' ? 'UPLOADING...' : 'UPLOAD THIS DEVICE'}
            </button>
            <button className="btn btn-ghost" onClick={() => void handleReplaceLocalWithCloud()} disabled={!syncConnected || Boolean(syncActionLabel)}>
              {syncActionLabel === 'REPLACING LOCAL' ? 'REPLACING...' : 'REPLACE LOCAL WITH CLOUD'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => void handleSyncSignOut()} disabled={!syncConnected || Boolean(syncActionLabel)}>
              {syncActionLabel === 'DISCONNECTING' ? 'DISCONNECTING...' : 'SIGN OUT'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-2)' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>ACCOUNT</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: syncConnected ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                  {appState?.sync_user_email ?? 'NOT CONNECTED'}
                </span>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>LAST SYNC</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{formatTimestamp(appState?.sync_last_sync_at)}</span>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>LOCAL RECORDS</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{syncBootstrapStatus?.local_counts.total ?? 0}</span>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>CLOUD RECORDS</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{syncBootstrapStatus?.remote_counts.total ?? 0}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <div className="card" style={{ margin: 0 }}>
              <PanelHeader title="THIS DEVICE" right={<span style={rowLabelStyle}>{syncBootstrapStatus?.local_counts.total ?? 0}</span>} />
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>DOMAINS: {syncBootstrapStatus?.local_counts.domains ?? 0}</span>
                <span style={rowLabelStyle}>TASKS: {syncBootstrapStatus?.local_counts.tasks ?? 0}</span>
                <span style={rowLabelStyle}>HABITS: {syncBootstrapStatus?.local_counts.habits ?? 0}</span>
                <span style={rowLabelStyle}>HABIT LOGS: {syncBootstrapStatus?.local_counts.habit_logs ?? 0}</span>
                <span style={rowLabelStyle}>GOALS: {syncBootstrapStatus?.local_counts.goals ?? 0}</span>
                <span style={rowLabelStyle}>NOTES: {syncBootstrapStatus?.local_counts.notes ?? 0}</span>
                <span style={rowLabelStyle}>INBOX: {syncBootstrapStatus?.local_counts.inbox_items ?? 0}</span>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <PanelHeader title="CLOUD" right={<span style={rowLabelStyle}>{syncBootstrapStatus?.remote_counts.total ?? 0}</span>} />
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>DOMAINS: {syncBootstrapStatus?.remote_counts.domains ?? 0}</span>
                <span style={rowLabelStyle}>TASKS: {syncBootstrapStatus?.remote_counts.tasks ?? 0}</span>
                <span style={rowLabelStyle}>HABITS: {syncBootstrapStatus?.remote_counts.habits ?? 0}</span>
                <span style={rowLabelStyle}>HABIT LOGS: {syncBootstrapStatus?.remote_counts.habit_logs ?? 0}</span>
                <span style={rowLabelStyle}>GOALS: {syncBootstrapStatus?.remote_counts.goals ?? 0}</span>
                <span style={rowLabelStyle}>NOTES: {syncBootstrapStatus?.remote_counts.notes ?? 0}</span>
                <span style={rowLabelStyle}>INBOX: {syncBootstrapStatus?.remote_counts.inbox_items ?? 0}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={rowLabelStyle}>FIRST-TIME RULE</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
              If cloud is empty, upload this device after a safety backup. If local is empty, pull cloud down. If both sides already have data, choose intentionally. The app will not auto-merge first-time setup for you.
            </span>
            {appState?.sync_last_sync_error ? (
              <span style={{ ...rowLabelStyle, color: 'var(--color-warning)' }}>LAST ERROR: {appState.sync_last_sync_error}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <PanelHeader
          title="SYNC-READY BACKUPS"
          right={(
            <span style={{ ...rowLabelStyle, color: backupHealth?.status_label === 'healthy' ? 'var(--color-accent)' : backupHealth?.status_label === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
              STATUS: {backupHealth?.status_label?.toUpperCase() ?? 'UNKNOWN'}
            </span>
          )}
        />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={rowLabelStyle}>
            USE A NORMAL FOLDER ON YOUR COMPUTER OR A SYNCTHING-SYNCED FOLDER. LIFE OS WRITES JSON SNAPSHOTS THERE, SO YOU CAN RESTORE THEM ON ANY INSTALL WITHOUT SHARING THE LIVE SQLITE DATABASE.
          </p>

          <FormField label="Backup Folder Path">
            <TextInput
              value={backupDirectoryInput}
              onChange={(e) => setBackupDirectoryInput(e.target.value)}
              placeholder="C:\\Users\\YourName\\Syncthing\\Life OS"
            />
          </FormField>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
            letterSpacing: 1,
            minHeight: 40,
          }}>
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            CREATE ONE BACKUP AUTOMATICALLY PER DAY ON APP OPEN
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <button className="btn btn-primary" onClick={handleSaveSyncSettings}>
              {syncSaved ? 'SYNC SAVED' : 'SAVE SYNC SETTINGS'}
            </button>
            <button className="btn btn-ghost" onClick={handleCreateBackup}>
              CREATE BACKUP NOW
            </button>
            <button className="btn btn-ghost" onClick={() => void handleSafetyBackup('manual-safety')}>
              SAFETY BACKUP
            </button>
            <button className="btn btn-ghost" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
              PREVIEW IMPORT FILE
            </button>
            <button className="btn btn-ghost" onClick={() => void handlePrepareRestoreLatest()} disabled={isImporting}>
              PREVIEW LATEST RESTORE
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <TextInput
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="weekly-plan-clean-state"
              style={{ maxWidth: 320 }}
            />
            <button className="btn btn-ghost" onClick={handleCreateSnapshot} disabled={!snapshotName.trim()}>
              CREATE NAMED SNAPSHOT
            </button>
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>CURRENT FOLDER: {backupHealth?.backup_directory ?? appState?.backup_directory ?? 'NOT SET'}</span>
                <span style={rowLabelStyle}>LAST BACKUP: {appState?.last_backup_at ?? 'NONE YET'}</span>
                <span style={rowLabelStyle}>LATEST SNAPSHOT AGE: {formatAge(backupHealth?.latest_backup_age_hours)}</span>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <span style={rowLabelStyle}>LATEST FILE: {backupHealth?.latest_backup?.file_name ?? 'NONE YET'}</span>
                <span style={rowLabelStyle}>LATEST VERSION: {backupHealth?.latest_backup?.version ?? 'UNKNOWN'}</span>
                <span style={rowLabelStyle}>AUTO-BACKUP: {backupHealth?.auto_backup_enabled ? 'ACTIVE' : 'OFF'}</span>
              </div>
            </div>
          </div>

          {backupHealth?.pending_warnings?.length ? (
            <div className="card" style={{ margin: 0, borderColor: 'var(--color-warning)' }}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {backupHealth.pending_warnings.map((warning) => (
                  <span key={warning} style={{ ...rowLabelStyle, color: 'var(--color-warning)' }}>
                    {warning}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {statusMessage && (
            <span style={{ ...rowLabelStyle, color: 'var(--color-accent)' }}>
              {statusMessage}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <PanelHeader title="RESTORE PREVIEW + HISTORY" />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {latestBackupSummary ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-2)' }}>
              <span style={rowLabelStyle}>PREVIEW FILE: {latestBackupSummary.file_name ?? latestBackupSummary.backup_name}</span>
              <span style={rowLabelStyle}>EXPORTED: {latestBackupSummary.exported_at ?? 'UNKNOWN'}</span>
              <span style={rowLabelStyle}>VERSION: {latestBackupSummary.version ?? 'UNKNOWN'}</span>
              <span style={rowLabelStyle}>TASKS: {latestBackupSummary.counts.tasks}</span>
              <span style={rowLabelStyle}>HABITS: {latestBackupSummary.counts.habits}</span>
              <span style={rowLabelStyle}>GOALS: {latestBackupSummary.counts.goals}</span>
              <span style={rowLabelStyle}>NOTES: {latestBackupSummary.counts.notes}</span>
              <span style={rowLabelStyle}>INBOX: {latestBackupSummary.counts.inbox_items}</span>
            </div>
          ) : (
            <span style={rowLabelStyle}>NO BACKUP PREVIEW AVAILABLE YET.</span>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 240, overflowY: 'auto', paddingRight: 'var(--space-1)' }}>
            {backupHistory.length === 0 ? (
              <span style={rowLabelStyle}>NO SNAPSHOTS OR RESTORE EVENTS YET.</span>
            ) : backupHistory.slice(0, 12).map((item) => (
              <div key={`${item.last_action}-${item.file_path}-${item.modified_at ?? ''}`} className="task-row" style={{ padding: 'var(--space-3) var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)', letterSpacing: 1 }}>
                    {item.backup_name.toUpperCase()}
                  </span>
                  <span style={{ ...rowLabelStyle, color: item.last_action === 'restore' ? 'var(--color-info)' : item.last_action === 'snapshot' ? 'var(--color-warning)' : 'var(--color-accent)' }}>
                    {item.last_action.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'var(--space-1)' }}>
                  <span style={rowLabelStyle}>{item.file_name}</span>
                  <span style={rowLabelStyle}>TIME: {item.modified_at ?? 'UNKNOWN'}</span>
                  <span style={rowLabelStyle}>VERSION: {item.version ?? 'UNKNOWN'} / COMPAT: {item.compatibility.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <PanelHeader title="RECOVERY BIN" right={<span style={rowLabelStyle}>{deletedNotes.length + deletedGoals.length + deletedInboxItems.length} ITEMS</span>} />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={rowLabelStyle}>
            DELETES ARE NOW SOFT-REMOVED FIRST. IF YOU DELETE A NOTE, GOAL, OR INBOX ITEM BY ACCIDENT, YOU CAN RESTORE IT HERE LATER.
          </p>

          {deletedNotes.length === 0 && deletedGoals.length === 0 && deletedInboxItems.length === 0 ? (
            <span style={rowLabelStyle}>RECOVERY BIN IS EMPTY.</span>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
            <div className="card" style={{ margin: 0 }}>
              <PanelHeader title="NOTES" right={<span style={rowLabelStyle}>{deletedNotes.length}</span>} />
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 240, overflowY: 'auto' }}>
                {deletedNotes.length === 0 ? (
                  <span style={rowLabelStyle}>NO DELETED NOTES.</span>
                ) : deletedNotes.slice(0, 12).map((note) => (
                  <div key={note.id} className="task-row" style={{ padding: 'var(--space-3) var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>{note.title}</div>
                    <div style={rowLabelStyle}>DELETED: {formatTimestamp(note.deleted_at)}</div>
                    <div style={rowLabelStyle}>DOMAIN: {note.domain_id?.toUpperCase() ?? 'GLOBAL'}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => void handleRestoreNote(note.id)}>
                        RESTORE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <PanelHeader title="GOALS" right={<span style={rowLabelStyle}>{deletedGoals.length}</span>} />
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 240, overflowY: 'auto' }}>
                {deletedGoals.length === 0 ? (
                  <span style={rowLabelStyle}>NO DELETED GOALS.</span>
                ) : deletedGoals.slice(0, 12).map((goal) => (
                  <div key={goal.id} className="task-row" style={{ padding: 'var(--space-3) var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>{goal.title}</div>
                    <div style={rowLabelStyle}>DELETED: {formatTimestamp(goal.deleted_at)}</div>
                    <div style={rowLabelStyle}>STATUS: {goal.status.toUpperCase().replace('_', ' ')}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => void handleRestoreGoal(goal.id)}>
                        RESTORE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <PanelHeader title="INBOX" right={<span style={rowLabelStyle}>{deletedInboxItems.length}</span>} />
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 240, overflowY: 'auto' }}>
                {deletedInboxItems.length === 0 ? (
                  <span style={rowLabelStyle}>NO DELETED INBOX ITEMS.</span>
                ) : deletedInboxItems.slice(0, 12).map((item) => (
                  <div key={item.id} className="task-row" style={{ padding: 'var(--space-3) var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)', marginBottom: 'var(--space-1)', whiteSpace: 'pre-wrap' }}>{item.content}</div>
                    <div style={rowLabelStyle}>DELETED: {formatTimestamp(item.deleted_at)}</div>
                    <div style={rowLabelStyle}>STATUS: {item.status.toUpperCase()}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => void handleRestoreInboxItem(item.id)}>
                        RESTORE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <PanelHeader title="DISPLAY TUNING" />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={rowLabelStyle}>
            TUNE TEXT SCALE AND DENSITY PROFILE. THESE SETTINGS PERSIST IN YOUR DATABASE SO THE APP FEELS CONSISTENT AFTER RESTORE.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <FormField label="Text Scale">
              <Select value={textScale} onChange={(e) => setTextScale(e.target.value as 'normal' | 'large' | 'xl')}>
                <option value="normal">NORMAL</option>
                <option value="large">LARGE</option>
                <option value="xl">XL</option>
              </Select>
            </FormField>
            <FormField label="UI Density">
              <Select value={uiDensity} onChange={(e) => setUiDensity(e.target.value as 'compact' | 'comfortable')}>
                <option value="compact">COMPACT</option>
                <option value="comfortable">COMFORTABLE</option>
              </Select>
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSaveDisplaySettings}>
              {displaySaved ? 'DISPLAY SAVED' : 'SAVE DISPLAY PROFILE'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)' }}>
            <span style={rowLabelStyle}>CURRENT SCALE: {appState?.text_scale?.toUpperCase() ?? 'NORMAL'}</span>
            <span style={rowLabelStyle}>CURRENT DENSITY: {appState?.ui_density?.toUpperCase() ?? 'COMFORTABLE'}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <PanelHeader title="DOMAIN PROFILES" />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={rowLabelStyle}>
            DOMAINS POWER THE WHOLE APP. ADD AS MANY AS YOU WANT, CHANGE THEIR ICONS, AND TUNE THEIR COLORS SO THE SYSTEM FITS ANY USER WITHOUT BREAKING YOUR DATA OR FEATURES.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
            {domainDrafts.map((domain) => (
              <div key={domain.id} className="card" style={{ ...getDomainThemeStyle(domain), margin: 0 }}>
                <PanelHeader
                  title={<span style={{ color: 'var(--domain-primary)' }}>{domain.id.toUpperCase()}</span>}
                  right={(
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => void handleDeleteDomain(domain.id)}
                      disabled={deletingDomainId === domain.id}
                    >
                      {deletingDomainId === domain.id ? '...' : 'DELETE'}
                    </button>
                  )}
                />
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <FormField label="Display Name">
                    <TextInput value={domain.name} onChange={(event) => handleDomainDraftChange(domain.id, 'name', event.target.value)} />
                  </FormField>
                  <FormField label="Icon">
                    <TextInput value={domain.icon} onChange={(event) => handleDomainDraftChange(domain.id, 'icon', event.target.value)} placeholder="[A] or emoji" maxLength={8} />
                  </FormField>
                  <FormField label="Color">
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <TextInput value={domain.color} onChange={(event) => handleDomainDraftChange(domain.id, 'color', event.target.value)} placeholder="#7C6CFF" style={{ flex: 1 }} />
                      <input type="color" value={isHexColor(domain.color) ? domain.color : '#7C6CFF'} onChange={(event) => handleDomainDraftChange(domain.id, 'color', event.target.value)} style={{ width: 42, height: 42, border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }} />
                    </div>
                  </FormField>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ margin: 0 }}>
            <PanelHeader title="ADD DOMAIN" />
            <div className="card-body layout-grid-domain-form">
              <FormField label="Display Name">
                <TextInput value={newDomainDraft.name} onChange={(event) => setNewDomainDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Work, Health, Study..." />
              </FormField>
              <FormField label="Icon">
                <TextInput value={newDomainDraft.icon} onChange={(event) => setNewDomainDraft((current) => ({ ...current, icon: event.target.value }))} maxLength={8} placeholder="[D]" />
              </FormField>
              <FormField label="Color">
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <TextInput value={newDomainDraft.color} onChange={(event) => setNewDomainDraft((current) => ({ ...current, color: event.target.value }))} placeholder="#7C6CFF" style={{ flex: 1 }} />
                  <input type="color" value={isHexColor(newDomainDraft.color) ? newDomainDraft.color : '#7C6CFF'} onChange={(event) => setNewDomainDraft((current) => ({ ...current, color: event.target.value }))} style={{ width: 42, height: 42, border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }} />
                </div>
              </FormField>
              <button className="btn btn-primary" onClick={() => void handleCreateDomain()}>
                ADD
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSaveDomains}>
              {domainSaved ? 'DOMAINS SAVED' : 'SAVE DOMAIN PROFILES'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <PanelHeader
          title="AI ASSIST FEATURES"
          right={(
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '2px var(--space-2)',
              border: `1px solid ${appState?.api_key ? 'var(--color-accent)' : 'var(--color-border)'}`,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
              color: appState?.api_key ? 'var(--color-accent)' : 'var(--color-text-muted)',
              letterSpacing: 1,
            }}>
              <span style={{
                width: 5,
                height: 5,
                background: appState?.api_key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                boxShadow: appState?.api_key ? 'var(--shadow-focus-ring)' : 'none',
                display: 'inline-block',
              }} />
              {appState?.api_key ? 'ACTIVE' : 'FALLBACK MODE'}
            </div>
          )}
        />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={rowLabelStyle}>
            ENTER YOUR ANTHROPIC API KEY TO ENABLE AI-ASSISTED ANALYSIS AND SMARTER SYSTEM GUIDANCE.
            WITHOUT A KEY, LIFE OS STAYS FULLY LOCAL AND CONTINUES TO WORK NORMALLY.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <TextInput
              type="password"
              placeholder="sk-ant-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSaveKey}
              disabled={!apiKeyInput.trim()}
            >
              {saved ? 'SAVED' : 'SAVE KEY'}
            </button>
          </div>
          {appState?.api_key && (
            <button
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-danger)',
                cursor: 'crosshair',
                textAlign: 'left',
                padding: 0,
                letterSpacing: 1,
              }}
              onClick={() => {
                setApiKeyInput('');
                void saveApiKey('');
              }}
            >
              [ REMOVE API KEY ]
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <PanelHeader title="DATA EXPORT" />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={rowLabelStyle}>
            EXPORT ALL YOUR DATA AS A JSON FILE. API KEYS STAY LOCAL TO THIS DEVICE, BUT YOUR TASKS, HABITS, GOALS, NOTES, HISTORY, AND APP STATE CAN MOVE CLEANLY TO ANOTHER INSTALL.
          </p>
          <button className="btn btn-ghost" onClick={handleExport} style={{ alignSelf: 'flex-start' }}>
            EXPORT AS JSON
          </button>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
        <PanelHeader title={<span style={{ color: 'var(--color-danger)' }}>DANGER ZONE</span>} style={{ borderColor: 'var(--color-danger)' }} />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={rowLabelStyle}>
            PERMANENTLY DELETE ALL TASKS, HABITS, GOALS, HISTORY, AND ACHIEVEMENT PROGRESS.
            BACKUP SETTINGS STAY IN PLACE, BUT YOUR LIVE DATA WILL BE GONE UNLESS YOU RESTORE FROM A SNAPSHOT.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <button className="btn btn-ghost" onClick={() => void handleSafetyBackup('before-reset')}>
              CREATE SAFETY BACKUP
            </button>
            {!showResetConfirm ? (
              <button className="btn btn-danger" onClick={() => setShowResetConfirm(true)} style={{ alignSelf: 'flex-start' }}>
                RESET ALL DATA
              </button>
            ) : (
              <>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-danger)', letterSpacing: 1 }}>
                  ARE YOU SURE? THIS ERASES LIVE DATA UNTIL YOU RESTORE A BACKUP.
                </span>
                <button className="btn btn-danger" onClick={handleReset}>YES, RESET</button>
                <button className="btn btn-ghost" onClick={() => setShowResetConfirm(false)}>CANCEL</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
            LIFE OS v0.6.0
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
            SQLITE / LOCAL-FIRST / SYNC-READY BACKUPS
          </span>
        </div>
      </div>

      <Modal
        open={Boolean(pendingAction)}
        onClose={() => !isImporting && setPendingAction(null)}
        title={pendingAction?.mode === 'import' ? 'IMPORT PREVIEW' : 'RESTORE PREVIEW'}
      >
        {pendingAction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <span style={{ ...rowLabelStyle, color: 'var(--color-text)' }}>
              FILE: {pendingAction.fileLabel}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-2)' }}>
              <span style={rowLabelStyle}>BACKUP NAME: {pendingAction.preview.backup_name}</span>
              <span style={rowLabelStyle}>EXPORTED: {pendingAction.preview.exported_at ?? 'UNKNOWN'}</span>
              <span style={rowLabelStyle}>VERSION: {pendingAction.preview.version ?? 'UNKNOWN'}</span>
              <span style={rowLabelStyle}>TASKS: {pendingAction.preview.counts.tasks}</span>
              <span style={rowLabelStyle}>HABITS: {pendingAction.preview.counts.habits}</span>
              <span style={rowLabelStyle}>GOALS: {pendingAction.preview.counts.goals}</span>
              <span style={rowLabelStyle}>NOTES: {pendingAction.preview.counts.notes}</span>
              <span style={rowLabelStyle}>FOCUS SESSIONS: {pendingAction.preview.counts.focus_sessions}</span>
            </div>
            {modalWarnings.length > 0 ? (
              <div className="card" style={{ margin: 0, borderColor: 'var(--color-warning)' }}>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {modalWarnings.map((warning) => (
                    <span key={warning} style={{ ...rowLabelStyle, color: 'var(--color-warning)' }}>
                      {warning}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <span style={rowLabelStyle}>
              LIFE OS WILL CREATE A SAFETY BACKUP AUTOMATICALLY BEFORE THIS ACTION CHANGES YOUR LIVE DATA.
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => void handleConfirmBackupAction()} disabled={isImporting}>
                {pendingAction.mode === 'import' ? 'IMPORT NOW' : 'RESTORE NOW'}
              </button>
              <button className="btn btn-ghost" onClick={() => setPendingAction(null)} disabled={isImporting}>
                CANCEL
              </button>
              <button className="btn btn-ghost" onClick={() => void handleSafetyBackup('manual-review-point')} disabled={isImporting}>
                EXTRA SAFETY BACKUP
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
