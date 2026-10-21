import * as api from "../api";
import { flushSync } from "react-dom";
import { getSlides } from "./editor/presentation";
import { toast } from "sonner";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getInitialLangCode } from "../components/LanguageSelector";
import type { UserIdentity } from "../utils/identity";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { usePreference } from "../context/PreferencesContext";
import { useEditorChrome } from "./editor/useEditorChrome";
import { useEditorAutoHide } from "./editor/useEditorAutoHide";
import { useEditorIdentity } from "./editor/useEditorIdentity";
import { EditorDialogs } from "./editor/EditorDialogs";
import { EditorView } from "./editor/EditorView";
import { useLibraryImportFromUrl } from "./editor/useLibraryImportFromUrl";
import { useEditorSnapshotGuards } from "./editor/useEditorSnapshotGuards";
import { useEditorSceneLoader } from "./editor/useEditorSceneLoader";
import { useEditorCollaboration } from "./editor/useEditorCollaboration";
import { useEditorPersistence } from "./editor/useEditorPersistence";
import { useEditorCanvasHandlers } from "./editor/useEditorCanvasHandlers";
import { useEditorCommands } from "./editor/useEditorCommands";
import { useEditorElementTracking } from "./editor/useEditorElementTracking";
import { useEditorBroadcast } from "./editor/useEditorBroadcast";
import { useEditorFileUploads } from "./editor/useEditorFileUploads";
import { useEditorSceneApi } from "./editor/useEditorSceneApi";
import { useEditorGridStep } from "./editor/useEditorGridStep";
import { useKeyboardLayoutFix } from "./editor/useKeyboardLayoutFix";
import { DEFAULT_GRID_STEP } from "../components/GridStepSelector";
import { PresentationDialog } from "./editor/PresentationDialog";
import { FrameAspectRatioGuide } from "./editor/FrameAspectRatioGuide";
import { RevealStepControl } from "./editor/RevealStepControl";
import { insertSlideTemplate } from "./editor/slideTemplates";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // Keep a departing drawing's queue and refs alive for its unmount flush,
  // while the next drawing starts with its own scene, version and permissions.
  return <ExcalidrawEditor key={id} />;
};

const ExcalidrawEditor: React.FC = () => {
  useKeyboardLayoutFix();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [accessLevel, setAccessLevel] = useState<
    "none" | "view" | "edit" | "owner"
  >("none");
  const canEdit = accessLevel === "edit" || accessLevel === "owner";
  const [drawingName, setDrawingName] = useState("Drawing Editor");
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [initialData, setInitialData] = useState<any>(null);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingOnLeave, setIsSavingOnLeave] = useState(false);
  const [editorAutoHide] = usePreference("editorAutoHide", false);
  const { autoHideEnabled, setAutoHideEnabled } = useEditorAutoHide(
    id,
    editorAutoHide,
  );
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [langCode, setLangCode] = usePreference(
    "language",
    getInitialLangCode(),
  );
  const [gridStep, setGridStep] = usePreference("gridStep", DEFAULT_GRID_STEP);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [presentationAPI, setPresentationAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [startPresentationImmediately, setStartPresentationImmediately] =
    useState(false);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [historyPreview, setHistoryPreview] =
    useState<api.DrawingSnapshotFull | null>(null);
  const { isHeaderVisible, setIsHeaderVisible } = useEditorChrome({
    drawingName,
    autoHideEnabled,
    isRenaming,
    isShareOpen,
  });
  const me: UserIdentity = useEditorIdentity(user);
  const [isReady, setIsReady] = useState(false);
  const {
    computeElementOrderSig,
    elementVersionMap,
    hasElementChanged,
    recordElementVersion,
  } = useEditorElementTracking();
  const isBootstrappingScene = useRef(true);
  const hasHydratedInitialScene = useRef(false);
  const isUnmounting = useRef(false);
  const latestElementsRef = useRef<readonly any[]>([]);
  const initialSceneElementsRef = useRef<readonly any[]>([]);
  const latestFilesRef = useRef<any>(null);
  const lastSyncedFilesRef = useRef<Record<string, any>>({});
  const lastSyncedElementOrderSigRef = useRef<string>("");
  const lastPersistedFilesRef = useRef<Record<string, any>>({});
  // fileId -> stored ref URL for images uploaded via the per-file endpoint.
  const uploadedFileRefsRef = useRef<Record<string, string>>({});
  const latestAppStateRef = useRef<any>(null);
  const debouncedSaveRef = useRef<
    | ((
        drawingId: string,
        elements: readonly any[],
        appState: any,
        files?: Record<string, any>,
      ) => void)
    | null
  >(null);
  const currentDrawingVersionRef = useRef<number | null>(null);
  const lastPersistedElementsRef = useRef<readonly any[]>([]);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const suspiciousBlankLoadRef = useRef(false);
  const hasSceneChangesSinceLoadRef = useRef(false);
  const lastLocalChangeAtRef = useRef<number>(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const excalidrawAPI = useRef<any>(null);
  const { resolveSafeSnapshot, normalizeImageElementStatus } =
    useEditorSnapshotGuards({
      lastPersistedElementsRef,
      initialSceneElementsRef,
      latestElementsRef,
    });
  useEffect(() => {
    isUnmounting.current = false;
    return () => {
      isUnmounting.current = true;
    };
  }, []);
  const handleSocketAccessDenied = useCallback(() => {
    if (!id || !location.pathname.startsWith("/editor/")) return;
    navigate(`/shared/${id}${location.search}${location.hash}`, {
      replace: true,
    });
  }, [id, location.hash, location.pathname, location.search, navigate]);
  const { peers, socketMeRef, socketRef, isSyncing, onPointerUpdate } =
    useEditorCollaboration({
      drawingId: id,
      me,
      isReady,
      excalidrawAPI,
      lastSyncedFilesRef,
      lastSyncedElementOrderSigRef,
      latestElementsRef,
      latestFilesRef,
      computeElementOrderSig,
      recordElementVersion,
      onAccessDenied: handleSocketAccessDenied,
    });
  const { scanNow: scanFileUploads } = useEditorFileUploads({
    canEdit,
    drawingId: id,
    isReady,
    excalidrawAPI,
    isSyncing,
    latestFiles: latestFilesRef,
    uploadedRefs: uploadedFileRefsRef,
  });
  const { emitFilesDeltaIfNeeded, setExcalidrawAPI } = useEditorSceneApi({
    canEdit,
    drawingId: id,
    excalidrawAPIRef: excalidrawAPI,
    isSyncing,
    socketRef,
    socketMeRef,
    lastSyncedFilesRef,
    latestFilesRef,
    latestElementsRef,
    latestAppStateRef,
    debouncedSaveRef,
    hasSceneChangesSinceLoadRef,
    uploadedRefs: uploadedFileRefsRef,
    scanFileUploads,
    setIsReady,
  });
  useLibraryImportFromUrl({ excalidrawAPIRef: excalidrawAPI, isReady, user });
  useEditorGridStep({ excalidrawAPI, isReady, gridStep });
  const persistenceRefs = React.useMemo(
    () => ({
      currentDrawingVersion: currentDrawingVersionRef,
      debouncedSave: debouncedSaveRef,
      excalidrawAPI,
      isSyncing,
      isUnmounting,
      lastLocalChangeAt: lastLocalChangeAtRef,
      lastPersistedElements: lastPersistedElementsRef,
      lastPersistedFiles: lastPersistedFilesRef,
      lastSyncedFiles: lastSyncedFilesRef,
      latestAppState: latestAppStateRef,
      latestElements: latestElementsRef,
      latestFiles: latestFilesRef,
      saveQueue: saveQueueRef,
      suspiciousBlankLoad: suspiciousBlankLoadRef,
      uploadedRefs: uploadedFileRefsRef,
    }),
    [isSyncing],
  );
  const {
    autosaveFailing,
    debouncedSave,
    debouncedSaveLibrary,
    debouncedSavePreview,
    enqueueSceneSave,
    saveDataRef,
    savePreviewRef,
    historyRestorePendingRef,
    runHistoryRestore,
  } = useEditorPersistence({
    drawingId: id,
    canEdit,
    refs: persistenceRefs,
    user,
    normalizeImageElementStatus,
    resolveSafeSnapshot,
  });
  const markSceneChangedSinceLoad = useCallback(() => {
    hasSceneChangesSinceLoadRef.current = true;
  }, []);
  const broadcastChanges = useEditorBroadcast({
    drawingId: id,
    excalidrawAPI,
    lastLocalChangeAtRef,
    lastSyncedElementOrderSigRef,
    lastSyncedFilesRef,
    latestAppStateRef,
    latestFilesRef,
    socketMeRef,
    socketRef,
    uploadedRefs: uploadedFileRefsRef,
    debouncedSave,
    debouncedSavePreview,
    computeElementOrderSig,
    hasElementChanged,
    normalizeImageElementStatus,
    recordElementVersion,
    setHasSceneChangesSinceLoad: markSceneChangedSinceLoad,
  });
  const sceneLoaderRefs = React.useMemo(
    () => ({
      elementVersionMap,
      saveQueue: saveQueueRef,
      latestElements: latestElementsRef,
      initialSceneElements: initialSceneElementsRef,
      latestFiles: latestFilesRef,
      isSyncing,
      lastSyncedFiles: lastSyncedFilesRef,
      lastSyncedElementOrderSig: lastSyncedElementOrderSigRef,
      lastPersistedFiles: lastPersistedFilesRef,
      currentDrawingVersion: currentDrawingVersionRef,
      lastPersistedElements: lastPersistedElementsRef,
      suspiciousBlankLoad: suspiciousBlankLoadRef,
      hasSceneChangesSinceLoad: hasSceneChangesSinceLoadRef,
      excalidrawAPI,
      latestAppState: latestAppStateRef,
      isBootstrappingScene,
      hasHydratedInitialScene,
    }),
    [elementVersionMap, isSyncing],
  );
  useEditorSceneLoader({
    id,
    user,
    location,
    navigate,
    refs: sceneLoaderRefs,
    setAccessLevel,
    setDrawingName,
    setInitialData,
    setIsReady,
    setIsSceneLoading,
    setLoadError,
    recordElementVersion,
    normalizeImageElementStatus,
  });
  const canvasHandlerRefs = React.useMemo(
    () => ({
      debouncedSave: debouncedSaveRef,
      excalidrawAPI,
      hasHydratedInitialScene,
      hasSceneChangesSinceLoad: hasSceneChangesSinceLoadRef,
      initialSceneElements: initialSceneElementsRef,
      isBootstrappingScene,
      isSyncing,
      isUnmounting,
      lastLocalChangeAt: lastLocalChangeAtRef,
      latestAppState: latestAppStateRef,
      latestElements: latestElementsRef,
      latestFiles: latestFilesRef,
      suspiciousBlankLoad: suspiciousBlankLoadRef,
    }),
    [isSyncing],
  );
  const { handleCanvasChange, handleCanvasDropCapture } =
    useEditorCanvasHandlers({
      canEdit,
      debouncedSavePreview,
      drawingId: id,
      emitFilesDeltaIfNeeded,
      isReady,
      refs: canvasHandlerRefs,
      resolveSafeSnapshot,
      broadcastChanges,
    });
  const commandRefs = React.useMemo(
    () => ({
      currentDrawingVersion: currentDrawingVersionRef,
      historyRestorePending: historyRestorePendingRef,
      excalidrawAPI,
      hasSceneChangesSinceLoad: hasSceneChangesSinceLoadRef,
      latestFiles: latestFilesRef,
      saveData: saveDataRef,
      savePreview: savePreviewRef,
      suspiciousBlankLoad: suspiciousBlankLoadRef,
      uploadedRefs: uploadedFileRefsRef,
    }),
    [historyRestorePendingRef, saveDataRef, savePreviewRef],
  );
  const {
    handleBackClick,
    handleExportClick,
    handleLibraryChange,
    handleRenameStart,
    handleRenameSubmit,
    handleToggleAutoHide,
  } = useEditorCommands({
    autoHideEnabled,
    canEdit,
    debouncedSaveLibrary,
    drawingId: id,
    drawingName,
    enqueueSceneSave,
    isSavingOnLeave,
    newName,
    refs: commandRefs,
    resolveSafeSnapshot,
    setAutoHideEnabled,
    setDrawingName,
    setIsHeaderVisible,
    setIsRenaming,
    setIsSavingOnLeave,
    setNewName,
    user,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        event.repeat ||
        event.isComposing ||
        event.defaultPrevented
      )
        return;
      if (
        !isReady ||
        isSceneLoading ||
        loadError ||
        isHistoryOpen ||
        isShareOpen ||
        presentationAPI ||
        isRenaming
      )
        return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"]',
        )
      )
        return;
      const editor = excalidrawAPI.current;
      if (!editor) return;
      const state = editor.getAppState();
      if (
        state.editingTextElement ||
        state.openDialog ||
        state.editingLinearElement ||
        state.croppingElementId ||
        state.newElement ||
        state.selectedElementsAreBeingDragged
      )
        return;
      const selected = editor
        .getSceneElements()
        .filter(
          (element: { id: string }) => state.selectedElementIds[element.id],
        );
      if (
        selected.length === 1 &&
        ["line", "arrow", "image"].includes(selected[0].type)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!getSlides(editor.getSceneElements()).length) {
        toast.info("Create a frame before starting a presentation.");
        return;
      }
      // Mount within the keyboard gesture so the browser permits fullscreen.
      flushSync(() => {
        setStartPresentationImmediately(true);
        setPresentationAPI(editor);
      });
      const dialog = document.getElementById("presentation-dialog");
      void dialog?.requestFullscreen?.().catch(() => {
        toast.info("Fullscreen was blocked. Presenting in this window.");
      });
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    isReady,
    isSceneLoading,
    loadError,
    isHistoryOpen,
    isShareOpen,
    presentationAPI,
    isRenaming,
  ]);

  return (
    <>
      <EditorView
        id={id}
        accessLevel={accessLevel}
        autoHideEnabled={autoHideEnabled}
        autosaveFailing={autosaveFailing}
        canEdit={canEdit}
        drawingName={drawingName}
        editorContainerRef={editorContainerRef}
        initialData={initialData}
        isHeaderVisible={isHeaderVisible}
        isHistoryOpen={isHistoryOpen}
        historyPreview={isHistoryOpen ? historyPreview : null}
        historyButtonRef={historyButtonRef}
        shareButtonRef={shareButtonRef}
        isRenaming={isRenaming}
        isSavingOnLeave={isSavingOnLeave}
        isSceneLoading={isSceneLoading}
        langCode={langCode}
        loadError={loadError}
        me={me}
        newName={newName}
        peers={peers}
        theme={theme}
        onBackClick={handleBackClick}
        onCanvasChange={handleCanvasChange}
        onCanvasDropCapture={handleCanvasDropCapture}
        onExportClick={handleExportClick}
        onLibraryChange={handleLibraryChange}
        onNavigateHome={() => navigate("/")}
        onNewNameChange={setNewName}
        onPointerUpdate={onPointerUpdate}
        onRenameBlur={() => setIsRenaming(false)}
        onRenameStart={handleRenameStart}
        onRenameSubmit={handleRenameSubmit}
        onSetExcalidrawAPI={setExcalidrawAPI}
        onSetLangCode={setLangCode}
        gridStep={gridStep}
        onSetGridStep={setGridStep}
        onShareOpen={() => setIsShareOpen(true)}
        isShareOpen={isShareOpen}
        onCloseShare={() => setIsShareOpen(false)}
        onHistoryOpen={() => setIsHistoryOpen(true)}
        onPresentationOpen={() => {
          if (isReady) {
            setStartPresentationImmediately(false);
            setPresentationAPI(excalidrawAPI.current);
          }
        }}
        onAddSlide={(template) => {
          if (!canEdit || !isReady || isHistoryOpen || !excalidrawAPI.current)
            return;
          insertSlideTemplate(excalidrawAPI.current, template);
          editorContainerRef.current
            ?.querySelector<HTMLElement>(".excalidraw")
            ?.focus();
        }}
        onToggleAutoHide={handleToggleAutoHide}
        onToggleTheme={toggleTheme}
      />
      {presentationAPI && (
        <PresentationDialog
          api={presentationAPI}
          startImmediately={startPresentationImmediately}
          canEdit={canEdit}
          drawingName={drawingName}
          onClose={() => setPresentationAPI(null)}
          onEditCanvas={() => {
            requestAnimationFrame(() =>
              editorContainerRef.current
                ?.querySelector<HTMLElement>(".excalidraw")
                ?.focus(),
            );
          }}
        />
      )}
      <FrameAspectRatioGuide
        apiRef={excalidrawAPI}
        isReady={isReady}
        enabled={canEdit && !isHistoryOpen && !presentationAPI}
      />
      <RevealStepControl
        apiRef={excalidrawAPI}
        isReady={isReady}
        enabled={canEdit && !isHistoryOpen && !presentationAPI && !isShareOpen}
      />
      <EditorDialogs
        drawingId={id}
        historyButtonRef={historyButtonRef}
        getCurrentVersion={() => currentDrawingVersionRef.current}
        isHistoryOpen={isHistoryOpen}
        onPreviewHistory={setHistoryPreview}
        onRestoreSnapshot={(snapshotId) =>
          runHistoryRestore(id!, () =>
            api.restoreDrawingSnapshot(id!, snapshotId),
          )
        }
        onCloseHistory={() => setIsHistoryOpen(false)}
      />
    </>
  );
};
