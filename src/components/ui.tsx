import {
  type ChangeEvent,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API_ORIGIN } from "../config";
import { FLAG_KEYS, FLAG_LABELS, type Flags, type PhotoDraft } from "../types";
import {
  createPhotoDraftFromUrl,
  createPhotoDraftsFromFiles,
  formatDate,
  formatNumber,
  hasAnyFlag,
  releasePhotoDrafts,
} from "../lib/recipeRules";

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions?: ReactNode;
  "data-testid"?: string;
}

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warn";
}

interface FlagChipsProps {
  flags: Flags;
  availableFlags?: Flags;
}

interface NutritionStripProps {
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  unit: string;
}

interface PhotoGalleryProps {
  photos: string[];
  alt: string;
  compact?: boolean;
}

interface PhotoEditorProps {
  photos: PhotoDraft[];
  onChange: (nextPhotos: PhotoDraft[]) => void;
  error?: string;
  allowUrlInput?: boolean;
  helperText?: string;
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  actions,
  children,
  ...rest
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      {...rest}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            aria-label="Закрыть окно"
          >
            Закрыть
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function FieldErrorText({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return <p className="field-error">{error}</p>;
}

export function SectionMessage({
  tone,
  children,
}: PropsWithChildren<{ tone: "success" | "error" | "info" }>) {
  return <div className={`section-message section-message-${tone}`}>{children}</div>;
}

export function FlagChips({ flags, availableFlags }: FlagChipsProps) {
  if (!hasAnyFlag(flags)) {
    return (
      <div className="flag-row">
        <Badge>Без специальных флагов</Badge>
        {availableFlags ? (
          <span className="subtle-hint">
            Доступно:{" "}
            {FLAG_KEYS.filter((key) => availableFlags[key])
              .map((key) => FLAG_LABELS[key])
              .join(", ") || "ничего"}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flag-row">
      {FLAG_KEYS.filter((key) => flags[key]).map((key) => (
        <Badge key={key} tone="success">
          {FLAG_LABELS[key]}
        </Badge>
      ))}
      {availableFlags ? (
        <span className="subtle-hint">
          Доступно:{" "}
          {FLAG_KEYS.filter((key) => availableFlags[key])
            .map((key) => FLAG_LABELS[key])
            .join(", ") || "ничего"}
        </span>
      ) : null}
    </div>
  );
}

export function NutritionStrip({
  calories,
  proteins,
  fats,
  carbohydrates,
  unit,
}: NutritionStripProps) {
  return (
    <div className="nutrition-strip">
      <div>
        <span>Калории</span>
        <strong>
          {formatNumber(calories)} {unit}
        </strong>
      </div>
      <div>
        <span>Белки</span>
        <strong>{formatNumber(proteins)} г</strong>
      </div>
      <div>
        <span>Жиры</span>
        <strong>{formatNumber(fats)} г</strong>
      </div>
      <div>
        <span>Углеводы</span>
        <strong>{formatNumber(carbohydrates)} г</strong>
      </div>
    </div>
  );
}

export function MetaList({
  createdAt,
  updatedAt,
}: {
  createdAt: string;
  updatedAt: string | null;
}) {
  return (
    <div className="meta-list">
      <div>
        <span>Создано</span>
        <strong>{formatDate(createdAt)}</strong>
      </div>
      <div>
        <span>Изменено</span>
        <strong>{formatDate(updatedAt)}</strong>
      </div>
    </div>
  );
}

export function PhotoGallery({
  photos,
  alt,
  compact = false,
}: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <div className={`photo-gallery ${compact ? "compact" : ""}`}>
        <div className="photo-placeholder">Без фото</div>
      </div>
    );
  }

  return (
    <div className={`photo-gallery ${compact ? "compact" : ""}`}>
      {photos.map((photo, index) => (
        <ImageWithFallback
          key={`${photo}-${index}`}
          photo={photo}
          alt={`${alt} ${index + 1}`}
        />
      ))}
    </div>
  );
}

export function PhotoEditor({
  photos,
  onChange,
  error,
  allowUrlInput = true,
  helperText = "До 5 фото. Можно смешивать ссылки и локальные изображения.",
}: PhotoEditorProps) {
  const [url, setUrl] = useState("");
  const remainingSlots = Math.max(0, 5 - photos.length);

  function applyNext(nextPhotos: PhotoDraft[]) {
    if (nextPhotos.length <= 5) {
      onChange(nextPhotos);
      return;
    }

    const allowed = nextPhotos.slice(0, 5);
    const dropped = nextPhotos.slice(5);
    releasePhotoDrafts(dropped);
    onChange(allowed);
  }

  function handleAddFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length || remainingSlots === 0) {
      return;
    }

    const drafts = createPhotoDraftsFromFiles(event.target.files);
    applyNext([...photos, ...drafts]);
    event.target.value = "";
  }

  function handleAddUrl() {
    if (!url.trim() || remainingSlots === 0) {
      return;
    }

    applyNext([...photos, createPhotoDraftFromUrl(url.trim())]);
    setUrl("");
  }

  function handleRemove(photoId: string) {
    const removed = photos.find((photo) => photo.id === photoId);

    if (removed) {
      releasePhotoDrafts([removed]);
    }

    onChange(photos.filter((photo) => photo.id !== photoId));
  }

  return (
    <div className="photo-editor">
      <div className="photo-editor-toolbar">
        {allowUrlInput ? (
          <div className="photo-url-row">
            <input
              type="url"
              placeholder="https://example.com/photo.jpg"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={remainingSlots === 0}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={handleAddUrl}
              disabled={remainingSlots === 0 || !url.trim()}
            >
              Добавить ссылку
            </button>
          </div>
        ) : null}
        <label className={`upload-button ${remainingSlots === 0 ? "disabled" : ""}`}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddFiles}
            disabled={remainingSlots === 0}
          />
          Загрузить файлы
        </label>
      </div>
      <p className="subtle-hint">{helperText}</p>
      {error ? <FieldErrorText error={error} /> : null}
      <div className="photo-draft-grid">
        {photos.length === 0 ? (
          <div className="photo-draft-empty">Фото пока не добавлены</div>
        ) : (
          photos.map((photo) => (
            <div key={photo.id} className="photo-draft-card">
              <ImageWithFallback photo={photo.previewUrl} alt={photo.label} />
              <div className="photo-draft-foot">
                <span>{photo.kind === "file" ? photo.label : "Ссылка"}</span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => handleRemove(photo.id)}
                >
                  Убрать
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ImageWithFallback({ photo, alt }: { photo: string; alt: string }) {
  const sources = useMemo(() => buildPhotoCandidates(photo), [photo]);
  const [index, setIndex] = useState(0);

  return (
    <img
      className="photo-image"
      src={sources[index]}
      alt={alt}
      onError={() => {
        if (index < sources.length - 1) {
          setIndex(index + 1);
        }
      }}
    />
  );
}

function buildPhotoCandidates(photo: string): string[] {
  if (/^(blob:|data:|https?:\/\/)/i.test(photo)) {
    return [photo];
  }

  if (photo.startsWith("/")) {
    return [`${API_ORIGIN}${photo}`];
  }

  return [photo];
}
