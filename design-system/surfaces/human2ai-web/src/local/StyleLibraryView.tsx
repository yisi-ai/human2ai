"use client";

import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Input, Modal } from "antd";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";

import type {
  StyleCategory,
  StyleEntry,
  StyleReferenceImage,
} from "../../../../../src/domain/style";
import { MAX_STYLE_PROMPT_SUMMARY_LENGTH } from "../../../../../src/domain/style/prompt-summary";
import { BasicButton } from "../vendor/yisiui/runtime/src/components/BasicButton";
import { ImageTitleCard } from "../vendor/yisiui/runtime/src/components/ImageTitleCard";
import { LoadingState } from "../vendor/yisiui/runtime/src/components/LoadingState";
import { TabSwitch } from "../vendor/yisiui/runtime/src/components/TabSwitch";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { ConfirmAction } from "../vendor/yisiui/runtime/src/patterns/ConfirmAction";

import "./StyleLibraryView.css";

type CategoryFilter = "all" | StyleCategory;
type CreatorFilter = "all" | "user" | "agent";

export interface StyleLibraryDraft {
  name: string;
  category: StyleCategory;
  description: string;
  promptSummary: string;
  newReferenceImages: File[];
  removedReferenceImageIds: string[];
}

export interface StyleLibraryLabels {
  newStyle: string;
  editStyle: string;
  name: string;
  namePlaceholder: string;
  category: string;
  allCategories: string;
  visualCategory: string;
  uiCategory: string;
  spatialCategory: string;
  creator: string;
  allCreators: string;
  userCreator: string;
  agentCreator: string;
  references: string;
  noReferences: string;
  addReferences: string;
  removeReference: string;
  pasteHint: string;
  fileTypes: string;
  description: string;
  descriptionPlaceholder: string;
  spatialDescriptionPlaceholder: string;
  promptSummary: string;
  promptSummaryPlaceholder: string;
  searchPlaceholder: string;
  deleteTitle: string;
  deleteDescription: string;
  empty: string;
  noMatches: string;
  loading: string;
  loadFailed: string;
  retry: string;
  save: string;
  cancel: string;
  delete: string;
  operationFailed: string;
  imageInvalid: string;
  openStyle: (name: string) => string;
  closePreview: string;
}

export interface StyleLibraryViewProps {
  styles: readonly StyleEntry[];
  labels: StyleLibraryLabels;
  loading?: boolean;
  errorMessage?: string | null;
  imageUrl: (styleId: string, referenceId: string) => string;
  onCreate?: (draft: StyleLibraryDraft) => Promise<StyleEntry>;
  onUpdate?: (style: StyleEntry, draft: StyleLibraryDraft) => Promise<StyleEntry>;
  onDelete?: (style: StyleEntry) => Promise<void>;
  onRetry?: () => void;
  initialCategory?: StyleCategory;
  selection?: { label: string; onSelect: (style: StyleEntry) => Promise<void> };
}

interface PendingImage {
  file: File;
  previewUrl: string;
}

const acceptedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxImageBytes = 10 * 1024 * 1024;

export function StyleLibraryView({
  styles,
  labels,
  loading = false,
  errorMessage,
  imageUrl,
  onCreate,
  onUpdate,
  onDelete,
  onRetry,
  initialCategory,
  selection,
}: StyleLibraryViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory ?? "all");
  const [creatorFilter, setCreatorFilter] = useState<CreatorFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [activeReferenceId, setActiveReferenceId] = useState<string | null>(null);
  const [editorStyleId, setEditorStyleId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StyleCategory>("visual");
  const [description, setDescription] = useState("");
  const [promptSummary, setPromptSummary] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [removedReferenceIds, setRemovedReferenceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);

  const selectedStyle = styles.find((style) => style.id === selectedStyleId) ?? null;
  const editorStyle = editorStyleId && editorStyleId !== "new"
    ? styles.find((style) => style.id === editorStyleId) ?? null
    : null;
  const visibleReferences = editorStyle?.referenceImages.filter(
    (reference) => !removedReferenceIds.includes(reference.id),
  ) ?? [];
  const activeReference = selectedStyle?.referenceImages.find(
    (reference) => reference.id === activeReferenceId,
  ) ?? selectedStyle?.referenceImages[0] ?? null;
  const filteredStyles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return styles.filter((style) => (
      (categoryFilter === "all" || style.category === categoryFilter)
      && (creatorFilter === "all" || style.creatorType === creatorFilter)
      && (
        !normalizedQuery
        || style.name.toLocaleLowerCase().includes(normalizedQuery)
        || style.description.toLocaleLowerCase().includes(normalizedQuery)
      )
    ));
  }, [categoryFilter, creatorFilter, query, styles]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => () => {
    for (const image of pendingImagesRef.current) {
      URL.revokeObjectURL(image.previewUrl);
    }
  }, []);

  useEffect(() => {
    if (selectedStyleId && !selectedStyle) setSelectedStyleId(null);
  }, [selectedStyle, selectedStyleId]);

  function openCreate(): void {
    resetPendingImages();
    setEditorStyleId("new");
    setName("");
    setCategory("visual");
    setDescription("");
    setPromptSummary("");
    setRemovedReferenceIds([]);
    setActionError(null);
  }

  function openEdit(style: StyleEntry): void {
    resetPendingImages();
    setEditorStyleId(style.id);
    setName(style.name);
    setCategory(style.category);
    setDescription(style.description);
    setPromptSummary(style.promptSummary);
    setRemovedReferenceIds([]);
    setActionError(null);
  }

  function closeEditor(): void {
    if (saving) return;
    resetPendingImages();
    setEditorStyleId(null);
    setRemovedReferenceIds([]);
    setActionError(null);
  }

  function resetPendingImages(): void {
    setPendingImages((current) => {
      for (const image of current) URL.revokeObjectURL(image.previewUrl);
      return [];
    });
  }

  function addFiles(files: readonly File[]): void {
    const valid = files.filter(
      (file) => acceptedImageTypes.has(file.type) && file.size > 0 && file.size <= maxImageBytes,
    );
    if (valid.length !== files.length) setActionError(labels.imageInvalid);
    if (valid.length === 0) return;
    setPendingImages((current) => [
      ...current,
      ...valid.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>): void {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>): void {
    const files = Array.from(event.clipboardData.files).filter((file) => (
      file.type.startsWith("image/")
    ));
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
  }

  async function submitEditor(): Promise<void> {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedDescription || !promptSummary.trim() || saving) return;
    if (editorStyle ? !onUpdate : !onCreate) return;
    setSaving(true);
    setActionError(null);
    const draft: StyleLibraryDraft = {
      name: trimmedName,
      category,
      description: trimmedDescription,
      promptSummary: promptSummary.trim(),
      newReferenceImages: pendingImages.map(({ file }) => file),
      removedReferenceImageIds: removedReferenceIds,
    };
    try {
      const style = editorStyle
        ? await onUpdate!(editorStyle, draft)
        : await onCreate!(draft);
      resetPendingImages();
      setEditorStyleId(null);
      setRemovedReferenceIds([]);
      setSelectedStyleId(style.id);
      setActiveReferenceId(style.referenceImages[0]?.id ?? null);
    } catch {
      setActionError(labels.operationFailed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected(): Promise<void> {
    if (!selectedStyle || deleting || !onDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await onDelete(selectedStyle);
      setSelectedStyleId(null);
      setActiveReferenceId(null);
    } catch {
      setActionError(labels.operationFailed);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "style-library-view",
        name: "StyleLibraryView",
        category: "page",
        origin: "project",
        status: "candidate",
      })}
      className="human2ai-style-library"
    >
      <header className="human2ai-style-library__toolbar">
        <Input
          className="human2ai-style-library__search"
          allowClear
          prefix={<SearchOutlined aria-hidden="true" />}
          value={query}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <TabSwitch
          aria-label={labels.category}
          value={categoryFilter}
          items={[
            { key: "all", label: labels.allCategories, mode: "text-only" },
            { key: "visual", label: labels.visualCategory, mode: "text-only" },
            { key: "ui", label: labels.uiCategory, mode: "text-only" },
            { key: "spatial", label: labels.spatialCategory, mode: "text-only" },
          ]}
          onChange={(value) => setCategoryFilter(value as CategoryFilter)}
        />
        <TabSwitch
          aria-label={labels.creator}
          value={creatorFilter}
          items={[
            { key: "all", label: labels.allCreators, mode: "text-only" },
            { key: "user", label: labels.userCreator, mode: "text-only" },
            { key: "agent", label: labels.agentCreator, mode: "text-only" },
          ]}
          onChange={(value) => setCreatorFilter(value as CreatorFilter)}
        />
        {onCreate ? <BasicButton
          type="primary"
          mode="with-icon"
          icon={<PlusOutlined aria-hidden="true" />}
          backgroundColor="color.action.primaryActive"
          textColor="color.text.onPrimary"
          onClick={openCreate}
        >
          {labels.newStyle}
        </BasicButton> : null}
      </header>

      {loading ? (
        <LoadingState label={labels.loading} rows={5} />
      ) : errorMessage ? (
        <div className="human2ai-style-library__page-state" role="alert">
          <span>{labels.loadFailed}</span>
          {onRetry ? (
            <BasicButton
              type="text"
              mode="with-icon"
              icon={<ReloadOutlined aria-hidden="true" />}
              onClick={onRetry}
            >
              {labels.retry}
            </BasicButton>
          ) : null}
        </div>
      ) : filteredStyles.length === 0 ? (
        <div className="human2ai-style-library__page-state">
          {styles.length === 0 ? labels.empty : labels.noMatches}
        </div>
      ) : (
        <div className="human2ai-style-library__grid">
          {filteredStyles.map((style) => {
            const cover = style.referenceImages[0];
            return (
              <div className="human2ai-style-library__card" key={style.id}>
                <ImageTitleCard
                  images={style.referenceImages.slice(0, 3).map((reference) => (
                    <img
                      key={reference.id}
                      src={imageUrl(style.id, reference.id)}
                      alt=""
                    />
                  ))}
                  title={style.name}
                />
                <button
                  className="human2ai-style-library__card-trigger"
                  type="button"
                  aria-label={labels.openStyle(style.name)}
                  onClick={() => {
                    setSelectedStyleId(style.id);
                    setActiveReferenceId(cover?.id ?? null);
                    setActionError(null);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(selectedStyle)}
        centered
        width={1120}
        title={selectedStyle ? (
          <div className="human2ai-style-library__preview-heading">
            <span className="human2ai-style-library__preview-title">{selectedStyle.name}</span>
            <span className="human2ai-style-library__badges">
              <span>{categoryLabel(selectedStyle.category, labels)}</span>
              <span>{creatorLabel(selectedStyle.creatorType, labels)}</span>
            </span>
          </div>
        ) : null}
        closeIcon={<CloseOutlined aria-label={labels.closePreview} />}
        footer={selectedStyle ? (
          <div className="human2ai-style-library__preview-actions">
            {onDelete ? <ConfirmAction
              type="text"
              icon={<DeleteOutlined aria-hidden="true" />}
              title={labels.deleteTitle}
              description={labels.deleteDescription}
              scopeLabel={selectedStyle.name}
              confirmLabel={labels.delete}
              cancelLabel={labels.cancel}
              loading={deleting}
              onConfirm={deleteSelected}
            >
              {labels.delete}
            </ConfirmAction> : null}
            {onUpdate ? <BasicButton
              type="primary"
              mode="with-icon"
              icon={<EditOutlined aria-hidden="true" />}
              backgroundColor="color.action.primaryActive"
              textColor="color.text.onPrimary"
              onClick={() => openEdit(selectedStyle)}
            >
              {labels.editStyle}
            </BasicButton> : null}
            {selection ? (
              <BasicButton
                className="human2ai-style-library__select-action"
                type="primary"
                loading={saving}
                backgroundColor="color.action.primaryActive"
                textColor="color.text.onPrimary"
                onClick={async () => {
                  if (saving) return;
                  setSaving(true);
                  setActionError(null);
                  try {
                    await selection.onSelect(selectedStyle);
                    setSelectedStyleId(null);
                  } catch {
                    setActionError(labels.operationFailed);
                  } finally {
                    setSaving(false);
                  }
                }}
              >{selection.label}</BasicButton>
            ) : null}
          </div>
        ) : null}
        onCancel={() => {
          if (!deleting && !saving) {
            setSelectedStyleId(null);
            setActiveReferenceId(null);
            setActionError(null);
          }
        }}
      >
        {selectedStyle ? (
          <div className="human2ai-style-library__preview">
            <section aria-labelledby="style-preview-references">
              <h2 id="style-preview-references">{labels.references}</h2>
              {activeReference ? (
                <>
                  <div className="human2ai-style-library__active-reference">
                    <img
                      src={imageUrl(selectedStyle.id, activeReference.id)}
                      alt={selectedStyle.name}
                    />
                  </div>
                  {selectedStyle.referenceImages.length > 1 ? (
                    <div className="human2ai-style-library__thumbnails">
                      {selectedStyle.referenceImages.map((reference, index) => (
                        <button
                          key={reference.id}
                          type="button"
                          aria-label={`${labels.references} ${index + 1}`}
                          aria-pressed={reference.id === activeReference.id}
                          onClick={() => setActiveReferenceId(reference.id)}
                        >
                          <img src={imageUrl(selectedStyle.id, reference.id)} alt="" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="human2ai-style-library__no-reference">
                  {labels.noReferences}
                </div>
              )}
            </section>
            <section
              className="human2ai-style-library__specification"
              aria-labelledby="style-preview-description"
              tabIndex={0}
            >
              <h2 id="style-preview-description">{labels.description}</h2>
              <p className="human2ai-style-library__description">
                {selectedStyle.description}
              </p>
              <h2>{labels.promptSummary}</h2>
              <p className="human2ai-style-library__description">{selectedStyle.promptSummary}</p>
            </section>
          </div>
        ) : null}
        {actionError && selectedStyle ? (
          <p className="human2ai-style-library__error" role="alert">{actionError}</p>
        ) : null}
      </Modal>

      <Modal
        open={editorStyleId !== null}
        title={editorStyle ? labels.editStyle : labels.newStyle}
        footer={null}
        onCancel={closeEditor}
      >
        <div
          className="human2ai-style-library__editor"
          onPaste={handlePaste}
        >
          <label>
            <span>{labels.name}</span>
            <Input
              autoFocus
              value={name}
              maxLength={200}
              placeholder={labels.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="human2ai-style-library__field">
            <span>{labels.category}</span>
            <TabSwitch
              aria-label={labels.category}
              value={category}
              items={[
                { key: "visual", label: labels.visualCategory, mode: "text-only" },
                { key: "ui", label: labels.uiCategory, mode: "text-only" },
                { key: "spatial", label: labels.spatialCategory, mode: "text-only" },
              ]}
              onChange={(value) => setCategory(value as StyleCategory)}
            />
          </div>
          <label>
            <span>{labels.description}</span>
            <Input.TextArea
              value={description}
              maxLength={20_000}
              autoSize={{ minRows: 6, maxRows: 14 }}
              placeholder={category === "spatial" ? labels.spatialDescriptionPlaceholder : labels.descriptionPlaceholder}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="human2ai-style-library__field">
            <span>{labels.references}</span>
            <div className="human2ai-style-library__editor-references">
              {visibleReferences.map((reference) => (
                <EditorReference
                  key={reference.id}
                  reference={reference}
                  previewUrl={imageUrl(reference.styleId, reference.id)}
                  removeLabel={labels.removeReference}
                  onRemove={() => setRemovedReferenceIds((current) => [
                    ...current,
                    reference.id,
                  ])}
                />
              ))}
              {pendingImages.map((image) => (
                <EditorReference
                  key={image.previewUrl}
                  previewUrl={image.previewUrl}
                  removeLabel={labels.removeReference}
                  onRemove={() => {
                    URL.revokeObjectURL(image.previewUrl);
                    setPendingImages((current) => current.filter(
                      (candidate) => candidate !== image,
                    ));
                  }}
                />
              ))}
              <button
                className="human2ai-style-library__add-reference"
                type="button"
                onClick={() => fileInput.current?.click()}
              >
                <PlusOutlined aria-hidden="true" />
                <span>{labels.addReferences}</span>
              </button>
            </div>
            <input
              ref={fileInput}
              className="human2ai-style-library__file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleFiles}
            />
            <span className="human2ai-style-library__image-hint">
              {labels.pasteHint} {labels.fileTypes}
            </span>
          </div>
          <label>
            <span>{labels.promptSummary}</span>
            <Input.TextArea
              value={promptSummary}
              maxLength={MAX_STYLE_PROMPT_SUMMARY_LENGTH}
              autoSize={{ minRows: 2, maxRows: 3 }}
              placeholder={labels.promptSummaryPlaceholder}
              onChange={(event) => setPromptSummary(event.target.value)}
            />
          </label>
          {actionError ? (
            <p className="human2ai-style-library__error" role="alert">{actionError}</p>
          ) : null}
          <div className="human2ai-style-library__editor-actions">
            <BasicButton disabled={saving} onClick={closeEditor}>
              {labels.cancel}
            </BasicButton>
            <BasicButton
              type="primary"
              loading={saving}
              disabled={!name.trim() || !description.trim() || !promptSummary.trim()}
              backgroundColor="color.action.primaryActive"
              textColor="color.text.onPrimary"
              onClick={() => void submitEditor()}
            >
              {labels.save}
            </BasicButton>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function EditorReference({
  reference,
  previewUrl,
  removeLabel,
  onRemove,
}: {
  reference?: StyleReferenceImage;
  previewUrl: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <div className="human2ai-style-library__editor-reference">
      <img src={previewUrl} alt="" />
      <button type="button" aria-label={removeLabel} onClick={onRemove}>
        <CloseOutlined aria-hidden="true" />
      </button>
      {reference ? <span>{reference.position + 1}</span> : null}
    </div>
  );
}

function categoryLabel(category: StyleCategory, labels: StyleLibraryLabels): string {
  return { visual: labels.visualCategory, ui: labels.uiCategory, spatial: labels.spatialCategory }[category];
}

function creatorLabel(
  creator: "user" | "agent",
  labels: StyleLibraryLabels,
): string {
  return creator === "user" ? labels.userCreator : labels.agentCreator;
}
